import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GbpApiError, GbpAuthError, GbpPaginationError, GbpTimeoutError } from "../errors";
import { parseRetryAfter } from "../http";
import { _resetTokenCacheForTests, getGoogleOAuthAccessToken } from "../oauth-client";
import { getBusinessReviews, parseListReviewsResponse } from "../reviews";

const ENV_KEYS = ["GBP_CLIENT_ID", "GBP_CLIENT_SECRET", "GBP_REFRESH_TOKEN", "GOOGLE_BUSINESS_ACCOUNT_ID", "GOOGLE_BUSINESS_LOCATION_ID"] as const;

function setConfigured() {
  process.env.GBP_CLIENT_ID = "client-id";
  process.env.GBP_CLIENT_SECRET = "client-secret-value";
  process.env.GBP_REFRESH_TOKEN = "refresh-token-value";
  process.env.GOOGLE_BUSINESS_ACCOUNT_ID = "accounts/123";
  process.env.GOOGLE_BUSINESS_LOCATION_ID = "locations/456";
}

function res(status: number, body: unknown = {}, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  } as Response;
}

const token = (value: string) => res(200, { access_token: value, expires_in: 3600 });
const review = (id: string, extra: Record<string, unknown> = {}) => ({ reviewId: id, reviewer: { displayName: id }, starRating: "FIVE", comment: `Review ${id}`, createTime: "2026-01-01T00:00:00Z", ...extra });
const page = (reviews: unknown[], extra: Record<string, unknown> = {}) => res(200, { averageRating: 4.8, totalReviewCount: 120, reviews, ...extra });
const FAST = { baseDelayMs: 0 };

beforeEach(() => {
  _resetTokenCacheForTests();
  for (const key of ENV_KEYS) delete process.env[key];
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const key of ENV_KEYS) delete process.env[key];
});

describe("a rejected access token", () => {
  it("is dropped, refreshed once, and the same page is asked for again", async () => {
    setConfigured();
    const fetchSpy = vi.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce(token("token-A"));
    fetchSpy.mockResolvedValueOnce(res(401, { error: { code: 401 } }));
    fetchSpy.mockResolvedValueOnce(token("token-B"));
    fetchSpy.mockResolvedValueOnce(page([review("r1")]));

    const result = await getBusinessReviews({ order: "api", request: FAST });

    expect(result.reviews.map((r) => r.id)).toEqual(["r1"]);
    expect(fetchSpy).toHaveBeenCalledTimes(4);
    const reviewCalls = fetchSpy.mock.calls.filter(([url]) => String(url).includes("/reviews"));
    expect(reviewCalls).toHaveLength(2);
    expect(reviewCalls[0][0]).toBe(reviewCalls[1][0]);
    const auth = reviewCalls.map(([, init]) => (init?.headers as Record<string, string>).Authorization);
    expect(auth).toEqual(["Bearer token-A", "Bearer token-B"]);
  });

  it("throws on a second 401 instead of looping", async () => {
    setConfigured();
    const fetchSpy = vi.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce(token("token-A"));
    fetchSpy.mockResolvedValueOnce(res(401));
    fetchSpy.mockResolvedValueOnce(token("token-B"));
    fetchSpy.mockResolvedValueOnce(res(401));

    const error = await getBusinessReviews({ request: FAST }).catch((e) => e);
    expect(error).toBeInstanceOf(GbpApiError);
    expect(error.status).toBe(401);
    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });
});

describe("the refresh token itself", () => {
  it("surfaces invalid_grant as a reauthorisation error, without retrying or leaking secrets", async () => {
    setConfigured();
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(res(400, { error: "invalid_grant", error_description: "Token has been expired or revoked." }));

    const error = await getGoogleOAuthAccessToken().catch((e) => e);

    expect(error).toBeInstanceOf(GbpAuthError);
    expect(error.code).toBe("invalid_grant");
    expect(error.reauthorizationRequired).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const text = `${String(error)} ${JSON.stringify(error)}`;
    for (const secret of ["client-secret-value", "refresh-token-value"]) expect(text).not.toContain(secret);

    // Nothing was cached: the next call asks Google again.
    await getGoogleOAuthAccessToken().catch(() => undefined);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("classifies invalid_client as a configuration error, not a reauthorisation", async () => {
    setConfigured();
    vi.spyOn(global, "fetch").mockResolvedValue(res(401, { error: "invalid_client" }));
    const error = await getGoogleOAuthAccessToken().catch((e) => e);
    expect(error).toBeInstanceOf(GbpAuthError);
    expect(error.code).toBe("invalid_client");
    expect(error.reauthorizationRequired).toBe(false);
  });

  it("shares one refresh between concurrent callers", async () => {
    setConfigured();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (String(url).includes("oauth2")) {
        await gate;
        return token("token-A");
      }
      return page([review("r1")]);
    });

    const both = Promise.all([getBusinessReviews({ request: FAST }), getBusinessReviews({ request: FAST })]);
    release();
    await both;

    const tokenCalls = fetchSpy.mock.calls.filter(([url]) => String(url).includes("oauth2"));
    expect(tokenCalls).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("asks frameworks not to cache the token request, and keeps the Next hint on reviews", async () => {
    setConfigured();
    const fetchSpy = vi.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce(token("token-A"));
    fetchSpy.mockResolvedValueOnce(page([review("r1")]));

    await getBusinessReviews({ request: FAST });

    const [tokenInit, reviewsInit] = fetchSpy.mock.calls.map(([, init]) => init as RequestInit & { cache?: string; next?: unknown });
    expect(tokenInit.cache).toBe("no-store");
    expect(tokenInit.next).toBeUndefined();
    expect(reviewsInit.next).toEqual({ revalidate: 3600, tags: ["google-reviews"] });
  });
});

describe("deadlines", () => {
  it("abandons a stalled request after the deadline", async () => {
    vi.useFakeTimers();
    setConfigured();
    vi.spyOn(global, "fetch").mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
        }),
    );

    const pending = getGoogleOAuthAccessToken({ request: { maxAttempts: 1 } }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(8_000);
    const error = await pending;

    expect(error).toBeInstanceOf(GbpTimeoutError);
    expect(error.timeoutMs).toBe(8_000);
  });

  it("lets the caller cancel, and says so as a cancel rather than a timeout", async () => {
    setConfigured();
    vi.spyOn(global, "fetch").mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
        }),
    );
    const controller = new AbortController();
    const pending = getGoogleOAuthAccessToken({ request: { signal: controller.signal } }).catch((e) => e);
    controller.abort(new Error("caller gave up"));
    const error = await pending;
    expect(error).not.toBeInstanceOf(GbpTimeoutError);
    expect(String(error)).toMatch(/caller gave up/);
  });
});

describe("retries", () => {
  it("retries 503 and succeeds within the budget", async () => {
    setConfigured();
    const fetchSpy = vi.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce(token("token-A"));
    fetchSpy.mockResolvedValueOnce(res(503));
    fetchSpy.mockResolvedValueOnce(res(503));
    fetchSpy.mockResolvedValueOnce(page([review("r1")]));

    const result = await getBusinessReviews({ request: FAST });
    expect(result.reviews).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  it("does not retry a 403", async () => {
    setConfigured();
    const fetchSpy = vi.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce(token("token-A"));
    fetchSpy.mockResolvedValueOnce(res(403, { error: { message: "The caller does not have permission" } }));

    const error = await getBusinessReviews({ request: FAST }).catch((e) => e);
    expect(error).toBeInstanceOf(GbpApiError);
    expect(error.status).toBe(403);
    expect(error.retryable).toBe(false);
    expect(error.attempts).toBe(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("waits out a Retry-After before asking again", async () => {
    vi.useFakeTimers();
    setConfigured();
    const fetchSpy = vi.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce(token("token-A"));
    fetchSpy.mockResolvedValueOnce(res(429, {}, { "retry-after": "2" }));
    fetchSpy.mockResolvedValueOnce(page([review("r1")]));

    const pending = getBusinessReviews();
    await vi.advanceTimersByTimeAsync(1_999);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    const result = await pending;
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(result.reviews).toHaveLength(1);
  });

  it("returns the error rather than sleeping through a long Retry-After", async () => {
    setConfigured();
    const fetchSpy = vi.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce(token("token-A"));
    fetchSpy.mockResolvedValueOnce(res(429, {}, { "retry-after": "120" }));

    const error = await getBusinessReviews().catch((e) => e);
    expect(error).toBeInstanceOf(GbpApiError);
    expect(error.status).toBe(429);
    expect(error.retryAfterMs).toBe(120_000);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("reads Retry-After as seconds or an HTTP date, and ignores nonsense", () => {
    const now = Date.parse("2026-09-24T12:00:00Z");
    expect(parseRetryAfter("2", now)).toBe(2_000);
    expect(parseRetryAfter("1.5", now)).toBe(1_500);
    expect(parseRetryAfter("Thu, 24 Sep 2026 12:00:10 GMT", now)).toBe(10_000);
    expect(parseRetryAfter("soon", now)).toBeNull();
    expect(parseRetryAfter(null, now)).toBeNull();
  });
});

describe("pagination guards", () => {
  it("stops when Google repeats a page token", async () => {
    setConfigured();
    const fetchSpy = vi.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce(token("token-A"));
    fetchSpy.mockResolvedValueOnce(page([], { nextPageToken: "x" }));
    fetchSpy.mockResolvedValueOnce(page([], { nextPageToken: "x" }));

    const error = await getBusinessReviews({ request: FAST }).catch((e) => e);
    expect(error).toBeInstanceOf(GbpPaginationError);
    expect(error.reason).toBe("repeated_token");
    expect(fetchSpy.mock.calls.filter(([url]) => String(url).includes("/reviews"))).toHaveLength(2);
    expect(String(error)).not.toContain('"x"');
  });

  it("stops at maxPages", async () => {
    setConfigured();
    const fetchSpy = vi.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce(token("token-A"));
    for (let i = 1; i <= 5; i++) fetchSpy.mockResolvedValueOnce(page([], { nextPageToken: `p${i}` }));

    const error = await getBusinessReviews({ maxPages: 2, request: FAST }).catch((e) => e);
    expect(error).toBeInstanceOf(GbpPaginationError);
    expect(error.reason).toBe("page_limit");
    expect(error.pagesFetched).toBe(2);
    expect(fetchSpy.mock.calls.filter(([url]) => String(url).includes("/reviews"))).toHaveLength(2);
  });
});

describe("aggregates", () => {
  it("never derives totalReviewCount from the returned reviews", async () => {
    setConfigured();
    const fetchSpy = vi.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce(token("token-A"));
    fetchSpy.mockResolvedValueOnce(res(200, { reviews: [review("r1"), review("r2"), review("r3")] }));

    const result = await getBusinessReviews({ limit: 1, request: FAST });
    expect(result.reviews).toHaveLength(1);
    expect(result.totalReviewCount).toBeNull();
    expect(result.averageRating).toBeNull();
  });

  it("keeps an explicit zero", async () => {
    setConfigured();
    const fetchSpy = vi.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce(token("token-A"));
    fetchSpy.mockResolvedValueOnce(res(200, { totalReviewCount: 0, reviews: [] }));

    const result = await getBusinessReviews({ request: FAST });
    expect(result.totalReviewCount).toBe(0);
  });

  it("rejects a negative or fractional count as unreadable", () => {
    expect(parseListReviewsResponse({ totalReviewCount: -3 }).totalReviewCount).toBeUndefined();
    expect(parseListReviewsResponse({ totalReviewCount: 2.5 }).totalReviewCount).toBeUndefined();
    expect(parseListReviewsResponse({ averageRating: 9 }).averageRating).toBeUndefined();
  });
});

describe("response guards", () => {
  it("throws on a response that is not an object", () => {
    expect(() => parseListReviewsResponse("nope")).toThrow(TypeError);
    expect(() => parseListReviewsResponse(null)).toThrow(TypeError);
  });

  it("skips a malformed review without losing its neighbours", () => {
    const parsed = parseListReviewsResponse({ reviews: [review("r1"), { comment: "no id" }, 42, review("r2")] });
    expect(parsed.reviews.map((r) => r.reviewId)).toEqual(["r1", "r2"]);
  });

  it("does not show a review whose star rating it cannot read", async () => {
    setConfigured();
    const fetchSpy = vi.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce(token("token-A"));
    fetchSpy.mockResolvedValueOnce(page([review("r1", { starRating: "STAR_RATING_UNSPECIFIED" }), review("r2")]));

    const result = await getBusinessReviews({ order: "api", request: FAST });
    expect(result.reviews.map((r) => r.id)).toEqual(["r2"]);
  });
});

describe("review media, reply URL and reply moderation", () => {
  it("maps attached photos and videos, and the reply URL", async () => {
    setConfigured();
    const fetchSpy = vi.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce(token("token-A"));
    fetchSpy.mockResolvedValueOnce(
      page([
        review("r1", {
          reviewMediaItems: [
            { thumbnailUrl: "https://lh3.example/photo", thumbnailLabel: "The finished wall" },
            { thumbnailUrl: "https://lh3.example/thumb", videoUrl: "https://video.example/v" },
            { thumbnailLabel: "no url, dropped" },
          ],
          reviewReplyUrl: "https://business.google.com/reply/r1",
        }),
      ]),
    );

    const [r] = (await getBusinessReviews({ request: FAST })).reviews;
    expect(r.media).toEqual([
      { thumbnailUrl: "https://lh3.example/photo", label: "The finished wall" },
      { thumbnailUrl: "https://lh3.example/thumb", videoUrl: "https://video.example/v" },
    ]);
    expect(r.replyUrl).toBe("https://business.google.com/reply/r1");
  });

  it("drops a rejected or pending reply by default, so a site never shows one", async () => {
    setConfigured();
    const fetchSpy = vi.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce(token("token-A"));
    fetchSpy.mockResolvedValueOnce(
      page([
        review("r1", { reviewReply: { comment: "Thanks!", updateTime: "t", reviewReplyState: "REJECTED", policyViolation: "FAKE_ENGAGEMENT" } }),
        review("r2", { reviewReply: { comment: "Cheers", updateTime: "t", reviewReplyState: "PENDING" } }),
        review("r3", { reviewReply: { comment: "Much appreciated", updateTime: "t", reviewReplyState: "APPROVED" } }),
        review("r4", { reviewReply: { comment: "Legacy reply", updateTime: "t" } }),
      ]),
    );

    const reviews = (await getBusinessReviews({ order: "api", request: FAST })).reviews;
    expect(reviews.map((r) => r.reply?.text ?? null)).toEqual([null, null, "Much appreciated", "Legacy reply"]);
    expect(reviews[2].reply?.state).toBe("APPROVED");
  });

  it("keeps them, with the state and the violation, for an owner-facing surface", async () => {
    setConfigured();
    const fetchSpy = vi.spyOn(global, "fetch");
    fetchSpy.mockResolvedValueOnce(token("token-A"));
    fetchSpy.mockResolvedValueOnce(
      page([review("r1", { reviewReply: { comment: "Thanks!", updateTime: "t", reviewReplyState: "REJECTED", policyViolation: "FAKE_ENGAGEMENT" } })]),
    );

    const [r] = (await getBusinessReviews({ includeUnapprovedReplies: true, request: FAST })).reviews;
    expect(r.reply).toEqual({ text: "Thanks!", updatedAt: "t", state: "REJECTED", policyViolation: "FAKE_ENGAGEMENT" });
  });
});

describe("options", () => {
  it("rejects a nonsense request policy up front", async () => {
    setConfigured();
    await expect(getBusinessReviews({ request: { maxAttempts: 0 } })).rejects.toThrow(RangeError);
    await expect(getBusinessReviews({ maxPages: 0 })).rejects.toThrow(RangeError);
  });
});
