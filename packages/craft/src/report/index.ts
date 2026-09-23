/**
 * The character report: the three signals and the reason rule, read together.
 *
 * No one signal decides. A site can carry no catalogued tell and still be what
 * Claude builds for its brief (signal 2); it can be nothing like the null and
 * still wear last year's reflexes (signal 1); it can pass both and be a twin of
 * the agency's other client (signal 3). And a site that passes all three has
 * still only avoided defaults: "decided" needs the reasons written down.
 *
 * So the verdict is:
 *   default   two or more signals raised
 *   mixed     one raised
 *   decided   none raised, and all measured, reasons included
 *   unproven  none raised, but something was not measured. Unverified is
 *             never a pass.
 *
 * The actions change the surface: type, colour, shape, effects, motion, copy.
 * Never the page grammar. A layout tell says what to change about how a
 * section looks, not that it should move.
 *
 * Pure. The CLI gathers the inputs.
 */

import type { CheckReport, Finding } from "../character/types.js";
import type { ChoiceKey, DirectionReport } from "../direction/types.js";
import type { EstateMatch } from "../estate/index.js";
import type { Typicality } from "../null/index.js";

/** Three or more distinct design tells: the rule fixed for the 2026-09-23 calibration. */
export const TELL_HEAVY = 3;
/** Fewer choices decided than this and the reasons are not yet a direction. */
export const MIN_DECIDED = 5;

export type Verdict = "default" | "mixed" | "decided" | "unproven";
export type Area = "direction" | "type" | "colour" | "shape" | "effects" | "motion" | "layout" | "copy";

export interface SignalResult {
  id: "tells" | "typicality" | "estate" | "reasons";
  /** null when it was not measured. */
  raised: boolean | null;
  detail: string;
}

export interface Action {
  area: Area;
  what: string;
  why: string;
  /** 1 first. Deciding comes before changing, so direction actions are always 1. */
  priority: 1 | 2 | 3;
  /** The art-direction choice that settles it, when there is one. */
  choice?: ChoiceKey;
}

export interface CharacterReport {
  site: string;
  verdict: Verdict;
  summary: string;
  signals: SignalResult[];
  actions: Action[];
}

export interface CharacterInputs {
  site: string;
  /** Source and rendered findings, merged. */
  findings?: CheckReport | null;
  typicality?: Typicality | null;
  estate?: EstateMatch[] | null;
  direction?: DirectionReport | null;
}

/** Where each design tell is fixed, and which choice in art-direction.json settles it. */
const TELL_AREA: Record<string, { area: Area; choice?: ChoiceKey }> = {
  "reflex-font": { area: "type", choice: "display" },
  "reflex-font-2": { area: "type", choice: "display" },
  "italic-serif-display": { area: "type", choice: "display" },
  "ai-violet": { area: "colour", choice: "accent" },
  "blue-purple-gradient": { area: "colour", choice: "accent" },
  "gradient-text": { area: "colour", choice: "accent" },
  "cream-palette": { area: "colour", choice: "ground" },
  "pill-everything": { area: "shape", choice: "shape" },
  "shadcn-dump": { area: "shape", choice: "shape" },
  "glass-panel": { area: "effects", choice: "motif" },
  "radial-spotlight-glow": { area: "effects", choice: "motif" },
  "grid-background": { area: "effects", choice: "motif" },
  "thin-border-wide-shadow": { area: "effects", choice: "shape" },
  "icon-tile-stack": { area: "effects", choice: "motif" },
  "reveal-everywhere": { area: "motion", choice: "signature" },
  "intro-cinematic": { area: "motion", choice: "signature" },
  marquee: { area: "motion", choice: "signature" },
  "hero-then-proof": { area: "layout" },
  "icon-tile-grid": { area: "layout" },
  "hero-eyebrow-chip": { area: "layout" },
  "bento-grid": { area: "layout" },
};

/** A fingerprint part the null shares, mapped the same way. */
const PART_AREA: Record<string, { area: Area; choice?: ChoiceKey }> = {
  display: { area: "type", choice: "display" },
  body: { area: "type", choice: "body" },
  accent: { area: "colour", choice: "accent" },
  ground: { area: "colour", choice: "ground" },
  shape: { area: "shape", choice: "shape" },
  effects: { area: "effects", choice: "motif" },
  motion: { area: "motion", choice: "signature" },
};

/**
 * Sharing an absence or the web's default is not a choice to move off: a white
 * page and no scroll reveals are what a plain site has. Telling someone to add
 * reveals would reward strangeness.
 */
const DEFAULTS = /^(?:ground )?(?:white|grey)(?: ground)?$|no scroll reveals|no reveals|accent (?:none|neutral)|^no buttons|shape no buttons/;

function designFindings(findings: CheckReport | null | undefined, copyTells: Set<string>): Finding[] {
  return (findings?.findings ?? []).filter((f) => !copyTells.has(f.tell));
}

export function characterReport(input: CharacterInputs, copyTells: Set<string> = new Set()): CharacterReport {
  const actions: Action[] = [];
  const signals: SignalResult[] = [];

  // 1. Known tells.
  if (input.findings) {
    const design = designFindings(input.findings, copyTells);
    const distinct = [...new Set(design.map((f) => f.tell))];
    signals.push({
      id: "tells",
      raised: distinct.length >= TELL_HEAVY,
      detail: `${distinct.length} distinct design tell${distinct.length === 1 ? "" : "s"}${distinct.length ? `: ${distinct.join(", ")}` : ""}`,
    });
    const seen = new Set<string>();
    for (const f of design) {
      if (seen.has(f.tell)) continue;
      seen.add(f.tell);
      const map = TELL_AREA[f.tell] ?? { area: "effects" as Area };
      const both = design.some((g) => g.tell === f.tell && g.line === 0) && design.some((g) => g.tell === f.tell && g.line > 0);
      actions.push({ area: map.area, what: f.fix, why: `${f.name} (${f.tell}, gen ${f.generation})${both ? ", in source and on the page" : ""}`, priority: both ? 1 : 2, choice: map.choice });
    }
    const copy = (input.findings.findings ?? []).filter((f) => copyTells.has(f.tell));
    const byTell = new Map<string, Finding[]>();
    for (const f of copy) byTell.set(f.tell, [...(byTell.get(f.tell) ?? []), f]);
    for (const [tell, list] of byTell) {
      actions.push({ area: "copy", what: list[0].fix, why: `${list[0].name} (${tell}), ${list.length} place${list.length === 1 ? "" : "s"}, first at ${list[0].path}${list[0].line ? `:${list[0].line}` : ""}`, priority: 3 });
    }
  } else {
    signals.push({ id: "tells", raised: null, detail: "not measured" });
  }

  // 2. Would Claude have built this anyway?
  if (input.typicality) {
    const t = input.typicality;
    signals.push({ id: "typicality", raised: t.typical, detail: `score ${t.score.toFixed(2)}, ${t.typical ? "typical" : "not typical"} of what Claude builds for this brief` });
    if (t.typical) {
      for (const s of t.shared) {
        const map = PART_AREA[s.part];
        if (!map || DEFAULTS.test(`${s.part} ${s.value}`)) continue;
        actions.push({ area: map.area, what: `Move off the model's pick for this brief: ${s.part} ${s.value}.`, why: `${s.runs} of ${s.of} null pages chose it`, priority: 1, choice: map.choice });
      }
    }
  } else {
    signals.push({ id: "typicality", raised: null, detail: "not measured: no null model for this brief" });
  }

  // 3. Does it look like the agency's other sites?
  if (input.estate) {
    const siblings = input.estate.filter((m) => m.sibling);
    const nearest = input.estate[0];
    signals.push({
      id: "estate",
      raised: siblings.length > 0,
      detail: siblings.length ? `sibling of ${siblings.map((s) => `${s.id} (${s.distance.toFixed(2)})`).join(", ")}` : nearest ? `nearest ${nearest.id} at ${nearest.distance.toFixed(2)}, no sibling` : "the register is empty",
    });
    for (const s of siblings) {
      for (const part of s.shared) {
        if (DEFAULTS.test(part)) continue;
        actions.push({ area: areaOfShared(part), what: `Differ from ${s.id}: both have ${part}.`, why: `sibling at ${s.distance.toFixed(2)}`, priority: 1, choice: choiceOfShared(part) });
      }
    }
  } else {
    signals.push({ id: "estate", raised: null, detail: "not measured: no estate register" });
  }

  // The reason rule.
  if (input.direction) {
    const d = input.direction;
    const raised = !d.valid || d.decided < MIN_DECIDED;
    signals.push({ id: "reasons", raised, detail: `${d.decided} of 7 choices decided with a reason${d.valid ? "" : ", art-direction.json has errors"}` });
    for (const p of d.problems) {
      const key = p.at.match(/^choices\.(\w+)/)?.[1] as ChoiceKey | undefined;
      if (p.severity === "error" || p.message === "not decided yet") {
        actions.push({ area: "direction", what: key && p.message === "not decided yet" ? `Decide ${key}, with a source from the client's world.` : `${p.at || "art-direction.json"}: ${p.message}`, why: "the reason rule", priority: 1, choice: key });
      }
    }
  } else {
    signals.push({ id: "reasons", raised: null, detail: "not measured: no art-direction.json" });
    actions.push({ area: "direction", what: "Write art-direction.json: run craft direction init, then give every choice a reason from the client's world.", why: "the reason rule", priority: 1 });
  }

  const raised = signals.filter((s) => s.raised === true).length;
  const unmeasured = signals.filter((s) => s.raised === null).map((s) => s.id);
  const verdict: Verdict = raised >= 2 ? "default" : raised === 1 ? "mixed" : unmeasured.length ? "unproven" : "decided";
  const summary =
    verdict === "default"
      ? `${raised} of 4 signals raised: nobody chose how this looks.`
      : verdict === "mixed"
        ? `1 of 4 signals raised: ${signals.find((s) => s.raised)!.id}.`
        : verdict === "decided"
          ? "No signal raised, and every choice carries a reason."
          : `No signal raised, but ${unmeasured.join(", ")} not measured. Unverified is not a pass.`;

  const order: Area[] = ["direction", "type", "colour", "shape", "effects", "motion", "layout", "copy"];
  // One change per choice. "Pick a display face" for a reflex font, "move off
  // Fraunces" from the null and "differ from HJ Beauty's Fraunces" from the
  // estate are one change with three reasons, and a checklist should say so.
  const merged: Action[] = [];
  for (const a of actions) {
    const same = a.choice && a.area !== "direction" && a.area !== "copy" ? merged.find((m) => m.choice === a.choice && m.area === a.area) : undefined;
    if (same) {
      // A second tell adds its name; its fix says the same thing again.
      const fromTell = /\(\S+, gen \d\)/.test(a.why);
      same.why = `${same.why}; ${fromTell ? a.why : `${a.what.replace(/\.$/, "")} (${a.why})`}`;
      same.priority = Math.min(same.priority, a.priority) as Action["priority"];
    } else merged.push({ ...a });
  }
  const unique = merged.filter((a, i) => merged.findIndex((b) => b.area === a.area && b.what === a.what) === i);
  unique.sort((a, b) => a.priority - b.priority || order.indexOf(a.area) - order.indexOf(b.area));
  return { site: input.site, verdict, summary, signals, actions: unique };
}

function areaOfShared(part: string): Area {
  if (/headline|body$/.test(part)) return "type";
  if (/accent|ground/.test(part)) return "colour";
  if (/buttons/.test(part)) return "shape";
  if (/reveal/.test(part)) return "motion";
  if (/running order/.test(part)) return "layout";
  return "effects";
}

function choiceOfShared(part: string): ChoiceKey | undefined {
  if (/headline/.test(part)) return "display";
  if (/body$/.test(part)) return "body";
  if (/accent/.test(part)) return "accent";
  if (/ground/.test(part)) return "ground";
  if (/buttons/.test(part)) return "shape";
  if (/reveal/.test(part)) return "signature";
  return /running order/.test(part) ? undefined : "motif";
}
