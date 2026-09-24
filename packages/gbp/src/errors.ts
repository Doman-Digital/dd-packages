/**
 * Typed failures, so a site can tell "reauthorise the Google account" from
 * "Google is having a bad minute" from "our code looped", and log the
 * difference without ever logging a credential.
 *
 * No message here carries a client id, client secret, refresh token, access
 * token or review text. Bodies from Google are cut to a short, bounded
 * excerpt.
 */

/** Base class: `instanceof GbpError` catches every failure this package throws. */
export class GbpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
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
  readonly code: GbpAuthErrorCode;
  readonly reauthorizationRequired: boolean;
  readonly status: number;
  readonly description?: string;

  constructor(code: GbpAuthErrorCode, status: number, description?: string) {
    super(
      `Google OAuth token refresh failed: ${status} ${code}${description ? ` (${description})` : ""}` +
        (code === "invalid_grant" ? ". Reauthorise the Google account and replace GBP_REFRESH_TOKEN." : ""),
    );
    this.code = code;
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

  constructor(options: { operation: string; status: number; retryable: boolean; attempts: number; body?: string; retryAfterMs?: number }) {
    super(`Business Profile reviews failed: ${options.status}${options.body ? ` ${options.body}` : ""}`);
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
    super(`${operation} timed out after ${timeoutMs}ms`);
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
        ? `Business Profile returned a page token it had already returned, after ${pagesFetched} page(s)`
        : `Business Profile reviews stopped at the page limit (${pagesFetched} pages)`,
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
