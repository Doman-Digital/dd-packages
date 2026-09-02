/**
 * Gamut mapping, per CSS Color 4 §13.2.
 *
 * Split from `oklch.ts` so the dependency runs one way: this module imports the
 * conversions, never the reverse.
 */

import {
  type Gamut,
  type Oklch,
  formatHex,
  inP3Gamut,
  inSrgbGamut,
  oklchToRgb,
} from "./oklch.js";

export interface OklchToHexOptions {
  /** Which gamut to map into before serialising. Defaults to sRGB. */
  gamut?: Gamut;
}

/**
 * OKLCh to hex, gamut-mapped by chroma reduction so hue survives.
 *
 * Naive per-channel RGB clipping is rejected here: clipping a saturated violet
 * pins blue at 1.0 while red keeps falling, which walks the hue toward magenta.
 * CSS Color 4 §13.2 bisects chroma with lightness and hue held fixed instead.
 */
export function oklchToHex(colour: Oklch, options: OklchToHexOptions = {}): string {
  const gamut = options.gamut ?? "srgb";
  return formatHex(oklchToRgb(toGamut(colour, gamut)));
}

/**
 * Reduce chroma until the colour fits the target gamut, per CSS Color 4 §13.2.
 * Lightness and hue are preserved exactly; only chroma moves.
 */
export function toGamut(colour: Oklch, gamut: Gamut = "srgb"): Oklch {
  const fits = gamut === "p3" ? inP3Gamut : inSrgbGamut;

  // Lightness outside 0..1 has no in-gamut representation at any chroma.
  if (colour.l <= 0) return { l: 0, c: 0, h: colour.h };
  if (colour.l >= 1) return { l: 1, c: 0, h: colour.h };
  if (fits(colour)) return colour;

  let lo = 0;
  let hi = colour.c;
  // 1e-6 in chroma is far below a JND; 25 halvings covers the widest chroma.
  for (let i = 0; i < 25 && hi - lo > 1e-6; i += 1) {
    const mid = (lo + hi) / 2;
    if (fits({ ...colour, c: mid })) lo = mid;
    else hi = mid;
  }
  return { ...colour, c: lo };
}

