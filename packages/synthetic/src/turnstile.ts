export const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Cloudflare's published Turnstile test keys: sitekeys `1x000…AA` (always
 * passes), `2x000…AB` (always blocks), `3x000…FF` (forces an interactive
 * challenge) and secrets `1x000…AA`, `2x000…AA`, `3x000…AA`. Matched by shape
 * so a future test key of the same family is caught too.
 */
const TEST_KEY = /^[123]x0{10,}[A-Z]{2}$/;

export function isTurnstileTestKey(key: string): boolean {
  return TEST_KEY.test(key);
}

/** Lower case, no scheme, userinfo, port, path or trailing dot. `www.` is NOT stripped: that mismatch is a real fault. */
export function normaliseHostname(value: string): string {
  let v = value.trim().toLowerCase();
  v = v.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  v = v.replace(/[/?#].*$/, "");
  v = v.replace(/^.*@/, "");
  v = v.replace(/:\d+$/, "");
  return v.replace(/\.+$/, "");
}

/** Hosts where Turnstile test keys are expected and allowed. */
export function isProductionHost(host: string): boolean {
  const h = normaliseHostname(host);
  if (!h || h === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":")) return false;
  return !/(^|\.)(localhost|local|test|invalid|example)$/.test(h) && !/^(staging|stage|preview|dev)\./.test(h);
}

export type TurnstileOutcome =
  | "ok"
  | "keys_missing"
  | "expected_hostname_missing"
  | "hostname_mismatch"
  | "test_key_in_production"
  | "invalid_input_secret"
  | "unexpected_response"
  | "siteverify_unreachable";

export interface TurnstileCheckInput {
  siteKey?: string;
  secretKey?: string;
  /** The handler's TURNSTILE_EXPECTED_HOSTNAME. */
  expectedHostname?: string;
  /** The host the public site is served from. */
  publicHost: string;
  /** Defaults to `isProductionHost(publicHost)`. */
  production?: boolean;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export interface TurnstileCheckResult {
  ok: boolean;
  outcome: TurnstileOutcome;
  /** Siteverify `error-codes`, when it answered. Codes only. */
  errorCodes?: string[];
}

const done = (outcome: TurnstileOutcome, errorCodes?: string[]): TurnstileCheckResult => ({
  ok: outcome === "ok",
  outcome,
  ...(errorCodes ? { errorCodes } : {}),
});

/**
 * The check that would have caught Sensphere's eleven weeks of rejected forms.
 * Runs in place of the Turnstile token on a verified synthetic request; also
 * safe to run on its own. Never throws.
 *
 *  1. both keys present
 *  2. TURNSTILE_EXPECTED_HOSTNAME, normalised, equals the public host
 *  3. on a production host, neither key is a Cloudflare test key
 *  4. siteverify with the real secret and a dummy token answers
 *     `invalid-input-response` (the secret is good; only the token is not),
 *     never `invalid-input-secret`
 *
 * On a non-production host with a test secret, step 4 is skipped: the
 * always-pass secret accepts any token, so the call proves nothing.
 */
export async function turnstileConfigCheck(input: TurnstileCheckInput): Promise<TurnstileCheckResult> {
  try {
    if (!input.siteKey || !input.secretKey) return done("keys_missing");
    if (!input.expectedHostname?.trim()) return done("expected_hostname_missing");
    if (normaliseHostname(input.expectedHostname) !== normaliseHostname(input.publicHost)) return done("hostname_mismatch");

    const production = input.production ?? isProductionHost(input.publicHost);
    const testSecret = isTurnstileTestKey(input.secretKey);
    if (production && (isTurnstileTestKey(input.siteKey) || testSecret)) return done("test_key_in_production");
    if (testSecret) return done("ok");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 5000);
    let res: Response;
    try {
      res = await (input.fetch ?? fetch)(SITEVERIFY_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret: input.secretKey, response: "dd-synthetic-config-check" }).toString(),
        signal: controller.signal,
      });
    } catch {
      return done("siteverify_unreachable");
    } finally {
      clearTimeout(timer);
    }
    let body: { success?: boolean; "error-codes"?: unknown };
    try {
      body = (await res.json()) as typeof body;
    } catch {
      return done("unexpected_response");
    }
    const codes = Array.isArray(body["error-codes"]) ? body["error-codes"].filter((c): c is string => typeof c === "string") : [];
    if (codes.includes("invalid-input-secret") || codes.includes("missing-input-secret")) return done("invalid_input_secret", codes);
    if (body.success === false && codes.includes("invalid-input-response")) return done("ok", codes);
    return done("unexpected_response", codes);
  } catch {
    return done("unexpected_response");
  }
}
