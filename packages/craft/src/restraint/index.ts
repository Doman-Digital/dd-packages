/**
 * Restraint: the budget that separates designed from decorated.
 *
 * Differentiation guards can only tell you a site differs from its siblings.
 * They pass anything ugly, so long as it is distinctively ugly. What they cannot
 * see is the commonest quality failure in practice, which is not sameness but
 * accumulation: eighteen font sizes, six shadows, four competing accent hues,
 * each added reasonably, together reading as noise.
 *
 * Pure over strings. No filesystem, no parser, no dependencies — so a guard, a
 * CI check and an editor can all run it on the same input and agree.
 */

import { hexToOklch } from "../color/oklch.js";

export interface RestraintBudget {
  maxFontSizes: number;
  maxFontWeights: number;
  /** Excludes the monospace face, which is a functional choice not a stylistic one. */
  maxFontFamilies: number;
  maxRadii: number;
  maxShadows: number;
  /** Accent hues must cluster within this many degrees in OKLCh. */
  accentHueClusterDeg: number;
  /** Longest permitted UI transition/animation, in ms. */
  maxUiDurationMs: number;
}

export const HOUSE_BUDGET: RestraintBudget = {
  maxFontSizes: 10,
  maxFontWeights: 3,
  maxFontFamilies: 2,
  maxRadii: 4,
  maxShadows: 4,
  accentHueClusterDeg: 15,
  maxUiDurationMs: 300,
};

export type RestraintSeverity = "error" | "warning";

export interface RestraintViolation {
  rule: string;
  severity: RestraintSeverity;
  message: string;
  /** The offending values, so the message is actionable rather than a count. */
  found: string[];
}

export interface RestraintReport {
  ok: boolean;
  violations: RestraintViolation[];
  /** What was counted, for a report that shows headroom as well as failure. */
  counts: Record<string, number>;
}

export interface CheckRestraintInput {
  /** Concatenated stylesheet text. */
  css: string;
  /** Concatenated markup or component source, for class-level rules. */
  markup?: string;
  budget?: Partial<RestraintBudget>;
}

/** Strip comments so a commented-out rule is not counted as shipped. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Distinct values of a property, ignoring whitespace and case. */
function distinctValues(css: string, property: string): string[] {
  const pattern = new RegExp(`(?:^|[;{\\s])${property}\\s*:\\s*([^;}]+)`, "gi");
  const seen = new Set<string>();
  for (const match of css.matchAll(pattern)) {
    const value = match[1].trim().replace(/\s+/g, " ").toLowerCase();
    // A var() reference is the token layer doing its job, not a new value.
    if (value.startsWith("var(") || value === "inherit" || value === "initial") continue;
    seen.add(value);
  }
  return [...seen];
}

/** Every duration in the sheet, in ms. */
function durationsMs(css: string): { value: string; ms: number }[] {
  const out: { value: string; ms: number }[] = [];
  for (const match of css.matchAll(/([\d.]+)(ms|s)\b/g)) {
    const n = Number(match[1]);
    if (!Number.isFinite(n)) continue;
    out.push({ value: match[0], ms: match[2] === "s" ? n * 1000 : n });
  }
  return out;
}

/**
 * Check a stylesheet against the restraint budget.
 *
 * Returns every violation rather than the first, because a budget report is only
 * useful if it shows the whole picture at once.
 */
export function checkRestraint(input: CheckRestraintInput): RestraintReport {
  const budget = { ...HOUSE_BUDGET, ...input.budget };
  const css = stripComments(input.css);
  const violations: RestraintViolation[] = [];

  const push = (
    rule: string,
    severity: RestraintSeverity,
    message: string,
    found: string[],
  ): void => {
    violations.push({ rule, severity, message, found });
  };

  // --- Vocabulary size -----------------------------------------------------
  const fontSizes = distinctValues(css, "font-size");
  if (fontSizes.length > budget.maxFontSizes) {
    push(
      "font-sizes",
      "error",
      `${fontSizes.length} distinct font sizes, budget ${budget.maxFontSizes}. A type scale stops being a scale once nobody can name its steps.`,
      fontSizes,
    );
  }

  const weights = distinctValues(css, "font-weight").filter((w) => w !== "normal" && w !== "bold");
  const namedWeights = distinctValues(css, "font-weight").filter(
    (w) => w === "normal" || w === "bold",
  );
  const allWeights = [...new Set([...weights, ...namedWeights])];
  if (allWeights.length > budget.maxFontWeights) {
    push(
      "font-weights",
      "error",
      `${allWeights.length} font weights, budget ${budget.maxFontWeights}.`,
      allWeights,
    );
  }

  const families = distinctValues(css, "font-family").filter(
    (f) => !/\bmonospace\b|\bmono\b/.test(f),
  );
  if (families.length > budget.maxFontFamilies) {
    push(
      "font-families",
      "error",
      `${families.length} non-mono font families, budget ${budget.maxFontFamilies}.`,
      families,
    );
  }

  const radii = distinctValues(css, "border-radius").filter((r) => r !== "0" && r !== "0px");
  if (radii.length > budget.maxRadii) {
    push("radii", "error", `${radii.length} corner radii, budget ${budget.maxRadii}.`, radii);
  }

  const shadows = distinctValues(css, "box-shadow").filter((s) => s !== "none");
  if (shadows.length > budget.maxShadows) {
    push(
      "shadows",
      "error",
      `${shadows.length} shadows, budget ${budget.maxShadows}. More than four elevations means no elevation reads as meaningful.`,
      shadows,
    );
  }

  // --- Accent hue cluster --------------------------------------------------
  const accentHexes = [
    ...css.matchAll(/--[a-z0-9-]*accent[a-z0-9-]*\s*:\s*(#[0-9a-fA-F]{3,8})/g),
  ].map((m) => m[1]);
  if (accentHexes.length > 1) {
    const hues = accentHexes
      .map((hex) => {
        try {
          const { c, h } = hexToOklch(hex);
          // A near-grey has no meaningful hue to cluster.
          return c > 0.02 ? h : null;
        } catch {
          return null;
        }
      })
      .filter((h): h is number => h !== null);
    if (hues.length > 1) {
      const spread = hueSpread(hues);
      if (spread > budget.accentHueClusterDeg) {
        push(
          "accent-hues",
          "error",
          `Accent hues span ${spread.toFixed(1)}deg, budget ${budget.accentHueClusterDeg}deg. Two accents is two brands.`,
          accentHexes,
        );
      }
    }
  }

  // --- Motion --------------------------------------------------------------
  if (/transition\s*:\s*all\b/i.test(css)) {
    push(
      "transition-all",
      "error",
      "`transition: all` animates properties you did not choose, including layout ones that cannot be composited.",
      ["transition: all"],
    );
  }

  const easeIn = [
    ...css.matchAll(/(?:transition|animation)[^;}]*\b(ease-in)\b(?!-out)/gi),
    ...css.matchAll(/cubic-bezier\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,/gi),
  ]
    .map((m) => {
      if (m[1] === "ease-in") return "ease-in";
      const x1 = Number(m[1]);
      const y1 = Number(m[2]);
      return Number.isFinite(x1) && Number.isFinite(y1) && y1 < x1 ? m[0] : null;
    })
    .filter((v): v is string => v !== null);
  if (easeIn.length > 0) {
    push(
      "ease-in",
      "error",
      "An ease-in curve accelerates away from the user. Exits use a decelerating curve, faster.",
      [...new Set(easeIn)],
    );
  }

  const overBudget = durationsMs(css).filter((d) => d.ms > budget.maxUiDurationMs);
  if (overBudget.length > 0) {
    push(
      "duration",
      "warning",
      `${overBudget.length} duration(s) over ${budget.maxUiDurationMs}ms. Allowed for drawers and one gated reveal; not for UI state.`,
      [...new Set(overBudget.map((d) => d.value))],
    );
  }

  if (/scale\(\s*0\s*\)|scale3d\(\s*0\s*,\s*0/i.test(css)) {
    push(
      "scale-zero",
      "error",
      "Entering from `scale(0)` collapses the element to a point, so its text reflows during the animation.",
      ["scale(0)"],
    );
  }

  // --- Reduced motion ------------------------------------------------------
  const reducedMotionAt = css.search(/@media[^{]*prefers-reduced-motion:\s*reduce/i);
  if (reducedMotionAt === -1) {
    if (/@keyframes|animation\s*:|transition\s*:/.test(css)) {
      push(
        "reduced-motion-missing",
        "error",
        "Motion is defined but no `prefers-reduced-motion: reduce` block exists.",
        [],
      );
    }
  } else {
    const block = css.slice(reducedMotionAt);
    if (/animation\s*:\s*none/i.test(block)) {
      push(
        "reduced-motion-animation-none",
        "error",
        "`animation: none` under reduced motion drops the `forwards` fill, stranding a forwards-filled entrance at opacity 0 for exactly the users who asked for less motion. Collapse the duration instead.",
        ["animation: none"],
      );
    }
  }

  // --- Numeric tables ------------------------------------------------------
  const markup = input.markup ?? "";
  if (markup.length > 0) {
    const hasNumericCells = /data-numeric|craft-numeric/.test(markup);
    const declaresTabular = /tabular-nums/.test(css) || /tabular-nums/.test(markup);
    if (hasNumericCells && !declaresTabular) {
      push(
        "tabular-nums",
        "error",
        "Numeric cells are marked but nothing sets `tabular-nums`. Proportional figures in a column do not line up.",
        [],
      );
    }
  }

  return {
    ok: violations.every((v) => v.severity !== "error"),
    violations,
    counts: {
      fontSizes: fontSizes.length,
      fontWeights: allWeights.length,
      fontFamilies: families.length,
      radii: radii.length,
      shadows: shadows.length,
      accentHexes: accentHexes.length,
    },
  };
}

/** Widest gap between hues on the circle, as a spread in degrees. */
function hueSpread(hues: number[]): number {
  const sorted = [...hues].sort((a, b) => a - b);
  let widestGap = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    const next = sorted[(i + 1) % sorted.length];
    const gap = i === sorted.length - 1 ? next + 360 - sorted[i] : next - sorted[i];
    widestGap = Math.max(widestGap, gap);
  }
  // The cluster occupies everything the widest gap does not.
  return 360 - widestGap;
}
