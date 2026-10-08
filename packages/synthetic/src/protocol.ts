import { fromBase64Url, hmacSha256, importHmacKey, sha256Hex, toHex, utf8 } from "./encoding";

/** The protocol version carried in `X-DD-Synth` and in the canonical string's first line. */
export const PROTOCOL_VERSION = "v1";
export const CANONICAL_PREFIX = "DD-SYNTH-V1";

export const HEADER = {
  version: "X-DD-Synth",
  kid: "X-DD-Synth-Kid",
  ts: "X-DD-Synth-Ts",
  run: "X-DD-Synth-Run",
  mode: "X-DD-Synth-Mode",
  client: "X-DD-Synth-Client",
  form: "X-DD-Synth-Form",
  sig: "X-DD-Synth-Sig",
} as const;

/**
 * `probe` and `full` are the two form modes in the plan. `beacon` and
 * `receipt` sign the traffic a site sends back to dd-checks, with the same
 * key and the same canonical string; a form handler never accepts them.
 */
export type SyntheticMode = "probe" | "full" | "beacon" | "receipt";
export const MODES: readonly SyntheticMode[] = ["probe", "full", "beacon", "receipt"];
export const FORM_MODES: readonly SyntheticMode[] = ["probe", "full"];

export interface SyntheticKey {
  /** Key id, for example `sensphere-2026-10`. */
  kid: string;
  /** The 32-byte secret, base64url without padding. */
  secret: string;
}

/** The fields the signature covers, in canonical order. */
export interface CanonicalParts {
  kid: string;
  ts: number;
  runId: string;
  mode: string;
  client: string;
  form: string;
  /** Lower-case host, with the port only if the URL has one. */
  host: string;
  /** Path only, no query string. */
  path: string;
  /** The Content-Type header exactly as sent. */
  contentType: string;
  /** Hex SHA-256 of the raw body bytes. */
  bodySha256: string;
}

export const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
export const RUN_ID_PATTERN = /^[a-z2-7]{16}$/;
export const SECRET_BYTES = 32;

const RUN_ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

/**
 * A fresh 16-character run id from the CSPRNG, 80 bits. It doubles as the
 * replay nonce and as the token in the canary address, so a form handler's
 * idempotency key can never match an earlier synthetic run.
 */
export function generateRunId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let out = "";
  // 32 symbols and 256 byte values: the modulo is exact, so there is no bias.
  for (const byte of bytes) out += RUN_ID_ALPHABET[byte % 32];
  return out;
}

/** The exact string the HMAC covers. */
export function canonicalString(p: CanonicalParts): string {
  return [
    CANONICAL_PREFIX,
    p.kid,
    String(p.ts),
    p.runId,
    p.mode,
    p.client,
    p.form,
    "POST",
    p.host,
    p.path,
    p.contentType,
    p.bodySha256,
  ].join("\n");
}

/** Decodes a base64url secret and checks it is 32 bytes. Null if it is not. */
export function decodeSecret(secret: string): Uint8Array | null {
  const bytes = fromBase64Url(secret);
  return bytes && bytes.length === SECRET_BYTES ? bytes : null;
}

export async function computeSignature(secret: Uint8Array, parts: CanonicalParts): Promise<Uint8Array> {
  return hmacSha256(await importHmacKey(secret), canonicalString(parts));
}

export interface SignOptions {
  key: SyntheticKey;
  /** The URL the request will be sent to. Its host and path go into the signature. */
  url: string | URL;
  /** The Content-Type header the request will carry, exactly. */
  contentType: string;
  /** The raw body bytes, as they will go on the wire. */
  body: Uint8Array | string;
  client: string;
  form: string;
  mode: SyntheticMode;
  /** Defaults to a fresh run id. */
  runId?: string;
  /** Unix seconds. Defaults to the current time. */
  now?: number;
}

export interface SignedHeaders {
  runId: string;
  ts: number;
  headers: Record<string, string>;
}

/** Splits a URL into the `host` and `path` the canonical string uses. */
export function hostAndPath(url: string | URL): { host: string; path: string } {
  const u = typeof url === "string" ? new URL(url) : url;
  return { host: u.host.toLowerCase(), path: u.pathname };
}

/** Signs a request. Throws on invalid input: signing is our own code, so a bad call is a bug. */
export async function sign(options: SignOptions): Promise<SignedHeaders> {
  const { key, client, form, mode, contentType } = options;
  const runId = options.runId ?? generateRunId();
  const ts = Math.floor(options.now ?? Date.now() / 1000);
  if (!ID_PATTERN.test(key.kid)) throw new Error("synthetic: invalid kid");
  if (!ID_PATTERN.test(client)) throw new Error("synthetic: invalid client");
  if (!ID_PATTERN.test(form)) throw new Error("synthetic: invalid form");
  if (!RUN_ID_PATTERN.test(runId)) throw new Error("synthetic: invalid run id");
  if (!MODES.includes(mode)) throw new Error("synthetic: invalid mode");
  if (!contentType || /[\r\n]/.test(contentType)) throw new Error("synthetic: invalid content type");
  const secret = decodeSecret(key.secret);
  if (!secret) throw new Error("synthetic: secret must be 32 bytes of base64url");

  const bytes = typeof options.body === "string" ? utf8(options.body) : options.body;
  const { host, path } = hostAndPath(options.url);
  const signature = await computeSignature(secret, {
    kid: key.kid,
    ts,
    runId,
    mode,
    client,
    form,
    host,
    path,
    contentType,
    bodySha256: await sha256Hex(bytes),
  });
  return {
    runId,
    ts,
    headers: {
      [HEADER.version]: PROTOCOL_VERSION,
      [HEADER.kid]: key.kid,
      [HEADER.ts]: String(ts),
      [HEADER.run]: runId,
      [HEADER.mode]: mode,
      [HEADER.client]: client,
      [HEADER.form]: form,
      [HEADER.sig]: `v1=${toHex(signature)}`,
    },
  };
}

export interface SyntheticEnv {
  DD_SYNTHETIC_SECRET?: string;
  DD_SYNTHETIC_KID?: string;
  DD_SYNTHETIC_SECRET_NEXT?: string;
  DD_SYNTHETIC_KID_NEXT?: string;
}

/**
 * Reads the site's keys from its environment. A secret without a kid, or a
 * kid without a secret, is left out. With no `DD_SYNTHETIC_SECRET` the list
 * is empty and the synthetic path is off. At most two keys, so a secret can
 * rotate with no downtime: set `_NEXT`, switch the platform, promote, remove.
 */
export function keysFromEnv(env: SyntheticEnv): SyntheticKey[] {
  const keys: SyntheticKey[] = [];
  if (env.DD_SYNTHETIC_SECRET && env.DD_SYNTHETIC_KID) {
    keys.push({ kid: env.DD_SYNTHETIC_KID, secret: env.DD_SYNTHETIC_SECRET });
  }
  if (env.DD_SYNTHETIC_SECRET && env.DD_SYNTHETIC_SECRET_NEXT && env.DD_SYNTHETIC_KID_NEXT) {
    keys.push({ kid: env.DD_SYNTHETIC_KID_NEXT, secret: env.DD_SYNTHETIC_SECRET_NEXT });
  }
  return keys;
}
