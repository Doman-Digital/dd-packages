/**
 * Component-level sameness: the CTA band, the pricing table, the testimonial
 * strip, compared one kind at a time.
 *
 * The page fingerprint can say two sites look alike overall. It cannot say
 * "every site in the estate ends on the same centred band with one orange
 * button". That is the sameness a client notices when they put two of the
 * agency's sites side by side, and it lives in the components.
 *
 * Pure, over the `sections` of version 2 fingerprints. A version 1
 * fingerprint has none, so it simply has no components to compare.
 */

import { deltaEOk } from "../color/oklch.js";
import type { EstateRegister } from "../estate/index.js";
import { MIN_RUNS, TYPICAL_AT, type NullRun } from "../null/index.js";
import type { SectionRole } from "../snapshot/types.js";
import type { Fingerprint, FingerprintSection } from "./index.js";

/** Badge texts that promote one option over the others. */
export const PROMO_BADGE = /\b(?:most popular|popular|recommended|best value|best seller|bestseller|most chosen)\b/i;

/** The sections of one role in a fingerprint, in running order. */
export function componentsOf(fp: Fingerprint, role: SectionRole): FingerprintSection[] {
  return (fp.sections ?? []).filter((s) => s.role === role);
}

const clamp = (n: number): number => Math.max(0, Math.min(1, n));
const diff = (a: number | undefined, b: number | undefined, scale: number): number | null =>
  a === undefined || b === undefined ? null : clamp(Math.abs(a - b) / scale);

/**
 * 0 (the same recipe) to 1 (nothing in common), over the parts both
 * components carry: layout (centring, width, balance), furniture (buttons,
 * cards, figures, avatars, carousel, a promo badge) and colour (its own
 * ground or the page's). Different roles are 1: a pricing table and an FAQ
 * are not the same component however they are laid out.
 */
export function componentDistance(a: FingerprintSection, b: FingerprintSection): number {
  if (a.role !== b.role) return 1;
  const promo = (s: FingerprintSection) => (s.badges ?? []).some((t) => PROMO_BADGE.test(t));
  const parts: (number | null)[] = [
    diff(a.centred, b.centred, 1),
    diff(a.width, b.width, 0.5),
    diff(a.symmetry, b.symmetry, 0.5),
    diff(a.controls, b.controls, 2),
    diff(a.cards, b.cards, 3),
    diff(a.figures, b.figures, 3),
    diff(a.avatars, b.avatars, 3),
    a.carousel === undefined || b.carousel === undefined ? null : a.carousel === b.carousel ? 0 : 1,
    a.badges === undefined || b.badges === undefined ? null : promo(a) === promo(b) ? 0 : 1,
    a.background === undefined || b.background === undefined
      ? null
      : a.background === null || b.background === null
        ? a.background === b.background ? 0 : 1
        : clamp(deltaEOk(a.background, b.background) / 0.3),
  ];
  const known = parts.filter((p): p is number => p !== null);
  return known.length === 0 ? 0 : Math.round((known.reduce((s, p) => s + p, 0) / known.length) * 1000) / 1000;
}

/** What two components share, as a person would name it. */
export function componentShared(a: FingerprintSection, b: FingerprintSection): string[] {
  if (a.role !== b.role) return [];
  const out: string[] = [];
  const both = (f: (s: FingerprintSection) => boolean) => f(a) && f(b);
  if (both((s) => s.centred >= 0.7)) out.push("centred");
  else if (both((s) => s.centred < 0.3)) out.push("left-aligned");
  if (both((s) => s.width <= 0.6)) out.push("narrow column");
  else if (both((s) => s.width >= 0.8)) out.push("full width");
  if (a.controls !== undefined && a.controls === b.controls && a.controls > 0) out.push(`${a.controls} button${a.controls === 1 ? "" : "s"}`);
  if (a.cards !== undefined && a.cards === b.cards && a.cards >= 2) out.push(`${a.cards} cards`);
  if (both((s) => (s.figures ?? 0) >= 3)) out.push("a row of figures");
  if (both((s) => (s.avatars ?? 0) >= 2)) out.push("avatars");
  if (both((s) => s.carousel === true)) out.push("carousel");
  if (both((s) => (s.badges ?? []).some((t) => PROMO_BADGE.test(t)))) out.push("promo badge");
  if (a.background && b.background && deltaEOk(a.background, b.background) <= 0.06) out.push("same coloured band");
  else if (a.background === null && b.background === null) out.push("on the page ground");
  return out;
}

/** The closest pair of components of one role between two fingerprints. */
export function closestComponents(a: Fingerprint, b: Fingerprint, role: SectionRole): { distance: number; shared: string[] } | null {
  let best: { distance: number; shared: string[] } | null = null;
  for (const x of componentsOf(a, role)) {
    for (const y of componentsOf(b, role)) {
      const distance = componentDistance(x, y);
      if (!best || distance < best.distance) best = { distance, shared: componentShared(x, y) };
    }
  }
  return best;
}

export interface ComponentPair {
  a: string;
  b: string;
  distance: number;
  shared: string[];
}

/**
 * Every pair of estate sites that both have a component of this role, closest
 * first. No sibling line yet: that needs a calibration set of real
 * components, so this ranks and names, and judges nothing.
 */
export function estateComponentPairs(register: EstateRegister, role: SectionRole): ComponentPair[] {
  const out: ComponentPair[] = [];
  const s = register.sites;
  for (let i = 0; i < s.length; i += 1) {
    for (let j = i + 1; j < s.length; j += 1) {
      const c = closestComponents(s[i].fingerprint, s[j].fingerprint, role);
      if (c) out.push({ a: s[i].id, b: s[j].id, ...c });
    }
  }
  return out.sort((x, y) => x.distance - y.distance);
}

export interface ComponentTypicality {
  role: SectionRole;
  score: number;
  typical: boolean;
  distance: number;
  baseline: number;
  /** How many null pages had a component of this role to compare with. */
  runs: number;
}

const meanNearest = (d: number[], k: number): number => {
  const s = [...d].sort((a, b) => a - b).slice(0, k);
  return s.reduce((t, v) => t + v, 0) / s.length;
};

/**
 * How typical one component is against the same role in a null model, by
 * the method `typicality` uses for whole pages: each null component is scored
 * against the others leaving itself out, and the page's component is placed
 * in that spread. Null when fewer than `MIN_RUNS` null pages have the role.
 */
export function componentTypicality(target: FingerprintSection, runs: NullRun[], k = 3): ComponentTypicality | null {
  const pool = runs.flatMap((r) => componentsOf(r.fingerprint, target.role).slice(0, 1));
  if (pool.length < MIN_RUNS) return null;
  const kk = Math.min(k, pool.length - 1);
  const distance = meanNearest(pool.map((p) => componentDistance(target, p)), kk);
  const loo = pool.map((p, i) => meanNearest(pool.filter((_, j) => j !== i).map((o) => componentDistance(p, o)), kk));
  const score = loo.filter((d) => d >= distance).length / loo.length;
  const sorted = [...loo].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const baseline = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return {
    role: target.role,
    score: Math.round(score * 100) / 100,
    typical: score >= TYPICAL_AT,
    distance: Math.round(distance * 1000) / 1000,
    baseline: Math.round(baseline * 1000) / 1000,
    runs: pool.length,
  };
}

/**
 * The roles that name a component rather than a generic block: what
 * `--component` accepts and what `craft audit --null` scores one by one.
 */
export const COMPONENT_ROLES: readonly SectionRole[] = ["cta-band", "footer-cta", "pricing", "testimonials", "faq", "process", "features", "team", "contact", "stats"];

/**
 * Typicality for each component on a page that the null model can speak to:
 * the first section of each component role, skipping roles too few null
 * pages have.
 */
export function componentTypicalities(fp: Fingerprint, runs: NullRun[], k = 3): ComponentTypicality[] {
  const out: ComponentTypicality[] = [];
  for (const role of COMPONENT_ROLES) {
    const first = componentsOf(fp, role)[0];
    const t = first ? componentTypicality(first, runs, k) : null;
    if (t) out.push(t);
  }
  return out;
}
