/**
 * Contrast: WCAG 2.x ratio and APCA-W3 lightness contrast (Lc).
 *
 * Both, deliberately. WCAG 2.x is what an audit, a client and the law ask for.
 * APCA is what actually tracks readability on dark backgrounds, where WCAG 2.x
 * is known to pass text that is genuinely hard to read. The house bar is a pair:
 * clear 4.5:1 *and* Lc 60, or it is not an accent that carries body text.
 */

import { parseHex } from "./oklch.js";

/** WCAG 2.x relative luminance. */
function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const channel = (c: number): number =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.x contrast ratio, 1..21. Order-independent. */
export function wcagContrast(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

// APCA-W3 0.1.9 constants.
const APCA = {
  mainTRC: 2.4,
  Rco: 0.2126729,
  Gco: 0.7151522,
  Bco: 0.072175,
  normBG: 0.56,
  normTXT: 0.57,
  revTXT: 0.62,
  revBG: 0.65,
  blkThrs: 0.022,
  blkClmp: 1.414,
  scaleBoW: 1.14,
  scaleWoB: 1.14,
  loBoWoffset: 0.027,
  loWoBoffset: 0.027,
  deltaYmin: 0.0005,
  loClip: 0.1,
} as const;

/** APCA screen luminance: a simple 2.4 power curve, not the sRGB piecewise one. */
function apcaLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  return (
    APCA.Rco * Math.pow(r, APCA.mainTRC) +
    APCA.Gco * Math.pow(g, APCA.mainTRC) +
    APCA.Bco * Math.pow(b, APCA.mainTRC)
  );
}

/** Lift very dark values away from the black point, where the curve misbehaves. */
function softClamp(y: number): number {
  return y < APCA.blkThrs ? y + Math.pow(APCA.blkThrs - y, APCA.blkClmp) : y;
}

/**
 * APCA-W3 0.1.9 lightness contrast, returned as Lc.
 *
 * Sign carries polarity: positive is dark text on a light background, negative
 * is light text on dark. Callers that only care about legibility take the
 * absolute value; the house bar is |Lc| >= 60 for body text.
 */
export function apcaContrast(text: string, background: string): number {
  const yTxt = softClamp(apcaLuminance(text));
  const yBg = softClamp(apcaLuminance(background));

  if (Math.abs(yBg - yTxt) < APCA.deltaYmin) return 0;

  let output: number;
  if (yBg > yTxt) {
    const sapc =
      (Math.pow(yBg, APCA.normBG) - Math.pow(yTxt, APCA.normTXT)) * APCA.scaleBoW;
    output = sapc < APCA.loClip ? 0 : sapc - APCA.loBoWoffset;
  } else {
    const sapc =
      (Math.pow(yBg, APCA.revBG) - Math.pow(yTxt, APCA.revTXT)) * APCA.scaleWoB;
    output = sapc > -APCA.loClip ? 0 : sapc + APCA.loWoBoffset;
  }
  return output * 100;
}

export interface ContrastCheck {
  text: string;
  background: string;
  /** WCAG 2.x ratio. */
  wcag: number;
  /** APCA Lc, signed. */
  lc: number;
  /** Clears 4.5:1 — WCAG AA for body text. */
  passesAA: boolean;
  /** Clears 3:1 — WCAG AA for large text and non-text UI. */
  passesAALarge: boolean;
  /** Clears |Lc| 60 — the house bar for body text on any surface. */
  passesLc60: boolean;
  /** Human-readable, and the string emitted as a CSS comment beside the pair. */
  note: string;
}

/** Measure one text-on-background pair against both models. */
export function checkPair(text: string, background: string): ContrastCheck {
  const wcag = wcagContrast(text, background);
  const lc = apcaContrast(text, background);
  return {
    text,
    background,
    wcag,
    lc,
    passesAA: wcag >= 4.5,
    passesAALarge: wcag >= 3,
    passesLc60: Math.abs(lc) >= 60,
    note: `${text} on ${background}: ${wcag.toFixed(2)}:1, Lc ${lc.toFixed(1)}`,
  };
}
