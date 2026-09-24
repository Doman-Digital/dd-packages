// Every indexable page's JSON-LD is one connected graph: no dangling @id
// references, no duplicate ids. Written by @domandigital/create-site.

import { describe, expect, test } from "vitest";
import { findGraphIssues } from "@domandigital/graph";
import { buildPageGraph } from "~site/page-graph";
import { policy } from "~site/routes";

describe("JSON-LD", () => {
  test("every indexable page builds a graph with no unresolved or duplicate @id", () => {
    const issues = policy
      .filter((entry) => entry.indexable && !entry.isDynamicPattern)
      .flatMap((entry) => findGraphIssues(buildPageGraph({ path: entry.path, name: entry.path })).map((i) => `${entry.path}: ${i}`));
    expect(issues).toEqual([]);
  });
});
