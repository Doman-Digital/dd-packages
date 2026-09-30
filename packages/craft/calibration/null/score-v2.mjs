// Same as score.mjs, on the -v2 null models and a v2 estate folder (ESTATE_DIR).
// Scores the estate and the AI set against the null models in this folder.
// Run from packages/craft after `pnpm build`:
//   CRAFT_CHROMIUM=/opt/pw-browsers/chromium node calibration/null/score.mjs
// Writes calibration/null/results.json and prints the tables CHARACTER.md records.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { auditSnapshot, fingerprint, scanSource, typicality } from "../../dist/index.js";
import { snapshotUrls } from "../../dist/audit.js";

const root = "calibration";
const briefs = JSON.parse(readFileSync(join(root, "briefs.json"), "utf8"));
const nulls = Object.fromEntries(Object.keys(briefs.estate).map((k) => [k, JSON.parse(readFileSync(join(root, "null", k + "-v2", "null.json"), "utf8"))]));
const pool = (keys) => keys.flatMap((k) => nulls[k].runs.map((r) => ({ ...r, id: `${k}/${r.id}` })));
const all = pool(Object.keys(nulls));

// Tell-heavy, fixed before reading any result: three or more distinct design tells.
const TELL_HEAVY = 3;
const pct = (n, d) => `${Math.round((100 * n) / d)}%`;
const out = { estate: [], aiSet: [], crossBrief: [] };

// 1. The null's own pages against the other briefs: is the model's look the same whatever the brief?
for (const k of Object.keys(nulls)) {
  const others = pool(Object.keys(nulls).filter((o) => o !== k));
  const scored = nulls[k].runs.map((r) => ({ id: r.id, t: typicality(r.fingerprint, others), tells: r.tells.length }));
  out.crossBrief.push({ brief: k, pages: scored.length, typical: scored.filter((s) => s.t.typical).length, flagged: scored.filter((s) => s.t.typical || s.tells >= TELL_HEAVY).length });
}

// 2. The live estate against its own brief's null, and against all of them.
const siteSnap = { dd: "dd", mmm: "mmm", sensphere: "sensphere", "harrison-james": "hj", "hj-beauty": "hjbeauty", "chair-and-blade": "chair", rmp: "rmp" };
for (const [k, file] of Object.entries(siteSnap)) {
  const snap = JSON.parse(readFileSync(join(root, "estate", process.env.ESTATE_DIR, `${file}.snapshot.json`), "utf8"));
  const fp = fingerprint(snap);
  const own = typicality(fp, nulls[k].runs);
  const pooled = typicality(fp, all);
  out.estate.push({ site: k, own: own.score, pooled: pooled.score, distance: own.distance, baseline: own.baseline, shared: own.shared.slice(0, 4).map((s) => `${s.part} ${s.value} (${s.runs}/${s.of})`) });
}

// 3. The AI set, already re-snapshotted on v2 by craft calibrate (calibration/results/2026-09-29-wider).
const aiIds = readdirSync(join(root, "ai-set")).filter((d) => existsSync(join(root, "results", "2026-09-29-wider", "snapshots", `ai-${d}.json`)));
for (const d of aiIds) {
  const snap = JSON.parse(readFileSync(join(root, "results", "2026-09-29-wider", "snapshots", `ai-${d}.json`), "utf8"));
  const html = readFileSync(join(root, "ai-set", d, "pages", "01.html"), "utf8");
  const tells = new Set([...auditSnapshot(snap).findings, ...scanSource([{ path: "01.html", text: html }]).findings].map((f) => f.tell));
  const t = typicality(fingerprint(snap), all);
  out.aiSet.push({ brief: d, score: t.score, typical: t.typical, tells: [...tells].sort(), flagged: t.typical || tells.size >= TELL_HEAVY });
}

writeFileSync(join(root, "null", "results-v2.json"), `${JSON.stringify(out, null, 2)}\n`);

console.log("Cross-brief: each brief's null pages against the other six");
for (const c of out.crossBrief) console.log(`  ${c.brief.padEnd(16)} typical ${c.typical}/${c.pages}  flagged ${c.flagged}/${c.pages}`);
console.log("\nEstate: typicality against its own brief's null, and all seven pooled");
for (const e of out.estate) console.log(`  ${e.site.padEnd(16)} own ${e.own.toFixed(2)}  pooled ${e.pooled.toFixed(2)}  ${e.shared.join(", ")}`);
const ok = out.aiSet.filter((a) => !a.error);
console.log(`\nAI set: ${ok.filter((a) => a.flagged).length}/${ok.length} flagged (${pct(ok.filter((a) => a.flagged).length, ok.length)}); typical ${ok.filter((a) => a.typical).length}, tell-heavy ${ok.filter((a) => a.tells.length >= TELL_HEAVY).length}`);
for (const a of out.aiSet) console.log(`  ${a.brief.padEnd(16)} ${a.error ? `error ${a.error}` : `score ${a.score.toFixed(2)}  tells ${a.tells.length}  ${a.flagged ? "flagged" : "missed"}`}`);
