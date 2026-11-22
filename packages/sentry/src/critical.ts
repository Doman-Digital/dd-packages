/**
 * Critical paths: the steps where a failure costs a client money or a lead
 * (checkout, booking, an enquiry form). A failure there is reported at level
 * `fatal` with two tags, and one Sentry alert per project (created from the
 * estate registry's `critical:` row) watches for the tag and pages the
 * founder through the relay. Nothing else in a project carries the tag, so
 * the alert stays quiet until a customer is actually stuck.
 *
 *   critical_path    which path: `checkout`, `booking`, `enquiry`, ...
 *   critical_stage   where on it: `card-load`, `tokenize`, `confirm`, `csp`, ...
 *
 * Like the presets, this imports no Sentry SDK: the site hands over its own
 * `captureException`, so v10 and v11 both work and the browser bundle does
 * not gain a second copy of the SDK.
 */

/** The tag every critical-path alert filters on. Never set it by hand: use {@link criticalReporter}. */
export const CRITICAL_PATH_TAG = "critical_path";
/** The step on the path that failed. */
export const CRITICAL_STAGE_TAG = "critical_stage";

/** A path or stage name: lower case, digits and hyphens, so it reads the same in a tag, a fingerprint and an alert. */
const NAME = /^[a-z][a-z0-9-]{0,39}$/;

/** What `captureException` receives: the same in `@sentry/browser`, `@sentry/astro`, `@sentry/cloudflare` and `@sentry/nextjs`. */
export interface CriticalCaptureContext {
  level: "fatal";
  tags: Record<string, string>;
  fingerprint: string[];
  extra: Record<string, unknown>;
}

/** The site's own `Sentry.captureException`, or anything with that shape. */
export type CaptureException = (error: unknown, context: CriticalCaptureContext) => unknown;

function checkName(kind: string, value: string): string {
  if (!NAME.test(value)) throw new TypeError(`${kind} must be lower case letters, digits and hyphens (got ${JSON.stringify(value)})`);
  return value;
}

/**
 * The capture context for one critical failure. Exported so a site with its
 * own wrapper (a lazy-loaded Sentry chunk, a beacon) can send the same event.
 * The fingerprint groups by path and stage, so a hundred card declines are
 * one issue and the alert fires on every event in it, not only the first.
 */
export function criticalContext(path: string, stage: string, extra: Record<string, unknown> = {}): CriticalCaptureContext {
  checkName("path", path);
  checkName("stage", stage);
  return {
    level: "fatal",
    tags: { [CRITICAL_PATH_TAG]: path, [CRITICAL_STAGE_TAG]: stage },
    fingerprint: ["critical", path, stage],
    extra: { ...extra, critical_path: path, critical_stage: stage },
  };
}

/** A browser CSP violation, as much of it as this needs. */
export interface CspViolation {
  effectiveDirective: string;
  blockedURI: string;
  sourceFile?: string;
  disposition?: string;
}

export interface CriticalReporter {
  /** Reports one failure on a critical path. Never throws: a broken report must not break the checkout it describes. */
  criticalFailure(path: string, stage: string, error: unknown, extra?: Record<string, unknown>): void;
  /** Marks the visitor as being on a critical step (the card form is open). CSP blocks are reported only from here on. */
  enter(path: string, stage: string): void;
  /** The visitor has left the critical step (booked, or gone back). */
  leave(): void;
  /** The step the visitor is on, or null. */
  current(): { path: string; stage: string } | null;
}

/** Binds the site's `captureException`. One reporter per page. */
export function criticalReporter(capture: CaptureException): CriticalReporter {
  let at: { path: string; stage: string } | null = null;
  return {
    criticalFailure(path, stage, error, extra = {}) {
      try {
        const err = error instanceof Error ? error : new Error(`${path} failed at ${stage}: ${String(error)}`);
        capture(err, criticalContext(path, stage, extra));
      } catch {
        // Reporting failed (bad name, SDK not loaded). The visitor's checkout carries on.
      }
    },
    enter(path, stage) {
      at = { path: checkName("path", path), stage: checkName("stage", stage) };
    },
    leave() {
      at = null;
    },
    current: () => at,
  };
}

/** Scheme and host of a blocked URI, never its path or query (a bank's 3-D Secure URL carries session ids). */
export function blockedOrigin(uri: string | undefined): string {
  if (!uri) return "unknown";
  try {
    const u = new URL(uri);
    return u.origin === "null" ? u.protocol.replace(/:$/, "") : u.origin;
  } catch {
    return uri.split(/[/?#]/)[0] || "unknown";
  }
}

/** Anything with `addEventListener`: `document`, or a test double. */
export interface ViolationTarget {
  addEventListener(type: "securitypolicyviolation", listener: (event: CspViolation) => void): void;
  removeEventListener(type: "securitypolicyviolation", listener: (event: CspViolation) => void): void;
}

export interface WatchCspOptions {
  /** Directives that cannot break this path (an analytics `img-src`, say). Default: none, so every enforced block counts. */
  ignoreDirectives?: readonly string[];
  /** Called after a block is reported: the site's own fallback (send the visitor to the provider's hosted page). */
  onBlocked?: (violation: CspViolation, at: { path: string; stage: string }) => void;
}

/**
 * Reports a CSP block as a critical failure, but only while the reporter is
 * on a critical step: a tag blocked on page load is noise, the same block
 * while the card form is open is a customer who cannot pay. Report-only
 * violations are ignored, and each directive and origin is reported once per
 * page. Returns the function that stops watching.
 */
export function watchCriticalCsp(target: ViolationTarget, reporter: CriticalReporter, options: WatchCspOptions = {}): () => void {
  const ignore = new Set(options.ignoreDirectives ?? []);
  const seen = new Set<string>();
  const listener = (event: CspViolation) => {
    const at = reporter.current();
    if (!at || event.disposition === "report") return;
    if (ignore.has(event.effectiveDirective)) return;
    const blocked = blockedOrigin(event.blockedURI);
    const key = `${event.effectiveDirective} ${blocked}`;
    if (seen.has(key)) return;
    seen.add(key);
    reporter.criticalFailure(at.path, "csp", new Error(`CSP blocked ${key} during ${at.stage}`), {
      directive: event.effectiveDirective,
      blocked,
      source: blockedOrigin(event.sourceFile),
      during: at.stage,
    });
    options.onBlocked?.(event, at);
  };
  target.addEventListener("securitypolicyviolation", listener);
  return () => target.removeEventListener("securitypolicyviolation", listener);
}
