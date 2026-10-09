import { describe, expect, it } from "vitest";
import { gradientContrast, gradientStops } from "../color/gradient.js";
import { wcagContrast } from "../color/contrast.js";

// The fixture pair dd-drift-guards shipped with its contrast guard, kept
// here so the folded-in check is seen to catch its own target.
const FAIL = { text: "#8a8f98", gradient: "linear-gradient(135deg, #f4f6fb 0%, #e7ebf5 100%)", beneath: "#ffffff" };

describe("gradientContrast", () => {
  it("fails muted text on a light gradient panel, the case axe and Lighthouse leave unscored", () => {
    const r = gradientContrast(FAIL.text, FAIL.gradient, FAIL.beneath);
    expect(r.passesAA).toBe(false);
    expect(r.wcag).toBeCloseTo(2.72, 1);
    expect(r.worst).toBe("#e7ebf5");
  });

  it("passes dark body text on a light gradient", () => {
    const r = gradientContrast("#1f2933", "linear-gradient(to bottom, #ffffff, #f4f6fb)");
    expect(r.passesAA).toBe(true);
  });

  it("finds a worst point between the stops, which the stops alone miss", () => {
    // Mid-grey clears 4.5:1 against black and against white, and is about
    // 1:1 against the grey in the middle of the gradient.
    const text = "#767676";
    expect(wcagContrast(text, "#000000")).toBeGreaterThan(4.5);
    expect(wcagContrast(text, "#ffffff")).toBeGreaterThan(4.5);
    const r = gradientContrast(text, "linear-gradient(90deg, #000000, #ffffff)");
    expect(r.passesAA).toBe(false);
    expect(r.wcag).toBeLessThan(1.05);
  });

  it("never blends across a hard stop, which the browser paints as a jump", () => {
    // #000 50%, #fff 50%: black then white, no grey between. Mid-grey clears
    // 4.5:1 against both, so this passes; sampling across the edge would
    // invent a ~1:1 grey (Codex review on dd-drift-guards#8).
    for (const gradient of [
      "linear-gradient(90deg, #000000 50%, #ffffff 50%)",
      "linear-gradient(90deg, #000000 0% 50%, #ffffff 50% 100%)",
      "linear-gradient(90deg, #000000 60%, #ffffff 40%)",
    ]) {
      expect(gradientContrast("#767676", gradient).passesAA, gradient).toBe(true);
    }
    // A blend that is painted is still sampled.
    expect(gradientContrast("#767676", "linear-gradient(90deg, #000000 40%, #ffffff 60%)").passesAA).toBe(false);
  });

  it("composites a translucent stop over what sits beneath", () => {
    const r = gradientContrast("#ffffff", "linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5))", "#ffffff");
    expect(r.stops).toEqual(["#808080", "#808080"]);
  });

  it("refuses translucent text and an unreadable stop rather than guess", () => {
    expect(() => gradientContrast("rgba(0, 0, 0, 0.5)", "linear-gradient(#fff, #000)")).toThrow(/opaque/);
    expect(() => gradientContrast("#000", "linear-gradient(#fff, var(--x))")).toThrow(/unreadable gradient stop/);
  });
});

describe("gradientStops", () => {
  it("keeps commas inside a colour, and drops the direction, shape and positions", () => {
    expect(gradientStops("radial-gradient(circle at top, rgba(1, 2, 3, 0.4) 10%, #fff 50% 60%)")).toEqual(["rgba(1, 2, 3, 0.4)", "#fff"]);
    expect(gradientStops("linear-gradient(135deg, white, black)")).toEqual(["white", "black"]);
    // Conic stops are positioned by angle (Codex review on dd-packages#91).
    expect(gradientStops("conic-gradient(from 45deg, #ff0000 0deg, #0000ff 180deg, #ff0000 0.5turn 1turn)")).toEqual(["#ff0000", "#0000ff", "#ff0000"]);
  });
});
