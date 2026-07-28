import { describe, expect, test } from "vitest";
import { getRelatedLinks, type LinkDeclaration } from "../links";

const DECLS: LinkDeclaration[] = [
  { routeKey: "journal/biab-vs-gel", supports: ["treatments/biab-nails"], pillar: "nails" },
  { routeKey: "journal/nail-aftercare", supports: ["treatments/biab-nails"], pillar: "nails" },
  { routeKey: "journal/gel-removal", pillar: "nails" },
  { routeKey: "treatments/biab-nails", pillar: "nails" },
  { routeKey: "journal/unrelated-topic", pillar: "brows" },
];

describe("getRelatedLinks", () => {
  test("money page gets the reverse edge from every guide that supports it", () => {
    const { linkedFrom } = getRelatedLinks(DECLS, "treatments/biab-nails");
    expect(linkedFrom.sort()).toEqual(["journal/biab-vs-gel", "journal/nail-aftercare"]);
  });

  test("a guide with explicit supports links out to its declared target", () => {
    const { linksTo } = getRelatedLinks(DECLS, "journal/biab-vs-gel");
    expect(linksTo).toContain("treatments/biab-nails");
  });

  test("a guide with no explicit supports falls back to pillar siblings", () => {
    const { linksTo } = getRelatedLinks(DECLS, "journal/gel-removal");
    expect(linksTo.sort()).toEqual(
      ["journal/biab-vs-gel", "journal/nail-aftercare", "treatments/biab-nails"].sort(),
    );
  });

  test("pillar fallback never crosses into a different pillar", () => {
    const { linksTo } = getRelatedLinks(DECLS, "journal/unrelated-topic");
    expect(linksTo).toEqual([]);
  });

  test("limit caps explicit supports and tops up with siblings, not more", () => {
    const { linksTo } = getRelatedLinks(DECLS, "journal/biab-vs-gel", { limit: 2 });
    expect(linksTo.length).toBeLessThanOrEqual(2);
    expect(linksTo).toContain("treatments/biab-nails");
  });
});
