import { afterEach, describe, expect, it, vi } from "vitest";
import { GbpPublishedError } from "../errors";
import { getPublishedFacebookRecommendations, parsePublishedFacebook } from "../facebook-published";

const FILE = {
  schema: 1,
  client: "example-electrical",
  source: "facebook",
  rating: 5,
  count: 6,
  recommends: 6,
  synced_at: "2026-10-09T04:20:00.000Z",
  published_at: "2026-10-09T04:20:01.000Z",
  reviews: [
    { id: "a", comment: "Brilliant electrician", createdAt: "2026-05-01T10:00:00.000Z" },
    { id: "b", comment: "", createdAt: "2026-04-01T10:00:00.000Z" },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.GBP_REVIEWS_BASE_URL;
});

describe("published Facebook recommendations", () => {
  it("reads <client>.facebook.json, keeps Meta's figures and drops an entry without words", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify(FILE), { status: 200 }));
    const r = await getPublishedFacebookRecommendations({ client: "example-electrical" });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://files.domandigital.co.uk/reviews/example-electrical.facebook.json");
    expect([r.rating, r.count, r.recommends]).toEqual([5, 6, 6]);
    expect(r.reviews).toEqual([{ id: "a", comment: "Brilliant electrician", createdAt: "2026-05-01T10:00:00.000Z" }]);
    expect(r.syncedAt).toBe("2026-10-09T04:20:00.000Z");
  });

  it("throws on a missing file so the caller keeps its copy", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("Not Found", { status: 404 }));
    const err = await getPublishedFacebookRecommendations({ client: "example-electrical", request: { baseDelayMs: 0 } }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GbpPublishedError);
    expect((err as GbpPublishedError).status).toBe(404);
  });

  it("refuses the Google file, another client's file, and impossible counts", () => {
    expect(() => parsePublishedFacebook({ ...FILE, source: undefined }, "example-electrical")).toThrow(/for example-electrical \(undefined\)/);
    expect(() => parsePublishedFacebook({ ...FILE, client: "example-salon" }, "example-electrical")).toThrow(/for example-salon/);
    expect(() => parsePublishedFacebook({ ...FILE, recommends: 7 }, "example-electrical")).toThrow(/within the count/);
    expect(() => parsePublishedFacebook({ ...FILE, schema: 2 }, "example-electrical")).toThrow(/unknown_schema/);
    expect(parsePublishedFacebook({ ...FILE, rating: null }, "example-electrical").rating).toBeNull();
  });
});
