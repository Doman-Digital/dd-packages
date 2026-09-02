/**
 * Semantic tokens derived from a small set of anchors, with a contrast report.
 *
 * The point of deriving rather than hand-picking is not tidiness. It is that a
 * hand-picked "accessible variant of the accent" is a guess that nobody
 * re-checks when the accent changes. `accentFork` walks the ramp and returns the
 * first step that actually clears the bar on every background it will sit on,
 * and records the measured ratio next to it.
 */

import { checkPair, type ContrastCheck } from "./contrast.js";
import { RAMP_STEPS, type RampStep, ramp, rampFromAnchors } from "./ramp.js";

export interface AccentFork {
  /** The chosen colour. */
  hex: string;
  /** Which ramp step it came from. */
  step: RampStep;
  /** Measurements against every background it was tested on. */
  checks: ContrastCheck[];
  /** Emitted as a CSS comment beside the token, so the ratio is never a guess. */
  note: string;
  /**
   * True when no step cleared both bars and the least-bad was returned. Callers
   * must surface this: a silently-failing accent is the exact defect this
   * function exists to remove.
   */
  degraded: boolean;
}

export interface AccentForkOptions {
  /** Minimum WCAG 2.x ratio. Defaults to 4.5 (AA body text). */
  minWcag?: number;
  /** Minimum absolute APCA Lc. Defaults to 60 (house bar for body text). */
  minLc?: number;
}

/**
 * The first ramp step that clears both contrast bars against every background.
 *
 * Searched light-to-dark or dark-to-light depending on which direction the
 * backgrounds sit, so the answer is the *closest* passing step rather than the
 * most extreme one — an accent that has been dragged to near-white to pass a
 * checker has stopped being the brand colour.
 */
export function accentFork(
  rampSteps: Record<RampStep, string>,
  on: string[],
  options: AccentForkOptions = {},
): AccentFork {
  const minWcag = options.minWcag ?? 4.5;
  const minLc = options.minLc ?? 60;

  if (on.length === 0) throw new Error("craft: accentFork needs at least one background");

  /*
   * Search from the brand end toward the legible end, not the other way round.
   *
   * On a dark background every step lighter than the accent eventually passes,
   * so scanning light-to-dark returns step 50 — a near-white that clears any bar
   * and is no longer recognisably the brand colour. Walking dark-to-light
   * instead returns the *first* step that passes, which is the darkest one that
   * does: maximum brand, minimum sufficient contrast. Light backgrounds mirror it.
   */
  const meanBackgroundLuminance =
    on.reduce((sum, bg) => sum + checkPair("#ffffff", bg).wcag, 0) / on.length;
  const darkBackgrounds = meanBackgroundLuminance > 4.5;
  const order = darkBackgrounds ? [...RAMP_STEPS].reverse() : [...RAMP_STEPS];

  let best: { step: RampStep; checks: ContrastCheck[]; margin: number } | null = null;

  for (const step of order) {
    const hex = rampSteps[step];
    const checks = on.map((bg) => checkPair(hex, bg));
    const clears = checks.every((c) => c.wcag >= minWcag && Math.abs(c.lc) >= minLc);
    if (clears) {
      return {
        hex,
        step,
        checks,
        note: checks.map((c) => c.note).join("; "),
        degraded: false,
      };
    }
    // Track the least-bad by its worst-case shortfall across both models.
    const margin = Math.min(
      ...checks.map((c) => Math.min(c.wcag / minWcag, Math.abs(c.lc) / minLc)),
    );
    if (best === null || margin > best.margin) best = { step, checks, margin };
  }

  const fallback = best as { step: RampStep; checks: ContrastCheck[]; margin: number };
  return {
    hex: rampSteps[fallback.step],
    step: fallback.step,
    checks: fallback.checks,
    note: `NO STEP CLEARS ${minWcag}:1 + Lc ${minLc} — closest: ${fallback.checks
      .map((c) => c.note)
      .join("; ")}`,
    degraded: true,
  };
}

export interface SemanticInput {
  /** Seed or anchored steps for the accent hue. */
  accent: string | Partial<Record<RampStep, string>>;
  /** Page background, darkest surface first. */
  bgCanvas: string;
  bgBase?: string;
  bgSurface: string;
  bgElevated: string;
  /** Body text ramp. */
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  /** Hairlines. */
  borderSubtle: string;
  borderStrong: string;
  /** Status hues. */
  success: string;
  warning: string;
  danger: string;
  info: string;
  /** Overrides written verbatim, for values craft cannot derive (rgba, etc). */
  overrides?: Record<string, string>;
}

export interface ContrastReport {
  checks: ContrastCheck[];
  /** Pairs that fail WCAG AA or the Lc60 house bar. */
  failures: ContrastCheck[];
  accent: AccentFork;
}

export interface SemanticResult {
  /** The 22 `--craft-*` semantic tokens, name to value. */
  tokens: Record<string, string>;
  /** Per-token provenance comment, emitted beside the declaration. */
  notes: Record<string, string>;
  report: ContrastReport;
  /** The accent ramp, for callers that want the raw steps too. */
  accentRamp: Record<RampStep, string>;
}

/** Derive the semantic layer, measuring every text-on-surface pair as it goes. */
export function semantic(input: SemanticInput): SemanticResult {
  const accentRamp =
    typeof input.accent === "string" ? ramp(input.accent).ramp : rampFromAnchors(input.accent);

  const surfaces = [input.bgCanvas, input.bgSurface, input.bgElevated];
  const fork = accentFork(accentRamp, surfaces);

  const bgBase = input.bgBase ?? input.bgCanvas;

  const tokens: Record<string, string> = {
    "--craft-bg-canvas": input.bgCanvas,
    "--craft-bg-base": bgBase,
    "--craft-bg-surface": input.bgSurface,
    "--craft-bg-elevated": input.bgElevated,
    "--craft-text-primary": input.textPrimary,
    "--craft-text-secondary": input.textSecondary,
    "--craft-text-muted": input.textMuted,
    "--craft-text-on-accent": accentRamp[50],
    "--craft-border-subtle": input.borderSubtle,
    "--craft-border-strong": input.borderStrong,
    "--craft-accent": accentRamp[500],
    "--craft-accent-hover": accentRamp[600],
    "--craft-accent-soft": accentRamp[900],
    "--craft-accent-text": fork.hex,
    "--craft-action-primary": accentRamp[500],
    "--craft-action-primary-hover": accentRamp[600],
    "--craft-focus-ring": fork.hex,
    "--craft-success": input.success,
    "--craft-warning": input.warning,
    "--craft-danger": input.danger,
    "--craft-info": input.info,
    "--craft-text-on-warning": checkPair("#111111", input.warning).wcag >= 4.5 ? "#111111" : "#ffffff",
  };

  const notes: Record<string, string> = {
    "--craft-accent-text": `${fork.note} (ramp step ${fork.step})`,
    "--craft-focus-ring": `derived from accent step ${fork.step}`,
    "--craft-text-on-warning": checkPair(
      tokens["--craft-text-on-warning"],
      input.warning,
    ).note,
  };

  for (const [name, value] of Object.entries(input.overrides ?? {})) {
    tokens[name] = value;
    notes[name] = "override: supplied verbatim, not derived";
  }

  // Measure every text token against every surface it can legally land on.
  const textTokens = ["--craft-text-primary", "--craft-text-secondary", "--craft-text-muted"];
  const checks: ContrastCheck[] = [];
  for (const name of textTokens) {
    const value = tokens[name];
    // rgba() and var() values cannot be measured; skip rather than guess.
    if (!value.startsWith("#")) continue;
    for (const surface of surfaces) {
      if (!surface.startsWith("#")) continue;
      checks.push(checkPair(value, surface));
    }
  }
  checks.push(...fork.checks);

  return {
    tokens,
    notes,
    accentRamp,
    report: {
      checks,
      failures: checks.filter((c) => !c.passesAA || !c.passesLc60),
      accent: fork,
    },
  };
}
