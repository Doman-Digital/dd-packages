/**
 * The counterfactual: what a model builds for this brief when nobody tells it
 * anything else. Signal 2 of CHARACTER.md.
 *
 * A null model is about twenty pages generated from one brief, each reduced to
 * a fingerprint. A site is typical when it sits as close to those pages as they
 * sit to each other. That question keeps working when model defaults move,
 * which a fixed list of tells cannot: ban Inter and the null model moves with
 * the model, so the comparison moves too.
 *
 * `harvest` reads the same pages the other way round: which choices recur
 * across them that the catalogue does not know yet. Those are the candidates
 * for the next generation of tells. A person decides; nothing is added here.
 *
 * Pure. Generating pages and snapshotting them lives in the CLI.
 */

import { isAiViolet, isCream } from "../character/color.js";
import { REFLEX_FONTS_1, REFLEX_FONTS_2 } from "../character/tells/source.js";
import { deltaEOk, formatHex, oklchToRgb, type Oklch } from "../color/oklch.js";
import type { Fingerprint } from "../fingerprint/index.js";
import { fingerprintDistance } from "../fingerprint/index.js";

export const NULL_VERSION = 1;

/**
 * The prompt a null run gets: the brief, and nothing about how it should look.
 * Changing this changes every null model built after it, so it is versioned
 * by being recorded in each one.
 */
export function nullPrompt(brief: string): string {
  return [
    `Build the home page for this business: ${brief.trim()}`,
    "",
    "Write it as one complete, self-contained HTML file. You may load fonts and libraries from a CDN. Use real copy, not placeholder text. Reply with the HTML only.",
  ].join("\n");
}

export interface NullRun {
  /** The page's file name without extension: "01". */
  id: string;
  fingerprint: Fingerprint;
  /** Catalogue tells found on the page, source and rendered, each once. */
  tells: string[];
  /** Every visible string on the page, for the phrase harvest. */
  copy: string[];
}

export interface NullModel {
  version: typeof NULL_VERSION;
  brief: string;
  /**
   * The prompt each page was built from. For imported pages, the prompt the
   * person was asked to give the builder: `craft null prompt` prints it.
   */
  prompt: string;
  /** What was asked for with --model, or "default"; "unknown" for imported pages unless given. */
  model: string;
  /**
   * The tool that built the pages, when they were imported rather than
   * generated here: "v0", "lovable". Absent for `craft null build`.
   */
  builder?: string;
  catalogueVersion: string;
  builtAt: string;
  runs: NullRun[];
}

/** The HTML document in a model's reply, without code fences or commentary. */
export function extractHtml(reply: string): string | null {
  const start = reply.search(/<!doctype html|<html[\s>]/i);
  if (start < 0) return null;
  const end = reply.toLowerCase().lastIndexOf("</html>");
  const html = end > start ? reply.slice(start, end + "</html>".length) : reply.slice(start).replace(/\s*```\s*$/, "");
  return html.length > 200 ? html : null;
}

// ------------------------------------------------------------- typicality

/** Fewer runs than this and the spread of the null is noise, so nothing is judged. */
export const MIN_RUNS = 5;
/** Typical when at least this share of the null's own pages sit further out. */
export const TYPICAL_AT = 0.1;

export interface Typicality {
  /**
   * 0 to 1: the share of the null's own pages that sit further from the rest
   * than this page sits from them. 1 is more typical than anything the model
   * built; 0 is further out than every one of them.
   */
  score: number;
  typical: boolean;
  /** Mean distance to the k nearest null pages. */
  distance: number;
  /** The same measure for each null page against the others, median. */
  baseline: number;
  nearest: { id: string; distance: number }[];
  /** The choices this page shares with most of the null: why it reads as typical. */
  shared: { part: string; value: string; runs: number; of: number }[];
}

function meanNearest(distances: number[], k: number): number {
  const sorted = [...distances].sort((a, b) => a - b).slice(0, k);
  return sorted.reduce((s, d) => s + d, 0) / sorted.length;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * How typical a page is against one or more null models (pooled). Every null
 * page is scored against the others the same way, leaving itself out, so the
 * threshold comes from the model's own spread and not from a number picked
 * here: a page drawn from the null is flagged nine times in ten by
 * construction, and the calibration checks whether real sites are not.
 */
export function typicality(target: Fingerprint, runs: NullRun[], k = 3): Typicality {
  if (runs.length < MIN_RUNS) throw new Error(`a null model needs at least ${MIN_RUNS} runs; this one has ${runs.length}`);
  const kk = Math.min(k, runs.length - 1);
  const toTarget = runs.map((r) => ({ id: r.id, distance: fingerprintDistance(target, r.fingerprint).total }));
  const distance = meanNearest(
    toTarget.map((t) => t.distance),
    kk,
  );
  const loo = runs.map((r, i) =>
    meanNearest(
      runs.filter((_, j) => j !== i).map((o) => fingerprintDistance(r.fingerprint, o.fingerprint).total),
      kk,
    ),
  );
  const score = loo.filter((d) => d >= distance).length / loo.length;
  return {
    score: Math.round(score * 100) / 100,
    typical: score >= TYPICAL_AT,
    distance: Math.round(distance * 1000) / 1000,
    baseline: Math.round(median(loo) * 1000) / 1000,
    nearest: toTarget.sort((a, b) => a.distance - b.distance).slice(0, kk),
    shared: sharedChoices(target, runs),
  };
}

// ------------------------------------------------------------- choices

const HUES: [string, number, number][] = [
  ["red", 0, 45],
  ["orange", 45, 75],
  ["yellow", 75, 110],
  ["green", 110, 165],
  ["teal", 165, 215],
  ["blue", 215, 265],
  ["violet", 265, 315],
  ["pink", 315, 360],
];

export function hueName(o: Oklch | null): string {
  if (!o) return "none";
  if (o.c < 0.03) return "neutral";
  return HUES.find(([, lo, hi]) => o.h >= lo && o.h < hi)?.[0] ?? "red";
}

export function groundName(o: Oklch): string {
  if (o.l < 0.3) return "dark";
  if (isCream(o)) return "cream";
  if (o.l >= 0.97 && o.c < 0.012) return "white";
  return o.c < 0.02 ? "grey" : "tinted";
}

export function shapeName(roundness: number | null): string {
  if (roundness === null) return "no buttons";
  if (roundness >= 0.45) return "pill";
  return roundness >= 0.15 ? "soft" : "square";
}

/** The discrete choices a fingerprint makes, as part → value. What a person would name. */
export function choicesOf(fp: Fingerprint): Record<string, string[]> {
  return {
    display: [fp.display.family],
    body: [fp.body.family],
    accent: [hueName(fp.accent)],
    ground: [groundName(fp.ground)],
    shape: [shapeName(fp.roundness)],
    motion: [fp.motion >= 0.6 ? "reveals most sections" : fp.motion > 0 ? "reveals some sections" : "no scroll reveals"],
    effects: fp.effects,
    opening: [fp.layout.slice(0, 3).join(" > ") || "none"],
  };
}

function sharedChoices(target: Fingerprint, runs: NullRun[]): Typicality["shared"] {
  const mine = choicesOf(target);
  const all = runs.map((r) => choicesOf(r.fingerprint));
  const out: Typicality["shared"] = [];
  for (const [part, values] of Object.entries(mine)) {
    for (const value of values) {
      const count = all.filter((c) => c[part].includes(value)).length;
      if (count / runs.length >= 0.25) out.push({ part, value, runs: count, of: runs.length });
    }
  }
  return out.sort((a, b) => b.runs - a.runs);
}

// ------------------------------------------------------------- harvest

export type CandidateKind = "face" | "accent" | "ground" | "shape" | "motion" | "opening" | "tell" | "phrase";

export interface HarvestCandidate {
  kind: CandidateKind;
  value: string;
  /** Null pages that make this choice, across every model given. */
  runs: number;
  of: number;
  /** Distinct briefs it turned up for. A habit shows across briefs; a brief's own words do not. */
  briefs: number;
  /** The catalogue tell that already catches it, or null when nothing does. */
  known: string | null;
  /** An example, for a phrase: the string it came from. */
  example?: string;
}

export interface HarvestOptions {
  /** Report a choice made by at least this share of pages. Default 0.25. */
  minShare?: number;
  /** Which copy tell, if any, already catches a phrase. The CLI passes the catalogue's. */
  copyTell?: (phrase: string) => string | null;
}

const REFLEX_1 = new Set(REFLEX_FONTS_1.map((f) => f.toLowerCase()));
const REFLEX_2 = new Set(REFLEX_FONTS_2.map((f) => f.toLowerCase()));

function knownFor(kind: CandidateKind, value: string, sample: Fingerprint[]): string | null {
  if (kind === "face") return REFLEX_1.has(value.toLowerCase()) ? "reflex-font" : REFLEX_2.has(value.toLowerCase()) ? "reflex-font-2" : null;
  if (kind === "accent" && value === "violet") return sample.some((f) => f.accent && isAiViolet(f.accent)) ? "ai-violet" : null;
  if (kind === "ground" && value === "cream") return "cream-palette";
  if (kind === "shape" && value === "pill") return "pill-everything";
  if (kind === "motion" && value === "reveals most sections") return "reveal-everywhere";
  if (kind === "tell") return value;
  if (kind === "opening" && /^hero > (?:logos|stats)/.test(value)) return "hero-then-proof";
  return null;
}

const STOP = new Set(
  "a an the and or but of to in on for with at by from as is are be we our you your us it its this that these those will can all more get has have not no any".split(" "),
);

function grams(text: string): Set<string> {
  const out = new Set<string>();
  // A gram never crosses punctuation that ends a clause, or a removed address.
  for (const clause of text.toLowerCase().replace(/[’']/g, "'").split(/[.!?;:|()\u2013\u2014\u00b7•]+|,\s/)) {
    const words = clause.match(/[a-z][a-z'-]*/g) ?? [];
    for (let n = 2; n <= 4; n += 1) {
      for (let i = 0; i + n <= words.length; i += 1) {
        const g = words.slice(i, i + n);
        if (STOP.has(g[0]) || STOP.has(g[n - 1])) continue;
        if (g.filter((w) => !STOP.has(w)).length < 2) continue;
        out.add(g.join(" "));
      }
    }
  }
  return out;
}

/**
 * Page grammar every site carries: navigation labels and the legal footer.
 * They recur across every null page and say nothing about the model's voice.
 */
const GRAMMAR = new Set([
  "privacy policy",
  "cookie policy",
  "rights reserved",
  "all rights reserved",
  "terms of service",
  "terms and conditions",
  "terms conditions",
  "how it works",
  "what we do",
  "about us",
  "contact us",
  "get in touch",
  "opening hours",
  "read more",
  "learn more",
  "book now",
  "free quote",
  "our services",
  "quick links",
  "email address",
  "phone number",
  "full name",
  "first name",
  "last name",
  "your name",
  "your email",
  "send message",
]);

/** Strings that are a footer's legal line, and the parts of any string that are addresses, times or numbers. */
const LEGAL = /©|&copy;|\bregistered (?:in|office|number)\b|\bcompany (?:no|number|reg)|\bvat (?:no|number|reg)/i;
const NOISE = /\S+@\S+|https?:\/\/\S+|\b[\w-]+(?:\.[\w-]+)*\.(?:co\.uk|com|org|net|uk|io)\b|\b\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)\b|\d+/gi;

function textGrams(text: string): Set<string> {
  if (LEGAL.test(text)) return new Set();
  const out = grams(text.replace(NOISE, " | "));
  for (const g of out) if (GRAMMAR.has(g)) out.delete(g);
  return out;
}

/** Capitalised words in a brief: the business's name and its place, which every run repeats. */
function properNouns(brief: string): Set<string> {
  return new Set((brief.match(/\b[A-Z][a-z]+/g) ?? []).map((w) => w.toLowerCase()).filter((w) => !STOP.has(w)));
}

/**
 * Choices that recur across null pages, with the tell that already catches
 * each, if any. The ones with `known: null` are the next generation's
 * candidates. Nothing here decides: a person reads them, and a candidate only
 * becomes a tell with a flag case and a pass case like every other.
 */
export function harvest(models: Pick<NullModel, "brief" | "runs">[], options: HarvestOptions = {}): HarvestCandidate[] {
  const minShare = options.minShare ?? 0.25;
  const runs = models.flatMap((m, b) => m.runs.map((r) => ({ ...r, brief: b })));
  const of = runs.length;
  if (of === 0) return [];
  const multiBrief = models.length > 1;
  const sample = runs.map((r) => r.fingerprint);

  const tally = new Map<string, { kind: CandidateKind; value: string; runs: Set<number>; briefs: Set<number>; example?: string }>();
  const add = (kind: CandidateKind, value: string, run: number, brief: number, example?: string) => {
    const key = `${kind}\u0000${value}`;
    const t = tally.get(key) ?? { kind, value, runs: new Set(), briefs: new Set(), example };
    t.runs.add(run);
    t.briefs.add(brief);
    tally.set(key, t);
  };

  runs.forEach((r, i) => {
    const c = choicesOf(r.fingerprint);
    for (const f of new Set([...c.display, ...c.body])) add("face", f, i, r.brief);
    add("accent", c.accent[0], i, r.brief);
    add("ground", c.ground[0], i, r.brief);
    add("shape", c.shape[0], i, r.brief);
    add("motion", c.motion[0], i, r.brief);
    add("opening", c.opening[0], i, r.brief);
    for (const t of r.tells) add("tell", t, i, r.brief);
  });

  const out: HarvestCandidate[] = [];
  for (const t of tally.values()) {
    if (t.runs.size / of < minShare) continue;
    if (t.kind === "accent" && (t.value === "none" || t.value === "neutral")) continue;
    if (t.kind === "shape" && t.value === "no buttons") continue;
    // A white or grey page is the web's default, not a model's.
    if (t.kind === "ground" && (t.value === "white" || t.value === "grey")) continue;
    if (t.kind === "motion" && t.value === "no scroll reveals") continue;
    out.push({ kind: t.kind, value: t.value, runs: t.runs.size, of, briefs: t.briefs.size, known: knownFor(t.kind, t.value, sample) });
  }

  // Phrases are rarer than design choices, so they need fewer pages, but more
  // than one brief when more than one was given: a phrase that recurs across
  // unrelated businesses is the model's, not the trade's.
  const phraseMin = Math.max(3, Math.ceil(of * minShare * 0.4));
  const names = models.map((m) => properNouns(m.brief));
  const phrases = new Map<string, { runs: Set<number>; briefs: Set<number>; example: string }>();
  runs.forEach((r, i) => {
    for (const text of r.copy) {
      for (const g of textGrams(text)) {
        if (g.split(" ").some((w) => names[r.brief].has(w))) continue;
        const p = phrases.get(g) ?? { runs: new Set(), briefs: new Set(), example: text.trim().slice(0, 140) };
        p.runs.add(i);
        p.briefs.add(r.brief);
        phrases.set(g, p);
      }
    }
  });
  const kept = [...phrases]
    .filter(([, p]) => p.runs.size >= phraseMin && (!multiBrief || p.briefs.size >= 2))
    .sort((a, b) => b[1].runs.size - a[1].runs.size || b[0].length - a[0].length);
  // Keep the longest form: "book an appointment today" hides "book an appointment"
  // when the longer one covers most of its pages.
  const maximal = kept.filter(([g, p]) => !kept.some(([h, q]) => h !== g && h.includes(g) && q.runs.size >= 0.8 * p.runs.size));
  for (const [g, p] of maximal.slice(0, 40)) {
    out.push({ kind: "phrase", value: g, runs: p.runs.size, of, briefs: p.briefs.size, known: options.copyTell?.(g) ?? null, example: p.example });
  }

  const order: CandidateKind[] = ["face", "accent", "ground", "shape", "motion", "opening", "tell", "phrase"];
  return out.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || b.runs - a.runs);
}

/** A representative colour for a hue family, for a report. */
export function hueSwatch(runs: NullRun[], hue: string): string | null {
  const hits = runs.map((r) => r.fingerprint.accent).filter((o): o is Oklch => !!o && hueName(o) === hue);
  if (hits.length === 0) return null;
  const centre = hits.reduce((best, o) => (hits.reduce((s, p) => s + deltaEOk(o, p), 0) < hits.reduce((s, p) => s + deltaEOk(best, p), 0) ? o : best));
  return formatHex(oklchToRgb(centre));
}
