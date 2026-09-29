// Measure every shape feature on the human baselines and the AI sets, and say
// which may ship as a tell.
//
//   pnpm --filter @domandigital/craft build && node scripts/shape/measure.mjs [--boot 300]
//
// Effect sizes are register-matched: AI marketing genres against UK small-business
// pages, AI email genres against Enron. Pooling every human register together
// hides a real effect: literary and parliamentary prose are comma-heavy, AI
// email against human email is not.
//
// A feature ships only if all of these hold:
//   in every matched pair, |d| >= 0.8 with the lower 95% bound >= 0.5, same sign;
//   the same sign for every model within each pair, and on the earlier (legacy) sample;
//   a threshold, set on the tuning halves, at which no human register of any
//   kind trips more than 5%, and which still holds at 5% or less on every holdout.
// Everything else is reported as a finding and does not ship.

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LEXICAL_FEATURES, isBlurb, lexicalOf, shapeOf, vocabulary, vocabularyCounts } from "../../dist/index.js";
import { CALIBRATION, FEATURES, SET, flag, htmlProse, isLexicalFile, paragraphs, vector } from "./lib.mjs";

// --lexical measures words and specificity (lexical.ts) instead of sentence shape.
const FEATURE_SET = SET === "lexical" ? [...LEXICAL_FEATURES] : FEATURES;
const SUFFIX = SET === "lexical" ? "-lexical" : "";

const BOOT = Number(flag("boot", 300));
const MIN_REGISTER = 200;
const FP_MAX = 0.05;
if (!Number.isInteger(BOOT) || BOOT < 50) throw new Error("--boot must be an integer of at least 50");
/** Which AI genres are compared with which human register. */
const MATCHED = [
  { register: "marketing", genres: ["service-blurb", "booking-description", "cta-block"] },
  { register: "business-email", genres: ["enquiry-reply", "internal-email"] },
];
const LEGACY = "legacy-2026-09-23";

// ------------------------------------------------------------- data

/** Derived features, computed from a stored vector so human and AI get the same. */
const DERIVED = SET === "lexical" ? {} : {
  shapeStack: (v) => {
    const at = (k) => v[FEATURES.indexOf(k)] ?? 0;
    return (at("tricolons") > 0 ? 1 : 0) + (at("stackedConditionals") > 0 ? 1 : 0) + (at("hedgedClose") > 0 ? 1 : 0) + (at("participialRate") > 0 ? 1 : 0);
  },
};
const ALL = [...FEATURE_SET, ...Object.keys(DERIVED)];
const withDerived = (v) => [...v.slice(0, FEATURE_SET.length), ...Object.values(DERIVED).map((f) => f(v))];

/** Per register: kept blurbs and how many contain each listed word (lexical runs only). */
const humanWords = {};

function loadHuman() {
  const dir = join(CALIBRATION, "human");
  const out = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json") && isLexicalFile(f) === (SET === "lexical"))) {
    const b = JSON.parse(readFileSync(join(dir, file), "utf8"));
    if (b.wordDocs) {
      const w = (humanWords[b.register] ??= { blurbs: 0, docs: {} });
      w.blurbs += b.counts.blurbs;
      for (const [k, n] of Object.entries(b.wordDocs)) w.docs[k] = (w.docs[k] ?? 0) + n;
    }
    const tagAt = b.features.indexOf("tag");
    for (const half of ["tuning", "holdout"]) {
      for (const row of b[half]) out.push({ register: b.register, source: b.source, tag: tagAt === -1 ? null : row[tagAt], half, v: withDerived(row) });
    }
  }
  return out;
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const blurbVectors = (paras) =>
  paras.flatMap((p) => {
    const f = shapeOf(p);
    if (!isBlurb(f)) return [];
    if (SET === "lexical") {
      const lf = lexicalOf(p);
      return [{ v: withDerived(LEXICAL_FEATURES.map((k) => lf[k])), words: [...vocabularyCounts(p).keys()] }];
    }
    return [{ v: withDerived(vector(f)), words: [] }];
  });

function loadAi() {
  const root = join(CALIBRATION, "ai");
  const out = [];
  for (const path of walk(root).filter((p) => p.endsWith(".txt"))) {
    const [provider, model, genre] = path.slice(root.length + 1).split("/");
    const edited = path.endsWith(".edited.txt");
    for (const b of blurbVectors(paragraphs(readFileSync(path, "utf8")))) out.push({ provider, model, genre, edited, ...b });
  }
  // The earlier generation: 160 landing pages under calibration/ (Opus 4.x era), body prose only.
  const legacy = [...walk(join(CALIBRATION, "..", "ai-set")), ...walk(join(CALIBRATION, "..", "null"))].filter((p) => p.endsWith(".html"));
  for (const path of legacy) {
    for (const b of blurbVectors(htmlProse(readFileSync(path, "utf8")))) out.push({ provider: "claude", model: "legacy-2026-09-23", genre: "landing-page", edited: false, ...b });
  }
  return out;
}

// ------------------------------------------------------------- statistics

const col = (rows, i) => rows.map((r) => r.v[i]).filter((x) => x !== null && x !== undefined && Number.isFinite(x));
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const variance = (xs, m = mean(xs)) => xs.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, xs.length - 1);

function cohenD(a, b) {
  if (a.length < 2 || b.length < 2) return null;
  const pooled = Math.sqrt(((a.length - 1) * variance(a) + (b.length - 1) * variance(b)) / (a.length + b.length - 2));
  return pooled === 0 ? 0 : (mean(a) - mean(b)) / pooled;
}

/** P(a > b) + P(a = b) / 2, by ranks with ties averaged. */
function auc(a, b) {
  if (a.length === 0 || b.length === 0) return null;
  const all = [...a.map((x) => [x, 0]), ...b.map((x) => [x, 1])].sort((p, q) => p[0] - q[0]);
  let rankA = 0;
  for (let i = 0; i < all.length; ) {
    let j = i;
    while (j < all.length && all[j][0] === all[i][0]) j += 1;
    const avg = (i + j + 1) / 2;
    for (let k = i; k < j; k += 1) if (all[k][1] === 0) rankA += avg;
    i = j;
  }
  return (rankA - (a.length * (a.length + 1)) / 2) / (a.length * b.length);
}

let seed = 7;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const resample = (xs) => Array.from({ length: xs.length }, () => xs[Math.floor(rand() * xs.length)]);
const quantile = (xs, q) => {
  const s = [...xs].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))];
};

function withCi(a, b) {
  const d = cohenD(a, b);
  const u = auc(a, b);
  if (d === null) return { d: null, auc: null };
  // Bootstrap a capped sample of each side: enough for a stable interval, quick enough to run 17 features.
  const cap = (xs) => (xs.length > 4000 ? resample(xs).slice(0, 4000) : xs);
  const ds = [];
  const us = [];
  for (let i = 0; i < BOOT; i += 1) {
    const ra = resample(cap(a));
    const rb = resample(cap(b));
    ds.push(cohenD(ra, rb));
    us.push(auc(ra, rb));
  }
  return { d, dLo: quantile(ds, 0.025), dHi: quantile(ds, 0.975), auc: u, aucLo: quantile(us, 0.025), aucHi: quantile(us, 0.975) };
}

const share = (xs, hit) => (xs.length === 0 ? null : xs.filter(hit).length / xs.length);

/**
 * The loosest threshold at which no human register (tuning half) trips more
 * than 5%. `up` when the AI side is higher: flag values >= t.
 */
function threshold(i, up, humanTuningByRegister) {
  // Work in "higher is flagged" space; a lower-in-AI feature is negated.
  const s = up ? 1 : -1;
  let t = -Infinity;
  for (const xs of Object.values(humanTuningByRegister)) {
    if (xs.length === 0) continue;
    const sorted = xs.map((x) => s * x).sort((a, b) => b - a);
    const allowed = Math.floor(FP_MAX * sorted.length);
    // The smallest observed value v with count(x >= v) <= allowed. If the very top
    // value is too common (a binary feature at 12%), nothing observed works.
    let best = null;
    for (let k = 0; k < sorted.length; ) {
      let j = k;
      while (j < sorted.length && sorted[j] === sorted[k]) j += 1;
      if (j > allowed) break;
      best = sorted[k];
      k = j;
    }
    if (best === null) return { never: true };
    if (best > t) t = best;
  }
  if (!Number.isFinite(t)) return null;
  const cut = s * t;
  return { t: Math.round(cut * 1000) / 1000, hit: up ? (x) => x >= cut : (x) => x <= cut };
}

// ------------------------------------------------------------- run

const human = loadHuman();
const ai = loadAi();
const registers = [...new Set(human.map((h) => h.register))].filter((r) => human.filter((h) => h.register === r).length >= MIN_REGISTER);
const aiOriginal = ai.filter((x) => !x.edited);
const aiEdited = ai.filter((x) => x.edited);
const fresh = aiOriginal.filter((x) => x.model !== "legacy-2026-09-23");
const models = [...new Set(aiOriginal.map((x) => x.model))];
const genres = [...new Set(aiOriginal.map((x) => x.genre))];
// A partially generated set cannot approve tells: every configured piece
// needs both its original and edit pass, even when that piece is too short
// to produce a blurb vector.
const config = JSON.parse(readFileSync(join(CALIBRATION, "briefs.json"), "utf8"));
let expectedPieces = 0;
let completePieces = 0;
for (const [provider, configuredModels] of Object.entries(config.models)) {
  for (const model of configuredModels) for (const genre of Object.keys(config.genres)) for (const brief of Object.keys(config.briefs)) {
    expectedPieces += 1;
    const original = join(CALIBRATION, "ai", provider, model, genre, `${brief}.txt`);
    const edited = original.replace(/\.txt$/, ".edited.txt");
    if (existsSync(original) && existsSync(edited) && readFileSync(original, "utf8").trim() && readFileSync(edited, "utf8").trim()) completePieces += 1;
  }
}
const generation = { expectedPieces, completePieces, complete: expectedPieces > 0 && completePieces === expectedPieces };

console.error(`measure: ${human.length} human blurbs (${registers.join(", ")}), ${aiOriginal.length} AI blurbs, ${aiEdited.length} edited`);

const results = [];
const pairs = MATCHED.filter((m) => registers.includes(m.register));
const missing = MATCHED.filter((m) => !registers.includes(m.register)).map((m) => m.register);
if (missing.length) console.error(`measure: no ${missing.join(", ")} baseline yet: those pairs are not measured, and nothing can ship`);

for (const [i, feature] of ALL.entries()) {
  const tuning = (r) => col(human.filter((h) => h.half === "tuning" && h.register === r), i);
  const aiIn = (genres, rows = fresh) => col(rows.filter((x) => genres.includes(x.genre)), i);

  const matched = Object.fromEntries(pairs.map((m) => [m.register, withCi(aiIn(m.genres), tuning(m.register))]));
  const ds = Object.values(matched).map((x) => x.d).filter((d) => d !== null);
  const sign = ds.length && ds.every((d) => Math.sign(d) === Math.sign(ds[0])) ? Math.sign(ds[0]) : 0;
  const up = sign >= 0;

  const byModel = Object.fromEntries(
    models
      .filter((m) => m !== LEGACY)
      .flatMap((m) => pairs.map((p) => [`${m} / ${p.register}`, cohenD(aiIn(p.genres, aiOriginal.filter((x) => x.model === m)), tuning(p.register))])),
  );
  const byGenre = Object.fromEntries(pairs.flatMap((p) => p.genres.map((g) => [g, cohenD(aiIn([g]), tuning(p.register))])));
  const legacy = registers.includes("marketing") ? cohenD(col(aiOriginal.filter((x) => x.model === LEGACY), i), tuning("marketing")) : null;
  const byRegister = Object.fromEntries(registers.map((r) => [r, cohenD(col(fresh, i), tuning(r))]));
  const editedMatched = Object.fromEntries(pairs.map((m) => [m.register, cohenD(aiIn(m.genres, aiEdited), tuning(m.register))]));

  const found = threshold(i, up, Object.fromEntries(registers.map((r) => [r, tuning(r)])));
  const cut = found && !found.never ? found : null;
  const holdoutFp = cut ? Object.fromEntries(registers.map((r) => [r, share(col(human.filter((h) => h.half === "holdout" && h.register === r), i), cut.hit)])) : null;
  // Informational, not a ship rule: the threshold that holds only the matched human register at 5%.
  const matchedGate = Object.fromEntries(pairs.map((p) => {
    const g = threshold(i, up, { [p.register]: tuning(p.register) });
    const c = g && !g.never ? g : null;
    return [p.register, c && {
      t: c.t,
      holdoutFp: share(col(human.filter((h) => h.half === "holdout" && h.register === p.register), i), c.hit),
      tpr: share(aiIn(p.genres), c.hit),
      tprEdited: share(aiIn(p.genres, aiEdited), c.hit),
    }];
  }));
  const targetGenres = pairs.flatMap((p) => p.genres);
  const tpr = cut ? share(aiIn(targetGenres), cut.hit) : null;
  const tprEdited = cut ? share(aiIn(targetGenres, aiEdited), cut.hit) : null;

  const reasons = [];
  if (!generation.complete) reasons.push(`generation incomplete: ${completePieces}/${expectedPieces} original/edit pairs`);
  if (pairs.length < MATCHED.length) reasons.push(`no ${missing.join(", ")} baseline`);
  for (const [r, m] of Object.entries(matched)) {
    if (m.d === null) {
      reasons.push(`${r}: no AI sample`);
      continue;
    }
    if (Math.abs(m.d) < 0.8) reasons.push(`${r}: |d| ${Math.abs(m.d).toFixed(2)} < 0.8`);
    const lower = m.d >= 0 ? m.dLo : -m.dHi;
    if (lower < 0.5) reasons.push(`${r}: lower bound ${lower.toFixed(2)} < 0.5`);
  }
  if (sign === 0) reasons.push("sign differs between registers");
  const signs = [...Object.values(byModel), ...Object.values(byGenre), ...(legacy === null ? [] : [legacy])];
  if (sign !== 0 && signs.some((d) => d === null || Math.sign(d) !== sign)) reasons.push("sign differs by model, genre or on the legacy sample");
  if (!cut) reasons.push("no threshold keeps every human register at 5% or less");
  else if (Object.values(holdoutFp).some((fp) => fp > FP_MAX)) reasons.push("a holdout half trips above 5%");
  if (feature === "skeletonRepeat") reasons.push("experimental: reported, never shipped");

  results.push({
    feature,
    direction: sign === 0 ? "mixed" : up ? "higher in AI" : "lower in AI",
    matched,
    byModel,
    byGenre,
    legacy,
    byRegister,
    editedMatched,
    threshold: cut ? cut.t : null,
    holdoutFp,
    matchedGate,
    tpr,
    tprEdited,
    ships: reasons.length === 0,
    reasons,
  });
}

// ------------------------------------------------------------- write

const f2 = (x) => (x === null || x === undefined ? "–" : x.toFixed(2));
const pct = (x) => (x === null || x === undefined ? "–" : `${(100 * x).toFixed(1)}%`);
// Intervals for each displayed stratum, not only the pooled matched pairs.
for (const [i, r] of results.entries()) {
  const tune = (register) => col(human.filter((h) => h.half === "tuning" && h.register === register), i);
  r.byModelStats = Object.fromEntries(models.filter((m) => m !== LEGACY).flatMap((model) => pairs.map((p) => [
    `${model} / ${p.register}`, withCi(col(fresh.filter((x) => x.model === model && p.genres.includes(x.genre)), i), tune(p.register)),
  ])));
  r.byGenreStats = Object.fromEntries(pairs.flatMap((p) => p.genres.map((genre) => [
    genre, withCi(col(fresh.filter((x) => x.genre === genre), i), tune(p.register)),
  ])));
  r.byRegisterStats = Object.fromEntries(registers.map((register) => [register, withCi(col(fresh, i), tune(register))]));
}
const counts = {
  human: Object.fromEntries([...new Set(human.map((h) => h.register))].map((r) => [r, human.filter((h) => h.register === r).length])),
  ai: Object.fromEntries(models.map((m) => [m, aiOriginal.filter((x) => x.model === m).length])),
  edited: aiEdited.length,
};
writeFileSync(join(CALIBRATION, `report${SUFFIX}.json`), `${JSON.stringify({ measuredAt: new Date().toISOString().slice(0, 10), boot: BOOT, generation, counts, results }, null, 1)}\n`);

const lines = [
  SET === "lexical" ? "# Lexical and specificity features: human baselines against AI copy" : "# Shape features: human baselines against AI copy",
  "",
  `Measured ${new Date().toISOString().slice(0, 10)} by \`scripts/shape/measure.mjs\`, ${BOOT} bootstrap resamples. Generated from \`report${SUFFIX}.json\`; do not edit by hand.`,
  "",
  `Generation: ${completePieces}/${expectedPieces} original/edit pairs complete. ${generation.complete ? "Complete." : "Preliminary report: no feature can ship until generation is complete."}`,
  "",
  "## Samples (blurb-sized paragraphs)",
  "",
  "| Side | Set | Blurbs |",
  "| --- | --- | ---: |",
  ...Object.entries(counts.human).map(([r, n]) => `| human | ${r}${registers.includes(r) ? "" : " (below the minimum, not gated)"} | ${n} |`),
  ...Object.entries(counts.ai).map(([m, n]) => `| AI | ${m} | ${n} |`),
  `| AI | edited ("sound more human") | ${counts.edited} |`,
  "",
  "## Every feature",
  "",
  `Effect sizes are register-matched: ${MATCHED.map((m) => `${m.genres.join(", ")} against ${m.register}`).join("; ")}. d with its 95% bootstrap interval. The threshold is the loosest at which no human register's tuning half, of any kind, trips more than 5%. TPR is the share of matched AI blurbs it catches; *edited* is after the edit pass.`,
  "",
  `| Feature | Direction | ${pairs.map((p) => `d ${p.register} [95% CI]`).join(" | ")} | ${pairs.map((p) => `edited d ${p.register}`).join(" | ")} | Legacy d | Threshold | Worst holdout FP | TPR | TPR edited | Ships |`,
  `| --- | --- | ${pairs.map(() => "---").join(" | ")} | ${pairs.map(() => "---:").join(" | ")} | ---: | ---: | ---: | ---: | ---: | --- |`,
  ...results.map(
    (r) =>
      `| \`${r.feature}\` | ${r.direction} | ${pairs.map((p) => { const m = r.matched[p.register]; return `${f2(m.d)} [${f2(m.dLo)}, ${f2(m.dHi)}]`; }).join(" | ")} | ${pairs.map((p) => f2(r.editedMatched[p.register])).join(" | ")} | ${f2(r.legacy)} | ${r.threshold ?? "–"} | ${r.holdoutFp ? pct(Math.max(...Object.values(r.holdoutFp))) : "–"} | ${pct(r.tpr)} | ${pct(r.tprEdited)} | ${r.ships ? "**yes**" : `no: ${r.reasons.join("; ")}`} |`,
  ),
  "",
  "## By model and genre (d against the matched register)",
  "",
  "| Feature | Model / register | d |",
  "| --- | --- | ---: |",
  ...results.flatMap((r) => Object.entries({ ...r.byModel, ...r.byGenre }).map(([k, d]) => `| \`${r.feature}\` | ${k} | ${f2(d)} |`)),
  "",
  "## By human register (d, all fresh AI against that register)",
  "",
  `| Feature | ${registers.join(" | ")} |`,
  `| --- | ${registers.map(() => "---:").join(" | ")} |`,
  ...results.map((r) => `| \`${r.feature}\` | ${registers.map((g) => f2(r.byRegister[g])).join(" | ")} |`),
  "",
];
lines.push(
  "## Stratified d and AUC intervals",
  "",
  "AUC is P(AI > human), with ties shared; values below 0.5 indicate lower values in AI. These are paragraph-level bootstrap intervals, not writer-level intervals.",
  "",
  "| Feature | Stratum | d [95% CI] | AUC [95% CI] |",
  "| --- | --- | --- | --- |",
  ...results.flatMap((r) => Object.entries({ ...r.byModelStats, ...r.byGenreStats, ...r.byRegisterStats }).map(([name, s]) =>
    `| \`${r.feature}\` | ${name} | ${f2(s.d)} [${f2(s.dLo)}, ${f2(s.dHi)}] | ${f2(s.auc)} [${f2(s.aucLo)}, ${f2(s.aucHi)}] |`,
  )),
  "",
  "## Edit survival",
  "",
  "| Feature | Original TPR | After edit TPR |",
  "| --- | ---: | ---: |",
  ...results.map((r) => `| \`${r.feature}\` | ${pct(r.tpr)} | ${pct(r.tprEdited)} |`),
  "",
);

// Informational: the same features with the gate applied to the matched register alone.
lines.push(
  "## Matched-register gate (informational, not a ship rule)",
  "",
  "The ship rule holds every human register, literary and parliamentary included, at 5%. This shows what the threshold would catch if only the matched register had to hold at 5% on its tuning half. False positives are on that register's holdout half.",
  "",
  "| Feature | Register | Threshold | Holdout FP | TPR | TPR edited |",
  "| --- | --- | ---: | ---: | ---: | ---: |",
  ...results.flatMap((r) => pairs.map((p) => {
    const g = r.matchedGate[p.register];
    return g ? `| \`${r.feature}\` | ${p.register} | ${g.t} | ${pct(g.holdoutFp)} | ${pct(g.tpr)} | ${pct(g.tprEdited)} |` : `| \`${r.feature}\` | ${p.register} | – | – | – | – |`;
  })),
  "",
);

// Word level (lexical runs): which listed words are common in AI blurbs and rare in every human register.
if (SET === "lexical") {
  const target = fresh.filter((x) => pairs.some((p) => p.genres.includes(x.genre)));
  const edited = aiEdited.filter((x) => pairs.some((p) => p.genres.includes(x.genre)));
  const rate = (rows, w) => (rows.length ? rows.filter((x) => x.words.includes(w)).length / rows.length : 0);
  const words = vocabulary().map(({ word, source }) => {
    const humanRates = Object.fromEntries(Object.entries(humanWords).map(([r, h]) => [r, h.blurbs ? (h.docs[word] ?? 0) / h.blurbs : null]));
    const worst = Math.max(...Object.values(humanRates).map((x) => x ?? 0));
    const ai = rate(target, word);
    return { word, source, ai, aiEdited: rate(edited, word), humanRates, worst, candidate: ai >= 0.015 && worst <= 0.005 };
  }).sort((a, b) => b.ai - a.ai);
  const hr = Object.keys(humanWords);
  lines.push(
    "## Words",
    "",
    `Share of blurbs containing each word: matched AI blurbs (${target.length}) against every human register. A candidate appears in at least 1.5% of matched AI blurbs and in at most 0.5% of every human register. A candidate is a word to consider for a review-tier list, not a tell; the 5% gate above still applies to any rate built from them.`,
    "",
    `| Word | Source | AI | AI edited | ${hr.join(" | ")} | Candidate |`,
    `| --- | --- | ---: | ---: | ${hr.map(() => "---:").join(" | ")} | --- |`,
    ...words.filter((w) => w.ai > 0 || w.worst > 0).map((w) => `| ${w.word} | ${w.source} | ${pct(w.ai)} | ${pct(w.aiEdited)} | ${hr.map((r) => pct(w.humanRates[r])).join(" | ")} | ${w.candidate ? "**yes**" : "no"} |`),
    "",
  );
  writeFileSync(join(CALIBRATION, "report-lexical-words.json"), `${JSON.stringify({ measuredAt: new Date().toISOString().slice(0, 10), aiBlurbs: target.length, humanBlurbs: Object.fromEntries(Object.entries(humanWords).map(([r, h]) => [r, h.blurbs])), words }, null, 1)}\n`);
}
writeFileSync(join(CALIBRATION, `report${SUFFIX}.md`), `${lines.join("\n")}\n`);
console.error(`measure: ${results.filter((r) => r.ships).map((r) => r.feature).join(", ") || "nothing"} ships. See calibration/copy-shape/report${SUFFIX}.md`);
