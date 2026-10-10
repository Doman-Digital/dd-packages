import { readFileSync } from "node:fs";
import type { Panel } from "./config.js";

/** Plain text from an HTML document: scripts and styles dropped, tags removed, entities decoded, blank runs collapsed. */
export function htmlToText(html: string): string {
  const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", middot: "·", rarr: "→", larr: "←", mdash: "—", ndash: "–", pound: "£", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", hellip: "…" };
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/(p|div|tr|li|h[1-6]|section|table|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") return String.fromCodePoint(e[1]?.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      return entities[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n[ \n]*/g, "\n")
    .trim();
}

export interface GradingContext {
  journeyMap: string;
  brandFacts: string;
  brandFactsVersion: string;
  knownStates: string[];
  notes: string[];
}

/** The reference material only the evaluator gets. The buyer never sees any of it. */
export function loadGradingContext(panel: Panel): GradingContext {
  const g = panel.grading;
  const map = readFileSync(g.journeyMap, "utf8");
  const facts = JSON.parse(readFileSync(g.brandFacts.path, "utf8")) as Record<string, unknown>;
  const subset: Record<string, unknown> = {};
  for (const key of g.brandFacts.include) {
    if (!(key in facts)) throw new Error(`brand facts: no section "${key}" in ${g.brandFacts.path}`);
    subset[key] = facts[key];
  }
  return {
    journeyMap: /\.html?$/i.test(g.journeyMap) ? htmlToText(map) : map,
    brandFacts: JSON.stringify(subset),
    brandFactsVersion: String(facts.version ?? "unknown"),
    knownStates: g.knownStates,
    notes: g.notes ?? [],
  };
}
