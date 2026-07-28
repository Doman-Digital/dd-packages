import { describe, expect, test } from "vitest";
import { getRoutePolicy, getSitemapRoutes, isRouteIndexable, type RoutePolicyEntry } from "../policy";

const POLICY: RoutePolicyEntry[] = [
  { path: "/audit", indexable: true, inSitemap: true },
  { path: "/audit/success", indexable: false, inSitemap: false },
  { path: "/locations/*", indexable: false, inSitemap: false, isDynamicPattern: true },
];

describe("getRoutePolicy", () => {
  test("exact match wins", () => {
    expect(getRoutePolicy(POLICY, "/audit")?.indexable).toBe(true);
  });

  test("pattern match via prefix", () => {
    expect(getRoutePolicy(POLICY, "/locations/manchester")?.isDynamicPattern).toBe(true);
  });

  test("unknown route returns undefined", () => {
    expect(getRoutePolicy(POLICY, "/nope")).toBeUndefined();
  });
});

describe("getSitemapRoutes", () => {
  test("excludes non-sitemap and pattern entries", () => {
    const routes = getSitemapRoutes(POLICY);
    expect(routes.map((r) => r.path)).toEqual(["/audit"]);
  });
});

describe("isRouteIndexable", () => {
  test("respects explicit policy", () => {
    expect(isRouteIndexable(POLICY, "/audit/success")).toBe(false);
  });

  test("defaults to true for an unknown route — the bug this default caused belongs to validateCoverage, not this function", () => {
    expect(isRouteIndexable(POLICY, "/work/sensphere")).toBe(true);
  });
});
