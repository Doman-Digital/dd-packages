/**
 * One place that decides how long to wait for Google and when to try again.
 *
 * Every request gets a deadline, because a stalled response would otherwise
 * hold a Next.js render or build until the platform kills it. Rate limits
 * (429) and transient server errors (500, 502, 503, 504) get a small, bounded
 * number of retries with full-jitter backoff. Google documents the 429 for
 * quota (developers.google.com/my-business/content/limits); whether the
 * Business Profile API sends `Retry-After` is not documented, so it is honoured
 * when present and not relied on.
 *
 * Nothing else is retried: a 400, 403 or 404 needs a person to change
 * something, and repeating the request only delays the error that says so.
 */

import { GbpTimeoutError } from "./errors";

export interface GbpRequestOptions {
  /** Deadline for each attempt, in ms. Default 8000. */
  timeoutMs?: number;
  /** Attempts per request, counting the first. Default 3. */
  maxAttempts?: number;
  /** Base of the exponential backoff, in ms. Default 250. */
  baseDelayMs?: number;
  /** Cap on a single backoff, in ms. Default 5000. */
  maxDelayMs?: number;
  /** Longest `Retry-After` this will sleep through, in ms. Longer, and the error is returned instead. Default 30000. */
  maxRetryAfterMs?: number;
  /** Cancels everything, including a wait between attempts. */
  signal?: AbortSignal;
}

export interface RequestPolicy extends Required<Omit<GbpRequestOptions, "signal">> {
  signal?: AbortSignal;
}

export const DEFAULT_REQUEST_POLICY = {
  timeoutMs: 8_000,
  maxAttempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 5_000,
  maxRetryAfterMs: 30_000,
} as const;

export const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([429, 500, 502, 503, 504]);

export function resolvePolicy(options: GbpRequestOptions = {}): RequestPolicy {
  const policy = { ...DEFAULT_REQUEST_POLICY, ...options };
  const check = (name: keyof typeof DEFAULT_REQUEST_POLICY, min: number, integer = false) => {
    const value = policy[name];
    if (!Number.isFinite(value) || value < min || (integer && !Number.isInteger(value))) {
      throw new RangeError(`request.${name} must be ${integer ? "an integer" : "a number"} >= ${min}, got ${value}`);
    }
  };
  check("timeoutMs", 1);
  check("maxAttempts", 1, true);
  check("baseDelayMs", 0);
  check("maxDelayMs", 0);
  check("maxRetryAfterMs", 0);
  return policy;
}

/**
 * `Retry-After` as milliseconds: either delay-seconds or an HTTP-date (RFC
 * 9110 section 10.2.3). `null` when absent or unreadable.
 */
export function parseRetryAfter(value: string | null | undefined, nowMs = Date.now()): number | null {
  if (!value) return null;
  const v = value.trim();
  if (/^\d+(\.\d+)?$/.test(v)) return Math.round(Number.parseFloat(v) * 1000);
  const at = Date.parse(v);
  return Number.isNaN(at) ? null : Math.max(0, at - nowMs);
}

/** Full jitter: anywhere from zero to the capped exponential delay. */
export function backoffMs(attempt: number, policy: RequestPolicy, random = Math.random): number {
  const cap = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** (attempt - 1));
  return Math.floor(random() * cap);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

async function attemptOnce(url: string, init: RequestInit, operation: string, policy: RequestPolicy): Promise<Response> {
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(new GbpTimeoutError(operation, policy.timeoutMs)), policy.timeoutMs);
  const signal = policy.signal ? AbortSignal.any([policy.signal, deadline.signal]) : deadline.signal;
  try {
    return await fetch(url, { ...init, signal });
  } catch (error) {
    if (deadline.signal.aborted && !policy.signal?.aborted) throw new GbpTimeoutError(operation, policy.timeoutMs);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export interface AttemptedResponse {
  response: Response;
  attempts: number;
  /** Set when the last response asked for a wait longer than `maxRetryAfterMs`. */
  retryAfterMs?: number;
}

/**
 * Fetch with a deadline per attempt and bounded retries. Returns the last
 * response whatever its status: the caller decides what an error status
 * means. Throws only on network failure, timeout or cancellation after the
 * budget is spent.
 */
export async function fetchWithRetry(url: string, init: RequestInit, operation: string, policy: RequestPolicy): Promise<AttemptedResponse> {
  for (let attempt = 1; ; attempt++) {
    if (policy.signal?.aborted) throw policy.signal.reason;
    let response: Response;
    try {
      response = await attemptOnce(url, init, operation, policy);
    } catch (error) {
      if (policy.signal?.aborted || attempt >= policy.maxAttempts) throw error;
      await sleep(backoffMs(attempt, policy), policy.signal);
      continue;
    }
    if (response.ok || !RETRYABLE_STATUSES.has(response.status)) return { response, attempts: attempt };
    const retryAfter = parseRetryAfter(response.headers?.get?.("retry-after"));
    if (retryAfter !== null && retryAfter > policy.maxRetryAfterMs) return { response, attempts: attempt, retryAfterMs: retryAfter };
    if (attempt >= policy.maxAttempts) return { response, attempts: attempt };
    await sleep(retryAfter ?? backoffMs(attempt, policy), policy.signal);
  }
}

/** Read an error body without trusting its size. */
export async function readErrorBody(response: Response): Promise<string> {
  try {
    const text = typeof response.text === "function" ? await response.text() : "";
    return text.slice(0, 2048);
  } catch {
    return "";
  }
}
