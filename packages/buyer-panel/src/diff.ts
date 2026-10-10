import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import type { Panel } from "./config.js";
import type { Cluster } from "./evaluate.js";
import { callForTool, emptyUsage } from "./model.js";
import type { RunReport } from "./report.js";

export interface RunDiff {
  before: string;
  after: string;
  persisting: { before: string; after: string; title: string }[];
  gone: Cluster[];
  added: Cluster[];
}

const MATCH_TOOL: Anthropic.Tool = {
  name: "submit_matches",
  description: "Pairs of clusters, one from each run, that are the same defect.",
  input_schema: {
    type: "object",
    properties: { pairs: { type: "array", items: { type: "object", properties: { before: { type: "string" }, after: { type: "string" } }, required: ["before", "after"] } } },
    required: ["pairs"],
  },
};

/** Matches the defects of one run against an earlier one: what persists, what is gone, what is new. */
export async function diffRuns(panel: Panel, beforeDir: string, afterDir: string): Promise<RunDiff> {
  const a = JSON.parse(readFileSync(join(beforeDir, "report.json"), "utf8")) as RunReport;
  const b = JSON.parse(readFileSync(join(afterDir, "report.json"), "utf8")) as RunReport;
  const line = (c: Cluster) => `${c.key} | ${c.title} | ${c.summary}`;
  const keysA = new Set(a.clusters.map((c) => c.key));
  const keysB = new Set(b.clusters.map((c) => c.key));
  const pairs =
    a.clusters.length && b.clusters.length
      ? await callForTool(
          { temperature: 0, ...panel.evaluator },
          {
            max_tokens: 4000,
            system: "You match defects found on a website in two runs of a buyer panel against two versions of the site. Pair a cluster from the earlier run with one from the later run only when they are the same defect on the same part of the site. Leave unmatched what has no counterpart.",
            messages: [{ role: "user", content: `Earlier run (key | title | summary):\n${a.clusters.map(line).join("\n")}\n\nLater run:\n${b.clusters.map(line).join("\n")}\n\nCall submit_matches.` }],
          },
          MATCH_TOOL,
          emptyUsage(),
          (input) => {
            const p = (input as { pairs?: { before: string; after: string }[] }).pairs;
            if (!Array.isArray(p)) throw new Error("pairs must be an array");
            return p.filter((x) => keysA.has(x.before) && keysB.has(x.after));
          },
        )
      : [];
  const matchedA = new Set(pairs.map((p) => p.before));
  const matchedB = new Set(pairs.map((p) => p.after));
  const diff: RunDiff = {
    before: a.meta.runId,
    after: b.meta.runId,
    persisting: pairs.map((p) => ({ ...p, title: b.clusters.find((c) => c.key === p.after)?.title ?? p.after })),
    gone: a.clusters.filter((c) => !matchedA.has(c.key)),
    added: b.clusters.filter((c) => !matchedB.has(c.key)),
  };
  const md = [
    `# Buyer panel diff: ${a.meta.runId} (${a.meta.version.slice(0, 8)}) → ${b.meta.runId} (${b.meta.version.slice(0, 8)})`,
    "",
    "Gone means not found this time, which is not proof of a fix.",
    "",
    `## Persisting (${diff.persisting.length})`,
    ...diff.persisting.map((p) => `- ${p.title} (\`${p.before}\` → \`${p.after}\`)`),
    "",
    `## Not found this time (${diff.gone.length})`,
    ...diff.gone.map((c) => `- ${c.title} (\`${c.key}\`, ${c.reproduces ? "reproduced" : "seen once"} before)`),
    "",
    `## New (${diff.added.length})`,
    ...diff.added.map((c) => `- ${c.title} (\`${c.key}\`, ${c.reproduces ? "reproduces" : "seen once"})`),
    "",
  ].join("\n");
  writeFileSync(join(afterDir, `diff-${a.meta.runId}.md`), md);
  writeFileSync(join(afterDir, `diff-${a.meta.runId}.json`), JSON.stringify(diff, null, 1));
  return diff;
}
