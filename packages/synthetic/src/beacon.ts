import { ID_PATTERN, sign, type SyntheticKey } from "./protocol";
import { REJECT_REASONS, type RejectReason } from "./verify";

export const DEFAULT_ENDPOINT = "https://checks.domandigital.co.uk";
export const BEACON_PATH = "/beacon";
export const RECEIPT_PATH = "/purge-receipt";

/**
 * What a beacon can say. Codes only, never personal data. `accepted` is a real
 * submission that went through; the next five are the config-class failures
 * that mean every visitor is affected; `captcha_failed` feeds the "5 or more
 * in an hour with none accepted" rule; `synthetic_rejected` carries a reason.
 */
export type BeaconCode =
  | "accepted"
  | "hostname_mismatch"
  | "invalid-input-secret"
  | "misconfigured"
  | "service_unavailable"
  | "delivery_failed"
  | "captcha_failed"
  | "synthetic_rejected";

export const BEACON_CODES: readonly BeaconCode[] = [
  "accepted",
  "hostname_mismatch",
  "invalid-input-secret",
  "misconfigured",
  "service_unavailable",
  "delivery_failed",
  "captcha_failed",
  "synthetic_rejected",
];

export interface ReporterOptions {
  /** The key the site holds, normally the first one. */
  key: SyntheticKey;
  /** The site's client slug, as in the registry. */
  client: string;
  /** Defaults to `https://checks.domandigital.co.uk`. */
  endpoint?: string;
  fetch?: typeof fetch;
  /** Hand in `ctx.waitUntil` (Workers) or `after` (Next) to keep the send alive past the response. */
  waitUntil?: (promise: Promise<unknown>) => void;
  /** Defaults to 3000 ms. */
  timeoutMs?: number;
  now?: number;
}

export interface BeaconEvent {
  form: string;
  code: BeaconCode;
  /** Required for `synthetic_rejected`: the reason `verify` gave. */
  reason?: RejectReason;
}

export interface PurgeReceipt {
  form: string;
  deleted: number;
  /** Rows still present that are past `purge_after`. Anything above zero opens a warning. */
  remaining: number;
}

async function post(options: ReporterOptions, path: string, mode: "beacon" | "receipt", form: string, payload: object): Promise<void> {
  const body = JSON.stringify(payload);
  const url = `${(options.endpoint ?? DEFAULT_ENDPOINT).replace(/\/+$/, "")}${path}`;
  const contentType = "application/json";
  const signed = await sign({ key: options.key, url, contentType, body, client: options.client, form, mode, now: options.now });
  await (options.fetch ?? fetch)(url, {
    method: "POST",
    headers: { "Content-Type": contentType, ...signed.headers },
    body,
    signal: AbortSignal.timeout(options.timeoutMs ?? 3000),
  });
}

/** Runs a send, swallows every failure, and hands the promise to `waitUntil` if given. */
function fireAndForget(options: ReporterOptions, run: () => Promise<void>): Promise<void> {
  let promise: Promise<void>;
  try {
    promise = run().catch(() => undefined);
  } catch {
    promise = Promise.resolve();
  }
  try {
    options.waitUntil?.(promise);
  } catch {
    // A broken waitUntil must not reach the form handler either.
  }
  return promise;
}

/**
 * Sends a signed beacon to dd-checks. Fire-and-forget: never throws, never
 * rejects, and a bad argument is dropped rather than raised, because the
 * caller is a form handler in the middle of a visitor's request.
 */
export function sendBeacon(options: ReporterOptions, event: BeaconEvent): Promise<void> {
  return fireAndForget(options, async () => {
    if (!BEACON_CODES.includes(event.code) || !ID_PATTERN.test(event.form)) return;
    const payload: { v: 1; client: string; form: string; code: BeaconCode; reason?: RejectReason; ts: number } = {
      v: 1,
      client: options.client,
      form: event.form,
      code: event.code,
      ts: Math.floor(options.now ?? Date.now() / 1000),
    };
    if (event.code === "synthetic_rejected") {
      if (!event.reason || !REJECT_REASONS.includes(event.reason)) return;
      payload.reason = event.reason;
    }
    await post(options, BEACON_PATH, "beacon", event.form, payload);
  });
}

/**
 * Sends the daily purge receipt: `{client, form, deleted, remaining}`. A
 * missing receipt, or `remaining > 0`, is what opens the reconciliation
 * warning. Never throws.
 */
export function sendPurgeReceipt(options: ReporterOptions, receipt: PurgeReceipt): Promise<void> {
  return fireAndForget(options, async () => {
    const counts = [receipt.deleted, receipt.remaining];
    if (!ID_PATTERN.test(receipt.form) || !counts.every((n) => Number.isSafeInteger(n) && n >= 0)) return;
    await post(options, RECEIPT_PATH, "receipt", receipt.form, {
      v: 1,
      client: options.client,
      form: receipt.form,
      deleted: receipt.deleted,
      remaining: receipt.remaining,
      ts: Math.floor(options.now ?? Date.now() / 1000),
    });
  });
}
