import { describe, expect, test } from "vitest";
import { toPolicyPatterns } from "@domandigital/seo";
import { policyPatternsFor } from "../patterns";

// The generator carries its own copy of seo's rule because it may not import
// seo at runtime. This keeps the copy honest.
describe("policyPatternsFor matches @domandigital/seo's toPolicyPatterns", () => {
  const cases = [
    "/blog/[slug]",
    "/docs/[...slug]",
    "/help/[[...slug]]",
    "/[[...slug]]",
    "/(marketing)/case-studies/[slug]",
    "/blog/[slug]/comments",
    "/shop/[category]/[product]",
    "/pricing",
  ];
  for (const path of cases) {
    test(path, () => {
      expect(policyPatternsFor(path)).toEqual(toPolicyPatterns(path));
    });
  }
});
