import { constantTimeEqual, fromHex, sha256Hex, utf8 } from "./encoding";
import {
  FORM_MODES,
  HEADER,
  ID_PATTERN,
  PROTOCOL_VERSION,
  RUN_ID_PATTERN,
  computeSignature,
  decodeSecret,
  hostAndPath,
  type SyntheticKey,
  type SyntheticMode,
} from "./protocol";

/** ±120 seconds, as the plan specifies. */
export const DEFAULT_WINDOW_SECONDS = 120;

/** Largest body `verify` will hash. A signed check is a small form post; anything bigger is not one. */
export const DEFAULT_MAX_BODY_BYTES = 1_048_576;

/**
 * Why a request that claimed to be synthetic was not accepted. Every one of
 * these is a `synthetic_rejected` beacon with the reason attached.
 */
export type RejectReason =
  | "unsupported_version"
  | "shape"
  | "malformed"
  | "mode"
  | "unknown_kid"
  | "stale"
  | "bad_signature"
  | "replay"
  | "replay_guard_unavailable";

export const REJECT_REASONS: readonly RejectReason[] = [
  "unsupported_version",
  "shape",
  "malformed",
  "mode",
  "unknown_kid",
  "stale",
  "bad_signature",
  "replay",
  "replay_guard_unavailable",
];

/**
 * Returns true the first time a run id is seen and false after. Required:
 * there is no default. Either the Upstash guard below (`SET synth:<runId> NX
 * EX 300`) or a unique constraint on `synthetic_run_id` in the site's own
 * database, where an insert that violates the constraint returns false.
 */
export type ReplayGuard = (runId: string) => Promise<boolean> | boolean;

/**
 * What a handler reads once a request has verified. Frozen, and built only
 * here from verified headers: no body or query field ever feeds it, so
 * `?synthetic=true` or `{"synthetic": true}` does nothing anywhere.
 */
export interface SyntheticContext {
  readonly v: 1;
  readonly runId: string;
  readonly mode: SyntheticMode;
  readonly client: string;
  readonly form: string;
  readonly kid: string;
}

export interface VerifyConfig {
  /** Zero, one or two keys. Empty means the synthetic path is off. */
  keys: readonly SyntheticKey[];
  /** The public host the form is served on, for example `www.sensphere.co.uk`. */
  host: string;
  /** The form's path or paths, for example `/api/enquiry`. Exact match, no query. */
  path: string | readonly string[];
  /** Accepted media types, for example `["application/json"]`. Parameters are ignored here and signed as sent. */
  contentTypes: readonly string[];
  replayGuard: ReplayGuard;
  /** Defaults to `probe` and `full`. */
  modes?: readonly SyntheticMode[];
  /** Pins the request to one client or form. A mismatch is a bad signature, not a different form. */
  client?: string;
  form?: string;
  /** Unix seconds. Defaults to the current time. */
  now?: number;
  windowSeconds?: number;
  /** Largest body to hash, in bytes. Defaults to 1 MiB; a larger body is a `shape` rejection, unread. */
  maxBodyBytes?: number;
}

export interface VerifyInput {
  method: string;
  /** The URL as the visitor reached it (public host), not an internal proxy address. */
  url: string | URL;
  headers: { get(name: string): string | null };
  /** The raw body bytes, unparsed. */
  body: Uint8Array | string;
}

export type VerifyResult =
  | { ok: true; synthetic: SyntheticContext }
  | {
      ok: false;
      /** True when the request claimed to be synthetic. Beacon it; handle it as an ordinary request. */
      rejected: boolean;
      reason: RejectReason | "not_synthetic" | "disabled";
      /** The client and form the request named, when they parsed. For the beacon only; untrusted. */
      claimed?: { client?: string; form?: string };
    };

const ordinary = (reason: "not_synthetic" | "disabled"): VerifyResult => ({ ok: false, rejected: false, reason });

function reject(reason: RejectReason, h?: VerifyInput["headers"]): VerifyResult {
  const claimed: { client?: string; form?: string } = {};
  const client = h?.get(HEADER.client);
  const form = h?.get(HEADER.form);
  if (client && ID_PATTERN.test(client)) claimed.client = client;
  if (form && ID_PATTERN.test(form)) claimed.form = form;
  return { ok: false, rejected: true, reason, claimed };
}

const mediaType = (contentType: string) => contentType.split(";")[0]!.trim().toLowerCase();

/**
 * Verifies a synthetic request. Order matters:
 *
 * 1. no `X-DD-Synth` header, or no keys configured: an ordinary request;
 * 2. shape (method, host, path, content type) before anything is hashed;
 * 3. header syntax, kid, time window, signature in constant time;
 * 4. the replay guard last, so a forged request cannot burn a real run id.
 *
 * Anything that is not `ok` is handled as an ordinary request, so Turnstile
 * still applies. Never throws.
 */
export async function verify(input: VerifyInput, config: VerifyConfig): Promise<VerifyResult> {
  try {
    return await verifyInner(input, config);
  } catch {
    return reject("malformed", input.headers);
  }
}

async function verifyInner(input: VerifyInput, config: VerifyConfig): Promise<VerifyResult> {
  const h = input.headers;
  const claim = h.get(HEADER.version);
  if (claim === null) return ordinary("not_synthetic");
  if (config.keys.length === 0) return ordinary("disabled");
  if (claim !== PROTOCOL_VERSION) return reject("unsupported_version", h);

  // Shape, before the signature.
  const contentType = h.get("content-type");
  const { host, path } = hostAndPath(input.url);
  const paths = typeof config.path === "string" ? [config.path] : config.path;
  if (
    input.method.toUpperCase() !== "POST" ||
    host !== config.host.toLowerCase() ||
    !paths.includes(path) ||
    contentType === null ||
    !config.contentTypes.map((t) => t.toLowerCase()).includes(mediaType(contentType))
  ) {
    return reject("shape", h);
  }

  const maxBody = config.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  if ((typeof input.body === "string" ? utf8(input.body).length : input.body.length) > maxBody) {
    return reject("shape", h);
  }

  const kid = h.get(HEADER.kid);
  const tsText = h.get(HEADER.ts);
  const runId = h.get(HEADER.run);
  const mode = h.get(HEADER.mode);
  const client = h.get(HEADER.client);
  const form = h.get(HEADER.form);
  const sig = h.get(HEADER.sig);
  if (
    !kid || !ID_PATTERN.test(kid) ||
    !tsText || !/^\d{1,12}$/.test(tsText) ||
    !runId || !RUN_ID_PATTERN.test(runId) ||
    !mode || !client || !ID_PATTERN.test(client) ||
    !form || !ID_PATTERN.test(form) ||
    !sig || !/^v1=[0-9a-f]{64}$/.test(sig)
  ) {
    return reject("malformed", h);
  }
  if (!(config.modes ?? FORM_MODES).includes(mode as SyntheticMode)) return reject("mode", h);

  const key = config.keys.find((k) => k.kid === kid);
  if (!key) return reject("unknown_kid", h);

  const ts = Number(tsText);
  const now = Math.floor(config.now ?? Date.now() / 1000);
  if (Math.abs(now - ts) > (config.windowSeconds ?? DEFAULT_WINDOW_SECONDS)) return reject("stale", h);

  const secret = decodeSecret(key.secret);
  if (!secret) return reject("bad_signature", h);
  const body = typeof input.body === "string" ? utf8(input.body) : input.body;
  const expected = await computeSignature(secret, {
    kid,
    ts,
    runId,
    mode,
    client,
    form,
    host,
    path,
    contentType,
    bodySha256: await sha256Hex(body),
  });
  const given = fromHex(sig.slice(3));
  const pinned = (config.client === undefined || config.client === client) && (config.form === undefined || config.form === form);
  // Evaluate both so a mismatched pin takes as long as a mismatched signature.
  const signatureOk = given !== null && constantTimeEqual(expected, given);
  if (!signatureOk || !pinned) return reject("bad_signature", h);

  let first: boolean;
  try {
    first = await config.replayGuard(runId);
  } catch {
    return reject("replay_guard_unavailable", h);
  }
  if (!first) return reject("replay", h);

  const synthetic: SyntheticContext = Object.freeze({
    v: 1,
    runId,
    mode: mode as SyntheticMode,
    client,
    form,
    kid,
  });
  return { ok: true, synthetic };
}

/** Verifies a `Request`. Reads a clone, so the handler can still read the body. */
export async function verifyRequest(request: Request, config: VerifyConfig): Promise<VerifyResult> {
  if (request.headers.get(HEADER.version) === null) return ordinary("not_synthetic");
  const maxBody = config.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBody) return reject("shape", request.headers);
  let body: Uint8Array;
  try {
    const read = await readCapped(request.clone(), maxBody);
    if (read === null) return reject("shape", request.headers);
    body = read;
  } catch {
    return reject("malformed", request.headers);
  }
  return verify({ method: request.method, url: request.url, headers: request.headers, body }, config);
}

/** Reads a body up to `max` bytes; null when it is larger. Never buffers more than `max` plus one chunk. */
async function readCapped(request: Request, max: number): Promise<Uint8Array | null> {
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      void reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

export type StageStatus = "pass" | "fail" | "skipped";
export interface StageResult {
  status: StageStatus;
  /** A short code, never personal data. */
  code?: string;
  ms?: number;
}

/**
 * The `synthetic` block added to the response JSON. Include it only when the
 * signature verified, so an ordinary visitor never sees stage detail.
 */
export function syntheticReport(ctx: SyntheticContext, stages: Record<string, StageResult>) {
  return { v: ctx.v, runId: ctx.runId, stages };
}

/** In-memory guard for tests and local development. Not shared across isolates: do not use in production. */
export function memoryReplayGuard(): ReplayGuard {
  const seen = new Set<string>();
  return (runId) => {
    if (seen.has(runId)) return false;
    seen.add(runId);
    return true;
  };
}

export interface UpstashReplayOptions {
  /** `UPSTASH_REDIS_REST_URL` */
  url: string;
  /** `UPSTASH_REDIS_REST_TOKEN` */
  token: string;
  /** Defaults to 300 seconds, well past the ±120 s window. */
  ttlSeconds?: number;
  fetch?: typeof fetch;
  /** Defaults to 2000 ms. A slow guard fails closed rather than holding the form open. */
  timeoutMs?: number;
}

/** `SET synth:<runId> 1 NX EX 300` over Upstash's REST API. A failed call throws, which `verify` treats as a rejection. */
export function upstashReplayGuard(options: UpstashReplayOptions): ReplayGuard {
  const doFetch = options.fetch ?? fetch;
  return async (runId) => {
    const res = await doFetch(options.url.replace(/\/+$/, ""), {
      method: "POST",
      headers: { Authorization: `Bearer ${options.token}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(options.timeoutMs ?? 2000),
      body: JSON.stringify(["SET", `synth:${runId}`, "1", "NX", "EX", String(options.ttlSeconds ?? 300)]),
    });
    if (!res.ok) throw new Error(`upstash ${res.status}`);
    const json = (await res.json()) as { result?: string | null };
    return json.result === "OK";
  };
}
