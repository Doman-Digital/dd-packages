import { afterEach, describe, expect, it, vi } from "vitest";
import { GbpPublishedError } from "../errors";
import { getPublishedExternalReviews, parsePublishedExternal, publishedExternalUrl } from "../external-published";

const FILE = {
  schema: 1,
  client: "bellerose-plumbing",
  source: "checkatrade",
  profile_url: "https://www.checkatrade.com/trades/belleroseplumbing",
  scale: "out_of_10",
  score: 9.84,
  count: 205,
  synced_at: "2026-10-10T03:00:00.000Z",
  published_at: "2026-10-10T03:00:01.000Z",
  reviews: [
    {
      id: "ct-1",
      author: "Karen P.",
      rating: 10,
      sentiment: null,
      job: "Replace kitchen tap",
      comment: "Tidy and on time",
      createdAt: "2026-09-20T00:00:00.000Z",
      reply: { text: "Thank you Karen" },
    },
    { id: "ct-2", author: "Sam", rating: 9, sentiment: null, job: null, comment: "", createdAt: null },
    { id: "ct-3", author: "Jo B.", rating: 11, sentiment: "great", job: "", comment: "Fixed the leak", createdAt: "not a date" },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.GBP_REVIEWS_BASE_URL;
});

describe("published Checkatrade and MyBuilder reviews", () => {
  it("reads <client>.<source>.json, keeps the platform's figures and drops an entry without words", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify(FILE), { status: 200 }));
    const r = await getPublishedExternalReviews({ client: "bellerose-plumbing", source: "checkatrade" });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://files.domandigital.co.uk/reviews/bellerose-plumbing.checkatrade.json");
    expect([r.source, r.scale, r.score, r.count]).toEqual(["checkatrade", "out_of_10", 9.84, 205]);
    expect(r.profileUrl).toBe("https://www.checkatrade.com/trades/belleroseplumbing");
    expect(r.reviews).toEqual([
      {
        id: "ct-1",
        author: "Karen P.",
        rating: 10,
        sentiment: null,
        job: "Replace kitchen tap",
        comment: "Tidy and on time",
        createdAt: "2026-09-20T00:00:00.000Z",
        reply: { text: "Thank you Karen" },
      },
      { id: "ct-3", author: "Jo B.", rating: null, sentiment: null, job: null, comment: "Fixed the leak", createdAt: null },
    ]);
    expect(r.syncedAt).toBe("2026-10-10T03:00:00.000Z");
  });

  it("limits the reviews returned without touching the figures", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify(FILE), { status: 200 }));
    const r = await getPublishedExternalReviews({ client: "bellerose-plumbing", source: "checkatrade", limit: 1 });
    expect(r.reviews.map((v) => v.id)).toEqual(["ct-1"]);
    expect(r.count).toBe(205);
  });

  it("throws on a missing file so the caller keeps its copy", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("Not Found", { status: 404 }));
    const err = await getPublishedExternalReviews({
      client: "bellerose-plumbing",
      source: "mybuilder",
      request: { baseDelayMs: 0 },
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GbpPublishedError);
    expect((err as GbpPublishedError).status).toBe(404);
  });

  it("refuses the other platform's file, another client's, a wrong scale and a score above the scale", () => {
    expect(() => parsePublishedExternal(FILE, "bellerose-plumbing", "mybuilder")).toThrow(/not mybuilder/);
    expect(() => parsePublishedExternal({ ...FILE, client: "rmp-electrical" }, "bellerose-plumbing", "checkatrade")).toThrow(/for rmp-electrical/);
    expect(() => parsePublishedExternal({ ...FILE, scale: "percent_positive" }, "bellerose-plumbing", "checkatrade")).toThrow(/scale/);
    expect(() => parsePublishedExternal({ ...FILE, score: 98.4 }, "bellerose-plumbing", "checkatrade")).toThrow(/out of range/);
    expect(() => parsePublishedExternal({ ...FILE, schema: 2 }, "bellerose-plumbing", "checkatrade")).toThrow(/unknown_schema/);
    const mb = parsePublishedExternal(
      { ...FILE, source: "mybuilder", scale: "percent_positive", score: 100, count: null, reviews: [] },
      "bellerose-plumbing",
      "mybuilder",
    );
    expect([mb.score, mb.count]).toEqual([100, null]);
  });

  it("builds the URL from the base and refuses a slug or source it does not know", () => {
    expect(publishedExternalUrl("bellerose-plumbing", "mybuilder", "https://example.test/r/")).toBe(
      "https://example.test/r/bellerose-plumbing.mybuilder.json",
    );
    expect(() => publishedExternalUrl("../etc", "checkatrade")).toThrow(RangeError);
    expect(() => publishedExternalUrl("bellerose-plumbing", "trustpilot" as never)).toThrow(RangeError);
  });
});
