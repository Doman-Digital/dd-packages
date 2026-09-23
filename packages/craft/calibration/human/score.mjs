// Scores the human reference set the way the AI set is scored. Run from packages/craft after `pnpm build`:
//   node calibration/human/score.mjs
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { auditSnapshot, fingerprint, typicality } from "../../dist/index.js";

const root = "calibration";
const briefs = Object.keys(JSON.parse(readFileSync(join(root, "briefs.json"), "utf8")).estate);
const pooled = briefs.flatMap((k) => JSON.parse(readFileSync(join(root, "null", k, "null.json"), "utf8")).runs.map((r) => ({ ...r, id: `${k}/${r.id}` })));
const dir = join(root, "human", "2026-09-23");
const out = [];
for (const f of readdirSync(dir).filter((f) => f.endsWith(".snapshot.json")).sort()) {
  const snap = JSON.parse(readFileSync(join(dir, f), "utf8"));
  const report = auditSnapshot(snap);
  const tells = [...new Set(report.findings.map((x) => x.tell))].sort();
  const t = typicality(fingerprint(snap), pooled);
  out.push({ site: f.replace(".snapshot.json", ""), url: snap.url, h1: snap.headings.find((h) => h.level === 1)?.text.slice(0, 60) ?? "", blocking: report.summary.blocking, tells, score: t.score, typical: t.typical, flagged: t.typical || tells.length >= 3 });
}
writeFileSync(join(root, "human", "results.json"), `${JSON.stringify(out, null, 2)}\n`);
for (const o of out) console.log(`${o.site.padEnd(17)} block ${o.blocking}  score ${o.score.toFixed(2)}  tells ${o.tells.length} ${o.flagged ? "FLAGGED" : "ok"}  ${o.tells.join(",")}  | ${o.h1}`);
console.log(`\n${out.filter((o) => o.flagged).length} of ${out.length} flagged; ${out.filter((o) => o.typical).length} typical; block hits ${out.reduce((s, o) => s + o.blocking, 0)}`);
