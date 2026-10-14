import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import type { ModelChoice, Panel } from "./config.js";
import type { Cluster } from "./evaluate.js";
import { callForTool, emptyUsage } from "./model.js";
import type { RunReport } from "./report.js";

export type Confidence = "high" | "medium" | "low";

/** One pairing the model proposed: a cluster of the earlier run and one of the later run. */
export interface ProposedMatch {
  before: string;
  after: string;
  confidence: Confidence;
  reason: string;
}

export interface RejectedMatch extends ProposedMatch {
  why: string;
}

export interface RunDiff {
  before: string;
  after: string;
  /** The model that proposed the matches. */
  matcher: ModelChoice;
  persisting: { before: string; after: string; title: string; confidence: Confidence; reason: string }[];
  gone: Cluster[];
  added: Cluster[];
  /** Pairings the model proposed that the diff did not accept, with why. */
  rejected: RejectedMatch[];
}

const MATCH_TOOL: Anthropic.Tool = {
  name: "submit_matches",
  description: "Pairs of clusters, one from each run, that are the same defect. Each key appears in at most one pair.",
  input_schema: {
    type: "object",
    properties: {
      pairs: {
        type: "array",
        items: {
          type: "object",
          properties: {
            before: { type: "string", description: "Key of the earlier run's cluster" },
            after: { type: "string", description: "Key of the later run's cluster" },
            reason: { type: "string", description: "One sentence: the defect both describe, and where on the site." },
            confidence: {
              type: "string",
              enum: ["high", "medium", "low"],
              description: "high: the same defect at the same place, one fix removes both. medium: the same defect, worded differently or found on a neighbouring page. low: only the topic, the page or the area is shared, or the reason has to describe a different problem in each run.",
            },
          },
          required: ["before", "after", "reason", "confidence"],
        },
      },
    },
    required: ["pairs"],
  },
};

const MATCH_SYSTEM =
  "You match defects found on a website in two runs of a buyer panel, against two versions of the site. Pair a cluster from the earlier run with one from the later run only when they are the same defect: the same thing wrong, for the same reason, on the same part of the site, so that one fix would have removed both. A shared topic is not enough: two different problems with gift cards, or with the prices page, are two defects. Each cluster is in at most one pair; when several later clusters resemble one earlier cluster, pair only the closest. Leave unmatched whatever has no clear counterpart: an unmatched defect is reported honestly as gone or new, while a wrong pair hides both. For every pair give a one-sentence reason naming the one defect both describe, and a confidence. If the reason can only say \"X in the earlier run, Y in the later run\", they are two defects: leave them unmatched.";

/** The tool input as proposed matches: every pair needs both keys, a reason and a confidence. */
export function parseMatches(input: unknown): ProposedMatch[] {
  const p = (input as { pairs?: unknown }).pairs;
  if (!Array.isArray(p)) throw new Error("pairs must be an array");
  return p.map((x, i) => {
    const m = x as Partial<ProposedMatch>;
    for (const k of ["before", "after", "reason"] as const) if (typeof m[k] !== "string" || !m[k]!.trim()) throw new Error(`pairs[${i}].${k} is required`);
    if (!["high", "medium", "low"].includes(m.confidence as string)) throw new Error(`pairs[${i}].confidence must be high, medium or low`);
    return { before: m.before!, after: m.after!, reason: m.reason!.trim(), confidence: m.confidence as Confidence };
  });
}

const rank: Record<Confidence, number> = { high: 2, medium: 1, low: 0 };

/**
 * Which proposed pairs the diff accepts. A pair stands only when both keys exist, the model did not mark it low
 * confidence, and it is one to one: a key paired more than once keeps its single most confident pair, and when
 * two pairs tie for it, neither is kept, since the model could not tell which defect it was.
 */
export function acceptMatches(proposed: ProposedMatch[], keysBefore: Set<string>, keysAfter: Set<string>): { accepted: ProposedMatch[]; rejected: RejectedMatch[] } {
  const rejected: RejectedMatch[] = [];
  let live: ProposedMatch[] = [];
  const seen = new Set<string>();
  for (const m of proposed) {
    const id = `${m.before}\u0000${m.after}`;
    if (seen.has(id)) continue; // the same pair twice is one pair
    seen.add(id);
    if (!keysBefore.has(m.before)) rejected.push({ ...m, why: `no cluster ${m.before} in the earlier run` });
    else if (!keysAfter.has(m.after)) rejected.push({ ...m, why: `no cluster ${m.after} in the later run` });
    else if (m.confidence === "low") rejected.push({ ...m, why: "low confidence" });
    else live.push(m);
  }
  for (const side of ["before", "after"] as const) {
    const groups = new Map<string, ProposedMatch[]>();
    for (const m of live) groups.set(m[side], [...(groups.get(m[side]) ?? []), m]);
    const keep = new Set<ProposedMatch>();
    for (const [key, ms] of groups) {
      if (ms.length === 1) {
        keep.add(ms[0]!);
        continue;
      }
      const best = Math.max(...ms.map((m) => rank[m.confidence]));
      const top = ms.filter((m) => rank[m.confidence] === best);
      if (top.length === 1) keep.add(top[0]!);
      for (const m of ms) if (!keep.has(m)) rejected.push({ ...m, why: top.length === 1 ? `${key} is matched more confidently elsewhere` : `${key} was matched ${ms.length} times with equal confidence` });
    }
    live = live.filter((m) => keep.has(m));
  }
  return { accepted: live, rejected };
}

/** Matches the defects of one run against an earlier one: what persists, what is gone, what is new. */
export async function diffRuns(panel: Panel, beforeDir: string, afterDir: string): Promise<RunDiff> {
  const a = JSON.parse(readFileSync(join(beforeDir, "report.json"), "utf8")) as RunReport;
  const b = JSON.parse(readFileSync(join(afterDir, "report.json"), "utf8")) as RunReport;
  const line = (c: Cluster) => `${c.key} | ${c.category} | ${c.title} | ${c.summary}`;
  const matcher: ModelChoice = { temperature: 0, ...panel.evaluator };
  const proposed =
    a.clusters.length && b.clusters.length
      ? await callForTool(
          matcher,
          {
            max_tokens: 6000,
            system: MATCH_SYSTEM,
            messages: [{ role: "user", content: `Earlier run (key | category | title | summary):\n${a.clusters.map(line).join("\n")}\n\nLater run:\n${b.clusters.map(line).join("\n")}\n\nCall submit_matches.` }],
          },
          MATCH_TOOL,
          emptyUsage(),
          parseMatches,
        )
      : [];
  const { accepted, rejected } = acceptMatches(proposed, new Set(a.clusters.map((c) => c.key)), new Set(b.clusters.map((c) => c.key)));
  const matchedA = new Set(accepted.map((p) => p.before));
  const matchedB = new Set(accepted.map((p) => p.after));
  const diff: RunDiff = {
    before: a.meta.runId,
    after: b.meta.runId,
    matcher,
    persisting: accepted.map((p) => ({ ...p, title: b.clusters.find((c) => c.key === p.after)?.title ?? p.after })),
    gone: a.clusters.filter((c) => !matchedA.has(c.key)),
    added: b.clusters.filter((c) => !matchedB.has(c.key)),
    rejected,
  };
  writeFileSync(join(afterDir, `diff-${a.meta.runId}.md`), renderDiff(diff, a, b));
  writeFileSync(join(afterDir, `diff-${a.meta.runId}.json`), JSON.stringify(diff, null, 1));
  return diff;
}

export function renderDiff(diff: RunDiff, a: RunReport, b: RunReport): string {
  return [
    `# Buyer panel diff: ${a.meta.runId} (${a.meta.version.slice(0, 8)}) → ${b.meta.runId} (${b.meta.version.slice(0, 8)})`,
    "",
    `Matched by ${diff.matcher.model} at temperature ${diff.matcher.temperature ?? "default"}. Graded by ${a.meta.evaluator.model} (earlier) and ${b.meta.evaluator.model} (later).`,
    "",
    "Gone means not found this time, which is not proof of a fix. A match is kept only one to one and when the matcher was at least fairly sure; the rest are listed at the end.",
    "",
    `## Persisting (${diff.persisting.length})`,
    ...diff.persisting.map((p) => `- ${p.title} (\`${p.before}\` → \`${p.after}\`, ${p.confidence}). ${p.reason}`),
    "",
    `## Not found this time (${diff.gone.length})`,
    ...diff.gone.map((c) => `- ${c.title} (\`${c.key}\`, ${c.reproduces ? "reproduced" : "seen once"} before)`),
    "",
    `## New (${diff.added.length})`,
    ...diff.added.map((c) => `- ${c.title} (\`${c.key}\`, ${c.reproduces ? "reproduces" : "seen once"})`),
    "",
    `## Matches not accepted (${diff.rejected.length})`,
    ...(diff.rejected.length ? diff.rejected.map((r) => `- \`${r.before}\` → \`${r.after}\`: ${r.why} (${r.confidence}). ${r.reason}`) : ["None."]),
    "",
  ].join("\n");
}
