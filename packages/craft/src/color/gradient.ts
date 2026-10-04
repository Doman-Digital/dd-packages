/**
 * Contrast against a CSS gradient: the case automated tools do not score.
 *
 * axe-core and Lighthouse mark text on a gradient "incomplete", and it never
 * reaches the result, so a page can report no contrast violations while its
 * body copy fails AA. This was first found on two client sites (4.14:1 to
 * 4.44:1, reported clean by every tool in CI). This walks the gradient's
 * stops, composites each over what sits beneath, and scores the text against
 * the worst one: the backdrop the text has to clear everywhere.
 *
 * WCAG 2.2 defines no method for gradient or translucent backdrops, so the
 * worst point is this package's own rule, not a conformance claim.
 *
 * Folded in from dd-drift-guards (guards/contrast-math.mjs) on 3 October 2026,
 * on craft's own colour parsing and contrast models, with one fix: the guard
 * scored the stops only. The worst point can sit between two stops, wherever
 * the backdrop's luminance comes closest to the text's: mid-grey text on a
 * black-to-white gradient clears 4.5:1 against both ends and about 1:1 in the
 * middle. So each segment is sampled, interpolated as browsers paint legacy
 * colours (sRGB, premultiplied alpha), except across a hard stop
 * (`#000 50%, #fff 50%`), where the browser paints a jump and no blend. Pure.
 */

import { parseColour } from "../character/color.js";
import { apcaContrast, wcagContrast } from "./contrast.js";
import { formatHex, oklchToRgb, parseHex, type Rgb } from "./oklch.js";

type Rgba = Rgb & { a: number };

const KEYWORDS: Record<string, Rgba> = {
  white: { r: 1, g: 1, b: 1, a: 1 },
  black: { r: 0, g: 0, b: 0, a: 1 },
  transparent: { r: 0, g: 0, b: 0, a: 0 },
};

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** Any colour craft reads, as sRGB 0..1 with alpha; null when it cannot be read. */
function toRgba(raw: string): Rgba | null {
  const value = raw.trim().toLowerCase();
  if (KEYWORDS[value]) return KEYWORDS[value];
  // Hex and rgb() are read exactly: through OKLCh and back they drift by a
  // fraction of a channel, enough to move a composited 127.5 across a byte.
  if (/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(value)) {
    const h = value.length <= 5 ? [...value.slice(1)].map((c) => c + c).join("") : value.slice(1);
    const { r, g, b } = parseHex(h.slice(0, 6));
    return { r, g, b, a: h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1 };
  }
  const rgb = /^rgba?\(([^)]+)\)$/.exec(value);
  if (rgb) {
    const parts = rgb[1].split(/[\s,/]+/).filter(Boolean);
    const channel = (p: string): number => (p.endsWith("%") ? parseFloat(p) / 100 : parseFloat(p) / 255);
    const alpha = parts[3] === undefined ? 1 : parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
    const [r, g, b] = parts.slice(0, 3).map(channel);
    if (parts.length >= 3 && [r, g, b, alpha].every(Number.isFinite)) return { r: clamp01(r), g: clamp01(g), b: clamp01(b), a: clamp01(alpha) };
    return null;
  }
  const parsed = parseColour(value);
  if (!parsed) return null;
  const { r, g, b } = oklchToRgb(parsed.oklch);
  return { r: clamp01(r), g: clamp01(g), b: clamp01(b), a: clamp01(parsed.alpha) };
}

/** Samples per segment between two stops: under 1/255 of a channel apart for any pair. */
export const SAMPLES_PER_SEGMENT = 256;

/** A point between two stops, premultiplied as CSS interpolates alpha. */
function mix(a: Rgba, b: Rgba, t: number): Rgba {
  const alpha = a.a + (b.a - a.a) * t;
  if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const ch = (x: number, y: number): number => (x * a.a + (y * b.a - x * a.a) * t) / alpha;
  return { r: ch(a.r, b.r), g: ch(a.g, b.g), b: ch(a.b, b.b), a: alpha };
}

/** Source-over: a translucent colour on an opaque one, in sRGB as browsers paint it. */
function composite(top: Rgba, under: Rgb): Rgb {
  return {
    r: top.r * top.a + under.r * (1 - top.a),
    g: top.g * top.a + under.g * (1 - top.a),
    b: top.b * top.a + under.b * (1 - top.a),
  };
}

/**
 * The colour stops of a CSS gradient, in order, as written. Splits on
 * top-level commas only, so `rgba(1, 2, 3, 0.4)` survives, and drops the
 * direction or shape argument (`to bottom`, `135deg`, `circle at top`).
 * Throws on a stop it cannot read: a skipped stop could be the worst one.
 */
export function gradientStops(gradient: string): string[] {
  return parseStops(gradient).map((s) => s.colour);
}

type Position = { value: number; unit: string };
type Stop = { colour: string; positions: Position[] };

/** The stops with their positions (up to two each), as written. */
function parseStops(gradient: string): Stop[] {
  const inner = /gradient\(([\s\S]*)\)\s*$/.exec(gradient.trim());
  if (!inner) throw new Error(`not a CSS gradient: ${gradient}`);
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of inner[1]) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());

  const stops: Stop[] = [];
  for (const part of parts) {
    // The direction or shape argument carries no colour. Judged on the part
    // as written: with its angle stripped, `from 45deg` would read as `from`.
    if (/^(to\s|circle|ellipse|closest|farthest|at\s|from\s|in\s|-?[\d.]+(deg|turn|rad|grad)$)/i.test(part)) continue;
    // A stop may carry one or two positions: `#fff 10%`, `#fff 10% 20%`, or
    // angles in a conic gradient: `#fff 90deg`, `#fff 0.5turn`.
    const positions: Position[] = [];
    let colour = part;
    for (let i = 0; i < 2; i++) {
      const m = /\s+(-?[\d.]+)(%|px|r?em|vw|vh|deg|turn|rad|grad)\s*$/i.exec(colour);
      if (!m) break;
      positions.unshift({ value: parseFloat(m[1]), unit: m[2].toLowerCase() });
      colour = colour.slice(0, m.index);
    }
    colour = colour.trim();
    if (!toRgba(colour)) throw new Error(`unreadable gradient stop "${colour}" in ${gradient}`);
    stops.push({ colour, positions });
  }
  if (stops.length === 0) throw new Error(`no colour stops in ${gradient}`);
  return stops;
}

/**
 * The adjacent stops the browser blends between. A stop with two positions is
 * a solid band. CSS moves a stop placed at or before an earlier one up to it,
 * so such a stop starts a hard edge: the colour jumps and nothing between is
 * painted, so sampling there would invent a backdrop that does not exist.
 * Positions are compared within one unit only; a stop with no position, or a
 * mix of units, counts as blended, which can only over-report.
 */
function blendedSegments(stops: Stop[]): [Rgba, Rgba][] {
  const entries: { rgba: Rgba; pos: Position | null }[] = [];
  for (const s of stops) {
    const rgba = toRgba(s.colour)!;
    if (s.positions.length === 0) entries.push({ rgba, pos: null });
    for (const pos of s.positions) entries.push({ rgba, pos });
  }
  const furthest: Record<string, number> = {};
  const pairs: [Rgba, Rgba][] = [];
  for (let i = 0; i + 1 < entries.length; i++) {
    const pos = entries[i].pos;
    if (pos) furthest[pos.unit] = Math.max(furthest[pos.unit] ?? -Infinity, pos.value);
    const next = entries[i + 1].pos;
    const hard = next !== null && furthest[next.unit] !== undefined && next.value <= furthest[next.unit];
    if (!hard) pairs.push([entries[i].rgba, entries[i + 1].rgba]);
  }
  return pairs;
}

export interface GradientContrast {
  text: string;
  gradient: string;
  beneath: string;
  /** Every stop composited over `beneath`, as hex. */
  stops: string[];
  /** The point of the gradient, stop or between stops, the text contrasts least with. */
  worst: string;
  /** WCAG 2.x ratio against the worst point. */
  wcag: number;
  /** APCA Lc against the worst point, signed. */
  lc: number;
  passesAA: boolean;
  passesAALarge: boolean;
  note: string;
}

/**
 * Text on a gradient that sits on `beneath` (an opaque colour; default white).
 * The text colour must be opaque: a translucent text colour depends on the
 * backdrop at each pixel, which is a rendered measurement, not this one.
 */
export function gradientContrast(text: string, gradient: string, beneath = "#ffffff"): GradientContrast {
  const under = toRgba(beneath);
  if (!under || under.a < 1) throw new Error(`beneath must be an opaque colour, got ${beneath}`);
  const fg = toRgba(text);
  if (!fg || fg.a < 1) throw new Error(`text must be an opaque colour, got ${text}`);
  const textHex = formatHex(fg);
  const parsed = parseStops(gradient);
  const stops = parsed.map((s) => formatHex(composite(toRgba(s.colour)!, under)));
  let worst = stops[0];
  let worstRatio = wcagContrast(textHex, worst);
  for (const s of stops) {
    const ratio = wcagContrast(textHex, s);
    if (ratio < worstRatio) [worst, worstRatio] = [s, ratio];
  }
  for (const [a, b] of blendedSegments(parsed)) {
    for (let k = 1; k < SAMPLES_PER_SEGMENT; k++) {
      const point = formatHex(composite(mix(a, b, k / SAMPLES_PER_SEGMENT), under));
      const ratio = wcagContrast(textHex, point);
      if (ratio < worstRatio) [worst, worstRatio] = [point, ratio];
    }
  }
  const wcag = wcagContrast(textHex, worst);
  const lc = apcaContrast(textHex, worst);
  return {
    text,
    gradient,
    beneath,
    stops,
    worst,
    wcag,
    lc,
    passesAA: wcag >= 4.5,
    passesAALarge: wcag >= 3,
    note: `${text} on ${gradient} over ${beneath}: worst point ${worst}, ${wcag.toFixed(2)}:1, Lc ${lc.toFixed(1)}`,
  };
}
