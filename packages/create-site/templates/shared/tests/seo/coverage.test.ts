// Every page has a policy entry, and every money page has a keyword target.
// Fails the moment a page is added without one. Written by
// @domandigital/create-site: the data lives in site.routes.ts.

import { describe, expect, test } from "vitest";
import { findKeywordCannibalization, validateCoverage } from "@domandigital/seo";
import { moneyRoutes, policy, targets } from "~site/routes";
import { routesOnDisk } from "~site/routes-on-disk";

describe("route coverage", () => {
  test("every page on disk has a policy entry, and every money page has a target", () => {
    expect(validateCoverage({ routesOnDisk: routesOnDisk(), policy, moneyRoutes, targets })).toEqual([]);
  });

  test("no two pages chase the same keyword", () => {
    expect(findKeywordCannibalization(targets)).toEqual([]);
  });
});
