// Human baseline, explanatory Q&A: the human answers in HC3 (Hello-SimpleAI,
// CC BY-SA 4.0), collected before ChatGPT's release. Tagged by split
// (reddit_eli5, open_qa, wiki_csai, medicine, finance) so a split whose
// licence or provenance turns out to be doubtful can be dropped at measure time.
//
//   node scripts/shape/sources/hc3.mjs
//
// Streams the JSONL; only feature vectors are written.

import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { Baseline, flag, memory, paragraphs } from "../lib.mjs";

const URL_ALL = "https://huggingface.co/datasets/Hello-SimpleAI/HC3/resolve/main/all.jsonl";

/** HC3 text is tokenised ("you 're", "best seller ."). Put it back the way it was written. */
export function detokenise(s) {
  return s
    .replace(/\s+([.,!?;:%)\]])/g, "$1")
    .replace(/([([])\s+/g, "$1")
    .replace(/\s+(n't|'s|'re|'ve|'ll|'d|'m)\b/gi, "$1")
    .replace(/"\s+([^"]*?)\s+"/g, '"$1"')
    .replace(/\s+-\s+/g, "-")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const out = new Baseline({
  source: "hc3-human",
  register: "explanatory",
  licence: "CC BY-SA 4.0 (Hello-SimpleAI/HC3); reddit_eli5 answers carry Reddit's terms, so the split is tagged",
  note: "Human answers only, detokenised. Writer = question (HC3 has no author ids). Tag = split.",
});

const res = await fetch(URL_ALL);
if (!res.ok) throw new Error(`HC3 ${res.status}`);
const lines = createInterface({ input: Readable.fromWeb(res.body) });
let rows = 0;
for await (const line of lines) {
  if (!line.trim()) continue;
  const row = JSON.parse(line);
  rows += 1;
  const split = row.source ?? "unknown";
  for (const answer of row.human_answers ?? []) {
    for (const p of paragraphs(detokenise(answer))) out.add(p, row.question, split);
  }
  if (rows % 5000 === 0) console.error(`  ${rows} questions, ${out.counts.blurbs} blurbs, ${memory()}`);
}
console.log(JSON.stringify(out.write("hc3-human-v1.json", { force: Boolean(flag("force", false)) })));
