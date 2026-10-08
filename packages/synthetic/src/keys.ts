import { fromBase64Url } from "./bytes";

/** A signing key: its id and the 32-byte base64url secret. */
export interface SynthKey {
  kid: string;
  secret: string;
}

export const SECRET_BYTES = 32;

/** Decodes a secret. Null unless it is exactly 32 bytes of base64url. */
export function decodeSecret(secret: string): Uint8Array | null {
  const bytes = fromBase64Url(secret);
  return bytes && bytes.length === SECRET_BYTES ? bytes : null;
}

export const KID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * Reads the two allowed keys from an environment. Each secret is paired with
 * its kid:
 *
 *   DD_SYNTHETIC_SECRET       + DD_SYNTHETIC_KID
 *   DD_SYNTHETIC_SECRET_NEXT  + DD_SYNTHETIC_KID_NEXT
 *
 * A secret with no kid is skipped, not guessed at. An unset
 * DD_SYNTHETIC_SECRET returns no keys at all, which turns the synthetic path
 * off. At most two keys are ever returned.
 */
export function keysFromEnv(env: Record<string, string | undefined>): SynthKey[] {
  const keys: SynthKey[] = [];
  const pairs: [string, string][] = [
    ["DD_SYNTHETIC_SECRET", "DD_SYNTHETIC_KID"],
    ["DD_SYNTHETIC_SECRET_NEXT", "DD_SYNTHETIC_KID_NEXT"],
  ];
  for (const [s, k] of pairs) {
    const secret = env[s];
    const kid = env[k];
    if (secret && kid) keys.push({ kid, secret });
  }
  return keys;
}
