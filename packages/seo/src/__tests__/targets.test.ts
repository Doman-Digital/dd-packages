import { describe, expect, test } from "vitest";
import { findKeywordCannibalization, getTargetForRoute, type PageTarget } from "../targets";

const TARGETS: PageTarget[] = [
  { routeKey: "audit", primaryKeyword: "website audit" },
  { routeKey: "seo", primaryKeyword: "website audit" },
  { routeKey: "electrician/high-wycombe", primaryKeyword: "electrician high wycombe", geo: "High Wycombe" },
];

describe("getTargetForRoute", () => {
  test("finds by routeKey", () => {
    expect(getTargetForRoute(TARGETS, "audit")?.primaryKeyword).toBe("website audit");
  });

  test("undefined for untargeted route", () => {
    expect(getTargetForRoute(TARGETS, "contact")).toBeUndefined();
  });
});

describe("findKeywordCannibalization", () => {
  test("flags two routes sharing a primary keyword", () => {
    const issues = findKeywordCannibalization(TARGETS);
    expect(issues).toEqual([{ primaryKeyword: "website audit", routeKeys: ["audit", "seo"] }]);
  });

  test("allowlist suppresses a deliberate overlap", () => {
    expect(findKeywordCannibalization(TARGETS, ["website audit"])).toEqual([]);
  });
});
