/**
 * The estate check before anything is built: declared art directions compared
 * with each other, not rendered pages.
 *
 * `compareToEstate` catches two clients converging after both sites ship. By
 * then the fix is a retrofit. This compares what each `art-direction.json`
 * says it will be, so the convergence is caught while it is still a decision.
 *
 * The colour thresholds are the rendered check's own (`ACCENT_SHARED`,
 * `GROUND_SHARED`), so the two checks agree on what "the same accent" means.
 * It ranks and names what is shared; there is no sibling line until declared
 * directions have been calibrated against the rendered estate.
 *
 * Pure.
 */

import { parseColour } from "../character/color.js";
import { deltaEOk } from "../color/oklch.js";
import type { ArtDirection } from "../direction/types.js";
import { ACCENT_SHARED, GROUND_SHARED, levenshtein, SHARED_PART } from "../fingerprint/index.js";
import { normaliseFamily } from "../snapshot/fonts.js";
import type { SectionRole } from "../snapshot/types.js";

/** What an art direction commits to, as the estate register stores it. */
export interface DirectionSummary {
  accent?: string;
  ground?: string;
  display?: string;
  body?: string;
  shape?: string;
  /** The home page's running order. */
  order?: SectionRole[];
  primaryAction?: string;
  positions?: string[];
}

export function summariseDirection(d: Partial<ArtDirection>): DirectionSummary {
  const c = d.choices ?? {};
  const home = d.hierarchy?.home;
  const s: DirectionSummary = {};
  if (typeof c.accent?.value === "string" && c.accent.value) s.accent = c.accent.value;
  if (typeof c.ground?.value === "string" && c.ground.value) s.ground = c.ground.value;
  if (typeof c.display?.value === "string" && c.display.value) s.display = normaliseFamily(c.display.value);
  if (typeof c.body?.value === "string" && c.body.value) s.body = normaliseFamily(c.body.value);
  if (typeof c.shape?.value === "string" && c.shape.value) s.shape = c.shape.value;
  if (Array.isArray(home?.order) && home.order.length) s.order = home.order.filter((o) => o && typeof o.role === "string").map((o) => o.role);
  if (typeof home?.primaryAction?.value === "string" && home.primaryAction.value) {
    s.primaryAction = home.primaryAction.value;
    s.positions = Array.isArray(home.primaryAction.positions) ? [...home.primaryAction.positions] : [];
  }
  return s;
}

export interface DirectionComparison {
  shared: string[];
  accentDelta: number | null;
  groundDelta: number | null;
  /** Edit distance over the longer order, 0 to 1; null without both orders. */
  orderDistance: number | null;
  /** Worth a look before either is built. */
  flagged: boolean;
}

const delta = (a?: string, b?: string): number | null => {
  const x = a ? parseColour(a) : null;
  const y = b ? parseColour(b) : null;
  return x && y ? deltaEOk(x.oklch, y.oklch) : null;
};

const same = (a?: string, b?: string): boolean => Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());

export function compareDirections(a: DirectionSummary, b: DirectionSummary): DirectionComparison {
  const shared: string[] = [];
  const accentDelta = delta(a.accent, b.accent);
  const groundDelta = delta(a.ground, b.ground);
  if (accentDelta !== null && accentDelta <= ACCENT_SHARED) shared.push(`accent (ΔE ${accentDelta.toFixed(3)})`);
  if (groundDelta !== null && groundDelta <= GROUND_SHARED) shared.push(`ground (ΔE ${groundDelta.toFixed(3)})`);
  if (a.display && b.display && same(normaliseFamily(a.display), normaliseFamily(b.display))) shared.push(`${normaliseFamily(a.display)} headline`);
  if (a.body && b.body && same(normaliseFamily(a.body), normaliseFamily(b.body))) shared.push(`${normaliseFamily(a.body)} body`);
  if (same(a.shape, b.shape)) shared.push(`shape "${a.shape}"`);
  let orderDistance: number | null = null;
  if (a.order?.length && b.order?.length) {
    orderDistance = levenshtein(a.order, b.order) / Math.max(a.order.length, b.order.length);
    if (orderDistance <= SHARED_PART) shared.push(orderDistance === 0 ? "the same section order" : "nearly the same section order");
  }
  if (same(a.primaryAction, b.primaryAction) && [...(a.positions ?? [])].sort().join(",") === [...(b.positions ?? [])].sort().join(",")) shared.push(`"${a.primaryAction}" asked in the same places`);
  // Two of the surface choices together, or the same structure, is a look two clients share.
  const surface = shared.filter((s) => /^(?:accent|ground|shape)|headline$/.test(s)).length;
  const flagged = surface >= 2 || (orderDistance !== null && orderDistance <= SHARED_PART);
  return { shared, accentDelta, groundDelta, orderDistance, flagged };
}

export interface DirectionMatch extends DirectionComparison {
  id: string;
}

/** Every site in the register with a declared direction, most shared first. */
export function compareToDeclared(target: DirectionSummary, sites: { id: string; direction?: DirectionSummary }[], exclude?: string): DirectionMatch[] {
  return sites
    .filter((s) => s.direction && s.id !== exclude)
    .map((s) => ({ id: s.id, ...compareDirections(target, s.direction!) }))
    .sort((x, y) => y.shared.length - x.shared.length || (x.accentDelta ?? 1) - (y.accentDelta ?? 1));
}

export function formatDirectionMatches(label: string, matches: DirectionMatch[]): string {
  const lines = [`${label}: declared directions in the estate (ranked, not judged: no sibling line yet)`];
  for (const m of matches) lines.push(`  ${m.id.padEnd(20)} ${m.flagged ? "LOOK  " : "      "}${m.shared.length ? `shares ${m.shared.join(", ")}` : "nothing shared"}`);
  if (matches.length === 0) lines.push("  no site in the register has a declared direction yet: craft estate add --direction <file>");
  return lines.join("\n");
}
