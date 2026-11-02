import { describe, expect, test } from "vitest";
import { getBreadcrumbTrail, type TrailLabel } from "../trail";

const LABELS: TrailLabel[] = [
  { path: "/work", label: "Work" },
  { path: "/work/case-c", label: "Case C" },
  { path: "/electrician", label: "Electrician" },
  { path: "/electrician/high-wycombe", label: "High Wycombe" },
];

describe("getBreadcrumbTrail", () => {
  test("builds a trail from registered labels at each segment", () => {
    expect(getBreadcrumbTrail(LABELS, "/work/case-c")).toEqual([
      { path: "/work", label: "Work" },
      { path: "/work/case-c", label: "Case C" },
    ]);
  });

  test("skips segments with no registered label instead of breaking the trail", () => {
    expect(getBreadcrumbTrail(LABELS, "/electrician/high-wycombe")).toEqual([
      { path: "/electrician", label: "Electrician" },
      { path: "/electrician/high-wycombe", label: "High Wycombe" },
    ]);
  });

  test("empty trail for a fully unregistered path", () => {
    expect(getBreadcrumbTrail(LABELS, "/nope/nested")).toEqual([]);
  });
});
