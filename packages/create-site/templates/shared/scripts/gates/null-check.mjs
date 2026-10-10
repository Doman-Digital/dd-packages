// Stage 06 gate: reads the rendered copy deck against the null set's harvest,
// the phrases a model kept writing when it built the same brief with nobody
// deciding anything (`craft null build`, then `craft tells harvest`, saved as
// text or with --json). Every exact hit is listed with its line. A hit is not
// automatically a failure: a phrase can be the buyer's own words, kept on
// purpose, and then site.programme.json carries it under
// nullCheck.justified with the reason. An unjustified hit exits 1. The table
// is written to paths.nullCheck for the Stage 06 review. When the harvest is
// not on this machine the gate says so and passes.
//
// Lifted from apps/site/scripts/null-check.mjs in Doman-Digital (DOM-647).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { programme, sitePath, stop } from "./programme.mjs";

const GATE = "null-check";
const { paths, nullCheck = {} } = programme();
if (!nullCheck.harvest) {
  console.log(`${GATE}: no harvest named in site.programme.json (nullCheck.harvest); skipped. Run craft null build for the brief to make one.`);
  process.exit(0);
}
const harvest = sitePath(nullCheck.harvest);
if (!existsSync(harvest)) {
  console.log(`${GATE}: harvest not on this machine (${nullCheck.harvest}); skipped`);
  process.exit(0);
}
const deckPath = sitePath(paths.deckMarkdown);
if (!existsSync(deckPath)) stop(GATE, "06", `no ${paths.deckMarkdown}: copy-deck.mjs writes it.`);

const raw = readFileSync(harvest, "utf8");
let phrases;
if (raw.trimStart().startsWith("{")) {
  phrases = (JSON.parse(raw).candidates ?? []).filter((c) => c.kind === "phrase").map((c) => ({ phrase: c.value.toLowerCase(), runs: c.runs, of: c.of }));
} else {
  phrases = raw
    .split("\n")
    .map((l) => l.match(/^\s+phrase\s+(.+?)\s{2,}(\d+) of (\d+)/))
    .filter(Boolean)
    .map((m) => ({ phrase: m[1].trim().toLowerCase(), runs: +m[2], of: +m[3] }));
}
const justified = Object.fromEntries(Object.entries(nullCheck.justified ?? {}).map(([k, v]) => [k.toLowerCase(), v]));

const deck = readFileSync(deckPath, "utf8").split("\n");
const hits = [];
for (const { phrase, runs, of } of phrases) {
  deck.forEach((line, i) => {
    if (line.toLowerCase().includes(phrase)) hits.push({ phrase, runs, of, line: i + 1, text: line.trim().slice(0, 120), justified: justified[phrase] ?? null });
  });
}
const unjustified = hits.filter((h) => !h.justified);
const md = [
  "# Null-set check · copy deck",
  "",
  `Run ${new Date().toISOString().slice(0, 10)} by \`scripts/gates/null-check.mjs\` against \`${nullCheck.harvest}\` (${phrases.length} phrases).`,
  "",
  `Hits: ${hits.length}. Unjustified: ${unjustified.length}.`,
  "",
  "| Phrase | Null runs | Deck line | Text | Kept because |",
  "| --- | --- | --- | --- | --- |",
  ...hits.map((h) => `| ${h.phrase} | ${h.runs} of ${h.of} | ${h.line} | ${h.text.replace(/\|/g, "\\|")} | ${h.justified ?? "**not justified**"} |`),
  "",
  `Phrases checked and absent: ${
    phrases
      .filter((p) => !hits.some((h) => h.phrase === p.phrase))
      .map((p) => `"${p.phrase}"`)
      .join(", ") || "none"
  }.`,
  "",
];
const out = sitePath(paths.nullCheck);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, md.join("\n"));
console.log(`${GATE}: ${hits.length} hits, ${unjustified.length} unjustified. Written to ${paths.nullCheck}`);
for (const h of unjustified) console.log(`  line ${h.line}: "${h.phrase}" in: ${h.text}`);
if (unjustified.length) stop(GATE, "06", "rewrite each unjustified phrase, or keep it with a reason under nullCheck.justified in site.programme.json.");
