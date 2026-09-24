/**
 * A fingerprint: the handful of choices that make a site look like itself,
 * reduced to something two sites can be compared on.
 *
 * Signals 2 and 3 of CHARACTER.md both need a distance. "Would a model have
 * built this anyway" is a distance from what the model builds; "does this
 * look like the agency's other sites" is a distance from the estate. Neither
 * cares about the exact pixels. They care whether the accent, the type, the
 * ground, the shape language, the motion and the running order were chosen
 * or defaulted, so that is what a fingerprint records.
 *
 * Pure. Built from a Snapshot, so it describes what a visitor gets.
 */

import { parseColour } from "../character/color.js";
import { deltaEOk, type Oklch } from "../color/oklch.js";
import { fontClass, normaliseFamily, type FontClass } from "../snapshot/fonts.js";
import type { SectionKind, SectionRole, Snapshot } from "../snapshot/types.js";

/**
 * 2 adds `sections` (role and geometry in running order). A version 1
 * fingerprint, or one from a version 1 snapshot, has none, and every
 * comparison involving it uses `layout` exactly as version 1 did, so the null
 * models and the estate register compare as they were calibrated until they
 * are re-snapshotted.
 */
export const FINGERPRINT_VERSION = 2;

/** One section as layout comparison sees it. */
export interface FingerprintSection {
  role: SectionRole;
  /** Share of centred text, 0 to 1. */
  centred: number;
  /** Content width over viewport width, 0 to 1. */
  width: number;
}

export interface Fingerprint {
  version: 1 | 2;
  /** The most prominent chromatic colour: button fills first, then painted area, then text. */
  accent: Oklch | null;
  ground: Oklch;
  display: { family: string; class: FontClass };
  body: { family: string; class: FontClass };
  /** Median button corner radius over its height, 0 (square) to 0.5 (pill). */
  roundness: number | null;
  /** Share of below-the-fold sections that wait for a scroll to appear. */
  motion: number;
  /** Which second-look effects are present, as tell ids. */
  effects: string[];
  /** Section kinds in running order, hero first. */
  layout: SectionKind[];
  /** Version 2: present when every section carries a role and geometry. */
  sections?: FingerprintSection[];
}

/** Below this chroma a colour reads as grey. A dark forest green (about 0.04) is still a choice. */
const CHROMATIC = 0.03;
/** CSS px²: a 200 by 100 panel. */
const MIN_ACCENT_AREA = 20_000;
const oklch = (value: string): Oklch | null => {
  const parsed = parseColour(value);
  return parsed && parsed.alpha > 0.5 ? parsed.oklch : null;
};

function accentOf(s: Snapshot): Oklch | null {
  const buttons = new Map<string, number>();
  for (const c of s.controls) {
    const o = oklch(c.background);
    if (o && o.c >= CHROMATIC) buttons.set(c.background, (buttons.get(c.background) ?? 0) + 1);
  }
  const topButton = [...buttons].sort((a, b) => b[1] - a[1])[0];
  if (topButton) return oklch(topButton[0]);
  // A painted colour has to cover a panel's worth of page to be the accent.
  // A floating chat button (a 48px WhatsApp green) is the only saturated
  // paint on many monochrome sites, and would otherwise be read as the brand.
  const bg = s.colours.backgrounds.map((b) => ({ o: oklch(b.value), w: b.area })).filter((x) => x.o && x.o.c >= CHROMATIC && x.w >= MIN_ACCENT_AREA).sort((a, b) => b.w - a.w)[0];
  if (bg) return bg.o;
  const text = s.colours.text.map((t) => ({ o: oklch(t.value), w: t.chars })).filter((x) => x.o && x.o.c >= CHROMATIC).sort((a, b) => b.w - a.w)[0];
  return text ? text.o : null;
}

function faces(s: Snapshot): { display: Fingerprint["display"]; body: Fingerprint["body"] } {
  const byChars = [...s.fonts].sort((a, b) => b.chars - a.chars);
  const byDisplay = [...s.fonts].sort((a, b) => b.displayChars - a.displayChars);
  const bodyName = normaliseFamily(byChars[0]?.family ?? "system-ui");
  const displayName = normaliseFamily((byDisplay[0]?.displayChars ? byDisplay[0].family : byChars[0]?.family) ?? "system-ui");
  return {
    display: { family: displayName, class: fontClass(displayName) },
    body: { family: bodyName, class: fontClass(bodyName) },
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function fingerprint(s: Snapshot): Fingerprint {
  const effects: string[] = [];
  if (s.effects.glass > 0) effects.push("glass-panel");
  if (s.effects.gradientText > 0) effects.push("gradient-text");
  if (s.effects.glows > 0 || s.effects.gradients.some((g) => g.radial)) effects.push("radial-spotlight-glow");
  if (s.effects.gridBackgrounds > 0) effects.push("grid-background");
  if (s.effects.marquees > 0) effects.push("marquee");
  if (s.effects.hairlineShadowCards >= 3) effects.push("thin-border-wide-shadow");
  if (s.effects.eyebrowChip) effects.push("hero-eyebrow-chip");
  if (s.motion.introOverlay) effects.push("intro-cinematic");
  const below = s.sections.filter((x) => x.top > s.viewport.height).length;
  return {
    version: FINGERPRINT_VERSION,
    accent: accentOf(s),
    ground: oklch(s.ground) ?? { l: 1, c: 0, h: 0 },
    ...faces(s),
    roundness: median(s.controls.map((c) => Math.min(0.5, c.radiusPx / Math.max(1, c.heightPx)))),
    motion: below ? Math.min(1, s.motion.hiddenSections / below) : 0,
    effects: effects.sort(),
    layout: s.sections.map((x) => x.kind),
    ...(s.sections.length > 0 && s.sections.every((x) => x.role && x.geometry)
      ? { sections: s.sections.map((x) => ({ role: x.role!, centred: x.geometry!.centredShare, width: x.geometry!.contentWidthRatio })) }
      : {}),
  };
}

export interface FingerprintDistance {
  /** 0 identical, 1 nothing in common. A weighted mean of the parts. */
  total: number;
  parts: { accent: number; ground: number; type: number; shape: number; motion: number; effects: number; layout: number };
}

/**
 * How much each part counts. Accent and type are where a model's defaults
 * show first and where a real business has something of its own, so they
 * carry half the weight between them.
 */
export const DISTANCE_WEIGHTS = { accent: 0.25, type: 0.25, ground: 0.1, shape: 0.1, motion: 0.1, effects: 0.1, layout: 0.1 } as const;

/** Edit distance with a substitution cost from 0 (same) to 1 (different). */
function levenshtein<T>(a: T[], b: T[], cost: (x: T, y: T) => number = (x, y) => (x === y ? 0 : 1)): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost(a[i - 1], b[j - 1]));
      prev = cur;
    }
  }
  return row[b.length];
}

/**
 * Two sections with the same role differ by how they are laid out: a
 * centred, narrow CTA band and a left-aligned, full-width one are not the
 * same recipe. At most half a substitution, so a different role always
 * costs more than a different layout of the same role.
 */
function sectionCost(x: FingerprintSection, y: FingerprintSection): number {
  if (x.role !== y.role) return 1;
  return Math.min(0.5, (Math.abs(x.centred - y.centred) + Math.abs(x.width - y.width)) / 2);
}

/** Layout distance, 0 to 1: by role and geometry when both have them, else by kind as in version 1. */
export function layoutDistance(a: Fingerprint, b: Fingerprint): number {
  if (a.sections && b.sections) {
    const longest = Math.max(a.sections.length, b.sections.length);
    return longest === 0 ? 0 : levenshtein(a.sections, b.sections, sectionCost) / longest;
  }
  const longest = Math.max(a.layout.length, b.layout.length);
  return longest === 0 ? 0 : levenshtein(a.layout, b.layout) / longest;
}

const clamp = (n: number): number => Math.max(0, Math.min(1, n));

function faceDistance(a: Fingerprint["display"], b: Fingerprint["display"]): number {
  if (a.family.toLowerCase() === b.family.toLowerCase()) return 0;
  return a.class === b.class ? 0.5 : 1;
}

export function fingerprintDistance(a: Fingerprint, b: Fingerprint): FingerprintDistance {
  // ΔE in OKLab. 0.02 is barely visible; by 0.3 two accents read as different colours.
  const accent = a.accent && b.accent ? clamp(deltaEOk(a.accent, b.accent) / 0.3) : a.accent || b.accent ? 1 : 0;
  const ground = clamp(deltaEOk(a.ground, b.ground) / 0.15);
  const type = 0.6 * faceDistance(a.display, b.display) + 0.4 * faceDistance(a.body, b.body);
  const shape = a.roundness === null || b.roundness === null ? (a.roundness === b.roundness ? 0 : 0.5) : clamp(Math.abs(a.roundness - b.roundness) / 0.5);
  const motion = clamp(Math.abs(a.motion - b.motion));
  const union = new Set([...a.effects, ...b.effects]);
  const shared = a.effects.filter((e) => b.effects.includes(e)).length;
  const effects = union.size === 0 ? 0 : 1 - shared / union.size;
  const layout = layoutDistance(a, b);
  const parts = { accent, ground, type, shape, motion, effects, layout };
  const total = (Object.keys(DISTANCE_WEIGHTS) as (keyof typeof DISTANCE_WEIGHTS)[]).reduce((sum, k) => sum + DISTANCE_WEIGHTS[k] * parts[k], 0);
  return { total: Math.round(total * 1000) / 1000, parts };
}

/**
 * The nearest neighbours of a fingerprint in a set, closest first. Typicality
 * (phase D) and estate distance (phase E) are both this, against different sets.
 */
export function nearest<T>(target: Fingerprint, set: { id: T; fingerprint: Fingerprint }[], k = set.length): { id: T; distance: FingerprintDistance }[] {
  return set
    .map((item) => ({ id: item.id, distance: fingerprintDistance(target, item.fingerprint) }))
    .sort((x, y) => x.distance.total - y.distance.total)
    .slice(0, k);
}
