/**
 * Calibration: how well the catalogue separates pages a person has labelled.
 *
 * A labelled set holds three kinds of page. `ai` pages were generated. `human`
 * pages were made by people. `ai-looking` pages were made by people and still
 * read as generated to someone who looks at many sites: they are what the
 * tells are for, since a tell detects a look, not a maker. So a tell's hit on
 * an `ai` or an `ai-looking` page counts for it, and a hit on a `human` page
 * counts against it.
 *
 * The verdict is the one CHARACTER.md fixed before any result was read: a page
 * is flagged when it is typical against the null models, or tell-heavy (three
 * or more distinct design tells). With no null models, tell-heavy decides.
 *
 * The targets are CHARACTER.md's first three. Target 4 (no siblings in the
 * estate) is `craft estate compare`; target 5 (people cannot tell) is the blind
 * test in docs/blind-test.md, which no tool here can run.
 *
 * Pure. Taking snapshots and reading files lives in the CLI.
 */

import { CATALOGUE } from "../character/check.js";
import { TELL_HEAVY } from "../report/index.js";

export const LABELS = ["ai", "ai-looking", "human"] as const;
export type Label = (typeof LABELS)[number];

/** Targets 1 and 3: this share of the set flagged, or more. */
export const FLAGGED_TARGET = 0.9;
/** Target 2: this share of the human set typical, or less. */
export const HUMAN_TYPICAL_TARGET = 0.1;

export interface MeasuredPage {
  id: string;
  label: Label;
  /** Every catalogue tell found on the page, each once. */
  tells: string[];
  /** Findings in the blocking tier. */
  blocking: number;
  /** Against the pooled null models; absent when none were given. */
  typicality?: { score: number; typical: boolean };
}

export interface UnmeasuredPage {
  id: string;
  label: Label;
  reason: string;
}

export interface LabelSummary {
  label: Label;
  pages: number;
  flagged: number;
  typical: number | null;
  tellHeavy: number;
  blocking: number;
}

export interface TellRate {
  tell: string;
  hits: Record<Label, number>;
  /** Hits on `ai` and `ai-looking` pages over all hits. */
  precision: number;
  /** `ai` and `ai-looking` pages hit, over all of them measured. Null when there are none. */
  recall: number | null;
}

export interface TargetCheck {
  target: string;
  /** Null when no page with that label was measured. */
  met: boolean | null;
  detail: string;
}

export interface Calibration {
  pages: number;
  /** Whether typicality was measured, or tell-heavy alone decided. */
  typicality: boolean;
  labels: LabelSummary[];
  tells: TellRate[];
  /** Catalogue tells that fired on no page. */
  silent: string[];
  targets: TargetCheck[];
  unmeasured: UnmeasuredPage[];
}

const SURFACE = new Map(CATALOGUE.map((t) => [t.id, t.surface]));

/** Tells about the look, not the words: what "tell-heavy" counts. */
export function designTells(tells: string[]): string[] {
  return tells.filter((t) => SURFACE.has(t) && SURFACE.get(t) !== "copy");
}

export function isFlagged(page: MeasuredPage): boolean {
  return Boolean(page.typicality?.typical) || designTells(page.tells).length >= TELL_HEAVY;
}

const positive = (label: Label): boolean => label !== "human";
const round = (n: number): number => Math.round(n * 100) / 100;
const share = (n: number, of: number): string => `${n} of ${of} (${Math.round((100 * n) / of)}%)`;

function summarise(label: Label, pages: MeasuredPage[], typicality: boolean): LabelSummary {
  const mine = pages.filter((p) => p.label === label);
  return {
    label,
    pages: mine.length,
    // A set measured partly against the null would count the same page two ways.
    flagged: mine.filter((p) => (typicality ? isFlagged(p) : designTells(p.tells).length >= TELL_HEAVY)).length,
    typical: typicality ? mine.filter((p) => p.typicality?.typical).length : null,
    tellHeavy: mine.filter((p) => designTells(p.tells).length >= TELL_HEAVY).length,
    blocking: mine.reduce((s, p) => s + p.blocking, 0),
  };
}

function flaggedTarget(target: string, s: LabelSummary, missing: number): TargetCheck {
  const note = missing ? `; ${missing} not measured, counted neither way` : "";
  if (s.pages === 0) return { target, met: null, detail: `no page measured${note}` };
  return { target, met: s.flagged / s.pages >= FLAGGED_TARGET, detail: `${share(s.flagged, s.pages)} flagged, target ${FLAGGED_TARGET * 100}% or more${note}` };
}

export function calibrate(pages: MeasuredPage[], unmeasured: UnmeasuredPage[] = []): Calibration {
  const typicality = pages.length > 0 && pages.every((p) => p.typicality !== undefined);
  const labels = LABELS.map((l) => summarise(l, pages, typicality));
  const byLabel = Object.fromEntries(labels.map((s) => [s.label, s])) as Record<Label, LabelSummary>;
  const missing = (l: Label) => unmeasured.filter((u) => u.label === l).length;
  const positives = pages.filter((p) => positive(p.label)).length;

  const fired = new Set(pages.flatMap((p) => p.tells));
  const tells: TellRate[] = [...fired]
    .map((tell) => {
      const hits = Object.fromEntries(LABELS.map((l) => [l, pages.filter((p) => p.label === l && p.tells.includes(tell)).length])) as Record<Label, number>;
      const on = hits.ai + hits["ai-looking"];
      return { tell, hits, precision: round(on / (on + hits.human)), recall: positives ? round(on / positives) : null };
    })
    .sort((a, b) => b.hits.ai + b.hits["ai-looking"] + b.hits.human - (a.hits.ai + a.hits["ai-looking"] + a.hits.human) || a.tell.localeCompare(b.tell));

  const human = byLabel.human;
  const humanNote = missing("human") ? `; ${missing("human")} not measured, counted neither way` : "";
  const targets: TargetCheck[] = [
    flaggedTarget("1. Generated pages get caught", byLabel.ai, missing("ai")),
    human.pages === 0
      ? { target: "2. Good human sites don't get caught", met: null, detail: `no page measured${humanNote}` }
      : {
          target: "2. Good human sites don't get caught",
          // A block hit fails it outright; without null models the other half is not known.
          met: human.blocking > 0 ? false : human.typical === null ? null : human.typical / human.pages <= HUMAN_TYPICAL_TARGET,
          detail: `${human.blocking} block hits, target 0; ${human.typical === null ? "typicality not measured (no null models)" : `${share(human.typical, human.pages)} typical, target ${HUMAN_TYPICAL_TARGET * 100}% or fewer`}${humanNote}`,
        },
    flaggedTarget("3. Sites a person labelled AI-looking get caught", byLabel["ai-looking"], missing("ai-looking")),
  ];

  return {
    pages: pages.length,
    typicality,
    labels,
    tells,
    silent: CATALOGUE.map((t) => t.id).filter((id) => !fired.has(id)),
    targets,
    unmeasured,
  };
}

/** `notes` are lines the caller knows and the numbers do not show, printed under the heading. */
export function formatCalibration(c: Calibration, notes: string[] = []): string {
  const counts = c.labels.map((s) => `${s.pages} ${s.label}`).join(", ");
  const lines = [`craft calibrate: ${c.pages} pages measured (${counts})`, ...notes];
  if (!c.typicality) lines.push("No null models: flagged means tell-heavy only.");
  if (c.unmeasured.length) {
    lines.push("", `Not measured: ${c.unmeasured.length}. A page not measured never counts as a pass.`);
    for (const u of c.unmeasured) lines.push(`  ${u.id} (${u.label}): ${u.reason}`);
  }
  lines.push("", "Targets");
  for (const t of c.targets) lines.push(`  ${t.target.padEnd(50)} ${t.met === null ? "not known" : t.met ? "met" : "NOT MET"}`, `    ${t.detail}`);
  lines.push("", `  ${"label".padEnd(11)} ${"pages".padStart(5)} ${"flagged".padStart(8)} ${"typical".padStart(8)} ${"tell-heavy".padStart(11)} ${"blocking".padStart(9)}`);
  for (const s of c.labels) {
    lines.push(`  ${s.label.padEnd(11)} ${String(s.pages).padStart(5)} ${String(s.flagged).padStart(8)} ${String(s.typical ?? "-").padStart(8)} ${String(s.tellHeavy).padStart(11)} ${String(s.blocking).padStart(9)}`);
  }
  lines.push("", "Per tell. A hit on ai or ai-looking counts for the tell; a hit on human counts against it.");
  lines.push(`  ${"tell".padEnd(28)} ${"ai".padStart(7)} ${"ai-looking".padStart(10)} ${"human".padStart(7)} ${"precision".padStart(9)} ${"recall".padStart(7)}`);
  const of = (l: Label) => c.labels.find((s) => s.label === l)?.pages ?? 0;
  for (const t of c.tells) {
    lines.push(
      `  ${t.tell.padEnd(28)} ${`${t.hits.ai}/${of("ai")}`.padStart(7)} ${`${t.hits["ai-looking"]}/${of("ai-looking")}`.padStart(10)} ${`${t.hits.human}/${of("human")}`.padStart(7)} ${t.precision.toFixed(2).padStart(9)} ${(t.recall === null ? "-" : t.recall.toFixed(2)).padStart(7)}`,
    );
  }
  if (!c.tells.length) lines.push("  no tell fired");
  lines.push("", `Never fired on this set: ${c.silent.length} of ${CATALOGUE.length} catalogue tells.`);
  return lines.join("\n");
}
