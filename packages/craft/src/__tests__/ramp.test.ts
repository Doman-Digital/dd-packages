import { describe, expect, it } from "vitest";
import { LIGHTNESS_CURVE, RAMP_STEPS, ramp, rampFromAnchors } from "../color/ramp.js";
import { hexToOklch } from "../color/oklch.js";

function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe("the anchor guarantee", () => {
  it("returns the caller's exact input string at the anchor step, for 2,000 hexes", () => {
    const random = makeRandom(490);
    for (let i = 0; i < 2000; i += 1) {
      const hex = `#${Array.from({ length: 3 }, () =>
        Math.floor(random() * 256)
          .toString(16)
          .padStart(2, "0"),
      ).join("")}`;
      const built = ramp(hex);
      // Identity, not equality-after-reserialising: the string is handed back.
      expect(built.ramp[built.anchor]).toBe(hex);
    }
  });

  it("honours an explicitly requested step", () => {
    const built = ramp("#7050f5", { step: 500 });
    expect(built.anchor).toBe(500);
    expect(built.ramp[500]).toBe("#7050f5");
  });

  it("emits all eleven steps", () => {
    const built = ramp("#7050f5");
    expect(Object.keys(built.ramp).map(Number).sort((a, b) => a - b)).toEqual([...RAMP_STEPS]);
  });
});

describe("ramp shape", () => {
  it("descends in lightness from 50 to 950", () => {
    const built = ramp("#7050f5", { step: 500 });
    const lightness = RAMP_STEPS.map((s) => hexToOklch(built.ramp[s]).l);
    for (let i = 1; i < lightness.length; i += 1) {
      expect(lightness[i]).toBeLessThan(lightness[i - 1]);
    }
  });

  it("holds the seed hue across every generated step", () => {
    const built = ramp("#7050f5", { step: 500 });
    const seedHue = hexToOklch("#7050f5").h;
    for (const step of RAMP_STEPS) {
      const { c, h } = hexToOklch(built.ramp[step]);
      // Hue is unstable where chroma has collapsed; only assert where it reads.
      if (c > 0.02) expect(Math.abs(h - seedHue)).toBeLessThan(3);
    }
  });

  it("desaturates toward both ends rather than holding mid-ramp chroma", () => {
    const built = ramp("#7050f5", { step: 500 });
    const mid = hexToOklch(built.ramp[500]).c;
    expect(hexToOklch(built.ramp[50]).c).toBeLessThan(mid);
    expect(hexToOklch(built.ramp[950]).c).toBeLessThan(mid);
  });
});

describe("rampFromAnchors", () => {
  // The values Phase 5 pins for the portal.
  const anchors = { 400: "#a78bfa", 500: "#7050f5", 600: "#6e4ce8" } as const;

  it("returns every supplied anchor unchanged", () => {
    const built = rampFromAnchors(anchors);
    for (const [step, hex] of Object.entries(anchors)) {
      expect(built[Number(step) as 400]).toBe(hex);
    }
  });

  it("fills every gap", () => {
    const built = rampFromAnchors(anchors);
    for (const step of RAMP_STEPS) {
      expect(built[step]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("extends past the anchored span in the right direction", () => {
    // Generated steps do NOT sit on the raw curve — the warp moves them so the
    // anchors' real lightness governs. What must hold is that steps lighter
    // than the lightest anchor are lighter than it, and darker steps darker.
    const built = rampFromAnchors(anchors);
    const lightestAnchor = hexToOklch(anchors[400]).l;
    const darkestAnchor = hexToOklch(anchors[600]).l;
    for (const step of [50, 100, 200, 300] as const) {
      expect(hexToOklch(built[step]).l).toBeGreaterThan(lightestAnchor);
    }
    for (const step of [700, 800, 900, 950] as const) {
      expect(hexToOklch(built[step]).l).toBeLessThan(darkestAnchor);
    }
  });

  it("keeps every step inside the representable lightness range", () => {
    const built = rampFromAnchors(anchors);
    for (const step of RAMP_STEPS) {
      const { l } = hexToOklch(built[step]);
      expect(l).toBeGreaterThanOrEqual(0);
      expect(l).toBeLessThanOrEqual(1);
    }
  });

  it("stays monotonic even though the anchors sit off the curve", () => {
    // #7050f5 is L=0.564 but LIGHTNESS_CURVE[500] is 0.658. Generating step 600
    // from the raw curve gave a step *lighter* than 500 — a ramp that reverses.
    const built = rampFromAnchors(anchors);
    const lightness = RAMP_STEPS.map((s) => hexToOklch(built[s]).l);
    for (let i = 1; i < lightness.length; i += 1) {
      expect(lightness[i], `step ${RAMP_STEPS[i]}`).toBeLessThan(lightness[i - 1]);
    }
  });

  it("works from a single anchor", () => {
    const built = rampFromAnchors({ 500: "#7050f5" });
    expect(built[500]).toBe("#7050f5");
    expect(built[50]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("refuses an empty anchor set rather than inventing a palette", () => {
    expect(() => rampFromAnchors({})).toThrow(/at least one anchor/);
  });
});
