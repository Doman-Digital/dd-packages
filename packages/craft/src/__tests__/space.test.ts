import { describe, expect, it } from "vitest";
import { SPACE_STEPS, fluidSpace, sectionRhythm } from "../space/scale.js";
import { DENSITIES, densityCss, densityTokens } from "../density/index.js";

describe("fluidSpace", () => {
  it("emits every step plus the one-up pairs", () => {
    const tokens = fluidSpace();
    const steps = Object.keys(SPACE_STEPS);
    for (const step of steps) expect(tokens[`--craft-space-${step}`]).toBeDefined();
    // n steps yield n-1 adjacent pairs.
    expect(Object.keys(tokens)).toHaveLength(steps.length * 2 - 1);
  });

  it("ascends across the scale", () => {
    const tokens = fluidSpace();
    const maxima = Object.keys(SPACE_STEPS).map((s) =>
      parseFloat(tokens[`--craft-space-${s}`].match(/[\d.]+rem\)/)![0]),
    );
    for (let i = 1; i < maxima.length; i += 1) {
      expect(maxima[i]).toBeGreaterThan(maxima[i - 1]);
    }
  });
});

describe("sectionRhythm", () => {
  it("emits three sizes, not the five that shipped with zero consumers", () => {
    const tokens = sectionRhythm();
    expect(Object.keys(tokens)).toEqual([
      "--craft-section-sm",
      "--craft-section-md",
      "--craft-section-lg",
    ]);
  });

  it("puts lg where a client site arrived at by hand", () => {
    // That site hand-wrote clamp(5rem, 10vw, 9rem) = 80px..144px.
    const { "--craft-section-lg": lg } = sectionRhythm();
    const [min, , max] = lg.match(/[\d.]+rem/g)!;
    expect(parseFloat(min)).toBeCloseTo(5, 2);
    expect(parseFloat(max)).toBeCloseTo(9, 2);
  });

  it("accepts a literal override for a site that must not move", () => {
    const tokens = sectionRhythm({ lg: "clamp(5rem, 10vw, 9rem)" });
    expect(tokens["--craft-section-lg"]).toBe("clamp(5rem, 10vw, 9rem)");
  });
});

describe("density", () => {
  it("keeps every dimension on the 4px grid", () => {
    for (const [name, d] of Object.entries(DENSITIES)) {
      for (const [key, px] of Object.entries(d)) {
        if (key === "fontPx") continue;
        expect(px % 4, `${name}.${key} = ${px}`).toBe(0);
      }
    }
  });

  it("orders the three densities by row height", () => {
    expect(DENSITIES.compact.rowPx).toBeLessThan(DENSITIES.comfortable.rowPx);
    expect(DENSITIES.comfortable.rowPx).toBeLessThan(DENSITIES.spacious.rowPx);
  });

  it("emits a root block plus one per density, so a shell sets it once", () => {
    const css = densityCss();
    expect(css).toMatch(/^:root \{/);
    for (const name of Object.keys(DENSITIES)) {
      expect(css).toContain(`[data-density="${name}"]`);
    }
  });

  it("defaults the root block to comfortable", () => {
    expect(densityCss()).toContain(densityTokens("comfortable")["--craft-density-row"]);
  });
});
