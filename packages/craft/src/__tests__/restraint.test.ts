import { describe, expect, it } from "vitest";
import { HOUSE_BUDGET, checkRestraint } from "../restraint/index.js";

/** A stylesheet that respects the budget, used as the base for each fail case. */
const PASS = `
:root { --accent: #7050f5; --accent-hover: #6e4ce8; }
h1 { font-size: 3rem; font-weight: 700; font-family: Fraunces, serif; }
h2 { font-size: 2rem; }
p  { font-size: 1rem; font-weight: 400; font-family: Inter, sans-serif; }
.card { border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,.25); }
.panel { border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,.4); }
.btn { transition: transform 120ms cubic-bezier(0.23, 1, 0.32, 1); }
@keyframes rise { from { opacity: 0 } to { opacity: 1 } }
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
`;

describe("the passing fixture", () => {
  it("clears the house budget", () => {
    const report = checkRestraint({ css: PASS });
    expect(report.violations.filter((v) => v.severity === "error")).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it("reports counts even when nothing fails, so headroom is visible", () => {
    const { counts } = checkRestraint({ css: PASS });
    expect(counts.fontSizes).toBe(3);
    expect(counts.shadows).toBe(2);
  });
});

/**
 * Each fail fixture must trip exactly its own rule. A fixture that trips two is
 * not testing what it claims to, and a guard built on it would pass for the
 * wrong reason.
 */
const FAILS: { name: string; rule: string; css: string }[] = [
  {
    name: "transition-all",
    rule: "transition-all",
    css: `${PASS}\n.x { transition: all 200ms; }`,
  },
  {
    name: "ease-in",
    rule: "ease-in",
    css: `${PASS}\n.x { transition: opacity 200ms cubic-bezier(0.4, 0, 1, 1); }`,
  },
  {
    name: "duration over budget",
    rule: "duration",
    css: `${PASS}\n.x { transition: opacity 900ms linear; }`,
  },
  {
    name: "scale(0) entry",
    rule: "scale-zero",
    css: `${PASS}\n.x { transform: scale(0); }`,
  },
  {
    name: "too many font sizes",
    rule: "font-sizes",
    css:
      PASS +
      Array.from({ length: 12 }, (_, i) => `.f${i} { font-size: ${10 + i}px; }`).join("\n"),
  },
  {
    name: "split accent hues",
    rule: "accent-hues",
    css: PASS.replace("--accent-hover: #6e4ce8;", "--accent-hover: #e8764c;"),
  },
  {
    name: "too many radii",
    rule: "radii",
    css: `${PASS}\n.a{border-radius:2px}.b{border-radius:4px}.c{border-radius:24px}.d{border-radius:32px}`,
  },
  {
    name: "animation: none under reduced motion",
    rule: "reduced-motion-animation-none",
    css: PASS.replace(
      "* { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }",
      "* { animation: none !important; }",
    ),
  },
  {
    name: "no reduced-motion block at all",
    rule: "reduced-motion-missing",
    css: PASS.slice(0, PASS.indexOf("@media (prefers-reduced-motion")),
  },
];

describe.each(FAILS)("fail fixture: $name", ({ rule, css }) => {
  it(`trips ${rule}`, () => {
    const report = checkRestraint({ css });
    expect(report.violations.map((v) => v.rule)).toContain(rule);
  });

  it("trips that rule and no other", () => {
    const report = checkRestraint({ css });
    expect([...new Set(report.violations.map((v) => v.rule))]).toEqual([rule]);
  });

  it("names the offending values rather than only a count", () => {
    const violation = checkRestraint({ css }).violations.find((v) => v.rule === rule)!;
    expect(violation.message.length).toBeGreaterThan(20);
  });
});

describe("checkRestraint details", () => {
  it("ignores commented-out rules", () => {
    const commented = `${PASS}\n/* .x { transition: all 200ms; } */`;
    expect(checkRestraint({ css: commented }).violations.map((v) => v.rule)).not.toContain(
      "transition-all",
    );
  });

  it("does not count var() references as new values", () => {
    const viaTokens =
      PASS + Array.from({ length: 12 }, (_, i) => `.v${i}{font-size:var(--s${i})}`).join("\n");
    expect(checkRestraint({ css: viaTokens }).counts.fontSizes).toBe(3);
  });

  it("exempts the monospace face from the family budget", () => {
    const withMono = `${PASS}\ncode { font-family: "JetBrains Mono", monospace; }`;
    expect(checkRestraint({ css: withMono }).violations.map((v) => v.rule)).not.toContain(
      "font-families",
    );
  });

  it("flags numeric cells with no tabular-nums anywhere", () => {
    const report = checkRestraint({ css: PASS, markup: '<td data-numeric>1,204</td>' });
    expect(report.violations.map((v) => v.rule)).toContain("tabular-nums");
  });

  it("accepts numeric cells once tabular-nums is declared", () => {
    const report = checkRestraint({
      css: `${PASS}\n[data-numeric]{font-variant-numeric:tabular-nums}`,
      markup: '<td data-numeric>1,204</td>',
    });
    expect(report.violations.map((v) => v.rule)).not.toContain("tabular-nums");
  });

  it("honours a caller-supplied budget", () => {
    expect(checkRestraint({ css: PASS, budget: { maxFontSizes: 2 } }).ok).toBe(false);
  });

  it("treats a duration overrun as a warning, not a hard failure", () => {
    // Drawers and one gated reveal legitimately exceed 300ms.
    const report = checkRestraint({ css: `${PASS}\n.d{transition:transform 400ms}` });
    expect(report.violations.find((v) => v.rule === "duration")?.severity).toBe("warning");
    expect(report.ok).toBe(true);
  });

  it("passes the package's own craft.css", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const css = readFileSync(fileURLToPath(new URL("../../css/craft.css", import.meta.url)), "utf8");
    const report = checkRestraint({ css });
    expect(report.violations.filter((v) => v.severity === "error")).toEqual([]);
  });
});

describe("HOUSE_BUDGET", () => {
  it("caps UI motion at 300ms", () => {
    expect(HOUSE_BUDGET.maxUiDurationMs).toBe(300);
  });

  it("clusters accent hues within 15 degrees", () => {
    expect(HOUSE_BUDGET.accentHueClusterDeg).toBe(15);
  });
});

describe("ease-in is judged by where the curve ends, not where it starts", () => {
  /**
   * The table that matters. Every entry is a curve this estate actually ships
   * or shipped, so a regression here is a regression somewhere real.
   */
  const curves: [name: string, curve: string, rejected: boolean][] = [
    ["EASE.out", "cubic-bezier(0.23, 1, 0.32, 1)", false],
    ["EASE.inOut", "cubic-bezier(0.77, 0, 0.175, 1)", false],
    ["EASE.drawer", "cubic-bezier(0.32, 0.72, 0, 1)", false],
    ["EASE.reveal", "cubic-bezier(0.22, 0.61, 0.36, 1)", false],
    ["Tailwind's default", "cubic-bezier(0.4, 0, 0.2, 1)", false],
    ["Tailwind's pulse", "cubic-bezier(0.4, 0, 0.6, 1)", false],
    ["linear", "cubic-bezier(0, 0, 1, 1)", false],
    ["the CSS ease-in keyword's curve", "cubic-bezier(0.42, 0, 1, 1)", true],
    ["the portal's old --ease-exit", "cubic-bezier(0.4, 0, 1, 1)", true],
    ["a back-loaded custom curve", "cubic-bezier(0.5, 0.1, 0.9, 0.2)", true],
  ];

  for (const [name, curve, rejected] of curves) {
    it(`${rejected ? "rejects" : "accepts"} ${name}`, () => {
      const report = checkRestraint({ css: `.x { transition-timing-function: ${curve}; }` });
      const flagged = report.violations.some((v) => v.rule === "ease-in");
      expect(flagged).toBe(rejected);
    });
  }

  it("still rejects the ease-in keyword", () => {
    const report = checkRestraint({ css: `.x { transition: opacity 120ms ease-in; }` });
    expect(report.violations.some((v) => v.rule === "ease-in")).toBe(true);
  });

  it("does not confuse ease-in-out for ease-in", () => {
    const report = checkRestraint({ css: `.x { transition: opacity 120ms ease-in-out; }` });
    expect(report.violations.some((v) => v.rule === "ease-in")).toBe(false);
  });
});

describe("framework reset and theme layers are not the surface's vocabulary", () => {
  /** Reduced from a compiled Tailwind v4 sheet, keeping the shape that misled. */
  const COMPILED = `
@layer theme, base, components, utilities;
@layer theme {
  :root {
    --animate-spin: spin 1s linear infinite;
    --animate-pulse: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    --default-transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
}
@layer base {
  small { font-size: 80%; }
  sub, sup { font-size: 75%; }
  code { font-size: 1em; }
}
@layer utilities {
  .text-\\[11px\\] { font-size: 11px; }
}
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; }
}
`;

  it("counts only the utilities the author wrote", () => {
    const report = checkRestraint({ css: COMPILED });
    expect(report.counts.fontSizes).toBe(1);
  });

  it("counts every layer when asked to", () => {
    const report = checkRestraint({ css: COMPILED, ignoreAtLayers: [] });
    expect(report.counts.fontSizes).toBe(4);
  });

  it("keeps unlayered rules, which is where a hand-written sheet lives", () => {
    const report = checkRestraint({
      css: `${COMPILED}\n@media (prefers-reduced-motion: reduce) { .a { animation: none; } }`,
    });
    expect(report.violations.some((v) => v.rule === "reduced-motion-animation-none")).toBe(true);
  });

  it("strips a whole layer, not just up to its first nested closing brace", () => {
    const css = `@layer base {
      .a { font-size: 1px; }
      @media (min-width: 40em) { .b { font-size: 2px; } }
      .c { font-size: 3px; }
    }
    .d { font-size: 4px; }`;
    expect(checkRestraint({ css }).counts.fontSizes).toBe(1);
  });

  it("reaches an ignored layer nested inside a kept one", () => {
    const css = `@layer components { .a { font-size: 1px; } @layer base { .b { font-size: 2px; } } }`;
    expect(checkRestraint({ css }).counts.fontSizes).toBe(1);
  });

  it("leaves a bare @layer order declaration alone", () => {
    const css = `@layer theme, base, utilities;\n.a { font-size: 1px; }`;
    expect(checkRestraint({ css }).counts.fontSizes).toBe(1);
  });
});

describe("the reduced-motion check reads the block, not the rest of the file", () => {
  it("does not flag `animation: none` that sits after the block", () => {
    const css = `
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
/* Section 7: the LCP element never animates. This is craft's own rule. */
[data-craft-lcp] { animation: none !important; }
`;
    const report = checkRestraint({ css });
    expect(report.violations.some((v) => v.rule === "reduced-motion-animation-none")).toBe(false);
  });

  it("still flags it inside the block", () => {
    const css = `
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; }
  .enter { animation: none; }
}
`;
    const report = checkRestraint({ css });
    expect(report.violations.some((v) => v.rule === "reduced-motion-animation-none")).toBe(true);
  });

  it("reads a nested rule inside the block, not just its first level", () => {
    const css = `
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; }
  @supports (animation: none) { .enter { animation: none; } }
}
`;
    const report = checkRestraint({ css });
    expect(report.violations.some((v) => v.rule === "reduced-motion-animation-none")).toBe(true);
  });

  it("reads every such block, not only the first", () => {
    const css = `
@media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; } }
.between { animation: none; }
@media screen and (prefers-reduced-motion: reduce) { .enter { animation: none; } }
`;
    const report = checkRestraint({ css });
    expect(report.violations.some((v) => v.rule === "reduced-motion-animation-none")).toBe(true);
  });
});

describe("keywords that defer to the cascade are not vocabulary", () => {
  for (const keyword of ["inherit", "initial", "unset", "revert", "revert-layer"]) {
    it(`does not count \`font-size: ${keyword}\` as a size`, () => {
      const report = checkRestraint({ css: `.a { font-size: 1rem; } .b { font-size: ${keyword}; }` });
      expect(report.counts.fontSizes).toBe(1);
    });
  }
});

describe("a token reference is resolved, not skipped", () => {
  /*
   * The original rule skipped any value starting with `var(`. On a hand-written
   * sheet that is right -- the token layer is doing its job. On a Tailwind v4
   * sheet it is catastrophic: every utility compiles to a token reference, so a
   * surface shipping 27 font sizes reported 19, and one shipping 17 shadows
   * reported 5. The exclusion was never really about layers. It was about
   * whether the surface used the value.
   */
  it("counts a theme token that a kept layer actually uses", () => {
    const css = `
@layer theme { :root { --text-sm: 0.875rem; --text-lg: 1.125rem; } }
@layer utilities { .text-sm { font-size: var(--text-sm); } }
`;
    const report = checkRestraint({ css });
    expect(report.counts.fontSizes).toBe(1);
    expect(checkRestraint({ css, budget: { maxFontSizes: 0 } }).violations[0]?.found).toEqual([
      "0.875rem",
    ]);
  });

  it("still ignores a theme token nothing uses", () => {
    const css = `
@layer theme { :root { --text-sm: 0.875rem; --text-lg: 1.125rem; --text-xl: 1.25rem; } }
@layer utilities { .text-sm { font-size: var(--text-sm); } }
`;
    // Three defined, one used. The two nobody reached for are not vocabulary.
    expect(checkRestraint({ css }).counts.fontSizes).toBe(1);
  });

  it("follows a chain of aliases to the value that renders", () => {
    const css = `
@layer theme { :root { --radius-18: 18px; } }
:root { --radius-lg: var(--radius-18); --radius-card: var(--radius-lg); }
@layer utilities { .card { border-radius: var(--radius-card); } }
`;
    expect(checkRestraint({ css, budget: { maxRadii: 0 } }).violations[0]?.found).toEqual(["18px"]);
  });

  it("dedupes two names that resolve to the same value", () => {
    const css = `
:root { --radius-card: 14px; --radius-image: 14px; }
.a { border-radius: var(--radius-card); }
.b { border-radius: var(--radius-image); }
`;
    // Two tokens, one radius. A reader meets one corner, so the budget sees one.
    expect(checkRestraint({ css }).counts.radii).toBe(1);
  });

  it("takes the last definition when a token is declared twice", () => {
    // Marketing redefines --shadow-elevated after the shared package sets it.
    // Last-wins approximates the cascade; the shipped value is the later one.
    const css = `
:root { --shadow-elevated: 0 10px 28px rgba(0,0,0,0.34); }
:root { --shadow-elevated: 0 8px 24px rgba(0,0,0,0.4); }
.card { box-shadow: var(--shadow-elevated); }
`;
    expect(checkRestraint({ css, budget: { maxShadows: 0 } }).violations[0]?.found).toEqual([
      "0 8px 24px rgba(0,0,0,0.4)",
    ]);
  });

  it("stops rather than looping when tokens reference each other", () => {
    const css = `:root { --a: var(--b); --b: var(--a); } .x { font-size: var(--a); }`;
    expect(() => checkRestraint({ css })).not.toThrow();
    expect(checkRestraint({ css }).counts.fontSizes).toBe(0);
  });
});

describe("shadows Tailwind routes through --tw-shadow", () => {
  /*
   * `shadow-[0_30px_90px_rgba(0,0,0,.55)]` emits no literal `box-shadow` at
   * all. It assigns `--tw-shadow` and lets one shared composite read it, so a
   * scan for `box-shadow:` sees a single plumbing string no matter how many
   * elevations ship. Nine were hiding behind it on the estate.
   */
  const composite =
    "box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)";

  it("counts each arbitrary shadow behind the composite", () => {
    const css = `
.s1 { --tw-shadow: 0 30px 90px var(--tw-shadow-color, rgba(0,0,0,0.55)); ${composite}; }
.s2 { --tw-shadow: 0 4px 30px var(--tw-shadow-color, rgba(0,0,0,0.4)); ${composite}; }
`;
    const report = checkRestraint({ css, budget: { maxShadows: 0 } });
    expect(report.counts.shadows).toBe(2);
    // --tw-shadow-color is plumbing; the report names what a reader would see.
    expect(report.violations[0]?.found).toEqual([
      "0 30px 90px rgba(0,0,0,0.55)",
      "0 4px 30px rgba(0,0,0,0.4)",
    ]);
  });

  it("does not count the composite itself, or the reset's empty initial", () => {
    const css = `* { --tw-shadow: 0 0 #0000; } .s { --tw-shadow: 0 1px 2px #0003; ${composite}; }`;
    expect(checkRestraint({ css }).counts.shadows).toBe(1);
  });

  it("dedupes a --tw-shadow against the same value written literally", () => {
    const css = `
:root { --shadow-soft: 0 2px 8px rgba(0,0,0,0.25); }
.a { box-shadow: var(--shadow-soft); }
.b { --tw-shadow: var(--shadow-soft); ${composite}; }
`;
    expect(checkRestraint({ css }).counts.shadows).toBe(1);
  });
});

describe("a reference that resolves to nothing is a bug, not vocabulary", () => {
  it("reports an undefined token instead of counting it", () => {
    // Shipped: `.prose-resources h1 { font-size: var(--text-h2) }`, where
    // --text-h2 is defined nowhere. It applies nothing, silently.
    const css = `.a { font-size: 1rem; } .b { font-size: var(--text-h2); }`;
    const report = checkRestraint({ css });
    expect(report.counts.fontSizes).toBe(1);
    const found = report.violations.find((v) => v.rule === "unresolved-token")?.found;
    expect(found).toEqual(["font-size: var(--text-h2)"]);
  });

  it("uses the fallback when one is given, and says nothing", () => {
    const css = `.a { border-radius: var(--nope, 12px); }`;
    const report = checkRestraint({ css, budget: { maxRadii: 0 } });
    expect(report.violations[0]?.found).toEqual(["12px"]);
    expect(report.violations.some((v) => v.rule === "unresolved-token")).toBe(false);
  });

  it("is a warning, not an error -- it costs no vocabulary", () => {
    const report = checkRestraint({ css: `.b { font-size: var(--missing); }` });
    expect(report.violations.find((v) => v.rule === "unresolved-token")?.severity).toBe("warning");
  });
});
