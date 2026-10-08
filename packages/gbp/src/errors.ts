/**
 * Typed failures, so a site can tell "reauthorise the Google account" from
 * "Google is having a bad minute" from "our code looped", and log the
 * difference without ever logging a credential.
 *
 * Every message is short and stable: the same failure always reads the same,
 * so an error tracker groups it as one issue rather than one per response
 * body. What varies (status, Google's description, a body excerpt) sits in
 * `context`, and `fingerprint` is `["gbp", code]` for a tracker that takes
 * one (Sentry's `captureException(error, { fingerprint, extra: context })`).
 *
 * No message or context here carries a client id, client secret, refresh
 * token, access token or review text. Bodies from Google are cut to a short,
 * bounded excerpt.
 */

/** Base class: `instanceof GbpError` catches every failure this package throws. */
export class GbpError extends Error {
  /** Short, stable name for the failure, e.g. `invalid_grant` or `api_5xx`. */
  readonly code: string;
  /** True when the same request may well work later without anyone changing anything. */
  readonly transient: boolean;
  /** What varies between occurrences: status, Google's description, a body excerpt. Never a credential. */
  readonly context: Record<string, unknown>;

  constructor(message: string, code = "unknown", transient = false, context: Record<string, unknown> = {}) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.transient = transient;
    this.context = context;
  }

  /** `["gbp", code]`: one error-tracker issue per kind of failure. */
  get fingerprint(): string[] {
    return ["gbp", this.code];
  }
}

export type GbpAuthErrorCode = "invalid_grant" | "invalid_client" | "token_request_failed";

/**
 * The refresh-token exchange failed. `reauthorizationRequired` is true for
 * `invalid_grant`: Google's documented remedy is to "authenticate the user
 * again", and no amount of retrying fixes it. Common causes: the user revoked
 * access, the token went unused for six months, the OAuth app is still in
 * "Testing" status (refresh tokens expire after 7 days), or the account passed
 * 100 live refresh tokens for this client and the oldest was dropped.
 */
export class GbpAuthError extends GbpError {
  declare readonly code: GbpAuthErrorCode;
  readonly reauthorizationRequired: boolean;
  readonly status: number;
  readonly description?: string;

  constructor(code: GbpAuthErrorCode, status: number, description?: string) {
    // A 5xx from the token endpoint is Google having a bad minute; anything
    // else needs a person to change the credential or the environment.
    super(`GBP token refresh failed: ${code}`, code, code === "token_request_failed" && status >= 500, {
      status,
      ...(description ? { description } : {}),
      ...(code === "invalid_grant" ? { remedy: "Reauthorise the Google account and replace GBP_REFRESH_TOKEN." } : {}),
    });
    this.reauthorizationRequired = code === "invalid_grant";
    this.status = status;
    this.description = description;
  }
}

/** A Business Profile API call returned an error status after its retry budget. */
export class GbpApiError extends GbpError {
  readonly operation: string;
  readonly status: number;
  readonly retryable: boolean;
  readonly attempts: number;
  /** Set when Google asked for a longer wait than this package will sleep through. */
  readonly retryAfterMs?: number;

  /** A short excerpt of Google's error body. In `context` too, never in the message. */
  readonly body?: string;

  constructor(options: { operation: string; status: number; retryable: boolean; attempts: number; body?: string; retryAfterMs?: number }) {
    // Every 5xx is one kind of failure (Google having a bad minute), so one issue.
    const server = options.status >= 500;
    super(`GBP ${options.operation} failed: ${server ? "5xx" : options.status}`, server ? "api_5xx" : `api_${options.status}`, options.retryable, {
      operation: options.operation,
      status: options.status,
      attempts: options.attempts,
      ...(options.body ? { body: options.body } : {}),
      ...(options.retryAfterMs !== undefined ? { retryAfterMs: options.retryAfterMs } : {}),
    });
    this.body = options.body;
    this.operation = options.operation;
    this.status = options.status;
    this.retryable = options.retryable;
    this.attempts = options.attempts;
    this.retryAfterMs = options.retryAfterMs;
  }
}

/** One attempt took longer than its deadline. Distinct from a caller's own abort. */
export class GbpTimeoutError extends GbpError {
  readonly operation: string;
  readonly timeoutMs: number;

  constructor(operation: string, timeoutMs: number) {
    super(`GBP ${operation} timed out`, "timeout", true, { operation, timeoutMs });
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Pagination stopped for a reason that means something upstream is wrong:
 * Google handed back a page token it had already given, or the page budget
 * ran out. Thrown rather than returning a partial list, which would look like
 * a complete one.
 */
export class GbpPaginationError extends GbpError {
  readonly reason: "repeated_token" | "page_limit";
  readonly pagesFetched: number;

  constructor(reason: "repeated_token" | "page_limit", pagesFetched: number) {
    super(
      reason === "repeated_token"
        ? "GBP reviews.list returned a page token it had already returned"
        : "GBP reviews.list stopped at the page limit",
      `pagination_${reason}`,
      false,
      { pagesFetched },
    );
    this.reason = reason;
    this.pagesFetched = pagesFetched;
  }
}

/** A short, bounded excerpt of an error body: enough to diagnose, never a payload. */
export function excerpt(text: string, max = 300): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}...` : flat;
}

/**
 * A published reviews file could not be used: the address answered an error (`http`, with `status`), the file was
 * malformed or for another client (`invalid`), or it uses a schema this version does not read (`unknown_schema`,
 * upgrade the package). The caller keeps the copy it already has.
 */
export class GbpPublishedError extends GbpError {
  readonly reason: "http" | "invalid" | "unknown_schema";
  readonly client: string;
  readonly status?: number;

  constructor(reason: "http" | "invalid" | "unknown_schema", client: string, detail: string, status?: number, body?: string) {
    const transient = reason === "http" && status !== undefined && (status === 429 || status >= 500);
    super(`Published reviews for ${client} unusable (${reason}): ${detail}`, `published_${reason}`, transient, {
      client,
      ...(status !== undefined ? { status } : {}),
      ...(body ? { body } : {}),
    });
    this.reason = reason;
    this.client = client;
    this.status = status;
  }
}
