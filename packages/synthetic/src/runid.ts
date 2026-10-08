const ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";
export const RUN_ID_PATTERN = /^[a-z2-7]{16}$/;

/**
 * 16 characters of `[a-z2-7]` (80 random bits). The run id is the nonce, the
 * replay-guard key and the local part of the canary address, so it is fresh
 * for every run: no idempotency key a client form derives from the fixture
 * can ever match two synthetic runs, because the email address differs.
 * 256 mod 32 is 0, so masking a byte is unbiased.
 */
export function generateRunId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += ALPHABET[bytes[i] & 31];
  return out;
}
