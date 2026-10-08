// Keeps X-DD-Synth-* values out of Sentry and logs. The signature is replayable
// for 120 s and the run id is the canary address, so neither belongs in a
// third party's storage.

export const REDACTED = "[Filtered]";

const SYNTH_KEY = /^x-dd-synth/i;
// `X-DD-Synth-Sig: v1=abc`, `"x-dd-synth-sig":"v1=abc"`, `x-dd-synth-sig=abc`
const SYNTH_INLINE = /(x-dd-synth[\w-]*["']?\s*[:=]\s*["']?)[^\s"',;}&]+/gi;

/** Redacts `X-DD-Synth*` entries from a header bag. Returns a new plain object. */
export function scrubHeaders(headers: Headers | Record<string, unknown> | [string, string][]): Record<string, unknown> {
  const entries: [string, unknown][] =
    typeof (headers as Headers).forEach === "function" && !Array.isArray(headers)
      ? (() => {
          const acc: [string, unknown][] = [];
          (headers as Headers).forEach((v, k) => acc.push([k, v]));
          return acc;
        })()
      : Array.isArray(headers)
        ? headers
        : Object.entries(headers as Record<string, unknown>);
  const out: Record<string, unknown> = {};
  for (const [k, v] of entries) out[k] = SYNTH_KEY.test(k) ? REDACTED : v;
  return out;
}

/** Redacts synth headers written into free text, such as a log line or a curl command. */
export function scrubString(text: string): string {
  return text.replace(SYNTH_INLINE, `$1${REDACTED}`);
}

/**
 * Deep copy with every `x-dd-synth*` key redacted and synth headers inside
 * strings redacted too. Cycle-safe. Use it on log objects.
 */
export function scrubDeep<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (typeof value === "string") return scrubString(value) as T;
  if (typeof value !== "object" || value === null) return value;
  if (seen.has(value)) return seen.get(value) as T;
  if (Array.isArray(value)) {
    const arr: unknown[] = [];
    seen.set(value, arr);
    for (const item of value) arr.push(scrubDeep(item, seen));
    return arr as T;
  }
  if (typeof (value as unknown as Headers).forEach === "function" && typeof (value as unknown as Headers).get === "function") {
    return scrubHeaders(value as unknown as Headers) as T;
  }
  const out: Record<string, unknown> = {};
  seen.set(value, out);
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SYNTH_KEY.test(k) ? REDACTED : scrubDeep(v, seen);
  }
  return out as T;
}

/**
 * Drop-in for Sentry's `beforeSend` / `beforeSendTransaction` / `beforeBreadcrumb`:
 *
 *   Sentry.init({ beforeSend: scrubSentryEvent })
 *
 * Returns a scrubbed copy of the event (request headers, breadcrumbs, extra,
 * contexts, message and exception text all included).
 */
export function scrubSentryEvent<T>(event: T): T {
  return scrubDeep(event);
}
