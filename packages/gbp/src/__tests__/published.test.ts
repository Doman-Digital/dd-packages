import { afterEach, describe, expect, it, vi } from "vitest";
import { GbpPublishedError } from "../errors";
import { getPublishedReviews, parsePublishedReviews, publishedReviewsUrl } from "../published";

const FILE = {
  schema: 1,
  client: "example-barber",
  rating: 4.7,
  count: 90,
  min_stars: 4,
  synced_at: "2026-10-09T03:45:00.000Z",
  published_at: "2026-10-09T03:46:00.000Z",
  reviews: [
    { id: "a", author: "Sam P", rating: 5, comment: "Great cut", createdAt: "2026-07-22T08:54:18.347Z", reply: { text: "Thanks Sam", updatedAt: "2026-07-23T10:00:00.000Z" } },
    { id: "b", author: "Ana", rating: 4, comment: "Good", createdAt: "2026-07-21T08:00:00.000Z" },
    { id: "bad", author: "X", rating: 9, comment: "out of range" },
  ],
};

function res(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, headers: new Headers(), json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.GBP_REVIEWS_BASE_URL;
});

describe("published reviews", () => {
  it("reads Google's own figures and the published reviews, skipping a malformed one", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(res(200, FILE));
    const r = await getPublishedReviews({ client: "example-barber" });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://files.domandigital.co.uk/reviews/example-barber.json");
    expect(r.averageRating).toBe(4.7);
    expect(r.totalReviewCount).toBe(90);
    expect(r.syncedAt).toBe("2026-10-09T03:45:00.000Z");
    expect(r.reviews.map((x) => x.id)).toEqual(["a", "b"]);
    expect(r.reviews[0]?.reply).toEqual({ text: "Thanks Sam", updatedAt: "2026-07-23T10:00:00.000Z" });
  });

  it("filters, limits and honours the base URL from the environment", async () => {
    process.env.GBP_REVIEWS_BASE_URL = "https://staging.example.test/reviews/";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(res(200, FILE));
    const r = await getPublishedReviews({ client: "example-barber", filterMinStars: 5, limit: 1 });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://staging.example.test/reviews/example-barber.json");
    expect(r.reviews.map((x) => x.id)).toEqual(["a"]);
    expect(r.totalReviewCount).toBe(90);
  });

  it("throws on a missing file so the caller keeps the copy it has, and retries a 503 first", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(res(503, "busy")).mockResolvedValue(res(404, "Not Found"));
    const err = await getPublishedReviews({ client: "example-barber", request: { baseDelayMs: 0 } }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GbpPublishedError);
    expect((err as GbpPublishedError).reason).toBe("http");
    expect((err as GbpPublishedError).status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refuses a file for another client, an unknown schema and a figure out of range", () => {
    expect(() => parsePublishedReviews({ ...FILE, client: "example-salon" }, "example-barber")).toThrow(/for example-salon/);
    expect(() => parsePublishedReviews({ ...FILE, schema: 2 }, "example-barber")).toThrow(/unknown_schema/);
    expect(() => parsePublishedReviews({ ...FILE, rating: 7 }, "example-barber")).toThrow(/rating/);
    expect(() => parsePublishedReviews({ ...FILE, count: 1.5 }, "example-barber")).toThrow(/count/);
    // Null is Google giving no figure: allowed, and the site shows no number.
    expect(parsePublishedReviews({ ...FILE, rating: null, count: null }, "example-barber").averageRating).toBeNull();
  });

  it("only builds URLs from a slug", () => {
    expect(() => publishedReviewsUrl("../secrets")).toThrow(RangeError);
  });
});
