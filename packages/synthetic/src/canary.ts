import { RUN_ID_PATTERN } from "./protocol";

export const CANARY_DOMAIN = "canary.domandigital.co.uk";

/**
 * Recipient lock. The submitter email of a synthetic request must be an
 * address at the canary domain, so the bypass can never mail a real person.
 * Strict on purpose: one plain address, no display name, no list, no
 * subdomain tricks, no look-alike domains.
 */
export function isCanaryRecipient(email: unknown): boolean {
  if (typeof email !== "string" || email.length > 254) return false;
  const match = /^([A-Za-z0-9][A-Za-z0-9._+-]{0,63})@([A-Za-z0-9.-]+)$/.exec(email);
  return match !== null && match[2]!.toLowerCase() === CANARY_DOMAIN;
}

/** Throws unless every address is at the canary domain. Call it before anything is sent. */
export function assertCanaryRecipient(...emails: unknown[]): void {
  for (const email of emails) {
    if (!isCanaryRecipient(email)) throw new SyntheticRecipientError();
  }
}

export class SyntheticRecipientError extends Error {
  constructor() {
    super("synthetic: recipient is not at the canary domain");
    this.name = "SyntheticRecipientError";
  }
}

/** `s-<runId>@canary…` for the staff email, `u-<runId>@canary…` for the submitter email. */
export function canaryAddress(kind: "s" | "u", runId: string): string {
  if (!RUN_ID_PATTERN.test(runId)) throw new Error("synthetic: invalid run id");
  return `${kind}-${runId}@${CANARY_DOMAIN}`;
}
