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
  /**
   * Cascade layers to exclude before counting, by name.
   *
   * A restraint budget measures the vocabulary a surface *chose*. A compiled
   * stylesheet also carries the framework's reset and theme, and counting those
   * makes the report wrong in the one direction that matters: it reports a
   * surface as over budget for values its author never wrote, so the real
   * findings get triaged away with the noise. Measured on this estate, Tailwind
   * v4 contributes three font sizes nobody chose (`small` at 80%, `sub`/`sup` at
   * 75%) and two timing functions (`--default-transition-timing-function`,
   * `--animate-pulse`) from `@layer theme` and `@layer base` alone.
   *
   * The default is those two names, which is the convention every layered
   * framework follows and the one Tailwind enforces. A rule placed in the reset
   * layer is a reset by the author's own declaration; put it outside the layer
   * to have it counted as vocabulary. Pass `[]` to count everything.
   */
  ignoreAtLayers?: string[];
}

/** Layers that hold a framework's reset and theme rather than a design vocabulary. */
export const DEFAULT_IGNORED_LAYERS = ["theme", "base"] as const;

/** Strip comments so a commented-out rule is not counted as shipped. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Remove the body of every `@layer <name> { ... }` block whose name is ignored.
 *
 * Brace-matched rather than regex-terminated: a layer body contains nested
 * blocks, and a lazy `\{[^}]*\}` stops at the first inner `}` — which would
 * leave most of the layer behind and silently under-strip. The bare form
 * `@layer a, b;` declares an order and carries no declarations, so it is left
 * alone.
 */
function stripLayers(css: string, ignored: readonly string[]): string {
  if (ignored.length === 0) return css;
  const names = new Set(ignored.map((n) => n.trim().toLowerCase()));
  let out = "";
  let i = 0;
  const pattern = /@layer\s+([a-zA-Z0-9_-]+)\s*\{/gi;
  while (i < css.length) {
    pattern.lastIndex = i;
    const match = pattern.exec(css);
    if (match === null) {
      out += css.slice(i);
      break;
    }
    out += css.slice(i, match.index);
    const bodyStart = match.index + match[0].length;
    let depth = 1;
    let j = bodyStart;
    while (j < css.length && depth > 0) {
      if (css[j] === "{") depth += 1;
      else if (css[j] === "}") depth -= 1;
      j += 1;
    }
    if (!names.has(match[1].toLowerCase())) {
      // Keep the layer, dropping only its wrapper. Recurse rather than emitting
      // the body verbatim: a kept layer can hold an ignored one, and this loop
      // has already advanced past the body by the time it emits it. Written
      // without recursion first, and the test for exactly this case caught it.
      out += stripLayers(css.slice(bodyStart, j - 1), ignored);
    }
    i = j;
  }
  return out;
}

/** Values that name no value: they defer to the cascade rather than choosing. */
const CSS_WIDE_KEYWORDS = new Set([
  "inherit",
  "initial",
  "unset",
  "revert",
  "revert-layer",
]);

/**
 * The bodies of every at-rule whose prelude matches, brace-matched.
 *
 * The reduced-motion check used to slice from the first match to the end of the
 * sheet, so every rule in the file after that point counted as being inside the
 * block. On a real sheet that meant `[data-craft-lcp] { animation: none }` —
 * this package's own section 7 rule, correctly outside any media query — was
 * reported as a section 8 violation. The standard failing its own checker, for
 * the second time in one file.
 */
function atRuleBodies(css: string, prelude: RegExp): string[] {
  const out: string[] = [];
  const pattern = new RegExp(
    prelude.source,
    prelude.flags.includes("g") ? prelude.flags : `${prelude.flags}g`
  );
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(css)) !== null) {
    const start = match.index + match[0].length;
    let depth = 1;
    let i = start;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") depth -= 1;
      i += 1;
    }
    out.push(css.slice(start, i - 1));
    pattern.lastIndex = i;
  }
  return out;
}

/**
 * Every custom property's declared value, last declaration winning.
 *
 * Built from the sheet *before* layers are stripped, because that is where the
 * definitions live: Tailwind v4 puts its whole theme in `@layer theme`, which
 * the budget deliberately ignores. Ignoring a definition is right; losing the
 * ability to resolve it is not, and those are two different things.
 *
 * Last-wins approximates the cascade rather than implementing it. A token
 * redefined under a media query or a `.dark` scope resolves here to whichever
 * definition appears last in the file, not to whichever actually applies. That
 * is accurate for a single-theme sheet and a documented over-simplification for
 * anything else -- it can name the wrong value, never the wrong count.
 */
function customProperties(css: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const match of css.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) {
    out.set(match[1].toLowerCase(), match[2].trim().replace(/\s+/g, " "));
  }
  return out;
}

/** `var(--tw-shadow-color, X)` is Tailwind plumbing; X is the value a reader meets. */
function unwrapShadowColor(value: string): string {
  return value.replace(
    /var\(\s*--tw-shadow-color\s*,\s*([^)]*(?:\([^)]*\))?[^)]*)\)/g,
    "$1"
  );
}

const SINGLE_VAR = /^var\(\s*(--[\w-]+)\s*(?:,([\s\S]*))?\)$/;

/**
 * Resolve a value that is exactly one `var()` reference, following the chain.
 *
 * Returns null when the chain dead-ends -- an undefined token with no fallback.
 * That is not a value the surface ships; it is a declaration that does nothing,
 * and it is reported separately rather than counted.
 */
function resolveValue(
  value: string,
  props: Map<string, string>,
  depth = 0
): string | null {
  if (depth > 8) return null;
  const match = SINGLE_VAR.exec(value.trim());
  if (match === null) return value.trim();
  const target = props.get(match[1].toLowerCase());
  if (target !== undefined && target !== "initial")
    return resolveValue(target, props, depth + 1);
  const fallback = match[2]?.trim();
  return fallback === undefined || fallback === ""
    ? null
    : resolveValue(fallback, props, depth + 1);
}

/** True for Tailwind's composite `var(--tw-a), var(--tw-b), ...` plumbing. */
function isVarOnlyList(value: string): boolean {
  const parts = value.split(",");
  return (
    parts.length > 1 &&
    parts.every((part) => /^\s*var\(\s*--[\w-]+\s*\)\s*$/.test(part))
  );
}

/**
 * Distinct values of a property, ignoring whitespace and case.
 *
 * A `var()` reference is resolved rather than skipped. Skipping it was the
 * original rule and it made the count wrong by a factor: Tailwind v4 compiles
 * `text-sm` to `font-size: var(--text-sm)` and `rounded-lg` to
 * `border-radius: var(--radius-lg)`, so a surface using those 700 times
 * reported none of them. The budget measures the vocabulary a surface chose,
 * and choosing `text-sm` is a choice however it is spelled.
 *
 * This does not undo the layer exclusion -- it completes it. A theme token is
 * only ever reached from a declaration in a *kept* layer, so a framework
 * default nothing uses is still not counted. Used versus unused is the real
 * distinction; which layer the definition sits in never was.
 *
 * Unresolvable references are collected in `unresolved` rather than counted.
 * A declaration whose token does not exist paints nothing, so it is not part
 * of the shipped vocabulary -- it is a bug, and gets said so separately.
 */
function distinctValues(
  css: string,
  property: string,
  props?: Map<string, string>,
  unresolved?: Set<string>
): string[] {
  const pattern = new RegExp(`(?:^|[;{\\s])${property}\\s*:\\s*([^;}]+)`, "gi");
  const seen = new Set<string>();
  for (const match of css.matchAll(pattern)) {
    const raw = match[1].trim().replace(/\s+/g, " ").toLowerCase();
    // The CSS-wide keywords name no value at all; counting them would inflate
    // the vocabulary with something a reader never meets as a distinct choice.
    if (CSS_WIDE_KEYWORDS.has(raw)) continue;
    const value = unwrapShadowColor(raw);
    // Tailwind's composite `var(--tw-shadow), var(--tw-ring-shadow), ...` is
    // plumbing shared by every shadow utility. Its real content arrives via the
    // `--tw-shadow` assignments, counted alongside.
    if (isVarOnlyList(value)) continue;
    if (!SINGLE_VAR.test(value)) {
      seen.add(value);
      continue;
    }
    if (props === undefined) continue;
    const resolved = resolveValue(value, props);
    if (resolved === null) {
      unresolved?.add(`${property}: ${value}`);
      continue;
    }
    seen.add(unwrapShadowColor(resolved).toLowerCase());
  }
  return [...seen];
}

/**
 * Shadows Tailwind v4 routes through `--tw-shadow`.
 *
 * `shadow-[0_30px_90px_rgba(0,0,0,.55)]` never emits a literal `box-shadow`.
 * It assigns `--tw-shadow` and lets a shared composite read it, so a scan for
 * `box-shadow:` finds one plumbing string however many distinct elevations the
 * surface ships. On the estate that hid nine of them.
 */
function twShadowValues(css: string, props: Map<string, string>): string[] {
  const seen = new Set<string>();
  for (const match of css.matchAll(/--tw-shadow\s*:\s*([^;}]+)/g)) {
    const raw = match[1].trim().replace(/\s+/g, " ").toLowerCase();
    // Tailwind's own "no shadow" initial, set on every element by the reset.
    if (raw === "0 0 #0000" || raw === "none") continue;
    const value = SINGLE_VAR.test(raw) ? resolveValue(raw, props) : raw;
    if (value === null) continue;
    seen.add(unwrapShadowColor(value).toLowerCase());
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
  const whole = stripComments(input.css);
  // Definitions come from the whole sheet, usage only from the kept layers.
  // That pairing is the rule: a token counts when something uses it.
  const props = customProperties(whole);
  const css = stripLayers(
    whole,
    input.ignoreAtLayers ?? DEFAULT_IGNORED_LAYERS
  );
  const unresolved = new Set<string>();
  const violations: RestraintViolation[] = [];

  const push = (
    rule: string,
    severity: RestraintSeverity,
    message: string,
    found: string[]
  ): void => {
    violations.push({ rule, severity, message, found });
  };

  // --- Vocabulary size -----------------------------------------------------
  const fontSizes = distinctValues(css, "font-size", props, unresolved);
  if (fontSizes.length > budget.maxFontSizes) {
    push(
      "font-sizes",
      "error",
      `${fontSizes.length} distinct font sizes, budget ${budget.maxFontSizes}. A type scale stops being a scale once nobody can name its steps.`,
      fontSizes
    );
  }

  const weights = distinctValues(css, "font-weight", props, unresolved).filter(
    (w) => w !== "normal" && w !== "bold"
  );
  const namedWeights = distinctValues(
    css,
    "font-weight",
    props,
    unresolved
  ).filter((w) => w === "normal" || w === "bold");
  const allWeights = [...new Set([...weights, ...namedWeights])];
  if (allWeights.length > budget.maxFontWeights) {
    push(
      "font-weights",
      "error",
      `${allWeights.length} font weights, budget ${budget.maxFontWeights}.`,
      allWeights
    );
  }

  const families = distinctValues(css, "font-family", props, unresolved).filter(
    (f) => !/\bmonospace\b|\bmono\b/.test(f)
  );
  if (families.length > budget.maxFontFamilies) {
    push(
      "font-families",
      "error",
      `${families.length} non-mono font families, budget ${budget.maxFontFamilies}.`,
      families
    );
  }

  const radii = distinctValues(css, "border-radius", props, unresolved).filter(
    (r) => r !== "0" && r !== "0px"
  );
  if (radii.length > budget.maxRadii) {
    push(
      "radii",
      "error",
      `${radii.length} corner radii, budget ${budget.maxRadii}.`,
      radii
    );
  }

  const shadows = [
    ...new Set([
      ...distinctValues(css, "box-shadow", props, unresolved),
      ...twShadowValues(css, props),
    ]),
  ].filter((s) => s !== "none");
  if (shadows.length > budget.maxShadows) {
    push(
      "shadows",
      "error",
      `${shadows.length} shadows, budget ${budget.maxShadows}. More than four elevations means no elevation reads as meaningful.`,
      shadows
    );
  }

  // A `var()` that resolves to nothing paints nothing. Not a budget question --
  // it is a declaration that silently does not apply, which is exactly the kind
  // of thing a compiled sheet hides. Reported as a warning because it costs the
  // surface nothing in vocabulary; it just does not work.
  if (unresolved.size > 0) {
    push(
      "unresolved-token",
      "warning",
      `${unresolved.size} declaration(s) reference a custom property that is never defined and carry no fallback. Each one applies nothing.`,
      [...unresolved].sort()
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
          `Accent hues span ${spread.toFixed(1)}deg, budget ${
            budget.accentHueClusterDeg
          }deg. Two accents is two brands.`,
          accentHexes
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
      ["transition: all"]
    );
  }

  const easeIn = [
    ...css.matchAll(/(?:transition|animation)[^;}]*\b(ease-in)\b(?!-out)/gi),
    ...css.matchAll(
      /cubic-bezier\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/gi
    ),
  ]
    .map((m) => {
      if (m[1] === "ease-in") return "ease-in";
      const p = [m[1], m[2], m[3], m[4]].map(Number);
      if (!p.every((n) => Number.isFinite(n))) return null;
      return acceleratesIntoTheEnd(p[0], p[1], p[2], p[3]) ? m[0] : null;
    })
    .filter((v): v is string => v !== null);
  if (easeIn.length > 0) {
    push(
      "ease-in",
      "error",
      "An ease-in curve accelerates away from the user. Exits use a decelerating curve, faster.",
      [...new Set(easeIn)]
    );
  }

  const overBudget = durationsMs(css).filter(
    (d) => d.ms > budget.maxUiDurationMs
  );
  if (overBudget.length > 0) {
    push(
      "duration",
      "warning",
      `${overBudget.length} duration(s) over ${budget.maxUiDurationMs}ms. Allowed for drawers and one gated reveal; not for UI state.`,
      [...new Set(overBudget.map((d) => d.value))]
    );
  }

  if (/scale\(\s*0\s*\)|scale3d\(\s*0\s*,\s*0/i.test(css)) {
    push(
      "scale-zero",
      "error",
      "Entering from `scale(0)` collapses the element to a point, so its text reflows during the animation.",
      ["scale(0)"]
    );
  }

  // --- Reduced motion ------------------------------------------------------
  const reducedMotionBlocks = atRuleBodies(
    css,
    /@media[^{]*prefers-reduced-motion:\s*reduce[^{]*\{/gi
  );
  if (reducedMotionBlocks.length === 0) {
    if (/@keyframes|animation\s*:|transition\s*:/.test(css)) {
      push(
        "reduced-motion-missing",
        "error",
        "Motion is defined but no `prefers-reduced-motion: reduce` block exists.",
        []
      );
    }
  } else {
    const block = reducedMotionBlocks.join("\n");
    if (/animation\s*:\s*none/i.test(block)) {
      push(
        "reduced-motion-animation-none",
        "error",
        "`animation: none` under reduced motion drops the `forwards` fill, stranding a forwards-filled entrance at opacity 0 for exactly the users who asked for less motion. Collapse the duration instead.",
        ["animation: none"]
      );
    }
  }

  // --- Numeric tables ------------------------------------------------------
  const markup = input.markup ?? "";
  if (markup.length > 0) {
    const hasNumericCells = /data-numeric|craft-numeric/.test(markup);
    const declaresTabular =
      /tabular-nums/.test(css) || /tabular-nums/.test(markup);
    if (hasNumericCells && !declaresTabular) {
      push(
        "tabular-nums",
        "error",
        "Numeric cells are marked but nothing sets `tabular-nums`. Proportional figures in a column do not line up.",
        []
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

/**
 * Does this curve arrive at its destination faster than it travelled?
 *
 * Section 7's objection to ease-in is about the *end* of the movement: a curve
 * that accelerates into its final position reads as the interface pulling away
 * from you. Nothing in that objection concerns the start, which is why ease-in-
 * out is fine — it starts slowly and still settles.
 *
 * The test this replaces compared only the first control point (`y1 < x1`) and
 * so could not tell the two apart. It rejected `EASE.inOut`, one of the four
 * curves in this package's own canonical block: the standard failed its own
 * checker, on every surface that adopted the token it recommends.
 *
 * The end tangent of a cubic Bezier from (0,0) to (1,1) points along P3 - P2,
 * unless P2 sits exactly on the endpoint, in which case the tangent is set by
 * the previous distinct control point. A slope above 1 means the curve is
 * covering more distance per unit time at the end than it averaged — that is
 * the acceleration being objected to. Slope 1 is linear and is left alone.
 */
function acceleratesIntoTheEnd(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): boolean {
  const EPSILON = 1e-6;
  let dx = 1 - x2;
  let dy = 1 - y2;
  if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) {
    dx = 1 - x1;
    dy = 1 - y1;
  }
  // A vertical end tangent is infinite slope: it snaps into place.
  if (Math.abs(dx) < EPSILON) return Math.abs(dy) > EPSILON;
  return dy / dx > 1 + EPSILON;
}

/** Widest gap between hues on the circle, as a spread in degrees. */
function hueSpread(hues: number[]): number {
  const sorted = [...hues].sort((a, b) => a - b);
  let widestGap = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    const next = sorted[(i + 1) % sorted.length];
    const gap =
      i === sorted.length - 1 ? next + 360 - sorted[i] : next - sorted[i];
    widestGap = Math.max(widestGap, gap);
  }
  // The cluster occupies everything the widest gap does not.
  return 360 - widestGap;
}
