/**
 * Fluid type scale, after Utopia (https://utopia.fyi).
 *
 * Every step is a `clamp()` interpolating between a size at the small viewport
 * and a size at the large one, so there are no breakpoint jumps in type.
 *
 * The interpolation term is `rem + vw`, never bare `vw`. A bare-`vw` font size
 * ignores the user's browser text-size setting entirely, which fails WCAG 1.4.4
 * — text must survive 200% zoom. The `rem` component is what keeps zoom working.
 */

/** Steps emitted, small to large. */
export const TYPE_STEPS = [-2, -1, 0, 1, 2, 3, 4, 5] as const;

export type TypeStep = (typeof TYPE_STEPS)[number];

export interface FluidTypeOptions {
  /** Viewport width in px at which the minimum size applies. */
  minViewport?: number;
  /** Viewport width in px at which the maximum size applies. */
  maxViewport?: number;
  /** Step-0 size in px at the small viewport. */
  minBase?: number;
  /** Step-0 size in px at the large viewport. */
  maxBase?: number;
  /** Ratio between steps at the small viewport. */
  minRatio?: number;
  /** Ratio between steps at the large viewport. */
  maxRatio?: number;
  /**
   * Literal values for specific steps, written through unchanged.
   *
   * This is how a live site adopts the scale without its type resizing: pin the
   * steps it already ships, and only the steps it never defined are generated.
   */
  pin?: Partial<Record<TypeStep, string>>;
  /** Root font size in px. Defaults to 16. */
  rootPx?: number;
}

const round = (n: number): number => Math.round(n * 10000) / 10000;

/**
 * One `clamp()` interpolating a px range across a viewport range.
 *
 * Exported because the space scale needs exactly the same maths.
 */
export function fluidClamp(
  minPx: number,
  maxPx: number,
  minViewport: number,
  maxViewport: number,
  rootPx = 16,
): string {
  const minRem = round(minPx / rootPx);
  const maxRem = round(maxPx / rootPx);

  // A degenerate viewport range has no slope to compute; pin the value.
  if (maxViewport === minViewport) return `${minRem}rem`;

  const slope = (maxPx - minPx) / (maxViewport - minViewport);
  const interceptRem = round((minPx - slope * minViewport) / rootPx);
  const slopeVw = round(slope * 100);

  const preferred =
    interceptRem === 0 ? `${slopeVw}vw` : `${interceptRem}rem + ${slopeVw}vw`;

  // clamp() requires min <= max; a descending pair would silently invert.
  const lower = Math.min(minRem, maxRem);
  const upper = Math.max(minRem, maxRem);
  return `clamp(${lower}rem, ${preferred}, ${upper}rem)`;
}

export interface FluidTypeResult {
  /** `--craft-step--2` .. `--craft-step-5`, name to value. */
  tokens: Record<string, string>;
  /** Which steps were pinned rather than generated. */
  pinned: TypeStep[];
}

/** Build the fluid type scale. */
export function fluidType(options: FluidTypeOptions = {}): FluidTypeResult {
  const {
    minViewport = 360,
    maxViewport = 1280,
    minBase = 16,
    maxBase = 18,
    minRatio = 1.2,
    maxRatio = 1.25,
    pin = {},
    rootPx = 16,
  } = options;

  const tokens: Record<string, string> = {};
  const pinned: TypeStep[] = [];

  for (const step of TYPE_STEPS) {
    // Negative steps read as `--craft-step--1`, which is intentional: it matches
    // Utopia's published naming, so a value can be traced back to its generator.
    const name = `--craft-step-${step < 0 ? `-${Math.abs(step)}` : step}`;
    const literal = pin[step];
    if (typeof literal === "string") {
      tokens[name] = literal;
      pinned.push(step);
      continue;
    }
    tokens[name] = fluidClamp(
      minBase * Math.pow(minRatio, step),
      maxBase * Math.pow(maxRatio, step),
      minViewport,
      maxViewport,
      rootPx,
    );
  }

  return { tokens, pinned };
}
