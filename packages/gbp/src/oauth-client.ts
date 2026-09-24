/**
 * Google user OAuth (refresh-token) auth -- for APIs that reject service
 * accounts, notably the Business Profile API (all scopes) and Search Console
 * on domain-verified properties.
 *
 * This code is identity-agnostic: which actual Google Cloud OAuth client it
 * talks to (the agency's shared client, or a business's own dedicated client)
 * is entirely a function of which GBP_CLIENT_ID / GBP_CLIENT_SECRET /
 * GBP_REFRESH_TOKEN values are set in the deploying app's environment -- not
 * a code-level distinction. Each app/deployment configures its own.
 *
 * The access token is cached per process until a minute before it expires.
 * Concurrent callers that miss the cache share one refresh rather than each
 * starting their own. A caller that is told the token is no longer good (a
 * 401 from the API) invalidates exactly that token and forces one refresh;
 * see `invalidateAccessToken`.
 *
 * Env: GBP_CLIENT_ID, GBP_CLIENT_SECRET, GBP_REFRESH_TOKEN.
 */

import { GbpAuthError, excerpt } from "./errors";
import { fetchWithRetry, readErrorBody, resolvePolicy, type GbpRequestOptions } from "./http";

interface CachedToken {
  accessToken: string;
  /** epoch ms when the token should be considered expired */
  expiresAt: number;
}

const TOKEN_URI = "https://oauth2.googleapis.com/token";
const EXPIRY_SKEW_MS = 60 * 1000; // refresh a minute early
const DEFAULT_LIFETIME_S = 3600;

let cached: CachedToken | null = null;
let refreshing: Promise<CachedToken> | null = null;

/** True when the OAuth client + refresh token are present. */
export function hasGoogleOAuthCredentials(): boolean {
  return Boolean(
    process.env.GBP_CLIENT_ID && process.env.GBP_CLIENT_SECRET && process.env.GBP_REFRESH_TOKEN,
  );
}

export interface AccessTokenOptions {
  /** Ignore the cache and refresh now, e.g. after the API rejected the cached token. */
  forceRefresh?: boolean;
  /** Deadline and retry policy for the token request. */
  request?: GbpRequestOptions;
}

/**
 * Drop the cached token, but only if it is still the one the caller used. A
 * request that was rejected with an old token must not throw away a newer one
 * another request has already fetched.
 */
export function invalidateAccessToken(accessToken: string): void {
  if (cached?.accessToken === accessToken) cached = null;
}

async function refresh(request: GbpRequestOptions | undefined): Promise<CachedToken> {
  // Never cached by a framework's fetch cache: a token response is a secret
  // with a lifetime, not content. `cache` is declared locally for the same
  // reason reviews.ts declares `next`: the lib types here do not carry it.
  const init: RequestInit & { cache?: "no-store" } = {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GBP_CLIENT_ID!,
      client_secret: process.env.GBP_CLIENT_SECRET!,
      refresh_token: process.env.GBP_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  };
  const { response } = await fetchWithRetry(TOKEN_URI, init, "oauth.refresh", resolvePolicy(request));

  if (!response.ok) {
    const body = await readErrorBody(response);
    let error: string | undefined;
    let description: string | undefined;
    try {
      const parsed = JSON.parse(body) as { error?: unknown; error_description?: unknown };
      if (typeof parsed.error === "string") error = parsed.error;
      if (typeof parsed.error_description === "string") description = excerpt(parsed.error_description, 200);
    } catch {
      // Not JSON: fall back to looking for the error code in the text.
      if (/\binvalid_grant\b/.test(body)) error = "invalid_grant";
      else if (/\binvalid_client\b/.test(body)) error = "invalid_client";
    }
    if (error === "invalid_grant") cached = null;
    const code = error === "invalid_grant" || error === "invalid_client" ? error : "token_request_failed";
    throw new GbpAuthError(code, response.status, description ?? (code === "token_request_failed" && body ? excerpt(body, 200) : undefined));
  }

  const data = (await response.json()) as { access_token?: unknown; expires_in?: unknown };
  if (typeof data.access_token !== "string" || !data.access_token) {
    throw new GbpAuthError("token_request_failed", response.status, "token response had no access_token");
  }
  const lifetime = typeof data.expires_in === "number" && Number.isFinite(data.expires_in) && data.expires_in > 0 ? data.expires_in : DEFAULT_LIFETIME_S;
  return { accessToken: data.access_token, expiresAt: Date.now() + lifetime * 1000 - EXPIRY_SKEW_MS };
}

/**
 * Exchange the stored refresh token for a short-lived access token. Returns
 * `null` when credentials aren't configured so callers can degrade
 * gracefully. The token's actual scopes are whatever the refresh token was
 * granted with -- not scoped per call.
 *
 * Throws `GbpAuthError`. On `invalid_grant` the cache is cleared and
 * `reauthorizationRequired` is true: retrying cannot fix it.
 */
export async function getGoogleOAuthAccessToken(options: AccessTokenOptions = {}): Promise<string | null> {
  if (!options.forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.accessToken;
  }

  if (!hasGoogleOAuthCredentials()) return null;

  if (!refreshing) {
    refreshing = refresh(options.request)
      .then((token) => {
        cached = token;
        return token;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return (await refreshing).accessToken;
}

/** Test-only: clear the module-level token cache between test cases. */
export function _resetTokenCacheForTests(): void {
  cached = null;
  refreshing = null;
}
