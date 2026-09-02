/**
 * Motion numbers. One set, shared by CSS and by every JS motion library.
 *
 * The divergence this replaces was not theoretical: `packages/ui/tokens/
 * component.css` shipped `--ease-emphasized` byte-identical to `--ease-standard`
 * (so "emphasized" emphasised nothing), and `--ease-exit` as
 * `cubic-bezier(0.4, 0, 1, 1)` — an ease-*in* curve, which starts slow and
 * accelerates out of view. That is the one curve never to use for UI: it makes a
 * dismissal feel like it is being dragged away from the user.
 *
 * `EASE_TUPLE` holds the same four control points as `EASE`, so a Framer Motion
 * or GSAP transition and a CSS transition on the same element cannot drift.
 */

/** CSS `cubic-bezier()` strings. */
export const EASE = {
  /** Entrances and anything arriving. Decelerates hard into place. */
  out: "cubic-bezier(0.23, 1, 0.32, 1)",
  /** Moves that start and end on screen: a panel resizing, a value morphing. */
  inOut: "cubic-bezier(0.77, 0, 0.175, 1)",
  /** Drawers and sheets — a longer settle than a dropdown wants. */
  drawer: "cubic-bezier(0.32, 0.72, 0, 1)",
  /** Scroll-triggered reveals. Gentler than `out`, which snaps at this length. */
  reveal: "cubic-bezier(0.22, 0.61, 0.36, 1)",
} as const;

export type EaseName = keyof typeof EASE;

/** The identical control points, for JS motion libraries. */
export const EASE_TUPLE: Readonly<Record<EaseName, readonly [number, number, number, number]>> =
  Object.freeze({
    out: [0.23, 1, 0.32, 1],
    inOut: [0.77, 0, 0.175, 1],
    drawer: [0.32, 0.72, 0, 1],
    reveal: [0.22, 0.61, 0.36, 1],
  });

/**
 * Durations in milliseconds, scaled to distance travelled and to how often the
 * user will sit through it. Nothing in UI exceeds 300ms except a drawer and a
 * one-off reveal.
 */
export const DURATION_MS = {
  press: 120,
  tooltip: 150,
  dropdown: 200,
  modal: 300,
  drawer: 400,
  reveal: 500,
  stagger: 60,
} as const;

export type DurationName = keyof typeof DURATION_MS;

/** The same durations in seconds, for libraries that take seconds. */
export const DURATION_S: Readonly<Record<DurationName, number>> = Object.freeze(
  Object.fromEntries(
    Object.entries(DURATION_MS).map(([name, ms]) => [name, ms / 1000]),
  ) as Record<DurationName, number>,
);

/** Spring parameters for libraries that prefer physics to a curve. */
export const SPRING = Object.freeze({ damping: 0.5, stiffness: 0.2 });

/** Transform scales. `press` is the tactile dip; `enter` the arrival start. */
export const SCALE = Object.freeze({ press: 0.97, enter: 0.95 });

/**
 * An exit is always faster than the matching entrance.
 *
 * Arriving content is asking to be read, so it takes its time. Leaving content
 * has already been dealt with, and lingering reads as lag.
 */
export const EXIT_RATIO = 0.75;

/** Milliseconds an exit should take, given its entrance duration. */
export function exitDuration(enterMs: number): number {
  return Math.round(enterMs * EXIT_RATIO);
}
