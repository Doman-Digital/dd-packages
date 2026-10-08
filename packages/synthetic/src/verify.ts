import { bodyBytes, constantTimeEqual, fromHex, hmacSha256, sha256Hex, type BodyInput } from "./bytes";
import { canonicalString, MODES, PROTOCOL_VERSION, type SynthMode } from "./canonical";
import { mintContext, type SynthContext } from "./context";
import { H, readHeader, type HeaderBag } from "./headers";
import { decodeSecret, type SynthKey } from "./keys";
import { RUN_ID_PATTERN } from "./runid";

export const WINDOW_SECONDS = 120;
export const REPLAY_TTL_SECONDS = 300;

/**
 * Claims a run id. Resolves true if this is the first sighting and false if it
 * was already claimed. Must be atomic: Upstash `SET synth:<runId> 1 NX EX 300`,
 * or an insert into a table with a unique constraint on `synthetic_run_id`.
 * A throw is treated as a rejection (fail closed).
 */
export type ReplayGuard = (runId: string, ttlSeconds: number) => Promise<boolean>;

export interface VerifyConfig {
  /** At most two (current and next). Empty or unset secret means the synthetic path is off. */
  keys: SynthKey[];
  /** The public host(s) this handler serves, as seen by the client. */
  host: string | string[];
  /** The form endpoint path(s). Exact match, no query string. */
  paths: string | string[];
  /** Accepted media types, e.g. ["application/json"]. Compared without parameters, case-insensitively. */
  contentTypes: string[];
  /** Required. There is no default and no way to switch it off. */
  replayGuard: ReplayGuard;
  /** Unix seconds; injectable for tests. */
  now?: () => number;
}

export interface VerifyInput {
  method: string;
  /** The request URL. Only host and pathname are used. */
  url: string | URL;
  /** Override when a proxy rewrites the URL host and the public one arrives elsewhere. */
  host?: string;
  headers: HeaderBag;
  /** The raw bytes received. Not a re-serialisation of a parsed body. */
  body: BodyInput;
}

export type RejectReason =
  | "shape"
  | "malformed"
  | "unknown_kid"
  | "bad_signature"
  | "expired"
  | "replay"
  | "replay_guard_error"
  | "misconfigured";

export type VerifyResult =
  | { ok: true; context: SynthContext }
  /** No synthetic marker, or the path is off: treat as an ordinary request, send nothing. */
  | { ok: false; reason: "not_synthetic" | "disabled"; beacon: false }
  /**
   * A synthetic marker that did not verify. Handle as an ordinary request
   * (Turnstile still applies) and send a `synthetic_rejected` beacon with `reason`.
   */
  | { ok: false; reason: RejectReason; beacon: true };

const NAME = /^[A-Za-z0-9._-]{1,64}$/;

function list(v: string | string[]): string[] {
  return Array.isArray(v) ? v : [v];
}

function mediaType(contentType: string): string {
  return contentType.split(";")[0].trim().toLowerCase();
}

const reject = (reason: RejectReason): VerifyResult => ({ ok: false, reason, beacon: true });

export async function verify(input: VerifyInput, config: VerifyConfig): Promise<VerifyResult> {
  if (typeof config.replayGuard !== "function") {
    throw new TypeError("synthetic: config.replayGuard is required");
  }
  if (readHeader(input.headers, H.marker) === undefined) {
    return { ok: false, reason: "not_synthetic", beacon: false };
  }
  if (config.keys.length === 0) return { ok: false, reason: "disabled", beacon: false };
  if (config.keys.length > 2) return reject("misconfigured");

  // Shape first: only the configured host, path, method and content type are
  // even considered, before any key material is touched.
  let url: URL;
  try {
    url = typeof input.url === "string" ? new URL(input.url) : input.url;
  } catch {
    return reject("shape");
  }
  const host = (input.host ?? url.host).toLowerCase();
  const contentType = readHeader(input.headers, "content-type") ?? "";
  if (
    input.method !== "POST" ||
    !list(config.host).some((h) => h.toLowerCase() === host) ||
    !list(config.paths).includes(url.pathname) ||
    !config.contentTypes.some((c) => c.toLowerCase() === mediaType(contentType))
  ) {
    return reject("shape");
  }

  const marker = readHeader(input.headers, H.marker);
  const kid = readHeader(input.headers, H.kid);
  const tsText = readHeader(input.headers, H.ts);
  const runId = readHeader(input.headers, H.run);
  const mode = readHeader(input.headers, H.mode);
  const client = readHeader(input.headers, H.client);
  const form = readHeader(input.headers, H.form);
  const sigHeader = readHeader(input.headers, H.sig);
  if (
    marker !== PROTOCOL_VERSION ||
    !kid || !NAME.test(kid) ||
    !tsText || !/^\d{1,12}$/.test(tsText) ||
    !runId || !RUN_ID_PATTERN.test(runId) ||
    !mode || !(MODES as readonly string[]).includes(mode) ||
    !client || !NAME.test(client) ||
    !form || !NAME.test(form) ||
    !sigHeader || !/^v1=[0-9a-fA-F]{64}$/.test(sigHeader)
  ) {
    return reject("malformed");
  }

  const key = config.keys.find((k) => k.kid === kid);
  if (!key) return reject("unknown_kid");
  const secret = decodeSecret(key.secret);
  if (!secret) return reject("misconfigured");

  const ts = Number(tsText);
  const canonical = canonicalString({
    kid,
    ts,
    runId,
    mode: mode as SynthMode,
    client,
    form,
    host,
    path: url.pathname,
    contentType,
    bodySha256: await sha256Hex(bodyBytes(input.body)),
  });
  const expected = await hmacSha256(secret, canonical);
  const given = fromHex(sigHeader.slice(3));
  if (!given || !constantTimeEqual(expected, given)) return reject("bad_signature");

  // After the signature, so a stale-clock diagnosis is only ever given to an
  // authentic request and a forger learns nothing about the window.
  const now = (config.now ?? (() => Math.floor(Date.now() / 1000)))();
  if (Math.abs(now - ts) > WINDOW_SECONDS) return reject("expired");

  // Last: a run id is only burned by a request that is otherwise valid, so
  // junk cannot exhaust the guard.
  let fresh: boolean;
  try {
    fresh = await config.replayGuard(runId, REPLAY_TTL_SECONDS);
  } catch {
    return reject("replay_guard_error");
  }
  if (!fresh) return reject("replay");

  return { ok: true, context: mintContext({ runId, mode: mode as SynthMode, client, form, kid, ts }) };
}

/**
 * A ReplayGuard over Upstash Redis REST: `SET synth:<runId> 1 NX EX 300`.
 * Sites without Upstash use a unique constraint on `synthetic_run_id` instead.
 */
export function upstashReplayGuard(opts: { url: string; token: string; fetch?: typeof fetch }): ReplayGuard {
  const doFetch = opts.fetch ?? fetch;
  return async (runId, ttl) => {
    const res = await doFetch(`${opts.url.replace(/\/+$/, "")}/set/synth:${runId}/1/NX/EX/${ttl}`, {
      method: "POST",
      headers: { authorization: `Bearer ${opts.token}` },
    });
    if (!res.ok) throw new Error(`upstash ${res.status}`);
    const body = (await res.json()) as { result: string | null };
    return body.result === "OK";
  };
}
