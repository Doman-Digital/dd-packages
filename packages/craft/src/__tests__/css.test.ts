import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { craftTokens, emitCss, motionTokens } from "../css/emit.js";
import { EASE } from "../motion/tokens.js";

const CRAFT_CSS = readFileSync(
  fileURLToPath(new URL("../../css/craft.css", import.meta.url)),
  "utf8",
);

/** The portal anchor set, as Phase 5 will pass it. */
const PORTAL = {
  accent: { 400: "#a78bfa", 500: "#7050f5", 600: "#6e4ce8" },
  bgCanvas: "#04060e",
  bgSurface: "#0b1120",
  bgElevated: "#151c2e",
  textPrimary: "#ecf2ff",
  textSecondary: "#b7c3d9",
  textMuted: "#8e9cb5",
  borderSubtle: "rgba(184, 198, 219, 0.16)",
  borderStrong: "rgba(184, 198, 219, 0.28)",
  success: "#3fb98a",
  warning: "#d6a14a",
  danger: "#e26d6d",
  info: "#5aa7e8",
} as const;

describe("craft.css", () => {
  it("references only custom properties craftTokens() actually emits", () => {
    const emitted = new Set(Object.keys(craftTokens({ ...PORTAL }).tokens));
    // Every var(--craft-*) in the stylesheet, ignoring the fallback after the comma.
    const referenced = [...CRAFT_CSS.matchAll(/var\((--craft-[a-z0-9-]+)/g)].map((m) => m[1]);
    expect(referenced.length).toBeGreaterThan(0);

    const measureTokens = new Set([
      // Supplied by the type layer in v0.2.0; craft.css carries a literal
      // fallback for each so v0.1.0 renders correctly on its own.
      "--craft-measure-body",
      "--craft-measure-narrow",
      "--craft-measure-wide",
    ]);
    const unknown = referenced.filter((n) => !emitted.has(n) && !measureTokens.has(n));
    expect(unknown).toEqual([]);
  });

  it("gives every forward-referenced token a literal fallback", () => {
    for (const match of CRAFT_CSS.matchAll(/var\((--craft-[a-z0-9-]+)([^)]*)\)/g)) {
      expect(match[2].trim().startsWith(","), `${match[1]} has no fallback`).toBe(true);
    }
  });

  it("collapses reduced motion rather than disabling it", () => {
    const block = CRAFT_CSS.slice(CRAFT_CSS.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(block).toMatch(/animation-duration:\s*0\.01ms/);
    expect(block).toMatch(/transition-duration:\s*0\.01ms/);
    expect(block).toMatch(/animation-iteration-count:\s*1/);
    // The defect this replaces: `animation: none` strands a forwards-filled
    // entrance at opacity 0 for exactly the users who asked for less motion.
    expect(block).not.toMatch(/animation:\s*none/);
  });

  it("holds the LCP element still", () => {
    expect(CRAFT_CSS).toMatch(/\[data-craft-lcp\]/);
  });
});

describe("motionTokens", () => {
  it("emits the ease curves under kebab-case names", () => {
    const tokens = motionTokens();
    expect(tokens["--craft-ease-out"]).toBe(EASE.out);
    expect(tokens["--craft-ease-in-out"]).toBe(EASE.inOut);
    expect(tokens["--craft-ease-drawer"]).toBe(EASE.drawer);
    expect(tokens["--craft-ease-reveal"]).toBe(EASE.reveal);
  });

  it("never emits an ease-in curve for UI", () => {
    // An ease-in exit accelerates away from the user. The replaced
    // --ease-exit was cubic-bezier(0.4, 0, 1, 1), exactly this shape.
    for (const [name, value] of Object.entries(motionTokens())) {
      if (!name.startsWith("--craft-ease-")) continue;
      const [x1, y1] = value.match(/[\d.]+/g)!.map(Number);
      expect(y1 >= x1 || name === "--craft-ease-in-out", `${name} is ease-in`).toBe(true);
    }
  });

  it("keeps every ease distinct — the defect was two identical curves", () => {
    const curves = Object.entries(motionTokens())
      .filter(([n]) => n.startsWith("--craft-ease-"))
      .map(([, v]) => v);
    expect(new Set(curves).size).toBe(curves.length);
  });
});

describe("emitCss", () => {
  it("writes a rule with provenance comments", () => {
    const css = emitCss({ "--craft-a": "#fff" }, { notes: { "--craft-a": "why" } });
    expect(css).toBe(":root {\n  --craft-a: #fff; /* why */\n}\n");
  });

  it("honours a custom selector", () => {
    expect(emitCss({ "--craft-a": "#fff" }, { selector: ".dark" })).toMatch(/^\.dark \{/);
  });
});

describe("craftTokens", () => {
  it("passes overrides through verbatim", () => {
    const { tokens } = craftTokens({ ...PORTAL });
    expect(tokens["--craft-border-subtle"]).toBe("rgba(184, 198, 219, 0.16)");
  });

  it("reports the accent fork with its measured ratios", () => {
    const { report } = craftTokens({ ...PORTAL });
    expect(report.accent.note).toMatch(/:1, Lc/);
    expect(report.accent.checks.length).toBe(3);
  });

  it("skips unmeasurable rgba values instead of guessing at them", () => {
    const { report } = craftTokens({ ...PORTAL });
    for (const check of report.checks) {
      expect(check.text.startsWith("#")).toBe(true);
      expect(check.background.startsWith("#")).toBe(true);
    }
  });
});
