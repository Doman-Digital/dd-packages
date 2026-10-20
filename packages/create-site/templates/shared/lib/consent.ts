// The visitor's cookie choice, shared by the banner and anything that loads a
// tracker. Written by @domandigital/create-site, from the dd-base banner
// (Doman-Digital/dd-library).
//
// Two separate choices in one record:
//   measurement  the consent-based tools (GA4, PostHog, pixels). Off until the
//                visitor accepts; no record means off. A tool that sets or
//                reads identifiers calls getConsent() and loads nothing unless
//                measurement is true, then listens for CONSENT_EVENT so a
//                choice made on this page takes effect without a reload.
//   statistics   Visit statistics: Cloudflare Web Analytics, loaded by
//                lib/web-analytics.ts. On until the visitor objects; no record
//                means on. Accept and Reject never change it.
//
// Refusing is as easy as accepting, and openCookieSettings() brings the
// settings back so a choice can be changed as easily as it was made (ICO
// guidance on PECR). The rule is docs/web-analytics.md in claude-kit.
//
// A v1 record ({ measurement, decidedAt }) is read as v2 with statistics on,
// and is rewritten as v2 the next time the visitor saves a choice.

export const CONSENT_KEY = "dd-cookie-consent";
/** Fired on window with the new ConsentRecord as detail. */
export const CONSENT_EVENT = "dd-cookie-consent";
/** Fired on window to open the cookie settings. */
export const SETTINGS_EVENT = "dd-cookie-settings";

export type ConsentRecord = { measurement: boolean; statistics: boolean; decidedAt: string; version: "v2" };

/** Reads a stored value as a v2 record, migrating v1. Anything else is no record. */
export function parseConsent(raw: string | null): ConsentRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.version !== "v1" && parsed.version !== "v2") return null;
    if (typeof parsed.measurement !== "boolean") return null;
    return {
      measurement: parsed.measurement,
      statistics: parsed.version === "v2" && typeof parsed.statistics === "boolean" ? parsed.statistics : true,
      decidedAt: typeof parsed.decidedAt === "string" ? parsed.decidedAt : "",
      version: "v2",
    };
  } catch {
    return null;
  }
}

export function getConsent(): ConsentRecord | null {
  if (typeof window === "undefined") return null;
  try {
    return parseConsent(window.localStorage.getItem(CONSENT_KEY));
  } catch {
    return null;
  }
}

/** Visit statistics are on unless the visitor has switched them off. */
export function getStatistics(): boolean {
  return getConsent()?.statistics ?? true;
}

/** Saves a choice. Leaving `statistics` out keeps whatever it is now. */
export function setConsent(measurement: boolean, statistics: boolean = getStatistics()): ConsentRecord {
  const record: ConsentRecord = { measurement, statistics, decidedAt: new Date().toISOString(), version: "v2" };
  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify(record));
  } catch {
    // Storage blocked: the choice holds for this page, and the banner asks again next visit.
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: record }));
  return record;
}

export function openCookieSettings(): void {
  window.dispatchEvent(new Event(SETTINGS_EVENT));
}
