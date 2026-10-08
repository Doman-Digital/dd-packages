import type { SynthContext } from "./context";

export const CANARY_DOMAIN = "canary.domandigital.co.uk";

const LOCAL = /^[a-z0-9._+-]{1,64}$/i;

/**
 * The recipient lock. True only for a single plain address at exactly
 * `canary.domandigital.co.uk`: no display name, no list of addresses, no
 * sub-domain, no look-alike suffix. The bypass can therefore never mail a
 * real person.
 */
export function isCanaryRecipient(email: unknown): boolean {
  if (typeof email !== "string") return false;
  const at = email.indexOf("@");
  if (at < 1 || email.indexOf("@", at + 1) !== -1) return false;
  return LOCAL.test(email.slice(0, at)) && email.slice(at + 1).toLowerCase() === CANARY_DOMAIN;
}

/** `s-<runId>@canary…` for the staff email, `u-<runId>@canary…` for the submitter copy. */
export function canaryAddress(kind: "s" | "u", runId: string): string {
  return `${kind}-${runId}@${CANARY_DOMAIN}`;
}

/**
 * Stricter form for a handler that has a context: the address must be one of
 * this run's own two canary addresses. Use it on the fixture's submitter email.
 */
export function isOwnCanaryAddress(email: unknown, ctx: SynthContext): boolean {
  return isCanaryRecipient(email) && [canaryAddress("s", ctx.runId), canaryAddress("u", ctx.runId)].includes((email as string).toLowerCase());
}
