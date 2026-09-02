/**
 * Eleven-step colour ramps derived in OKLCh.
 *
 * The governing rule is the anchor guarantee: a hex the caller supplied comes
 * back out of the ramp as the *same string*, byte for byte. Everything else on
 * the ramp is generated. That is what lets an existing site adopt craft without
 * a single pixel moving — the colours already shipped stay literal, and only
 * the steps nobody had picked by hand are computed.
 */

import { toGamut } from "./gamut.js";
import { type Gamut, type Oklch, formatHex, hexToOklch, oklchToRgb } from "./oklch.js";

/** The eleven steps, light to dark. */
export const RAMP_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

export type RampStep = (typeof RAMP_STEPS)[number];

/**
 * Target OKLCh lightness per step. Spacing is tighter at the light end, where
 * the eye resolves smaller differences, and opens up through the shadows.
 */
export const LIGHTNESS_CURVE: Readonly<Record<RampStep, number>> = Object.freeze({
  50: 0.971,
  100: 0.936,
  200: 0.885,
  300: 0.828,
  400: 0.746,
  500: 0.658,
  600: 0.586,
  700: 0.51,
  800: 0.432,
  900: 0.352,
  950: 0.253,
});

/**
 * Chroma envelope: how much of the seed's chroma a step may carry.
 *
 * Peaks mid-ramp and falls toward both ends, because a tint at L=0.97 and a
 * shade at L=0.25 physically cannot hold mid-ramp chroma — pushing it there is
 * what produces the muddy, over-saturated near-blacks that give generated
 * palettes away.
 */
function chromaEnvelope(lightness: number): number {
  return 4 * lightness * (1 - lightness);
}


/**
 * Warp the lightness curve so an anchor's *actual* lightness defines its step.
 *
 * Without this the anchor guarantee and the curve contradict each other. The
 * house violet `#7050f5` sits at OKLCh L=0.564, but `LIGHTNESS_CURVE[500]` is
 * 0.658 — so pinning it at 500 and generating 600 from the raw curve (0.586)
 * produces a step 600 *lighter* than step 500. A ramp that reverses direction is
 * not a ramp. The warp is piecewise linear, pinned at 0 and 1, and passes
 * through (anchorCurve, anchorActual), so it is monotonic by construction and
 * every other step keeps its relative position.
 */
function warpLightness(curveValue: number, anchorCurve: number, anchorActual: number): number {
  if (anchorCurve <= 0 || anchorCurve >= 1) return curveValue;
  if (anchorActual <= 0 || anchorActual >= 1) return curveValue;
  return curveValue >= anchorCurve
    ? anchorActual + ((curveValue - anchorCurve) * (1 - anchorActual)) / (1 - anchorCurve)
    : (anchorActual * curveValue) / anchorCurve;
}

export interface Ramp {
  /** Step to hex. The anchor step holds the caller's exact input string. */
  ramp: Record<RampStep, string>;
  /** Which step the seed was placed at. */
  anchor: RampStep;
  /** The seed, in OKLCh. */
  seed: Oklch;
}

export interface RampOptions {
  /** Force the seed onto this step instead of placing it by lightness. */
  step?: RampStep;
  /** Gamut to map generated steps into. Defaults to sRGB. */
  gamut?: Gamut;
}

/** The step whose target lightness is closest to this colour's. */
function nearestStep(lightness: number): RampStep {
  let best: RampStep = RAMP_STEPS[0];
  let bestDistance = Infinity;
  for (const step of RAMP_STEPS) {
    const distance = Math.abs(LIGHTNESS_CURVE[step] - lightness);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = step;
    }
  }
  return best;
}

/**
 * Build an eleven-step ramp from one seed colour.
 *
 * The seed is placed on the step its lightness is nearest (or `options.step`),
 * and that step returns the input string unchanged. Remaining steps hold the
 * seed's hue, take their lightness from `LIGHTNESS_CURVE`, and scale chroma by
 * the envelope normalised so the anchor keeps exactly the chroma it had.
 */
export function ramp(seed: string, options: RampOptions = {}): Ramp {
  const seedOklch = hexToOklch(seed);
  const anchor = options.step ?? nearestStep(seedOklch.l);
  const gamut = options.gamut ?? "srgb";

  const anchorEnvelope = chromaEnvelope(seedOklch.l);
  const out = {} as Record<RampStep, string>;

  for (const step of RAMP_STEPS) {
    if (step === anchor) {
      // The anchor guarantee. Not re-derived, not re-serialised: handed back.
      out[step] = seed;
      continue;
    }
    const lightness = warpLightness(LIGHTNESS_CURVE[step], LIGHTNESS_CURVE[anchor], seedOklch.l);
    const scale = anchorEnvelope === 0 ? 0 : chromaEnvelope(lightness) / anchorEnvelope;
    out[step] = formatHex(
      oklchToRgb(toGamut({ l: lightness, c: seedOklch.c * scale, h: seedOklch.h }, gamut)),
    );
  }

  return { ramp: out, anchor, seed: seedOklch };
}

/** Shortest signed distance between two hue angles, in degrees. */
function hueDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

export interface RampFromAnchorsOptions {
  gamut?: Gamut;
}

/**
 * Build a ramp from two or more known steps.
 *
 * Every hex the caller provides is returned unchanged. Gaps between anchors are
 * interpolated in OKLCh — lightness, chroma and hue each moving on the shortest
 * path — and steps outside the anchored span extend the nearest anchor along
 * `LIGHTNESS_CURVE`. This is the entry point Phase 5 uses, where the 400/500/600
 * steps are already shipped values that must not move.
 */
export function rampFromAnchors(
  anchors: Partial<Record<RampStep, string>>,
  options: RampFromAnchorsOptions = {},
): Record<RampStep, string> {
  const gamut = options.gamut ?? "srgb";
  const given = RAMP_STEPS.filter((step) => typeof anchors[step] === "string");
  if (given.length === 0) {
    throw new Error("craft: rampFromAnchors needs at least one anchor");
  }

  const parsed = new Map<RampStep, Oklch>();
  for (const step of given) parsed.set(step, hexToOklch(anchors[step] as string));

  const out = {} as Record<RampStep, string>;

  for (const step of RAMP_STEPS) {
    const supplied = anchors[step];
    if (typeof supplied === "string") {
      out[step] = supplied;
      continue;
    }

    const below = [...given].reverse().find((s) => s < step);
    const above = given.find((s) => s > step);

    let colour: Oklch;
    if (below !== undefined && above !== undefined) {
      // Between two anchors: interpolate on lightness position between them.
      const lo = parsed.get(below) as Oklch;
      const hi = parsed.get(above) as Oklch;
      const span = LIGHTNESS_CURVE[below] - LIGHTNESS_CURVE[above];
      const t = span === 0 ? 0.5 : (LIGHTNESS_CURVE[below] - LIGHTNESS_CURVE[step]) / span;
      colour = {
        // Between two anchors, lightness runs between what those anchors
        // actually are, not what the curve wishes they were. Anchors are the
        // shipped truth; the curve only sets spacing.
        l: lo.l + (hi.l - lo.l) * t,
        c: lo.c + (hi.c - lo.c) * t,
        h: (((lo.h + hueDelta(lo.h, hi.h) * t) % 360) + 360) % 360,
      };
    } else {
      // Outside the anchored span: hold the nearest anchor's hue, and scale its
      // chroma by the envelope so tints and shades desaturate as they should.
      const nearest = (below ?? above) as RampStep;
      const base = parsed.get(nearest) as Oklch;
      const lightness = warpLightness(
        LIGHTNESS_CURVE[step],
        LIGHTNESS_CURVE[nearest],
        base.l,
      );
      const baseEnvelope = chromaEnvelope(base.l);
      const scale = baseEnvelope === 0 ? 0 : chromaEnvelope(lightness) / baseEnvelope;
      colour = { l: lightness, c: base.c * scale, h: base.h };
    }

    out[step] = formatHex(oklchToRgb(toGamut(colour, gamut)));
  }

  return out;
}
