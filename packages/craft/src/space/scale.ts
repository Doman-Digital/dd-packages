/**
 * Fluid space scale and section rhythm, after Utopia.
 *
 * Space uses the same `clamp()` maths as type so the two stay in proportion as
 * the viewport changes. A fixed space scale next to a fluid type scale drifts:
 * padding that framed a heading at 360px swamps it at 1280px.
 */

import { fluidClamp } from "../type/scale.js";

/** Multiples of the base step, small to large. */
export const SPACE_STEPS = {
  "3xs": 0.25,
  "2xs": 0.5,
  xs: 0.75,
  s: 1,
  m: 1.5,
  l: 2,
  xl: 3,
  "2xl": 4,
  "3xl": 6,
} as const;

export type SpaceStep = keyof typeof SPACE_STEPS;

const ORDER = Object.keys(SPACE_STEPS) as SpaceStep[];

export interface FluidSpaceOptions {
  minViewport?: number;
  maxViewport?: number;
  /** Base space in px at the small viewport. */
  minBase?: number;
  /** Base space in px at the large viewport. */
  maxBase?: number;
  rootPx?: number;
  /** Literal values written through unchanged, for steps a site already ships. */
  pin?: Partial<Record<string, string>>;
}

/**
 * Build the space scale.
 *
 * One-up pairs (`s-m`, `m-l`, ...) are emitted alongside the steps because the
 * common real need is a gap that grows *faster* than the scale — a stack that is
 * `s` on mobile and `m` on desktop. Without the pairs that gets hand-written as
 * a bespoke clamp every time, which is how a space scale stops being a scale.
 */
export function fluidSpace(options: FluidSpaceOptions = {}): Record<string, string> {
  const {
    minViewport = 360,
    maxViewport = 1280,
    minBase = 16,
    maxBase = 20,
    rootPx = 16,
    pin = {},
  } = options;

  const tokens: Record<string, string> = {};

  for (const step of ORDER) {
    const name = `--craft-space-${step}`;
    tokens[name] =
      pin[step] ??
      fluidClamp(
        minBase * SPACE_STEPS[step],
        maxBase * SPACE_STEPS[step],
        minViewport,
        maxViewport,
        rootPx,
      );
  }

  for (let i = 0; i < ORDER.length - 1; i += 1) {
    const from = ORDER[i];
    const to = ORDER[i + 1];
    const name = `--craft-space-${from}-${to}`;
    tokens[name] =
      pin[`${from}-${to}`] ??
      fluidClamp(
        minBase * SPACE_STEPS[from],
        maxBase * SPACE_STEPS[to],
        minViewport,
        maxViewport,
        rootPx,
      );
  }

  return tokens;
}

export interface SectionRhythmOptions {
  /** Vertical padding for a tight section. Literal CSS, or px min/max. */
  sm?: string | { min: number; max: number };
  md?: string | { min: number; max: number };
  lg?: string | { min: number; max: number };
  minViewport?: number;
  maxViewport?: number;
  rootPx?: number;
}

/**
 * Section vertical rhythm: three sizes, not five.
 *
 * The shared layer previously shipped five (`xs` through `xl`) with zero
 * consumers, which is the signature of a scale invented ahead of a need. Three
 * is what section layouts actually reach for — tight, default, and the one that
 * gives a section room to breathe.
 */
export function sectionRhythm(options: SectionRhythmOptions = {}): Record<string, string> {
  const { minViewport = 360, maxViewport = 1280, rootPx = 16 } = options;

  const defaults = {
    sm: { min: 40, max: 64 },
    md: { min: 56, max: 96 },
    // Matches the `clamp(5rem, 10vw, 9rem)` a client site arrived at by hand.
    lg: { min: 80, max: 144 },
  } as const;

  const tokens: Record<string, string> = {};
  for (const size of ["sm", "md", "lg"] as const) {
    const supplied = options[size];
    if (typeof supplied === "string") {
      tokens[`--craft-section-${size}`] = supplied;
      continue;
    }
    const { min, max } = supplied ?? defaults[size];
    tokens[`--craft-section-${size}`] = fluidClamp(min, max, minViewport, maxViewport, rootPx);
  }
  return tokens;
}
