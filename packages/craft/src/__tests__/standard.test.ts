import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { HOUSE_BUDGET } from "../restraint/index.js";
import { DURATION_MS, EASE, EXIT_RATIO } from "../motion/tokens.js";

const STANDARD = readFileSync(
  fileURLToPath(new URL("../../STANDARD.md", import.meta.url)),
  "utf8",
);

/** The canonical block STANDARD.md publishes as the standard's numbers. */
function canonical(): {
  budget: typeof HOUSE_BUDGET;
  ease: Record<string, string>;
  durationMs: Record<string, number>;
  exitRatio: number;
  contrast: { minWcag: number; minLc: number; deltaEOk: number };
} {
  const marker = STANDARD.indexOf("<!-- craft:canonical -->");
  expect(marker, "STANDARD.md has no canonical block").toBeGreaterThan(-1);
  const fenced = STANDARD.slice(marker).match(/```json\n([\s\S]*?)```/);
  expect(fenced, "canonical block is not fenced json").not.toBeNull();
  return JSON.parse(fenced![1]);
}

describe("STANDARD.md is bound to the code", () => {
  // A standard that documents numbers the package does not ship is worse than
  // no standard: it is a second source of truth that reads as authoritative.
  it("publishes the budget the package enforces", () => {
    expect(canonical().budget).toEqual(HOUSE_BUDGET);
  });

  it("publishes the ease curves the package emits", () => {
    expect(canonical().ease).toEqual({ ...EASE });
  });

  it("publishes the durations the package emits", () => {
    expect(canonical().durationMs).toEqual({ ...DURATION_MS });
  });

  it("publishes the exit ratio the package applies", () => {
    expect(canonical().exitRatio).toBe(EXIT_RATIO);
  });
});

describe("STANDARD.md structure", () => {
  it("has all twelve sections", () => {
    const headings = [...STANDARD.matchAll(/^## (\d+)\./gm)].map((m) => Number(m[1]));
    expect(headings).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("cites a source for every rule section", () => {
    // Sections 1-10 are rules and must each carry a source line; 11 and 12
    // are the non-rules and the data block.
    const sections = STANDARD.split(/^## /m).slice(1);
    for (const section of sections) {
      const number = Number(section.match(/^(\d+)\./)![1]);
      if (number >= 11) continue;
      expect(section, `section ${number} has no source`).toMatch(/\*Source:/);
    }
  });

  it("puts the phone first, as a rule about order and floor", () => {
    const section10 = STANDARD.split(/^## /m).find((s) => s.startsWith("10."))!;
    expect(section10).toMatch(/^10\. The phone is the base layout/);
    for (const rule of ["`min-width`", "375", "44 × 44", "16px", "mobile Lighthouse"]) expect(section10).toContain(rule);
    const section11 = STANDARD.split(/^## /m).find((s) => s.startsWith("11."))!;
    expect(section11, "the not-a-rule section must say layout stays free under section 10").toMatch(/Section\s+10 fixes the order/);
  });

  it("says what is deliberately not a rule", () => {
    expect(STANDARD).toMatch(/## 11\. What is deliberately not a rule/);
  });
});
