import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GbpApiError, GbpAuthError, GbpError, GbpPublishedError, GbpTimeoutError } from "../errors";
import { _resetTokenCacheForTests } from "../oauth-client";
import { _resetSafeStateForTests, getBusinessReviewsSafe, getPublishedReviewsSafe, type GbpFailureReport } from "../safe";

const ENV_KEYS = ["GBP_CLIENT_ID", "GBP_CLIENT_SECRET", "GBP_REFRESH_TOKEN", "GOOGLE_BUSINESS_ACCOUNT_ID", "GOOGLE_BUSINESS_LOCATION_ID"] as const;

function setConfigured() {
  process.env.GBP_CLIENT_ID = "client-id";
  process.env.GBP_CLIENT_SECRET = "client-secret-value";
  process.env.GBP_REFRESH_TOKEN = "refresh-token-value";
  process.env.GOOGLE_BUSINESS_ACCOUNT_ID = "accounts/123";
  process.env.GOOGLE_BUSINESS_LOCATION_ID = "locations/456";
}

function res(status: number, body: unknown = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  } as Response;
}

const token = () => res(200, { access_token: "token-A", expires_in: 3600 });
const page = () =>
  res(200, {
    averageRating: 4.8,
    totalReviewCount: 120,
    reviews: [{ reviewId: "r1", reviewer: { displayName: "Sam" }, starRating: "FIVE", comment: "Great", createTime: "2026-01-01T00:00:00Z" }],
  });
const invalidGrant = () => res(400, { error: "invalid_grant", error_description: "Token has been expired or revoked." });
const FAST = { baseDelayMs: 0 };
const SNAPSHOT = { averageRating: 4.5, totalReviewCount: 10, reviews: [] };

function recorder() {
  const calls: [GbpError, GbpFailureReport][] = [];
  return { calls, report: (error: GbpError, info: GbpFailureReport) => void calls.push([error, info]) };
}

beforeEach(() => {
  _resetTokenCacheForTests();
  _resetSafeStateForTests();
  for (const key of ENV_KEYS) delete process.env[key];
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const key of ENV_KEYS) delete process.env[key];
});

describe("stable error messages", () => {
  it("keeps Google's body out of the message, in context instead", () => {
    const a = new GbpAuthError("invalid_grant", 400, "Token has been expired or revoked.");
    const b = new GbpAuthError("invalid_grant", 400, "Bad Request");
    expect(a.message).toBe("GBP token refresh failed: invalid_grant");
    expect(b.message).toBe(a.message);
    expect(a.fingerprint).toEqual(["gbp", "invalid_grant"]);
    expect(a.transient).toBe(false);
    expect(a.context).toMatchObject({ status: 400, description: "Token has been expired or revoked." });
  });

  it("groups every 5xx as one failure, and keeps 4xx apart", () => {
    const e503 = new GbpApiError({ operation: "reviews.list", status: 503, retryable: true, attempts: 3, body: '{"error":{"code":503,"message":"The service is currently unavailable."}}' });
    const e502 = new GbpApiError({ operation: "reviews.list", status: 502, retryable: true, attempts: 3, body: "<html>bad gateway</html>" });
    const e403 = new GbpApiError({ operation: "reviews.list", status: 403, retryable: false, attempts: 1 });
    expect(e503.message).toBe("GBP reviews.list failed: 5xx");
    expect(e502.message).toBe(e503.message);
    expect(e503.fingerprint).toEqual(["gbp", "api_5xx"]);
    expect(e503.transient).toBe(true);
    expect(e503.context).toMatchObject({ status: 503, body: expect.stringContaining("unavailable") });
    expect(e403.fingerprint).toEqual(["gbp", "api_403"]);
    expect(e403.transient).toBe(false);
  });

  it("names timeouts and published-file failures without varying detail", () => {
    expect(new GbpTimeoutError("reviews.list", 8000).message).toBe("GBP reviews.list timed out");
    const published = new GbpPublishedError("http", "tardi-group", "503", 503, "<html>upstream</html>");
    expect(published.message).toBe("Published reviews for tardi-group unusable (http): 503");
    expect(published.fingerprint).toEqual(["gbp", "published_http"]);
    expect(published.transient).toBe(true);
    expect(new GbpPublishedError("http", "tardi-group", "404", 404).transient).toBe(false);
  });
});

describe("getBusinessReviewsSafe", () => {
  it("returns live reviews, marked live", async () => {
    setConfigured();
    vi.spyOn(global, "fetch").mockResolvedValueOnce(token()).mockResolvedValueOnce(page());
    const result = await getBusinessReviewsSafe({ order: "api", request: FAST });
    expect(result.source).toBe("live");
    expect(result.error).toBeUndefined();
    expect(result.reviews.map((r) => r.id)).toEqual(["r1"]);
  });

  it("serves an empty result instead of throwing on invalid_grant, and reports it with a stable fingerprint", async () => {
    setConfigured();
    vi.spyOn(global, "fetch").mockResolvedValue(invalidGrant());
    const { calls, report } = recorder();

    const result = await getBusinessReviewsSafe({ report, request: FAST });

    expect(result).toMatchObject({ averageRating: null, totalReviewCount: null, reviews: [], source: "empty" });
    expect(result.error).toBeInstanceOf(GbpAuthError);
    expect(calls).toHaveLength(1);
    const [error, info] = calls[0]!;
    expect(error.message).toBe("GBP token refresh failed: invalid_grant");
    expect(info).toMatchObject({ fingerprint: ["gbp", "invalid_grant"], code: "invalid_grant", transient: false, served: "empty", suppressed: 0 });
    expect(info.context).toMatchObject({ status: 400 });
    expect(JSON.stringify(info)).not.toContain("refresh-token-value");
    expect(JSON.stringify(info)).not.toContain("client-secret-value");
  });

  it("serves the last good result after the token dies", async () => {
    setConfigured();
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(token()).mockResolvedValueOnce(page());
    await getBusinessReviewsSafe({ order: "api", request: FAST });

    _resetTokenCacheForTests();
    fetchSpy.mockResolvedValue(invalidGrant());
    const result = await getBusinessReviewsSafe({ order: "api", fallback: SNAPSHOT, report: () => {}, request: FAST });

    expect(result.source).toBe("cache");
    expect(result.reviews.map((r) => r.id)).toEqual(["r1"]);
    expect(result.totalReviewCount).toBe(120);
  });

  it("serves the configured fallback, or what its loader returns, when nothing is cached", async () => {
    setConfigured();
    vi.spyOn(global, "fetch").mockResolvedValue(invalidGrant());

    const snapshot = await getBusinessReviewsSafe({ fallback: SNAPSHOT, report: () => {}, request: FAST });
    expect(snapshot).toMatchObject({ ...SNAPSHOT, source: "fallback" });

    _resetSafeStateForTests();
    const loaded = await getBusinessReviewsSafe({ fallback: async () => SNAPSHOT, report: () => {}, request: FAST });
    expect(loaded.source).toBe("fallback");

    _resetSafeStateForTests();
    const broken = await getBusinessReviewsSafe({
      fallback: async () => {
        throw new Error("KV down");
      },
      report: () => {},
      request: FAST,
    });
    expect(broken.source).toBe("empty");
  });

  it("reports a failure once per window, then again with the count it held back", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    setConfigured();
    vi.spyOn(global, "fetch").mockResolvedValue(invalidGrant());
    const { calls, report } = recorder();

    for (let i = 0; i < 5; i++) await getBusinessReviewsSafe({ report, request: FAST });
    expect(calls).toHaveLength(1);

    vi.advanceTimersByTime(60 * 60 * 1000 + 1);
    await getBusinessReviewsSafe({ report, request: FAST });
    expect(calls).toHaveLength(2);
    expect(calls[1]![1].suppressed).toBe(4);
  });

  it("stops asking Google for a token for a while after invalid_grant", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    setConfigured();
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(invalidGrant());

    for (let i = 0; i < 10; i++) await getBusinessReviewsSafe({ report: () => {}, request: FAST });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await getBusinessReviewsSafe({ report: () => {}, request: FAST });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("keeps trying after a transient failure, and serves the cache meanwhile", async () => {
    setConfigured();
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(token()).mockResolvedValueOnce(page());
    await getBusinessReviewsSafe({ request: FAST });

    fetchSpy.mockResolvedValue(res(503, { error: { code: 503, message: "The service is currently unavailable." } }));
    const { calls, report } = recorder();
    const first = await getBusinessReviewsSafe({ report, request: FAST });
    const second = await getBusinessReviewsSafe({ report, request: FAST });

    expect(first.source).toBe("cache");
    expect(second.source).toBe("cache");
    expect(fetchSpy).toHaveBeenCalledTimes(2 + 3 + 3); // the good fetch, then three attempts each time
    expect(calls).toHaveLength(1);
    expect(calls[0]![1]).toMatchObject({ fingerprint: ["gbp", "api_5xx"], transient: true, served: "cache" });
  });

  it("drops a cached result older than maxStaleMs", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    setConfigured();
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(token()).mockResolvedValueOnce(page());
    await getBusinessReviewsSafe({ request: FAST });

    _resetTokenCacheForTests();
    fetchSpy.mockResolvedValue(invalidGrant());
    vi.advanceTimersByTime(2000);
    const result = await getBusinessReviewsSafe({ maxStaleMs: 1000, report: () => {}, request: FAST });
    expect(result.source).toBe("empty");
  });

  it("wraps a failure that is not a GbpError, and survives a reporter that throws", async () => {
    setConfigured();
    vi.spyOn(global, "fetch").mockRejectedValue(new TypeError("fetch failed"));
    const result = await getBusinessReviewsSafe({
      report: () => {
        throw new Error("Sentry not initialised");
      },
      request: { ...FAST, maxAttempts: 1 },
    });
    expect(result.source).toBe("empty");
    expect(result.error?.fingerprint).toEqual(["gbp", "unexpected"]);
    expect(result.error?.context).toMatchObject({ name: "TypeError", message: "fetch failed" });
  });

  it("warns on the console once when no reporter is given", async () => {
    setConfigured();
    vi.spyOn(global, "fetch").mockResolvedValue(invalidGrant());
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await getBusinessReviewsSafe({ request: FAST, authRetryMs: 0 });
    await getBusinessReviewsSafe({ request: FAST, authRetryMs: 0 });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toContain("GBP token refresh failed: invalid_grant");
  });
});

describe("getPublishedReviewsSafe", () => {
  it("serves an empty result when the file is missing", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(res(404, "Not Found"));
    const { calls, report } = recorder();
    const result = await getPublishedReviewsSafe({ client: "tardi-group", report });
    expect(result).toMatchObject({ averageRating: null, totalReviewCount: null, reviews: [], source: "empty" });
    expect(calls[0]![1]).toMatchObject({ fingerprint: ["gbp", "published_http"], transient: false });
  });
});
