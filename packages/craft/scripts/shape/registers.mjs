// Register separation: do the frozen human baselines differ from each other
// enough to profile a register?
//
// The detection runs asked "is AI copy outside the human range?" and found no.
// This asks a different question of the same frozen vectors: is plain
// institutional writing measurably different from literary, business email,
// explanatory answers and small-business marketing? A feature earns a place in
// a register profile only if it separates two registers at |d| >= 0.8 on the
// tuning half, with the bootstrap lower bound at 0.5 or more, and holds that on
// the holdout half with the same sign. Same bar as the detection work.
//
// Reads numbers only. No prose exists in these files.
//
//   node scripts/shape/registers.mjs [--boot 200]

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CALIBRATION, flag } from "./lib.mjs";

const BOOT = Number(flag("boot", 200));
// Document level: the mean of K paragraphs drawn from one register's half,
// GROUPS times. Paragraphs are drawn across writers, so this approximates a
// document; it measures how far averaging narrows the spread, not any one text.
const K = Number(flag("k", 5));
const GROUPS = 2000;
const D_MIN = 0.8;
const LO_MIN = 0.5;

// Copied from measure.mjs, which keeps its statistics private. Kept identical
// so a d here means what a d there means.
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const variance = (xs, m = mean(xs)) => xs.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, xs.length - 1);
function cohenD(a, b) {
  if (a.length < 2 || b.length < 2) return null;
  const pooled = Math.sqrt(((a.length - 1) * variance(a) + (b.length - 1) * variance(b)) / (a.length + b.length - 2));
  return pooled === 0 ? 0 : (mean(a) - mean(b)) / pooled;
}
let seed = 7;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const resample = (xs) => Array.from({ length: xs.length }, () => xs[Math.floor(rand() * xs.length)]);
const quantile = (xs, q) => {
  const s = [...xs].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))];
};

// ------------------------------------------------------------- load

const dir = join(CALIBRATION, "human");
const byRegister = {};
for (const name of readdirSync(dir).filter((n) => n.endsWith("-v1.json")).sort()) {
  const file = JSON.parse(readFileSync(join(dir, name), "utf8"));
  const r = (byRegister[file.register] ??= { source: file.source, tuning: {}, holdout: {} });
  for (const half of ["tuning", "holdout"]) {
    for (const [i, feature] of file.features.entries()) {
      r[half][feature] = file[half].map((v) => v[i]).filter((x) => x !== null && x !== undefined && Number.isFinite(x));
    }
  }
}
const registers = Object.keys(byRegister).sort();
// A feature is tested on every pair where both registers carry it: a source not yet
// re-extracted drops out of that feature's pairs, not the whole feature.
const features = [...new Set(registers.flatMap((r) => Object.keys(byRegister[r].tuning)))].filter((f) => f !== "tag");

// ------------------------------------------------------------- measure

function documents(xs) {
  return Array.from({ length: GROUPS }, () => {
    let sum = 0;
    for (let i = 0; i < K; i += 1) sum += xs[Math.floor(rand() * xs.length)];
    return sum / K;
  });
}

const LEVELS = ["blurb", `document (${K} paragraphs)`];
const byLevel = { [LEVELS[0]]: byRegister, [LEVELS[1]]: {} };
for (const r of registers) {
  const x = byRegister[r];
  byLevel[LEVELS[1]][r] = { source: x.source, tuning: {}, holdout: {} };
  for (const half of ["tuning", "holdout"]) for (const f of features) if (x[half][f]?.length) byLevel[LEVELS[1]][r][half][f] = documents(x[half][f]);
}

function lowerBound(a, b, d) {
  const cap = (xs) => (xs.length > 2000 ? resample(xs).slice(0, 2000) : xs);
  const ds = [];
  for (let i = 0; i < BOOT; i += 1) ds.push(cohenD(resample(cap(a)), resample(cap(b))));
  // The bound nearest zero, in the direction of d.
  return d >= 0 ? quantile(ds, 0.025) : -quantile(ds, 0.975);
}

const rows = [];
for (const level of LEVELS) for (const f of features) {
  for (let i = 0; i < registers.length; i += 1) {
    for (let j = i + 1; j < registers.length; j += 1) {
      const [a, b] = [byLevel[level][registers[i]], byLevel[level][registers[j]]];
      if (!a.tuning[f] || !b.tuning[f] || !a.holdout[f] || !b.holdout[f]) continue;
      const d = cohenD(a.tuning[f], b.tuning[f]);
      const hold = cohenD(a.holdout[f], b.holdout[f]);
      if (d === null || hold === null) continue;
      const lo = lowerBound(a.tuning[f], b.tuning[f], d);
      const passes = Math.abs(d) >= D_MIN && lo >= LO_MIN && Math.abs(hold) >= D_MIN && Math.sign(hold) === Math.sign(d);
      rows.push({ level, feature: f, a: registers[i], b: registers[j], d, lo, hold, passes });
    }
  }
}

const band = (xs) => [quantile(xs, 0.1), quantile(xs, 0.5), quantile(xs, 0.9)];

// ------------------------------------------------------------- report

const r2 = (x) => (x === null ? "–" : x.toFixed(2));
const lines = [];
const out = (s = "") => lines.push(s);

out("# Register separation: human baselines against each other");
out();
out(`Measured ${new Date().toISOString().slice(0, 10)} by \`scripts/shape/registers.mjs\`, ${BOOT} bootstrap resamples. Generated; do not edit by hand.`);
out();
out("A feature separates two registers when |d| >= 0.8 on the tuning half, the bootstrap bound nearest zero is at least 0.5, and the holdout d has the same sign and |d| >= 0.8.");
out();
out("## Samples");
out();
out("| Register | Source | Tuning | Holdout |");
out("| --- | --- | ---: | ---: |");
for (const r of registers) {
  const x = byRegister[r];
  out(`| ${r} | ${x.source} | ${x.tuning[features[0]].length} | ${x.holdout[features[0]].length} |`);
}
out();

const pairs = registers.flatMap((a, i) => registers.slice(i + 1).map((b) => [a, b]));
for (const level of LEVELS) {
  const at = rows.filter((r) => r.level === level);
  out(`## Features that pass, per register pair: ${level}`);
  out();
  out("| Pair | Passing features (tuning d / holdout d) |");
  out("| --- | --- |");
  for (const [a, b] of pairs) {
    const hit = at.filter((r) => r.a === a && r.b === b && r.passes).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
    out(`| ${a} vs ${b} | ${hit.length ? hit.map((r) => `\`${r.feature}\` ${r2(r.d)} / ${r2(r.hold)}`).join("; ") : "none"} |`);
  }
  out();

  out(`## Profile candidates, per register: ${level}`);
  out();
  out("A feature is a candidate for a register's profile when it separates that register from at least one other. The band is the tuning half's 10th, 50th and 90th percentile.");
  out();
  for (const r of registers) {
    const hits = at.filter((x) => x.passes && (x.a === r || x.b === r));
    const byFeature = {};
    for (const h of hits) (byFeature[h.feature] ??= []).push(h.a === r ? h.b : h.a);
    const fs = Object.keys(byFeature).sort((x, y) => byFeature[y].length - byFeature[x].length);
    out(`### ${r}`);
    out();
    if (fs.length === 0) {
      out("No feature separates this register from any other.");
      out();
      continue;
    }
    out("| Feature | Band (p10 / p50 / p90) | Separates from |");
    out("| --- | --- | --- |");
    for (const f of fs) out(`| \`${f}\` | ${band(byLevel[level][r].tuning[f]).map(r2).join(" / ")} | ${byFeature[f].join(", ")} |`);
    out();
  }
}

out("## Every pair and feature");
out();
out("| Level | Feature | Pair | d tuning | bound | d holdout | Passes |");
out("| --- | --- | --- | ---: | ---: | ---: | --- |");
for (const r of rows) out(`| ${r.level} | \`${r.feature}\` | ${r.a} vs ${r.b} | ${r2(r.d)} | ${r2(r.lo)} | ${r2(r.hold)} | ${r.passes ? "yes" : "no"} |`);
out();

const target = join(CALIBRATION, "report-registers.md");
writeFileSync(target, lines.join("\n"));
const passing = rows.filter((r) => r.passes);
for (const level of LEVELS) console.log(`${level}: ${rows.filter((r) => r.level === level && r.passes).length} of ${rows.filter((r) => r.level === level).length} pair tests pass`);
console.log(`${registers.length} registers, ${features.length} features. Wrote ${target}`);
