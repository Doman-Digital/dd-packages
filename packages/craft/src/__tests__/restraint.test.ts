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
