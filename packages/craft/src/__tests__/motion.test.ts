import { describe, expect, it } from "vitest";
import {
  DURATION_MS,
  DURATION_S,
  EASE,
  EASE_TUPLE,
  exitDuration,
} from "../motion/tokens.js";
import { shouldAnimate } from "../motion/decide.js";

describe("EASE and EASE_TUPLE", () => {
  it("carry the identical control points, so CSS and JS cannot drift", () => {
    for (const [name, css] of Object.entries(EASE)) {
      const fromCss = css.match(/[\d.]+/g)!.map(Number);
      expect(fromCss).toEqual([...EASE_TUPLE[name as keyof typeof EASE]]);
    }
  });
});

describe("DURATION_S", () => {
  it("mirrors DURATION_MS exactly", () => {
    for (const [name, ms] of Object.entries(DURATION_MS)) {
      expect(DURATION_S[name as keyof typeof DURATION_MS]).toBeCloseTo(ms / 1000, 10);
    }
  });

  it("keeps every UI duration at or under 300ms", () => {
    const uiOnly = { ...DURATION_MS } as Record<string, number>;
    delete uiOnly.drawer;
    delete uiOnly.reveal;
    for (const [name, ms] of Object.entries(uiOnly)) {
      expect(ms, `${name} is ${ms}ms`).toBeLessThanOrEqual(300);
    }
  });
});

describe("exitDuration", () => {
  it("is faster than the entrance it matches", () => {
    expect(exitDuration(DURATION_MS.modal)).toBe(225);
    expect(exitDuration(200)).toBeLessThan(200);
  });
});

describe("shouldAnimate", () => {
  it("refuses to animate a keyboard-triggered interaction", () => {
    const decision = shouldAnimate({ usesPerDay: 1, trigger: "keyboard", kind: "entrance" });
    expect(decision.animate).toBe(false);
    expect(decision.reason).toMatch(/keyboard/);
  });

  it("refuses at 100 uses a day or more", () => {
    expect(shouldAnimate({ usesPerDay: 100, trigger: "pointer", kind: "state" }).animate).toBe(
      false,
    );
    expect(shouldAnimate({ usesPerDay: 99, trigger: "pointer", kind: "state" }).animate).toBe(
      true,
    );
  });

  it("runs an exit at 0.75x its entrance", () => {
    const decision = shouldAnimate({
      usesPerDay: 1,
      trigger: "pointer",
      kind: "exit",
      enterMs: 200,
    });
    expect(decision.durationMs).toBe(150);
  });

  it("always gives a reason", () => {
    for (const kind of ["entrance", "exit", "state", "reveal", "signature"] as const) {
      expect(shouldAnimate({ usesPerDay: 1, trigger: "pointer", kind }).reason).toBeTruthy();
    }
  });
});
