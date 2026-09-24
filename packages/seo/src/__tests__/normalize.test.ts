import { describe, expect, test } from "vitest";
import { normalizeRoutePath, toPolicyPatterns } from "../normalize";

describe("normalizeRoutePath", () => {
  test("strips query, hash and a trailing slash by default", () => {
    expect(normalizeRoutePath("/pricing/")).toBe("/pricing");
    expect(normalizeRoutePath("/pricing?ref=x")).toBe("/pricing");
    expect(normalizeRoutePath("/pricing#faq")).toBe("/pricing");
    expect(normalizeRoutePath("/pricing/?ref=x#faq")).toBe("/pricing");
  });

  test("keeps the root as /", () => {
    expect(normalizeRoutePath("/")).toBe("/");
    expect(normalizeRoutePath("/?x=1")).toBe("/");
    expect(normalizeRoutePath("")).toBe("/");
  });

  test("adds a trailing slash under trailingSlash: always", () => {
    expect(normalizeRoutePath("/pricing", { trailingSlash: "always" })).toBe("/pricing/");
    expect(normalizeRoutePath("/pricing/", { trailingSlash: "always" })).toBe("/pricing/");
    expect(normalizeRoutePath("/", { trailingSlash: "always" })).toBe("/");
  });
});

describe("toPolicyPatterns", () => {
  test("maps a dynamic segment and a catch-all to the /prefix/* convention", () => {
    expect(toPolicyPatterns("/blog/[slug]")).toEqual(["/blog/*"]);
    expect(toPolicyPatterns("/docs/[...slug]")).toEqual(["/docs/*"]);
    expect(toPolicyPatterns("/blog/[slug]/comments")).toEqual(["/blog/*"]);
    expect(toPolicyPatterns("/[slug]")).toEqual(["/*"]);
  });

  test("an optional catch-all also needs its parent", () => {
    expect(toPolicyPatterns("/help/[[...slug]]")).toEqual(["/help", "/help/*"]);
    expect(toPolicyPatterns("/[[...slug]]")).toEqual(["/", "/*"]);
  });

  test("drops route groups", () => {
    expect(toPolicyPatterns("/(marketing)/blog/[slug]")).toEqual(["/blog/*"]);
    expect(toPolicyPatterns("/(marketing)/pricing")).toEqual(["/pricing"]);
  });

  test("throws on parallel and intercepting segments instead of guessing", () => {
    expect(() => toPolicyPatterns("/feed/@modal/[id]")).toThrow(/parallel or intercepting/);
    expect(() => toPolicyPatterns("/feed/(.)photo/[id]")).toThrow(/parallel or intercepting/);
  });
});
