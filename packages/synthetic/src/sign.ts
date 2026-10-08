import { bodyBytes, hmacSha256, sha256Hex, toHex, type BodyInput } from "./bytes";
import { canonicalSafe, canonicalString, PROTOCOL_VERSION, type SynthMode } from "./canonical";
import { H } from "./headers";
import { decodeSecret, KID_PATTERN, type SynthKey } from "./keys";
import { generateRunId, RUN_ID_PATTERN } from "./runid";

export interface SignInput {
  key: SynthKey;
  mode: SynthMode;
  client: string;
  form: string;
  /** The URL being POSTed to. Its host and path go into the signature; the query string does not. */
  url: string | URL;
  /** The Content-Type header value exactly as it will be sent. */
  contentType: string;
  /** The raw bytes that will be sent. Sign the final body, after any encoding. */
  body: BodyInput;
  /** Defaults to a fresh `generateRunId()`. Supply one only to reproduce a vector. */
  runId?: string;
  /** Unix seconds. Defaults to now. */
  ts?: number;
}

export interface Signed {
  /** Add these to the request. The client must send exactly the signed body and content type. */
  headers: Record<string, string>;
  runId: string;
  ts: number;
  canonical: string;
  /** Hex HMAC-SHA-256, without the `v1=` prefix. */
  signature: string;
}

/** Signs a request. Throws on malformed input; a signer with a bad key should fail loudly. */
export async function sign(input: SignInput): Promise<Signed> {
  const secret = decodeSecret(input.key.secret);
  if (!secret) throw new Error("synthetic: secret must be 32 bytes of base64url");
  if (!KID_PATTERN.test(input.key.kid)) throw new Error("synthetic: invalid key id");
  const url = typeof input.url === "string" ? new URL(input.url) : input.url;
  const runId = input.runId ?? generateRunId();
  if (!RUN_ID_PATTERN.test(runId)) throw new Error("synthetic: run id must be 16 characters of [a-z2-7]");
  const ts = input.ts ?? Math.floor(Date.now() / 1000);
  if (!Number.isInteger(ts) || ts < 0) throw new Error("synthetic: ts must be unix seconds");

  const parts = {
    kid: input.key.kid,
    ts,
    runId,
    mode: input.mode,
    client: input.client,
    form: input.form,
    host: url.host,
    path: url.pathname,
    contentType: input.contentType,
    bodySha256: await sha256Hex(bodyBytes(input.body)),
  };
  if (!canonicalSafe(parts)) throw new Error("synthetic: fields must be non-empty and contain no line breaks");
  const canonical = canonicalString(parts);
  const signature = toHex(await hmacSha256(secret, canonical));

  return {
    runId,
    ts,
    canonical,
    signature,
    headers: {
      [H.marker]: PROTOCOL_VERSION,
      [H.kid]: parts.kid,
      [H.ts]: String(ts),
      [H.run]: runId,
      [H.mode]: input.mode,
      [H.client]: input.client,
      [H.form]: input.form,
      [H.sig]: `${PROTOCOL_VERSION}=${signature}`,
    },
  };
}
