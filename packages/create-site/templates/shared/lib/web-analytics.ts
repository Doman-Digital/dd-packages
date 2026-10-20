// Cloudflare Web Analytics, loaded for every visitor from the first page
// unless they have switched Visit statistics off in the cookie settings. Not
// behind the banner's Accept and Reject. Written by @domandigital/create-site,
// from the dd-base loader (Doman-Digital/dd-library).
//
// Manual beacon only: never turn on Cloudflare's automatic setup, which a
// visitor's objection cannot stop. The rule is docs/web-analytics.md in
// claude-kit. If the site sets a CSP it allows
//   script-src https://static.cloudflareinsights.com/beacon.min.js
//   connect-src https://cloudflareinsights.com

import { CONSENT_EVENT, getStatistics } from "~site/consent";
import type { ConsentRecord } from "~site/consent";

export const BEACON_SRC = "https://static.cloudflareinsights.com/beacon.min.js";

export type BeaconOptions = {
  /** True for a client-routed site: the beacon then counts route changes. */
  spa?: boolean;
};

/** Adds the beacon once. Returns true if it added it. A null token loads nothing. */
export function loadBeacon(token: string | null | undefined, options: BeaconOptions = {}): boolean {
  if (!token) return false;
  if (document.querySelector("script[data-cf-beacon]")) return false;
  const script = document.createElement("script");
  script.defer = true;
  script.src = BEACON_SRC;
  script.setAttribute("data-cf-beacon", JSON.stringify(options.spa ? { token, spa: true } : { token }));
  document.head.append(script);
  return true;
}

/**
 * Loads the beacon now unless the visitor has objected, and again if they
 * switch Visit statistics back on. Switching it off stops the beacon from the
 * next page, because a script already running cannot be recalled. Returns the
 * clean-up for the listener.
 */
export function startWebAnalytics(token: string | null | undefined, options: BeaconOptions = {}): () => void {
  if (getStatistics()) loadBeacon(token, options);
  const onChoice = (event: Event) => {
    if ((event as CustomEvent<ConsentRecord>).detail?.statistics) loadBeacon(token, options);
  };
  window.addEventListener(CONSENT_EVENT, onChoice);
  return () => window.removeEventListener(CONSENT_EVENT, onChoice);
}
