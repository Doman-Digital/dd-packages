/**
 * Whether a thing should animate at all.
 *
 * The most common motion defect is not a wrong curve, it is animating something
 * that should have been instant. An animation the user triggers a hundred times
 * a day stops being delight and becomes latency they cannot skip, and a
 * keyboard-driven interaction animating at all fights the person using it.
 */

export type MotionKind =
  | "entrance"
  | "exit"
  | "state"
  | "reveal"
  | "signature";

export interface MotionDecision {
  animate: boolean;
  /** Suggested duration in ms when `animate`, else 0. */
  durationMs: number;
  /** Why — surfaced in review, so a "no" is arguable rather than mysterious. */
  reason: string;
}

export interface ShouldAnimateInput {
  /** Roughly how often one user triggers this in a day. */
  usesPerDay: number;
  /** What sets it off. */
  trigger: "pointer" | "keyboard" | "scroll" | "load" | "system";
  kind: MotionKind;
  /** Entrance duration in ms, when the caller has one in mind. */
  enterMs?: number;
}

const DEFAULT_MS: Record<MotionKind, number> = {
  entrance: 200,
  exit: 150,
  state: 120,
  reveal: 500,
  signature: 700,
};

/** Decide, and say why. */
export function shouldAnimate(input: ShouldAnimateInput): MotionDecision {
  const base = input.enterMs ?? DEFAULT_MS[input.kind];

  if (input.trigger === "keyboard") {
    return {
      animate: false,
      durationMs: 0,
      reason:
        "keyboard-triggered: someone navigating by keyboard is moving faster than the animation",
    };
  }

  if (input.usesPerDay >= 100) {
    return {
      animate: false,
      durationMs: 0,
      reason: `${input.usesPerDay} uses/day: at this frequency motion reads as latency, not polish`,
    };
  }

  if (input.kind === "exit") {
    return {
      animate: true,
      durationMs: Math.round(base * 0.75),
      reason: "exit runs at 0.75x the entrance — leaving content lingering reads as lag",
    };
  }

  if (input.kind === "signature") {
    return {
      animate: true,
      durationMs: base,
      reason:
        "signature moment: allowed once per page, must be gated and must never be the LCP element",
    };
  }

  return { animate: true, durationMs: base, reason: `${input.kind} at ${base}ms` };
}
