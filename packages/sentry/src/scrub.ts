/**
 * The PII scrubber every project runs as `beforeSend`. Lifted from
 * Doman-Digital `packages/shared/sentry-scrubber.ts` (and its
 * `sanitize-telemetry.ts`), widened to the parts of an event that carried
 * customer details in the 2026-10-08 audit, then passed through
 * `@domandigital/synthetic`'s scrubber so `X-DD-Synth-*` never leaves either.
 */

import { scrubSentryEvent as scrubSynthetic } from "@domandigital/synthetic";

export const REDACTED = "[REDACTED]";

/** A key whose value is never sent, whatever it holds. */
const REDACT_KEYS = /email|token|cookie|authori[sz]ation|^auth$|password|passwd|secret|session|signature|api[-_]?key|phone/i;
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const BEARER = /bearer\s+[a-z0-9._\-~+/]+=*/gi;
// UK numbers, as customers type them: +44 or 0, then 9 or 10 digits with optional spaces or dashes.
// Narrow on purpose: a looser pattern eats dates, order numbers and timings.
const PHONE = /(?<![\w.+])(?:\+44\s?(?:\(0\)\s?)?|0)\d(?:[\s-]?\d){8,9}(?![\w.])/g;

const MAX_DEPTH = 8;
const MAX_ITEMS = 100;

/** Redacts emails, bearer tokens and UK phone numbers in free text. */
export function scrubString(input: string): string {
  return input
    .replace(EMAIL, "[REDACTED_EMAIL]")
    .replace(BEARER, "Bearer [REDACTED_TOKEN]")
    .replace(PHONE, "[REDACTED_PHONE]");
}

/** Redacts sensitive keys and strings anywhere in a value. Never mutates it. */
export function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[TRUNCATED_DEPTH]";
  if (value == null) return value;
  if (typeof value === "string") return scrubString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Error) return { name: value.name, message: scrubString(value.message) };
  if (Array.isArray(value)) return value.slice(0, MAX_ITEMS).map((item) => scrubValue(item, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = REDACT_KEYS.test(key) ? REDACTED : scrubValue(item, depth + 1);
    }
    return out;
  }
  return String(value);
}

type Rec = Record<string, unknown>;
const isRec = (value: unknown): value is Rec => typeof value === "object" && value !== null && !Array.isArray(value);

function scrubRequest(request: Rec): Rec {
  const out: Rec = { ...request };
  if ("headers" in out) out.headers = scrubValue(out.headers);
  if ("cookies" in out && out.cookies) out.cookies = REDACTED;
  if ("data" in out) out.data = scrubValue(out.data);
  if (typeof out.query_string === "string") out.query_string = scrubString(out.query_string);
  else if ("query_string" in out) out.query_string = scrubValue(out.query_string);
  if (typeof out.url === "string") out.url = scrubString(out.url);
  return out;
}

function scrubException(exception: Rec): Rec {
  if (!Array.isArray(exception.values)) return exception;
  return {
    ...exception,
    // Only the message: stack frames, types and mechanisms are code, not customer data.
    values: exception.values.map((v) => (isRec(v) && typeof v.value === "string" ? { ...v, value: scrubString(v.value) } : v)),
  };
}

function scrubBreadcrumb(crumb: unknown): unknown {
  if (!isRec(crumb)) return crumb;
  const out: Rec = { ...crumb };
  if (typeof out.message === "string") out.message = scrubString(out.message);
  if ("data" in out) out.data = scrubValue(out.data);
  return out;
}

function scrubPii(event: Rec): Rec {
  const out: Rec = { ...event };
  if (isRec(out.request)) out.request = scrubRequest(out.request);
  for (const key of ["user", "extra", "contexts", "tags"] as const) {
    if (key in out) out[key] = scrubValue(out[key]);
  }
  if (typeof out.message === "string") out.message = scrubString(out.message);
  if (isRec(out.logentry) && typeof out.logentry.message === "string") {
    out.logentry = { ...out.logentry, message: scrubString(out.logentry.message) };
  }
  if (isRec(out.exception)) out.exception = scrubException(out.exception);
  if (Array.isArray(out.breadcrumbs)) out.breadcrumbs = out.breadcrumbs.map(scrubBreadcrumb);
  return out;
}

/** A span attribute whose value is never sent. Narrower than {@link REDACT_KEYS}: span keys are dotted names like `sentry.session.id`. */
const SPAN_REDACT_KEYS = /x-dd-synth|cookie|authori[sz]ation|token|secret|password|email|phone/i;

function scrubAttributes(attributes: Rec): Rec {
  const out: Rec = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (SPAN_REDACT_KEYS.test(key)) out[key] = REDACTED;
    else if (typeof value === "string") out[key] = scrubString(value);
    else if (Array.isArray(value)) out[key] = value.map((v) => (typeof v === "string" ? scrubString(v) : v));
    else out[key] = value;
  }
  return out;
}

/**
 * `beforeSendSpan`: scrubs a span's name and attributes (v11's streamed
 * `attributes`, v10's `data`) and keeps its shape exactly, because a span
 * cannot be dropped and the SDK sends what this returns.
 */
export function scrubSpan<S extends object>(span: S): S {
  try {
    const out: Rec = { ...(span as Rec) };
    if (typeof out.name === "string") out.name = scrubString(out.name);
    if (typeof out.description === "string") out.description = scrubString(out.description);
    if (isRec(out.attributes)) out.attributes = scrubAttributes(out.attributes);
    if (isRec(out.data)) out.data = scrubAttributes(out.data);
    return out as S;
  } catch {
    return span;
  }
}

/**
 * Scrubs a whole Sentry event: request, user, extra, contexts, tags, message,
 * exception messages and breadcrumbs, then every `X-DD-Synth-*` header.
 * Returns a new object and never throws; if scrubbing fails it drops the
 * request and user rather than let them through.
 */
export function scrubEvent<T extends object>(event: T): T {
  try {
    return scrubSynthetic(scrubPii(event as Rec)) as T;
  } catch {
    const { request: _request, user: _user, extra: _extra, breadcrumbs: _breadcrumbs, ...rest } = event as Rec;
    return rest as T;
  }
}
