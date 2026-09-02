import { describe, expect, it } from "vitest";
import { apcaContrast, checkPair, wcagContrast } from "../color/contrast.js";

describe("wcagContrast", () => {
  it("gives 21:1 for black on white and 1:1 for a colour on itself", () => {
    expect(wcagContrast("#000000", "#ffffff")).toBeCloseTo(21, 10);
    expect(wcagContrast("#ffffff", "#ffffff")).toBeCloseTo(1, 10);
  });

  it("is order-independent", () => {
    expect(wcagContrast("#a78bfa", "#060b19")).toBeCloseTo(
      wcagContrast("#060b19", "#a78bfa"),
      10,
    );
  });

  it("clears AA for the shipped accent on the marketing canvas", () => {
    expect(wcagContrast("#a78bfa", "#060b19")).toBeGreaterThanOrEqual(4.5);
  });
});

describe("apcaContrast", () => {
  it("reproduces the APCA-W3 0.1.9 published reference values", () => {
    expect(apcaContrast("#000000", "#ffffff")).toBeCloseTo(106.04, 1);
    expect(apcaContrast("#ffffff", "#000000")).toBeCloseTo(-107.88, 1);
    expect(apcaContrast("#888888", "#ffffff")).toBeCloseTo(63.06, 1);
  });

  it("signs dark-on-light positive and light-on-dark negative", () => {
    expect(apcaContrast("#000000", "#ffffff")).toBeGreaterThan(0);
    expect(apcaContrast("#ffffff", "#000000")).toBeLessThan(0);
  });

  it("returns zero when the two are indistinguishable", () => {
    expect(apcaContrast("#7050f5", "#7050f5")).toBe(0);
  });
});

describe("checkPair", () => {
  it("records the WCAG-passes-but-APCA-fails case the house bar exists to catch", () => {
    // The portal's shipped --violet-400 on the marketing canvas. WCAG says fine;
    // APCA says this is not a body-text colour. Both are reported, and the
    // house bar is the pair, so this does not silently ship as accent text.
    const check = checkPair("#a78bfa", "#060b19");
    expect(check.passesAA).toBe(true);
    expect(check.passesLc60).toBe(false);
  });

  it("carries the measured ratio in its note", () => {
    expect(checkPair("#000000", "#ffffff").note).toMatch(/21\.00:1, Lc 106\.0/);
  });
});
