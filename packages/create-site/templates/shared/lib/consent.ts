// The visitor's cookie choice, shared by the banner and anything that sets a
// non-essential cookie. Written by @domandigital/create-site, from the
// dd-base banner (Doman-Digital/dd-library).
//
// Two states: strictly necessary only (the default, and what no answer
// means), or measurement as well. An analytics loader calls getConsent() and
// loads nothing unless measurement is true, then listens for CONSENT_EVENT so
// a choice made on this page takes effect without a reload. Refusing is as
// easy as accepting, and openCookieSettings() brings the banner back so a
// choice can be changed as easily as it was made (ICO guidance on PECR).

export const CONSENT_KEY = "dd-cookie-consent";
/** Fired on window with the new ConsentRecord as detail. */
export const CONSENT_EVENT = "dd-cookie-consent";
/** Fired on window to show the banner again. */
export const SETTINGS_EVENT = "dd-cookie-settings";

export type ConsentRecord = { measurement: boolean; decidedAt: string; version: "v1" };

export function getConsent(): ConsentRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentRecord;
    return parsed.version === "v1" && typeof parsed.measurement === "boolean" ? parsed : null;
  } catch {
    return null;
  }
}

export function setConsent(measurement: boolean): ConsentRecord {
  const record: ConsentRecord = { measurement, decidedAt: new Date().toISOString(), version: "v1" };
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
