import { describe, expect, it } from "vitest";
import {
  deltaEOk,
  deltaEOkHex,
  hexToOklch,
  inP3Gamut,
  inSrgbGamut,
  parseHex,
} from "../color/oklch.js";
import { oklchToHex, toGamut } from "../color/gamut.js";

/** Deterministic PRNG so a failure is reproducible. */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe("hexToOklch", () => {
  it("reproduces Ottosson's published reference values", () => {
    // https://bottosson.github.io/posts/oklab/ — sRGB red.
    const red = hexToOklch("#ff0000");
    expect(red.l).toBeCloseTo(0.6279, 3);
    expect(red.c).toBeCloseTo(0.2577, 3);
    expect(red.h).toBeCloseTo(29.23, 1);
  });

  it("puts white and black at the ends of the lightness axis with no chroma", () => {
    // Float epsilon, not error: the cube roots do not land on exact 1.
    const white = hexToOklch("#ffffff");
    expect(white.l).toBeCloseTo(1, 6);
    expect(white.c).toBeCloseTo(0, 6);
    const black = hexToOklch("#000000");
    expect(black.l).toBeCloseTo(0, 6);
    expect(black.c).toBeCloseTo(0, 6);
  });

  it("places the house violet where two independent matrix routes agree", () => {
    // NOTE: the programme brief asserted L~0.52, H~290+/-1 for this colour.
    // Both the direct Ottosson route and an independent sRGB->XYZ->LMS route
    // give L=0.5639, H=285.02. The brief's figure was wrong; these are measured.
    const violet = hexToOklch("#7050f5");
    expect(violet.l).toBeCloseTo(0.5639, 3);
    expect(violet.h).toBeCloseTo(285.02, 1);
  });

  it("accepts shorthand and alpha hex", () => {
    expect(parseHex("#fff")).toEqual(parseHex("#ffffff"));
    expect(parseHex("#ff0000ff")).toEqual(parseHex("#ff0000"));
  });

  it("rejects a string that is not a colour", () => {
    expect(() => parseHex("nonsense")).toThrow(/not a hex colour/);
  });
});

describe("round trip", () => {
  it("survives 5,000 random hexes within a fraction of a JND", () => {
    const random = makeRandom(20260902);
    let worst = 0;
    for (let i = 0; i < 5000; i += 1) {
      const hex = `#${Array.from({ length: 3 }, () =>
        Math.floor(random() * 256)
          .toString(16)
          .padStart(2, "0"),
      ).join("")}`;
      worst = Math.max(worst, deltaEOkHex(hex, oklchToHex(hexToOklch(hex))));
    }
    expect(worst).toBeLessThan(0.002);
  });
});

describe("gamut mapping", () => {
  const wide = { l: 0.7, c: 0.35, h: 150 };

  it("treats P3 as strictly wider than sRGB", () => {
    expect(inSrgbGamut(wide)).toBe(false);
    expect(inP3Gamut(wide)).toBe(false);
    expect(toGamut(wide, "p3").c).toBeGreaterThan(toGamut(wide, "srgb").c);
  });

  it("preserves hue and lightness, moving only chroma", () => {
    const mapped = toGamut(wide, "srgb");
    expect(mapped.h).toBe(wide.h);
    expect(mapped.l).toBe(wide.l);
    expect(mapped.c).toBeLessThan(wide.c);
    expect(inSrgbGamut(mapped)).toBe(true);
  });

  it("leaves an in-gamut colour untouched", () => {
    const inside = hexToOklch("#7050f5");
    expect(toGamut(inside, "srgb")).toBe(inside);
  });

  it("collapses chroma at the lightness extremes", () => {
    expect(toGamut({ l: 0, c: 0.3, h: 200 })).toMatchObject({ l: 0, c: 0 });
    expect(toGamut({ l: 1, c: 0.3, h: 200 })).toMatchObject({ l: 1, c: 0 });
  });
});

describe("deltaEOk", () => {
  it("is zero for a colour against itself", () => {
    expect(deltaEOk(hexToOklch("#7050f5"), hexToOklch("#7050f5"))).toBe(0);
  });

  it("ranks a near-neighbour below a JND and a different hue above it", () => {
    expect(deltaEOkHex("#7050f5", "#7050f4")).toBeLessThan(0.02);
    expect(deltaEOkHex("#7050f5", "#f55050")).toBeGreaterThan(0.02);
  });
});
