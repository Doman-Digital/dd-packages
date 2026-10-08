/**
 * The Turnstile config self-check that replaces the token on a verified
 * synthetic request. It is the check that would have caught Sensphere, whose
 * forms rejected every submission for about 11 weeks because
 * `TURNSTILE_EXPECTED_HOSTNAME` was wrong.
 */

export const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileOutcome =
  | "ok"
  | "missing_keys"
  | "hostname_mismatch"
  | "test_key_on_production"
  | "invalid-input-secret"
  | "siteverify_unexpected"
  | "siteverify_unreachable";

export interface TurnstileCheckResult {
  ok: boolean;
  outcome: TurnstileOutcome;
  /** Cloudflare's `error-codes`, when siteverify answered. Codes only. */
  errorCodes?: string[];
}

export interface TurnstileCheckOptions {
  siteKey: string | undefined;
  secretKey: string | undefined;
  /** `TURNSTILE_EXPECTED_HOSTNAME`. */
  expectedHostname: string | undefined;
  /** The public host the form is served on. */
  publicHost: string;
  /** Overrides the host-based production guess. */
  production?: boolean;
  fetch?: typeof fetch;
  /** Defaults to 5000 ms. */
  timeoutMs?: number;
}

/**
 * Cloudflare's published test keys. Site keys are `1x…AA` (always passes),
 * `2x…AB` (always blocks), `3x…FF` (forces an interactive challenge), plus the
 * `1x…BB`/`2x…BB` visible variants; secret keys are `1x…AA`, `2x…AA`, `3x…AA`.
 * Real keys start `0x4`, so the `[123]x0000…` shape cannot collide with one.
 */
export function isTurnstileTestKey(key: string): boolean {
  return /^[123]x0{10,}[0-9A-Za-z]*$/.test(key);
}

/** Lower-case, no scheme, port, path or trailing dot. `www.` is kept: it is a different host. */
export function normaliseHostname(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.+$/, "");
}

/** Anything that is not obviously staging, local or a platform preview URL counts as production. */
export function isProductionHost(host: string): boolean {
  const h = normaliseHostname(host);
  if (h === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return false;
  if (h.startsWith("staging.") || h.startsWith("preview.") || h.startsWith("dev.")) return false;
  return !/\.(local|test|localhost|invalid|workers\.dev|pages\.dev|vercel\.app)$/.test(h);
}

/**
 * 1. both keys present;
 * 2. `expectedHostname`, normalised, equals the public host;
 * 3. on a production host, neither key is a Cloudflare test key;
 * 4. siteverify with the real secret and a dummy token answers
 *    `invalid-input-response` (the secret is good, the token is not), never
 *    `invalid-input-secret`.
 *
 * Off production an always-pass test secret answers `success: true` to the
 * dummy token, which is fine there. Never throws.
 */
export async function turnstileConfigCheck(options: TurnstileCheckOptions): Promise<TurnstileCheckResult> {
  const { siteKey, secretKey, expectedHostname, publicHost } = options;
  if (!siteKey || !secretKey || !expectedHostname) return { ok: false, outcome: "missing_keys" };
  if (normaliseHostname(expectedHostname) !== normaliseHostname(publicHost)) {
    return { ok: false, outcome: "hostname_mismatch" };
  }
  const production = options.production ?? isProductionHost(publicHost);
  if (production && (isTurnstileTestKey(siteKey) || isTurnstileTestKey(secretKey))) {
    return { ok: false, outcome: "test_key_on_production" };
  }

  let json: { success?: boolean; "error-codes"?: string[] };
  try {
    const res = await (options.fetch ?? fetch)(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: secretKey, response: "dd-synthetic-config-check" }).toString(),
      signal: AbortSignal.timeout(options.timeoutMs ?? 5000),
    });
    json = (await res.json()) as typeof json;
  } catch {
    return { ok: false, outcome: "siteverify_unreachable" };
  }

  const errorCodes = Array.isArray(json["error-codes"])
    ? json["error-codes"].filter((c): c is string => typeof c === "string")
    : [];
  if (errorCodes.includes("invalid-input-secret")) {
    return { ok: false, outcome: "invalid-input-secret", errorCodes };
  }
  if (errorCodes.includes("invalid-input-response") && json.success !== true) return { ok: true, outcome: "ok", errorCodes };
  if (!production && json.success === true) return { ok: true, outcome: "ok", errorCodes };
  return { ok: false, outcome: "siteverify_unexpected", errorCodes };
}
