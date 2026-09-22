/**
 * Every colour syntax the estate actually writes, read into OKLCh.
 *
 * A hue rule that only knows Tailwind class names misses the site that sets its
 * violet as `#5a35d1`, which is exactly what the old checker did. Hue is judged
 * in OKLCh because that is where "violet" is one range of angles; in RGB and HSL
 * the same perceived hue drifts with lightness.
 */

import { formatHex, hexToOklch, type Oklch } from "../color/oklch.js";

export interface FoundColour {
  raw: string;
  oklch: Oklch;
  alpha: number;
  /** Offset of `raw` inside the searched string. */
  index: number;
}

const COLOUR =
  /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3,4}\b|\b(?:rgba?|hsla?|oklch)\([^)]*\)/g;

function num(token: string, percentOf: number): number {
  const t = token.trim();
  if (t.endsWith("%")) return (parseFloat(t) / 100) * percentOf;
  return parseFloat(t);
}

function parts(fn: string): { channels: string[]; alpha: number } {
  const inner = fn.slice(fn.indexOf("(") + 1, -1).trim();
  const [main, slashAlpha] = inner.split("/");
  const channels = main.split(/[\s,]+/).filter(Boolean);
  let alpha = 1;
  if (slashAlpha !== undefined) alpha = num(slashAlpha, 1);
  else if (channels.length === 4) alpha = num(channels.pop()!, 1);
  return { channels, alpha: Number.isFinite(alpha) ? alpha : 1 };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const k = (n: number): number => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number): number => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: f(0), g: f(8), b: f(4) };
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

export function parseColour(raw: string): { oklch: Oklch; alpha: number } | null {
  try {
    if (raw.startsWith("#")) {
      const hex = raw.slice(1);
      const alpha =
        hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1;
      return { oklch: hexToOklch(raw), alpha };
    }
    const fn = raw.slice(0, raw.indexOf("(")).toLowerCase();
    const { channels, alpha } = parts(raw);
    if (channels.length < 3 || channels.some((c) => c.startsWith("var"))) return null;
    if (fn === "oklch") {
      const l = num(channels[0], 1);
      const c = num(channels[1], 0.4);
      const h = parseFloat(channels[2]);
      if (![l, c].every(Number.isFinite)) return null;
      return { oklch: { l, c, h: Number.isFinite(h) ? h : 0 }, alpha };
    }
    if (fn === "rgb" || fn === "rgba") {
      const [r, g, b] = channels.map((c) => clamp01(num(c, 255) / 255));
      if (![r, g, b].every(Number.isFinite)) return null;
      return { oklch: hexToOklch(formatHex({ r, g, b })), alpha };
    }
    if (fn === "hsl" || fn === "hsla") {
      const h = parseFloat(channels[0]);
      const s = num(channels[1], 1);
      const l = num(channels[2], 1);
      if (![h, s, l].every(Number.isFinite)) return null;
      const rgb = hslToRgb(((h % 360) + 360) % 360, clamp01(s), clamp01(l));
      return { oklch: hexToOklch(formatHex(rgb)), alpha };
    }
  } catch {
    return null;
  }
  return null;
}

export function findColours(value: string): FoundColour[] {
  const out: FoundColour[] = [];
  for (const m of value.matchAll(COLOUR)) {
    const parsed = parseColour(m[0]);
    if (parsed) out.push({ raw: m[0], ...parsed, index: m.index ?? 0 });
  }
  return out;
}

/**
 * The indigo-to-purple band models default to, in OKLCh hue degrees.
 *
 * Tailwind's blue-600 sits at 262, indigo-600 at 277, violet-600 at 293,
 * purple-600 at 304 and fuchsia at 322. The band starts past blue, so a
 * plumber's navy is left alone, and stops before fuchsia and pink, which are
 * a different conversation. Chroma must be high enough to read as a colour
 * choice rather than a tinted grey.
 */
export const AI_VIOLET = { hueMin: 268, hueMax: 312, minChroma: 0.1, minL: 0.3, maxL: 0.85 } as const;

export function isAiViolet({ l, c, h }: Oklch): boolean {
  return c >= AI_VIOLET.minChroma && h >= AI_VIOLET.hueMin && h <= AI_VIOLET.hueMax && l >= AI_VIOLET.minL && l <= AI_VIOLET.maxL;
}

/**
 * The warm off-white the second wave moved to once violet was named: parchment,
 * linen, oat. Very light, faintly saturated, yellow-orange hue.
 */
export function isCream({ l, c, h }: Oklch): boolean {
  return l >= 0.9 && l <= 0.985 && c >= 0.008 && c <= 0.06 && h >= 55 && h <= 105;
}

/** Blue through purple: the two ends of the first-wave gradient. */
export function isBlueToPurple({ c, h }: Oklch): boolean {
  return c >= 0.08 && h >= 240 && h <= 330;
}
