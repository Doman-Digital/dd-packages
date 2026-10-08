import { constantTimeEqual, fromHex, hmacSha256, sha256Hex, toHex, utf8 } from "./bytes";
import { H } from "./headers";
import { decodeSecret, type SynthKey } from "./keys";
import type { RejectReason } from "./verify";

// Beacons and purge receipts are the two things a form handler sends back to
// dd-checks. Same key, same HMAC, a different canonical string, and a body of
// codes and counts only: never a name, an email address or a message.
//
//   DD-SYNTH-REPORT-V1\n<kid>\n<ts>\n<kind>\n<client>\n<form>\n<hex sha256(body)>
//
// Headers: X-DD-Synth: report-v1, X-DD-Synth-Kid, X-DD-Synth-Ts, X-DD-Synth-Sig: v1=<hex>.

export const REPORT_MARKER = "report-v1";
export const REPORT_PREFIX = "DD-SYNTH-REPORT-V1";

export const BEACON_CODES = [
  "accepted",
  "captcha_failed",
  "hostname_mismatch",
  "invalid-input-secret",
  "misconfigured",
  "service_unavailable",
  "delivery_failed",
  "synthetic_rejected",
] as const;
export type BeaconCode = (typeof BEACON_CODES)[number];

const REJECT_REASONS: readonly RejectReason[] = [
  "shape",
  "malformed",
  "unknown_kid",
  "bad_signature",
  "expired",
  "replay",
  "replay_guard_error",
  "misconfigured",
];

export type ReportKind = "beacon" | "purge";

export interface ReportTarget {
  /** The dd-checks endpoint, e.g. https://checks.domandigital.co.uk/beacon */
  url: string;
  key: SynthKey;
  client: string;
  form: string;
  fetch?: typeof fetch;
  /** Pass `ctx.waitUntil` in a Worker so the request outlives the response. */
  waitUntil?: (p: Promise<unknown>) => void;
  timeoutMs?: number;
  /** Unix seconds; injectable for tests. */
  now?: () => number;
}

export interface BeaconInput extends ReportTarget {
  code: BeaconCode;
  /** Required with `synthetic_rejected`: why the signature was not accepted. */
  reason?: RejectReason;
}

export interface PurgeReceiptInput extends ReportTarget {
  deleted: number;
  /** Rows still present past their `purge_after`. Anything above 0 opens a warning. */
  remaining: number;
}

async function signReport(kind: ReportKind, t: ReportTarget, body: string): Promise<Record<string, string>> {
  const secret = decodeSecret(t.key.secret);
  if (!secret) throw new Error("bad key");
  const ts = (t.now ?? (() => Math.floor(Date.now() / 1000)))();
  const canonical = [REPORT_PREFIX, t.key.kid, ts, kind, t.client, t.form, await sha256Hex(utf8(body))].join("\n");
  return {
    "content-type": "application/json",
    [H.marker]: REPORT_MARKER,
    [H.kid]: t.key.kid,
    [H.ts]: String(ts),
    [H.sig]: `v1=${toHex(await hmacSha256(secret, canonical))}`,
  };
}

/** Fire and forget. Resolves (never rejects) once the attempt is over, whatever happened. */
function dispatch(kind: ReportKind, t: ReportTarget, payload: Record<string, unknown>): Promise<void> {
  const run = (async () => {
    try {
      const body = JSON.stringify({ v: 1, kind, client: t.client, form: t.form, ...payload });
      const headers = await signReport(kind, t, body);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), t.timeoutMs ?? 3000);
      try {
        const res = await (t.fetch ?? fetch)(t.url, { method: "POST", headers, body, signal: controller.signal });
        // Drain so the connection is released; the answer is not used.
        await res.arrayBuffer().catch(() => undefined);
      } finally {
        clearTimeout(timer);
      }
    } catch {
      // A monitoring beacon must never affect the visitor's request.
    }
  })();
  try {
    t.waitUntil?.(run);
  } catch {
    // ignore
  }
  return run;
}

/**
 * Reports one real-traffic outcome as a code. Never throws, never rejects; an
 * unknown code or a bad key sends nothing. A visitor's data is not accepted
 * here at all: the input has no free-text field.
 */
export function sendBeacon(input: BeaconInput): Promise<void> {
  try {
    if (!(BEACON_CODES as readonly string[]).includes(input.code)) return Promise.resolve();
    const payload: Record<string, unknown> = { code: input.code };
    if (input.code === "synthetic_rejected") {
      if (!input.reason || !REJECT_REASONS.includes(input.reason)) return Promise.resolve();
      payload.reason = input.reason;
    }
    return dispatch("beacon", input, payload);
  } catch {
    return Promise.resolve();
  }
}

/** Daily purge receipt: `{client, form, deleted, remaining}`. Never throws, never rejects. */
export function sendPurgeReceipt(input: PurgeReceiptInput): Promise<void> {
  try {
    const ok = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 0;
    if (!ok(input.deleted) || !ok(input.remaining)) return Promise.resolve();
    return dispatch("purge", input, { deleted: input.deleted, remaining: input.remaining });
  } catch {
    return Promise.resolve();
  }
}

export type VerifyReportResult =
  | { ok: true; kind: ReportKind; client: string; form: string; payload: Record<string, unknown> }
  | { ok: false; reason: "malformed" | "unknown_kid" | "bad_signature" | "expired" };

/** For dd-checks: authenticates a beacon or receipt. `keys` is the client's key set. */
export async function verifyReport(
  headers: Headers | Record<string, string | undefined>,
  rawBody: string,
  keys: SynthKey[],
  opts: { now?: () => number; windowSeconds?: number } = {},
): Promise<VerifyReportResult> {
  const get = (name: string): string | undefined => {
    if (typeof (headers as Headers).get === "function") return (headers as Headers).get(name) ?? undefined;
    const lower = name.toLowerCase();
    const hit = Object.entries(headers as Record<string, string | undefined>).find(([k]) => k.toLowerCase() === lower);
    return hit?.[1];
  };
  const kid = get(H.kid);
  const tsText = get(H.ts);
  const sig = get(H.sig);
  let parsed: { kind?: unknown; client?: unknown; form?: unknown } & Record<string, unknown>;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const { kind, client, form } = parsed;
  if (
    get(H.marker) !== REPORT_MARKER || !kid || !tsText || !/^\d{1,12}$/.test(tsText) || !sig || !/^v1=[0-9a-fA-F]{64}$/.test(sig) ||
    (kind !== "beacon" && kind !== "purge") || typeof client !== "string" || typeof form !== "string"
  ) {
    return { ok: false, reason: "malformed" };
  }
  const key = keys.find((k) => k.kid === kid);
  const secret = key && decodeSecret(key.secret);
  if (!secret) return { ok: false, reason: "unknown_kid" };
  const canonical = [REPORT_PREFIX, kid, tsText, kind, client, form, await sha256Hex(utf8(rawBody))].join("\n");
  const given = fromHex(sig.slice(3));
  if (!given || !constantTimeEqual(await hmacSha256(secret, canonical), given)) return { ok: false, reason: "bad_signature" };
  const now = (opts.now ?? (() => Math.floor(Date.now() / 1000)))();
  if (Math.abs(now - Number(tsText)) > (opts.windowSeconds ?? 120)) return { ok: false, reason: "expired" };
  return { ok: true, kind, client, form, payload: parsed };
}
