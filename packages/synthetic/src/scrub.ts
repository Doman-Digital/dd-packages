/**
 * Keeps `X-DD-Synth-*` out of Sentry events and logs. The signature and run id
 * are not secrets on their own, but the headers are the handle on the bypass,
 * so they never leave the request.
 */

export const REDACTED = "[redacted]";

const SYNTH_NAME = /^x-dd-synth(-.*)?$/i;

/** Returns a copy with every `X-DD-Synth*` value replaced. Accepts `Headers`, a record, or tuples. */
export function scrubHeaders(headers: Headers): Headers;
export function scrubHeaders(headers: Record<string, unknown>): Record<string, unknown>;
export function scrubHeaders(headers: [string, unknown][]): [string, unknown][];
export function scrubHeaders(headers: Headers | Record<string, unknown> | [string, unknown][]) {
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    const out = new Headers();
    headers.forEach((value, name) => out.append(name, SYNTH_NAME.test(name) ? REDACTED : value));
    return out;
  }
  if (Array.isArray(headers)) {
    return headers.map(([name, value]) => [name, SYNTH_NAME.test(name) ? REDACTED : value] as [string, unknown]);
  }
  return Object.fromEntries(Object.entries(headers).map(([name, value]) => [name, SYNTH_NAME.test(name) ? REDACTED : value]));
}

/** Redacts `X-DD-Synth-Name: value` wherever it appears in a log line, header dump or URL-encoded blob. */
export function scrubText(text: string): string {
  return text.replace(/(x-dd-synth(?:-[a-z]+)?)(["']?\s*[:=]\s*["']?)[^\s"',;}&]+/gi, `$1$2${REDACTED}`);
}

const MAX_DEPTH = 12;

function scrubValue(value: unknown, depth: number): unknown {
  // Past the limit (a cycle, or something absurdly deep) nothing is passed through unchecked.
  if (depth > MAX_DEPTH) return "[truncated]";
  if (typeof value === "string") return scrubText(value);
  // A header tuple: ["x-dd-synth-sig", "v1=…"].
  if (Array.isArray(value) && value.length === 2 && typeof value[0] === "string" && SYNTH_NAME.test(value[0])) {
    return [value[0], REDACTED];
  }
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, SYNTH_NAME.test(k) ? REDACTED : scrubValue(v, depth + 1)]),
    );
  }
  return value;
}

/**
 * Scrubs a whole Sentry event: request headers, breadcrumbs, extra, contexts,
 * messages. Use as `beforeSend: scrubSentryEvent` (and `beforeSendTransaction`).
 * Returns a new object and never throws; on any failure it returns the event
 * with `request.headers` dropped rather than let a header through.
 */
export function scrubSentryEvent<T extends object>(event: T): T {
  try {
    return scrubValue(event, 0) as T;
  } catch {
    const copy = { ...event } as Record<string, unknown>;
    if (copy.request && typeof copy.request === "object") copy.request = { ...copy.request, headers: undefined };
    return copy as T;
  }
}
