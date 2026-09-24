import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { liveLinkedUrls } from "../backlinks";
import type { Backlink } from "../backlinks";

const link = (overrides: Partial<Backlink>): Backlink => ({
  source: "NICEIC contractor register",
  url: "https://www.niceic.com/find-a-contractor/example",
  targetUrl: "https://example-electrical.co.uk/",
  obtainedOn: "2026-09-24",
  rel: "nofollow",
  status: "live",
  ...overrides,
});

describe("liveLinkedUrls", () => {
  test("returns only live links' targets, so a lost link does not demand a redirect", () => {
    const urls = liveLinkedUrls({
      links: [
        link({ targetUrl: "https://example-electrical.co.uk/a" }),
        link({ targetUrl: "https://example-electrical.co.uk/b", status: "lost" }),
        link({ targetUrl: "https://example-electrical.co.uk/c", status: "pending" }),
      ],
    });
    expect(urls).toEqual(["https://example-electrical.co.uk/a"]);
  });

  test("de-duplicates targets that several sources link to", () => {
    const urls = liveLinkedUrls({ links: [link({ source: "A" }), link({ source: "B" })] });
    expect(urls).toEqual(["https://example-electrical.co.uk/"]);
  });
});

describe("links.schema.json stays in step with the Backlink type", () => {
  const schema = JSON.parse(readFileSync(new URL("../../links.schema.json", import.meta.url), "utf8"));
  const item = schema.properties.links.items;

  test("every Backlink field is in the schema, and the required ones are required", () => {
    expect(Object.keys(item.properties).sort()).toEqual(
      ["kind", "lastCheckedOn", "notes", "obtainedOn", "rel", "source", "status", "targetUrl", "url"].sort(),
    );
    expect([...item.required].sort()).toEqual(["obtainedOn", "rel", "source", "status", "targetUrl", "url"]);
  });

  test("has no status for asks: the register records links, not outreach", () => {
    expect(item.properties.status.enum).toEqual(["live", "pending", "lost"]);
  });
});
