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
 *
 * 3 adds `hero` (the headline's size and where the hero's picture sits).
 * Rhythm, the sequence of light and dark bands, is read from the version 2
 * `sections`, so a version 2 fingerprint measures it without a fresh
 * snapshot. A part neither side carries is left out of the distance rather
 * than counted as different (see `fingerprintDistance`).
 */
export const FINGERPRINT_VERSION = 3;

/** One section as layout comparison sees it. */
export interface FingerprintSection {
  role: SectionRole;
  /** Share of centred text, 0 to 1. */
  centred: number;
  /** Content width over viewport width, 0 to 1. */
  width: number;
  /** Left-right balance of the content, 0 to 1. Component comparison only. */
  symmetry?: number;
  /** Buttons in the section. */
  controls?: number;
  /** Cards side by side. */
  cards?: number;
  /** The section's own background, or null when it is the page ground. */
  background?: Oklch | null;
  /** Badge texts ("Most popular"), lower-cased. */
  badges?: string[];
  /** Small round portraits. */
  avatars?: number;
  carousel?: boolean;
  /** Large standalone figures. */
  figures?: number;
}

/** Where the hero's largest picture sits, relative to the headline. */
export type HeroImage = "left" | "right" | "full" | "none";

/** The hero's composition: the first thing two sites are compared on by eye. */
export interface FingerprintHero {
  /** The headline (the first h1 inside the hero), or null when the hero has none. */
  headline: { sizePx: number; weight: number; class: FontClass; italic: boolean } | null;
  /**
   * The largest photo or illustration in the hero: beside the text (left or
   * right of the viewport's centre line), `full` when it spans the width,
   * `none` without one. Absent when the snapshot predates image positions.
   */
  image?: HeroImage;
}

export interface Fingerprint {
  version: 1 | 2 | 3;
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
  /** Version 3: present when the page has a hero section. */
  hero?: FingerprintHero;
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

/** A picture spanning this share of the viewport is behind the text, not beside it. */
const FULL_WIDTH_IMAGE = 0.8;

/**
 * The hero is the first section that holds the h1, or the first section
 * marked as one: the section reader splits a nav band from the hero on some
 * pages, and the band is not where the headline is.
 */
function heroOf(s: Snapshot): FingerprintHero | undefined {
  const h1 = s.headings.find((h) => h.level === 1);
  const inside = (top: number, x: { top: number; height: number }) => top >= x.top && top < x.top + x.height;
  const index = (() => {
    const withH1 = h1 ? s.sections.findIndex((x) => x.kind === "hero" && inside(h1.top, x)) : -1;
    return withH1 >= 0 ? withH1 : s.sections.findIndex((x) => x.kind === "hero");
  })();
  if (index < 0) return undefined;
  const section = s.sections[index];
  const headline = h1 && inside(h1.top, section) ? { sizePx: h1.sizePx, weight: h1.weight, class: fontClass(normaliseFamily(h1.family)), italic: h1.italic || h1.italicPart } : null;
  if (!s.images) return { headline };
  const picture = s.images
    .filter((i) => (i.role === "photo" || i.role === "illustration") && (i.section === index || (i.section === null && inside(i.top, section))))
    .sort((a, b) => b.width * b.height - a.width * a.height)[0];
  if (!picture) return { headline, image: "none" };
  if (picture.left === undefined) return { headline };
  const image: HeroImage = picture.width >= FULL_WIDTH_IMAGE * s.viewport.width ? "full" : picture.left + picture.width / 2 < s.viewport.width / 2 ? "left" : "right";
  return { headline, image };
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
  const hero = heroOf(s);
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
      ? {
          sections: s.sections.map((x) => ({
            role: x.role!,
            centred: x.geometry!.centredShare,
            width: x.geometry!.contentWidthRatio,
            symmetry: x.geometry!.mirrorSymmetry,
            controls: x.geometry!.controls,
            cards: x.cards,
            background: x.geometry!.background === s.ground ? null : oklch(x.geometry!.background),
            badges: (x.badges ?? []).map((b) => b.toLowerCase()),
            avatars: x.avatars ?? 0,
            carousel: x.carousel ?? false,
            figures: x.figures ?? 0,
          })),
        }
      : {}),
    ...(hero ? { hero } : {}),
  };
}

// ------------------------------------------------------------ temperature

/**
 * OKLCh hues that read as warm (red through orange and yellow) and cool
 * (teal through blue and violet). The greens and magentas between are
 * neither: a sage grey and a blush grey are tinted, not warm or cool.
 */
const WARM_HUE: [number, number][] = [
  [330, 360],
  [0, 130],
];
const COOL_HUE: [number, number][] = [[160, 310]];
/**
 * Chroma at which a ground's tint is unmistakable. RMP's cream sits at 0.010
 * and Bellerose's stone at 0.007, both plainly warm paper; Bellerose's
 * porcelain (#F1F3F4) at 0.003 is a cool hint. A page ground is the largest
 * area on the page and the eye adapts to it, so a tint far below what reads
 * as a difference between two buttons still reads as warm or cool paper.
 */
export const TEMPERATURE_FULL = 0.006;
/** A ground is named warm or cool from this temperature, about chroma 0.0024. Below it, the name stays neutral. */
export const TEMPERATURE_NAMED = 0.4;

/**
 * How warm or cool a colour reads, -1 (fully cool) through 0 (neutral) to 1
 * (fully warm): the chroma over `TEMPERATURE_FULL`, signed by the hue.
 */
export function groundTemperature(o: Oklch): number {
  const h = ((o.h % 360) + 360) % 360;
  const within = (bands: [number, number][]) => bands.some(([lo, hi]) => h >= lo && h < hi);
  const strength = Math.min(1, o.c / TEMPERATURE_FULL);
  return within(WARM_HUE) ? strength : within(COOL_HUE) ? -strength : 0;
}

export type Temperature = "warm" | "neutral" | "cool";

export function temperatureName(o: Oklch): Temperature {
  const t = groundTemperature(o);
  return t >= TEMPERATURE_NAMED ? "warm" : t <= -TEMPERATURE_NAMED ? "cool" : "neutral";
}

// --------------------------------------------------------------- distance

export interface FingerprintDistance {
  /** 0 identical, 1 nothing in common. A weighted mean of the parts both sides measure. */
  total: number;
  parts: {
    accent: number;
    ground: number;
    type: number;
    shape: number;
    motion: number;
    effects: number;
    layout: number;
    /** Null when either side has no sections (version 1). */
    rhythm: number | null;
    /** Null when either side has no hero. */
    hero: number | null;
  };
}

/**
 * How much each part counts. Accent and type are where a model's defaults
 * show first and where a real business has something of its own, so they
 * carry the most. Structure (the running order, the rhythm of light and dark
 * bands, and the hero's composition) carries a quarter between its three
 * parts: two sites that open the same way read as the same site before any
 * colour is compared. A part only one side measures is left out and the
 * rest are weighed over what remains.
 */
export const DISTANCE_WEIGHTS = { accent: 0.2, type: 0.2, ground: 0.1, shape: 0.1, motion: 0.05, effects: 0.1, layout: 0.1, rhythm: 0.1, hero: 0.05 } as const;

/** Edit distance with a substitution cost from 0 (same) to 1 (different). */
export function levenshtein<T>(a: T[], b: T[], cost: (x: T, y: T) => number = (x, y) => (x === y ? 0 : 1)): number {
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

// ----------------------------------------------------------------- rhythm

/** A section's band by the lightness of what it is painted on. */
export type LightnessBand = "light" | "mid" | "dark";

export function bandOf(l: number): LightnessBand {
  return l < 0.4 ? "dark" : l >= 0.75 ? "light" : "mid";
}

/**
 * The page's rhythm: its bands of light and dark in running order, each run
 * of same-lightness sections merged into one. "Light hero, white logo strip,
 * near-black band, light features" is light, dark, light: the strip is part
 * of the light opening, which is how a visitor sees it. Null for a version 1
 * fingerprint, which has no section backgrounds.
 */
export function rhythmOf(fp: Fingerprint): LightnessBand[] | null {
  if (!fp.sections) return null;
  const out: LightnessBand[] = [];
  for (const s of fp.sections) {
    if (s.background === undefined) return null;
    const band = bandOf((s.background ?? fp.ground).l);
    if (out[out.length - 1] !== band) out.push(band);
  }
  return out;
}

/** The first bands count double: the opening is what two sites are compared on before anyone scrolls. */
export const OPENING_BANDS = 3;

/**
 * Rhythm distance, 0 to 1: the edit distance over the opening bands and over
 * the whole sequence, averaged. Null when either side has no sections.
 */
export function rhythmDistance(a: Fingerprint, b: Fingerprint): number | null {
  const ra = rhythmOf(a);
  const rb = rhythmOf(b);
  if (!ra || !rb) return null;
  const over = (x: LightnessBand[], y: LightnessBand[]) => {
    const longest = Math.max(x.length, y.length);
    return longest === 0 ? 0 : levenshtein(x, y) / longest;
  };
  return (over(ra.slice(0, OPENING_BANDS), rb.slice(0, OPENING_BANDS)) + over(ra, rb)) / 2;
}

// ------------------------------------------------------------------- hero

/** Two headlines an octave apart (48px against 96px) are as different in size as headlines get. */
const HEADLINE_OCTAVES = 1;

function heroSection(fp: Fingerprint): FingerprintSection | undefined {
  return fp.sections?.find((s) => s.role === "hero");
}

/**
 * Hero distance, 0 to 1, over the parts both sides measure: where the text
 * sits (centred or left), how wide it runs, the headline's class and size,
 * and which side the picture is on. Null when either side has no hero.
 */
export function heroDistance(a: Fingerprint, b: Fingerprint): number | null {
  const sa = heroSection(a);
  const sb = heroSection(b);
  if (!sa || !sb) return null;
  const parts: number[] = [Math.abs(sa.centred - sb.centred), clamp(Math.abs(sa.width - sb.width) / 0.5)];
  const ha = a.hero?.headline;
  const hb = b.hero?.headline;
  if (ha && hb) parts.push(0.5 * (ha.class === hb.class ? 0 : 1) + 0.5 * clamp(Math.abs(Math.log2(ha.sizePx / hb.sizePx)) / HEADLINE_OCTAVES));
  else if (a.hero && b.hero && (ha || hb)) parts.push(1);
  if (a.hero?.image && b.hero?.image) parts.push(a.hero.image === b.hero.image ? 0 : 1);
  return parts.reduce((s, p) => s + p, 0) / parts.length;
}

// ----------------------------------------------------------------- ground

function faceDistance(a: Fingerprint["display"], b: Fingerprint["display"]): number {
  if (a.family.toLowerCase() === b.family.toLowerCase()) return 0;
  return a.class === b.class ? 0.5 : 1;
}

/** ΔE in OKLab. 0.02 is barely visible; by 0.3 two accents read as different colours. */
export const ACCENT_SCALE = 0.3;
/** Grounds sit near white, where a smaller step already reads as a different paper. */
export const GROUND_SCALE = 0.15;
/**
 * How much a difference in temperature adds to the ground distance, on top
 * of ΔE. Cream against porcelain is ΔE 0.013, a tenth of `GROUND_SCALE`, and
 * nobody takes them for the same paper: the temperature carries what ΔE
 * cannot at this chroma. Warm against cool adds 0.6; warm against neutral
 * white adds 0.3; two warm papers add nothing.
 */
export const TEMPERATURE_WEIGHT = 0.6;
/** A part at or below this distance counts as shared between two sites. */
export const SHARED_PART = 0.2;
/** Two accents within this ΔE_OK read as the same colour family: about 6 on the familiar ΔE scale. */
export const ACCENT_SHARED = ACCENT_SCALE * SHARED_PART;
/** Two grounds within this ΔE_OK read as the same paper. */
export const GROUND_SHARED = GROUND_SCALE * SHARED_PART;

/** Ground distance, 0 to 1: ΔE over `GROUND_SCALE`, plus the temperature gap. */
export function groundDistance(a: Oklch, b: Oklch): number {
  return clamp(deltaEOk(a, b) / GROUND_SCALE + (TEMPERATURE_WEIGHT * Math.abs(groundTemperature(a) - groundTemperature(b))) / 2);
}

export function fingerprintDistance(a: Fingerprint, b: Fingerprint): FingerprintDistance {
  const accent = a.accent && b.accent ? clamp(deltaEOk(a.accent, b.accent) / ACCENT_SCALE) : a.accent || b.accent ? 1 : 0;
  const ground = groundDistance(a.ground, b.ground);
  const type = 0.6 * faceDistance(a.display, b.display) + 0.4 * faceDistance(a.body, b.body);
  const shape = a.roundness === null || b.roundness === null ? (a.roundness === b.roundness ? 0 : 0.5) : clamp(Math.abs(a.roundness - b.roundness) / 0.5);
  const motion = clamp(Math.abs(a.motion - b.motion));
  const union = new Set([...a.effects, ...b.effects]);
  const shared = a.effects.filter((e) => b.effects.includes(e)).length;
  const effects = union.size === 0 ? 0 : 1 - shared / union.size;
  const layout = layoutDistance(a, b);
  const rhythm = rhythmDistance(a, b);
  const hero = heroDistance(a, b);
  const parts = { accent, ground, type, shape, motion, effects, layout, rhythm, hero };
  let sum = 0;
  let weight = 0;
  for (const k of Object.keys(DISTANCE_WEIGHTS) as (keyof typeof DISTANCE_WEIGHTS)[]) {
    const p = parts[k];
    if (p === null) continue;
    sum += DISTANCE_WEIGHTS[k] * p;
    weight += DISTANCE_WEIGHTS[k];
  }
  return { total: Math.round((sum / weight) * 1000) / 1000, parts };
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
