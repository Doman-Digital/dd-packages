/**
 * `craft retrofit`: a character report turned into the checklist a retrofit
 * session works through, in the order that works: decide, then change.
 *
 * Every change is tied to the art-direction choice that settles it, and shows
 * the decided value and its reason when there is one. A change with no
 * decided value waits for the decision; otherwise the retrofit swaps one
 * default for the next.
 *
 * Pure. Returns Markdown.
 */

import type { ArtDirection, ChoiceKey } from "../direction/types.js";
import type { Action, Area, CharacterReport } from "./index.js";

const HEADINGS: Record<Area, string> = {
  direction: "Decide first",
  type: "Type",
  colour: "Colour",
  shape: "Shape",
  effects: "Effects",
  motion: "Motion",
  layout: "How sections look (not where they sit)",
  copy: "Copy",
};

const ORDER: Area[] = ["direction", "type", "colour", "shape", "effects", "motion", "layout", "copy"];

function target(a: Action, direction: ArtDirection | null | undefined): string {
  if (!a.choice || a.area === "direction") return "";
  const c = direction?.choices?.[a.choice as ChoiceKey];
  if (c && c.because && !c.because.startsWith("PROPOSED:")) return `\n  - Use: **${c.value}** for ${a.choice}. ${c.because}`;
  return `\n  - Waits on: deciding **${a.choice}** in art-direction.json.`;
}

export function retrofitPlan(report: CharacterReport, direction?: ArtDirection | null): string {
  const lines: string[] = [
    `# Retrofit: ${report.site}`,
    "",
    `**Now:** ${report.verdict}. ${report.summary}`,
    "",
    "| Signal | Raised | Reading |",
    "|---|---|---|",
    ...report.signals.map((s) => `| ${s.id} | ${s.raised === null ? "not measured" : s.raised ? "yes" : "no"} | ${s.detail} |`),
    "",
    "**Done when** `craft report` says *decided*: fewer than three design tells, typicality under 0.10 against this brief's null, no sibling in the estate, and at least five of the seven choices decided with a reason.",
    "",
  ];
  let n = 0;
  for (const area of ORDER) {
    const list = report.actions.filter((a) => a.area === area);
    if (list.length === 0) continue;
    n += 1;
    lines.push(`## ${n}. ${HEADINGS[area]}`, "");
    for (const a of list) lines.push(`- [ ] ${a.what} *(${a.why})*${target(a, direction)}`);
    lines.push("");
  }
  if (n === 0) lines.push("Nothing to change.", "");
  lines.push(
    "## Leave alone",
    "",
    "Navigation, the order of the sections, where the call to action sits, reading order and legibility. Change the look, never the page grammar. A layout tell above is about how a section looks: the icon tiles, the chip, the strip. The section stays where it is.",
    "",
  );
  return lines.join("\n");
}
