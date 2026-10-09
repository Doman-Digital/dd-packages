/**
 * Noise every Doman Digital project drops. Each entry is here because the
 * 2026-10-08 audit found it in more than one client's Sentry, raised by code
 * nobody at Doman Digital wrote. Sentry matches a string as a substring of the
 * error's `Type: message` (or of the frame URL for `denyUrls`).
 */

export const IGNORE_ERRORS: ReadonlyArray<string | RegExp> = [
  // In-app browsers and wallet extensions poking at objects they injected.
  /\bethereum\b/i,
  "__firefox__",
  "webkit.messageHandlers",
  "Java object is gone",
  // Globals that tag managers, extensions and injected bars expect to exist.
  /\b(?:googletag|jQuery|zaius|eventTracker) is not defined\b/,
  /(?:^|[^\w$])\$ is not defined\b/,
  /Can't find variable: (?:googletag|jQuery|zaius|eventTracker|\$)(?![\w$])/,
  // Next.js after a deploy: an open tab posts to a server action the new build no longer has.
  "Failed to find Server Action",
  // The browser skipped a view transition (a second navigation, a hidden tab). Nothing broke.
  "Skipping view transition",
  "Transition was skipped",
];

export const DENY_URLS: ReadonlyArray<string | RegExp> = [
  // Errors whose top frame is in a browser extension, or Safari's mask for one.
  /^(?:chrome|moz|safari|safari-web|ms-browser)-extension:\/\//i,
  /^webkit-masked-url:/i,
  // Third-party scripts a site embeds and cannot fix.
  /googletagmanager\.com/i,
  /google-analytics\.com/i,
  /googlesyndication\.com/i,
  /connect\.facebook\.net/i,
  /static\.hotjar\.com/i,
  /clarity\.ms/i,
];

/** The bare network failures each browser throws from `fetch`. */
const NETWORK_FAILURE = /^(?:Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.)(?: \(([^)\s]+)\))?$/;

type Rec = Record<string, unknown>;
const isRec = (value: unknown): value is Rec => typeof value === "object" && value !== null;

function bareHost(host: string): string {
  return host.toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");
}

function hostOf(url: unknown): string | undefined {
  if (typeof url !== "string") return undefined;
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

function sameSite(a: string, b: string): boolean {
  const x = bareHost(a);
  const y = bareHost(b);
  return x === y || x.endsWith(`.${y}`) || y.endsWith(`.${x}`);
}

/**
 * True for a generic `Failed to fetch` / `Load failed` whose request went to
 * another site: an analytics beacon, a chat widget, an ad network, blocked by
 * the visitor's own browser. The Sentry SDK appends the host it was fetching
 * (`Failed to fetch (host)`), or leaves it on the error when
 * `enhanceFetchErrorMessages` is `"report-only"`. A failure on the site's own
 * host, or one whose host is unknown, is kept.
 */
export function isThirdPartyNetworkError(event: unknown, hint?: unknown, firstPartyHosts: readonly string[] = []): boolean {
  if (!isRec(event) || !isRec(event.exception) || !Array.isArray(event.exception.values)) return false;
  const values = event.exception.values.filter(isRec);
  const last = values[values.length - 1];
  if (!last || last.type !== "TypeError" || typeof last.value !== "string") return false;
  const match = NETWORK_FAILURE.exec(last.value);
  if (!match) return false;

  const original = isRec(hint) && isRec(hint.originalException) ? hint.originalException : undefined;
  const target = match[1] ?? (typeof original?.__sentry_fetch_url_host__ === "string" ? original.__sentry_fetch_url_host__ : undefined);
  if (!target) return false;

  const page = isRec(event.request) ? hostOf(event.request.url) : undefined;
  const ours = [...firstPartyHosts, ...(page ? [page] : [])];
  if (ours.length === 0) return false;
  return !ours.some((host) => sameSite(host, target));
}
