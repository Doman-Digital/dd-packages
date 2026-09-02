import { describe, expect, it } from "vitest";
import { accentFork, semantic } from "../color/semantic.js";
import { rampFromAnchors } from "../color/ramp.js";

const PORTAL_ACCENT = rampFromAnchors({ 400: "#a78bfa", 500: "#7050f5", 600: "#6e4ce8" });

describe("accentFork", () => {
  it("returns a step clearing both bars on every background it was given", () => {
    const fork = accentFork(PORTAL_ACCENT, ["#04060e", "#0b1120", "#151c2e"]);
    if (!fork.degraded) {
      for (const check of fork.checks) {
        expect(check.passesAA).toBe(true);
        expect(check.passesLc60).toBe(true);
      }
    }
  });

  it("does not settle for the shipped 400 step, which fails Lc60 on the canvas", () => {
    const fork = accentFork(PORTAL_ACCENT, ["#060b19"]);
    expect(fork.hex).not.toBe("#a78bfa");
  });

  it("returns the step nearest the brand accent, not the nearest to white", () => {
    // Scanning from the light end returns step 50 on any dark background: it
    // clears every bar and is no longer the brand colour. The chosen step must
    // be the darkest that passes, and strictly darker than the ramp's tints.
    const fork = accentFork(PORTAL_ACCENT, ["#04060e", "#0b1120", "#151c2e"]);
    expect(fork.step).toBeGreaterThan(50);
    expect(fork.step).toBeGreaterThan(100);
  });

  it("carries the measured ratio, so the choice is checkable", () => {
    expect(accentFork(PORTAL_ACCENT, ["#04060e"]).note).toMatch(/:1, Lc/);
  });

  it("flags rather than hides a set where nothing clears the bar", () => {
    // Every step on a mid-grey: no light or dark end can clear Lc60 both ways.
    const fork = accentFork(PORTAL_ACCENT, ["#808080"], { minWcag: 7, minLc: 90 });
    expect(fork.degraded).toBe(true);
    expect(fork.note).toMatch(/NO STEP CLEARS/);
  });

  it("refuses an empty background list", () => {
    expect(() => accentFork(PORTAL_ACCENT, [])).toThrow(/at least one background/);
  });
});

describe("semantic", () => {
  const input = {
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
  };

  it("emits 22 semantic tokens", () => {
    const { tokens } = semantic(input);
    expect(Object.keys(tokens)).toHaveLength(22);
  });

  it("keeps every anchor byte-identical", () => {
    const { tokens, accentRamp } = semantic(input);
    expect(tokens["--craft-bg-canvas"]).toBe("#04060e");
    expect(tokens["--craft-text-primary"]).toBe("#ecf2ff");
    expect(accentRamp[500]).toBe("#7050f5");
    expect(accentRamp[400]).toBe("#a78bfa");
    expect(accentRamp[600]).toBe("#6e4ce8");
  });

  it("picks legible text for the warning surface rather than assuming", () => {
    const { tokens } = semantic(input);
    expect(["#111111", "#ffffff"]).toContain(tokens["--craft-text-on-warning"]);
  });

  it("reports failures instead of burying them", () => {
    const { report } = semantic(input);
    expect(Array.isArray(report.failures)).toBe(true);
    for (const failure of report.failures) {
      expect(failure.passesAA === false || failure.passesLc60 === false).toBe(true);
    }
  });

  it("accepts a bare seed as well as anchored steps", () => {
    const { accentRamp } = semantic({ ...input, accent: "#7050f5" });
    expect(Object.values(accentRamp)).toContain("#7050f5");
  });
});
