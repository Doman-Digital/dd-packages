import { bodyBytes, sha256Hex, type BodyInput } from "./bytes";

export const PROTOCOL_VERSION = "v1";
export const CANONICAL_PREFIX = "DD-SYNTH-V1";

export type SynthMode = "probe" | "full";
export const MODES: readonly SynthMode[] = ["probe", "full"];

export interface CanonicalParts {
  kid: string;
  /** Unix seconds. */
  ts: number;
  runId: string;
  mode: SynthMode;
  client: string;
  form: string;
  /** Host header value the handler sees, lower case, with port if non-default. */
  host: string;
  /** Path only: no query string. */
  path: string;
  /** The Content-Type header value exactly as sent. */
  contentType: string;
  /** Lower-case hex SHA-256 of the raw request body. */
  bodySha256: string;
}

/**
 * The string the HMAC covers. Fields are newline separated; none of them may
 * contain a newline, which `assertCanonicalSafe` enforces on both sides.
 *
 *   DD-SYNTH-V1\n<kid>\n<ts>\n<runId>\n<mode>\n<client>\n<form>\nPOST\n<host>\n<path>\n<content-type>\n<hex sha256(raw body)>
 */
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

/** True when no field could smuggle a line break into the canonical string. */
export function canonicalSafe(p: Pick<CanonicalParts, "kid" | "runId" | "client" | "form" | "host" | "path" | "contentType">): boolean {
  return [p.kid, p.runId, p.client, p.form, p.host, p.path, p.contentType].every((v) => typeof v === "string" && v.length > 0 && !/[\r\n]/.test(v));
}

export async function bodySha256Hex(body: BodyInput): Promise<string> {
  return sha256Hex(bodyBytes(body));
}
