import { describe, expect, it } from "vitest";
import { TYPE_STEPS, fluidClamp, fluidType } from "../type/scale.js";
import { HOUSE_TYPE, typeFeatureTokens } from "../type/features.js";

describe("fluidClamp", () => {
  it("reproduces utopia.fyi's published output for 16->18px across 320->1240", () => {
    // The canonical Utopia worked example. If this drifts, the generator has
    // stopped agreeing with the tool the scale is documented against.
    expect(fluidClamp(16, 18, 320, 1240)).toBe("clamp(1rem, 0.9565rem + 0.2174vw, 1.125rem)");
  });

  it("always keeps a rem term, so browser text-size settings still apply", () => {
    // A bare-vw font size fails WCAG 1.4.4: it ignores user zoom entirely.
    for (const [min, max] of [
      [12, 20],
      [16, 18],
      [40, 72],
    ]) {
      expect(fluidClamp(min, max, 360, 1280)).toMatch(/rem/);
    }
  });

  it("never emits an inverted clamp", () => {
    const descending = fluidClamp(24, 12, 360, 1280);
    const [lower, , upper] = descending.match(/[\d.]+rem/g)!;
    expect(parseFloat(lower)).toBeLessThanOrEqual(parseFloat(upper));
  });

  it("degrades to a fixed size when the viewport range is a point", () => {
    expect(fluidClamp(16, 18, 800, 800)).toBe("1rem");
  });
});

describe("fluidType", () => {
  it("emits all eight steps with Utopia's negative-step naming", () => {
    const { tokens } = fluidType();
    expect(Object.keys(tokens)).toHaveLength(TYPE_STEPS.length);
    expect(tokens["--craft-step--2"]).toBeDefined();
    expect(tokens["--craft-step-5"]).toBeDefined();
  });

  it("writes pinned steps through unchanged, so a live site's type does not move", () => {
    const pinned = "clamp(2.5rem, 5vw, 3.25rem)";
    const { tokens, pinned: which } = fluidType({ pin: { 5: pinned } });
    expect(tokens["--craft-step-5"]).toBe(pinned);
    expect(which).toEqual([5]);
  });

  it("ascends in size across the steps", () => {
    const { tokens } = fluidType();
    const maxima = TYPE_STEPS.map((s) => {
      const name = `--craft-step-${s < 0 ? `-${Math.abs(s)}` : s}`;
      return parseFloat(tokens[name].match(/[\d.]+rem\)/)![0]);
    });
    for (let i = 1; i < maxima.length; i += 1) {
      expect(maxima[i]).toBeGreaterThan(maxima[i - 1]);
    }
  });
});

describe("typeFeatureTokens", () => {
  it("emits the tracking, leading and measure families", () => {
    const tokens = typeFeatureTokens();
    expect(tokens["--craft-tracking-display"]).toBe("-0.01em");
    expect(tokens["--craft-leading-body"]).toBe("1.6");
    expect(tokens["--craft-measure-body"]).toBe("65ch");
  });

  it("keeps the display tracking two client repos arrived at independently", () => {
    expect(HOUSE_TYPE.tracking.display).toBe("-0.01em");
  });

  it("keeps body measure inside the 45-75ch band", () => {
    for (const value of Object.values(HOUSE_TYPE.measure)) {
      const ch = parseInt(value, 10);
      expect(ch).toBeGreaterThanOrEqual(45);
      expect(ch).toBeLessThanOrEqual(75);
    }
  });
});
