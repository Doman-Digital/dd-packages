/**
 * Reviews that never throw into a page render.
 *
 * `getBusinessReviews` and `getPublishedReviews` throw on a real failure, so a
 * caller can choose what to do. Most callers want the same thing: keep showing
 * what they showed last time, tell someone once, and carry on. A dead refresh
 * token (`invalid_grant`, every 7 days while the OAuth app is in Testing) or a
 * Google 503 otherwise reaches every server render, and a site that reports
 * each one sends thousands of events about one fault.
 *
 * The `...Safe` functions here catch every failure and serve, in order:
 *
 *   1. the last good result this process fetched for the same options
 *      (`source: "cache"`), up to `maxStaleMs` old;
 *   2. the caller's `fallback`, a snapshot or a loader for one such as a KV
 *      read (`source: "fallback"`);
 *   3. an empty result: no rating, no count, no reviews (`source: "empty"`).
 *
 * Each kind of failure is reported at most once per `reportIntervalMs` per
 * process, through `report`. After an auth failure no amount of retrying
 * helps, so the live call is skipped for `authRetryMs` and the cache or
 * fallback is served straight away.
 */

import { GbpError, excerpt } from "./errors";
import { getPublishedReviews, type GetPublishedReviewsOptions, type PublishedReviewsResult } from "./published";
import { getBusinessReviews, type BusinessReviewsResult, type GetBusinessReviewsOptions } from "./reviews";

/** Where a safe result came from. */
export type ReviewsSource = "live" | "cache" | "fallback" | "empty";

/** A result from a `...Safe` function: the reviews, where they came from, and the failure if there was one. */
export type SafeReviewsResult<T extends BusinessReviewsResult = BusinessReviewsResult> = T & {
  source: ReviewsSource;
  /** The failure behind a `cache`, `fallback` or `empty` result. */
  error?: GbpError;
};

/** What `report` is told alongside the error. */
export interface GbpFailureReport {
  /** `["gbp", code]`. Pass it to Sentry as `fingerprint` so every occurrence is one issue. */
  fingerprint: string[];
  code: string;
  /** True when the failure may clear by itself (a 5xx, a timeout); false when a person has to act. */
  transient: boolean;
  /** Status, Google's description, a body excerpt. Never a credential. Pass it as Sentry `extra`. */
  context: Record<string, unknown>;
  /** What the page was given instead. */
  served: Exclude<ReviewsSource, "live">;
  /** Failures of this kind left unreported since the last report, because they fell inside the window. */
  suppressed: number;
}

export interface SafeReviewsOptions<F extends BusinessReviewsResult = BusinessReviewsResult> {
  /**
   * Served when there is no cached result: a snapshot, or a function that loads one (a KV read, say). A loader that
   * throws or returns nothing falls through to an empty result. Served as given: `limit` and `filterMinStars` are
   * not applied to it.
   */
  fallback?: F | (() => F | null | undefined | Promise<F | null | undefined>);
  /**
   * Called at most once per kind of failure per `reportIntervalMs`, per process. Default: one `console.warn`.
   *
   * ```ts
   * report: (error, { fingerprint, context, transient }) =>
   *   Sentry.captureException(error, { fingerprint, extra: context, level: transient ? "warning" : "error" }),
   * ```
   */
  report?: (error: GbpError, report: GbpFailureReport) => void;
  /** Default one hour. */
  reportIntervalMs?: number;
  /** Longest a cached result is served after the last good fetch. Default 30 days. */
  maxStaleMs?: number;
  /** After an auth failure, skip the live call for this long. Default five minutes. `0` turns it off. */
  authRetryMs?: number;
}

export const DEFAULT_REPORT_INTERVAL_MS = 60 * 60 * 1000;
export const DEFAULT_MAX_STALE_MS = 30 * 24 * 60 * 60 * 1000;
export const DEFAULT_AUTH_RETRY_MS = 5 * 60 * 1000;

const lastGood = new Map<string, { result: BusinessReviewsResult; at: number }>();
const reported = new Map<string, { at: number; suppressed: number }>();
const authBlockedUntil = new Map<string, { until: number; error: GbpError }>();

/** Anything that is not already a `GbpError` (a network failure after retries, a bug) becomes one. */
function toGbpError(error: unknown): GbpError {
  if (error instanceof GbpError) return error;
  const name = error instanceof Error ? error.name : typeof error;
  const message = error instanceof Error ? error.message : String(error);
  const wrapped = new GbpError("GBP reviews failed: unexpected error", "unexpected", true, { name, message: excerpt(message, 200) });
  (wrapped as { cause?: unknown }).cause = error;
  return wrapped;
}

function isAuthFailure(error: GbpError): boolean {
  return error.code === "invalid_grant" || error.code === "invalid_client";
}

function defaultReport(error: GbpError, report: GbpFailureReport): void {
  console.warn(`[gbp] ${error.message}; serving ${report.served}`, report.context);
}

async function loadFallback<F extends BusinessReviewsResult>(fallback: SafeReviewsOptions<F>["fallback"]): Promise<F | null> {
  if (fallback === undefined) return null;
  try {
    return (typeof fallback === "function" ? await fallback() : fallback) ?? null;
  } catch {
    return null;
  }
}

function reportOnce(error: GbpError, served: GbpFailureReport["served"], options: SafeReviewsOptions<BusinessReviewsResult>): void {
  const now = Date.now();
  const window = options.reportIntervalMs ?? DEFAULT_REPORT_INTERVAL_MS;
  const last = reported.get(error.code);
  if (last && now - last.at < window) {
    last.suppressed++;
    return;
  }
  reported.set(error.code, { at: now, suppressed: 0 });
  try {
    (options.report ?? defaultReport)(error, {
      fingerprint: error.fingerprint,
      code: error.code,
      transient: error.transient,
      context: error.context,
      served,
      suppressed: last?.suppressed ?? 0,
    });
  } catch {
    // A broken reporter must not break the page either.
  }
}

async function safely<T extends BusinessReviewsResult, F extends BusinessReviewsResult>(
  key: string,
  load: () => Promise<T>,
  empty: () => SafeReviewsResult<T | F>,
  options: SafeReviewsOptions<F>,
): Promise<SafeReviewsResult<T | F>> {
  const now = Date.now();
  let error: GbpError;
  const blocked = authBlockedUntil.get(key);
  if (blocked && blocked.until > now) {
    error = blocked.error;
  } else {
    try {
      const result = await load();
      lastGood.set(key, { result, at: Date.now() });
      authBlockedUntil.delete(key);
      return { ...result, source: "live" };
    } catch (caught) {
      error = toGbpError(caught);
      const retryMs = options.authRetryMs ?? DEFAULT_AUTH_RETRY_MS;
      if (isAuthFailure(error) && retryMs > 0) authBlockedUntil.set(key, { until: Date.now() + retryMs, error });
    }
  }

  let cached = lastGood.get(key);
  if (cached && now - cached.at > (options.maxStaleMs ?? DEFAULT_MAX_STALE_MS)) {
    // Too old to serve: forget it, so reviews deleted at source do not linger here.
    lastGood.delete(key);
    cached = undefined;
  }
  let served: SafeReviewsResult<T | F>;
  if (cached) {
    served = { ...(cached.result as T), reviews: [...cached.result.reviews], source: "cache", error };
  } else {
    const fallback = await loadFallback(options.fallback);
    served = fallback ? { ...fallback, source: "fallback", error } : { ...empty(), error };
  }
  reportOnce(error, served.source as GbpFailureReport["served"], options as SafeReviewsOptions<BusinessReviewsResult>);
  return served;
}

/**
 * `getBusinessReviews`, but it never throws: on any failure it serves the last good result, the `fallback`, or an
 * empty result, and reports the failure at most once per window. `source` says which.
 */
export function getBusinessReviewsSafe(
  options: GetBusinessReviewsOptions & SafeReviewsOptions = {},
): Promise<SafeReviewsResult> {
  const { fallback, report, reportIntervalMs, maxStaleMs, authRetryMs, ...fetchOptions } = options;
  const key = JSON.stringify([
    "business",
    process.env.GOOGLE_BUSINESS_LOCATION_ID ?? null,
    fetchOptions.limit ?? null,
    fetchOptions.filterMinStars ?? null,
    fetchOptions.includeUnapprovedReplies ?? false,
  ]);
  return safely(
    key,
    () => getBusinessReviews(fetchOptions),
    () => ({ averageRating: null, totalReviewCount: null, reviews: [], source: "empty" }),
    { fallback, report, reportIntervalMs, maxStaleMs, authRetryMs },
  );
}

/** A published result, or a fallback or empty one, which carries no sync times. */
export type SafePublishedReviewsResult = SafeReviewsResult<BusinessReviewsResult & Partial<Pick<PublishedReviewsResult, "syncedAt" | "publishedAt">>>;

/**
 * `getPublishedReviews`, but it never throws: on any failure it serves the last good result, the `fallback`, or an
 * empty result, and reports the failure at most once per window. `source` says which.
 *
 * Where a framework keeps the last good page when a render throws (a static build that refuses to publish), the
 * throwing `getPublishedReviews` keeps that behaviour; use this where a throw would reach the visitor.
 */
export function getPublishedReviewsSafe(options: GetPublishedReviewsOptions & SafeReviewsOptions): Promise<SafePublishedReviewsResult> {
  const { fallback, report, reportIntervalMs, maxStaleMs, authRetryMs, ...fetchOptions } = options;
  const key = JSON.stringify([
    "published",
    fetchOptions.client,
    fetchOptions.baseUrl ?? process.env.GBP_REVIEWS_BASE_URL ?? null,
    fetchOptions.limit ?? null,
    fetchOptions.filterMinStars ?? null,
  ]);
  return safely(
    key,
    () => getPublishedReviews(fetchOptions),
    () => ({ averageRating: null, totalReviewCount: null, reviews: [], source: "empty" }),
    { fallback, report, reportIntervalMs, maxStaleMs, authRetryMs },
  );
}

/** Test-only: forget cached results, report windows and auth back-off. */
export function _resetSafeStateForTests(): void {
  lastGood.clear();
  reported.clear();
  authBlockedUntil.clear();
}
