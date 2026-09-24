import { describe, expect, test } from "vitest";
import { validateCoverage } from "../validate";
import type { RoutePolicyEntry } from "../policy";

// Reproduces the real bug this validator exists to catch: six /work/* case
// studies had live pages and seo-map entries but no routePolicy entry, so
// they were indexable-but-unsubmitted with nothing in CI flagging it.
describe("validateCoverage — the six-missing-case-studies regression", () => {
  const policy: RoutePolicyEntry[] = [
    { path: "/work", indexable: true, inSitemap: true },
    { path: "/work/beautyops", indexable: true, inSitemap: true },
    { path: "/work/verqan", indexable: true, inSitemap: true },
    { path: "/work/rise-bloom", indexable: true, inSitemap: true },
    // sensphere, mmm-beauty, tardi-group etc deliberately absent, matching
    // the pre-fix state of lib/seo/routePolicy.ts.
  ];

  const routesOnDisk = [
    "/work",
    "/work/beautyops",
    "/work/verqan",
    "/work/rise-bloom",
    "/work/sensphere",
    "/work/mmm-beauty",
    "/work/tardi-group",
  ];

  test("flags every route on disk with no policy entry", () => {
    const issues = validateCoverage({ routesOnDisk, policy });
    const missing = issues
      .filter((i) => i.kind === "route-missing-policy")
      .map((i) => i.path)
      .sort();
    expect(missing).toEqual(["/work/mmm-beauty", "/work/sensphere", "/work/tardi-group"]);
  });

  test("a fully covered set produces no issues", () => {
    const fullPolicy: RoutePolicyEntry[] = [
      ...policy,
      { path: "/work/sensphere", indexable: true, inSitemap: true },
      { path: "/work/mmm-beauty", indexable: true, inSitemap: true },
      { path: "/work/tardi-group", indexable: true, inSitemap: true },
    ];
    expect(validateCoverage({ routesOnDisk, policy: fullPolicy })).toEqual([]);
  });
});

describe("validateCoverage — orphaned policy entries", () => {
  test("flags a sitemap-eligible policy entry with no corresponding page", () => {
    const policy: RoutePolicyEntry[] = [
      { path: "/work/retired-client", indexable: true, inSitemap: true },
    ];
    const issues = validateCoverage({ routesOnDisk: [], policy });
    expect(issues).toEqual([{ kind: "policy-missing-route", path: "/work/retired-client" }]);
  });

  test("does not flag a deliberately noindex policy entry with no page", () => {
    const policy: RoutePolicyEntry[] = [
      { path: "/thank-you", indexable: false, inSitemap: false },
    ];
    expect(validateCoverage({ routesOnDisk: [], policy })).toEqual([]);
  });
});

describe("validateCoverage — money routes without a target", () => {
  test("flags a money route with no keyword target declared", () => {
    const policy: RoutePolicyEntry[] = [{ path: "/audit", indexable: true, inSitemap: true }];
    const issues = validateCoverage({
      routesOnDisk: ["/audit"],
      policy,
      moneyRoutes: ["/audit"],
      targets: [],
    });
    expect(issues).toContainEqual({ kind: "money-route-missing-target", path: "/audit" });
  });

  test("does not flag once a target is declared", () => {
    const policy: RoutePolicyEntry[] = [{ path: "/audit", indexable: true, inSitemap: true }];
    const issues = validateCoverage({
      routesOnDisk: ["/audit"],
      policy,
      moneyRoutes: ["/audit"],
      targets: [{ routeKey: "/audit", primaryKeyword: "website audit" }],
    });
    expect(issues.filter((i) => i.kind === "money-route-missing-target")).toEqual([]);
  });
});

describe("validateCoverage — dynamic routes", () => {
  test("flags a dynamic route with no pattern policy", () => {
    expect(
      validateCoverage({ routesOnDisk: [], dynamicRoutesOnDisk: ["/blog/[slug]"], policy: [] }),
    ).toEqual([{ kind: "dynamic-route-missing-policy", path: "/blog/[slug]", pattern: "/blog/*" }]);
  });

  test("a matching pattern entry covers it", () => {
    const policy: RoutePolicyEntry[] = [
      { path: "/blog/*", indexable: true, inSitemap: false, isDynamicPattern: true },
    ];
    expect(validateCoverage({ routesOnDisk: [], dynamicRoutesOnDisk: ["/blog/[slug]"], policy })).toEqual([]);
  });

  test("an optional catch-all needs a static entry for its parent as well", () => {
    const policy: RoutePolicyEntry[] = [
      { path: "/help/*", indexable: true, inSitemap: false, isDynamicPattern: true },
    ];
    expect(
      validateCoverage({ routesOnDisk: [], dynamicRoutesOnDisk: ["/help/[[...slug]]"], policy }),
    ).toEqual([{ kind: "dynamic-route-missing-policy", path: "/help/[[...slug]]", pattern: "/help" }]);
  });

  test("flags a pattern entry no dynamic route produces", () => {
    const policy: RoutePolicyEntry[] = [
      { path: "/locations/*", indexable: false, inSitemap: false, isDynamicPattern: true },
    ];
    expect(validateCoverage({ routesOnDisk: [], dynamicRoutesOnDisk: [], policy })).toEqual([
      { kind: "policy-pattern-missing-route", path: "/locations/*" },
    ]);
  });

  test("without dynamicRoutesOnDisk, pattern entries are not checked (unchanged behaviour)", () => {
    const policy: RoutePolicyEntry[] = [
      { path: "/locations/*", indexable: false, inSitemap: false, isDynamicPattern: true },
    ];
    expect(validateCoverage({ routesOnDisk: [], policy })).toEqual([]);
  });

  test("static routes match policy regardless of a trailing slash", () => {
    const policy: RoutePolicyEntry[] = [{ path: "/pricing", indexable: true, inSitemap: true }];
    expect(validateCoverage({ routesOnDisk: ["/pricing/"], policy })).toEqual([]);
  });
});
