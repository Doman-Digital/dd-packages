// The consent record and the Cloudflare Web Analytics loader that every new
// site gets (templates/shared/lib), run against a stand-in window and document.
// The rule: docs/web-analytics.md in claude-kit (DOM-1060). Every case below
// is one sentence of it: the beacon loads for a first visit with empty storage,
// Accept and Reject do not govern it, an objection stops it, switching it back
// on restarts it, and a v1 record still works.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { PACKAGE_ROOT } from "./fixtures";

// Loaded by path, not imported: the templates are written for a site, which has
// the DOM library and the ~site keys, and this package typechecks without them.
const template = (file: string) => join(PACKAGE_ROOT, "templates", "shared", "lib", file);
type Record2 = { measurement: boolean; statistics: boolean; decidedAt: string; version: "v2" };
type Consent = {
  getConsent: () => Record2 | null;
  getStatistics: () => boolean;
  parseConsent: (raw: string | null) => Record2 | null;
  setConsent: (measurement: boolean, statistics?: boolean) => Record2;
};
type Analytics = {
  BEACON_SRC: string;
  loadBeacon: (token: string | null | undefined, options?: { spa?: boolean }) => boolean;
  startWebAnalytics: (token: string | null | undefined, options?: { spa?: boolean }) => () => void;
};
const { getConsent, getStatistics, parseConsent, setConsent } = (await import(/* @vite-ignore */ template("consent.ts"))) as Consent;
const { BEACON_SRC, loadBeacon, startWebAnalytics } = (await import(/* @vite-ignore */ template("web-analytics.ts"))) as Analytics;

const KEY = "dd-cookie-consent";
const TOKEN = "test-site-token";
const V1 = JSON.stringify({ measurement: true, decidedAt: "2026-01-02T03:04:05.000Z", version: "v1" });

type Script = { src?: string; defer?: boolean; attrs: Record<string, string> };
let scripts: Script[];
let store: Map<string, string>;

function browser(opts: { stored?: string; blocked?: boolean } = {}) {
  store = new Map(opts.stored === undefined ? [] : [[KEY, opts.stored]]);
  scripts = [];
  const localStorage = {
    getItem: (key: string) => {
      if (opts.blocked) throw new Error("blocked");
      return store.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      if (opts.blocked) throw new Error("blocked");
      store.set(key, String(value));
    },
  };
  Object.assign(globalThis, {
    window: Object.assign(new EventTarget(), { localStorage }),
    document: {
      head: { append: (el: Script) => scripts.push(el) },
      createElement: (): Script => {
        const el: Script = { attrs: {} };
        return Object.assign(el, { setAttribute: (k: string, v: string) => (el.attrs[k] = v) });
      },
      querySelector: () => scripts.find((s) => s.attrs["data-cf-beacon"]) ?? null,
    },
  });
}

beforeEach(() => browser());

describe("the consent record", () => {
  test("with no record, Visit statistics are on and measurement is off", () => {
    expect(getConsent()).toBeNull();
    expect(getStatistics()).toBe(true);
  });

  test("with storage blocked, Visit statistics are still on", () => {
    browser({ blocked: true });
    expect(getConsent()).toBeNull();
    expect(getStatistics()).toBe(true);
  });

  test("an objection is saved and read back, and leaves measurement alone", () => {
    setConsent(false, false);
    expect(JSON.parse(store.get(KEY)!)).toMatchObject({ measurement: false, statistics: false, version: "v2" });
    expect(getStatistics()).toBe(false);
    expect(getConsent()?.measurement).toBe(false);
  });

  test("Accept and Reject keep an objection, and leave Visit statistics on when nobody objected", () => {
    setConsent(false, false);
    setConsent(true);
    expect(getStatistics()).toBe(false);
    setConsent(false);
    expect(getStatistics()).toBe(false);
    browser();
    setConsent(true);
    expect(getStatistics()).toBe(true);
    setConsent(false);
    expect(getStatistics()).toBe(true);
  });

  test("the two choices are separate", () => {
    setConsent(true, false);
    expect([getConsent()?.measurement, getConsent()?.statistics]).toEqual([true, false]);
    setConsent(false, true);
    expect([getConsent()?.measurement, getConsent()?.statistics]).toEqual([false, true]);
  });

  test("a v1 record is read as v2 with Visit statistics on, its measurement choice and date kept", () => {
    browser({ stored: V1 });
    expect(getConsent()).toEqual({ measurement: true, statistics: true, decidedAt: "2026-01-02T03:04:05.000Z", version: "v2" });
    expect(getStatistics()).toBe(true);
  });

  test("a v1 record with measurement refused stays refused", () => {
    browser({ stored: JSON.stringify({ measurement: false, decidedAt: "x", version: "v1" }) });
    expect(getConsent()?.measurement).toBe(false);
  });

  test("saving over a v1 record writes v2, and an objection then holds", () => {
    browser({ stored: V1 });
    setConsent(true, false);
    expect(JSON.parse(store.get(KEY)!).version).toBe("v2");
    expect(getStatistics()).toBe(false);
  });

  test("a v2 record without a usable statistics value is read as on", () => {
    expect(parseConsent(JSON.stringify({ measurement: false, decidedAt: "x", version: "v2" }))?.statistics).toBe(true);
    expect(parseConsent(JSON.stringify({ measurement: false, statistics: "no", decidedAt: "x", version: "v2" }))?.statistics).toBe(true);
  });

  test("values that are not a choice read as no record", () => {
    for (const raw of [null, "", "not json", "null", "[]", '"v2"', JSON.stringify({ version: "v3", measurement: true }), JSON.stringify({ version: "v2" }), JSON.stringify({ version: "v1", measurement: "yes" })]) {
      expect(parseConsent(raw), String(raw)).toBeNull();
    }
  });

  test("saving fires the consent event with the new record, even with storage blocked", () => {
    browser({ blocked: true });
    let seen: unknown = null;
    (globalThis as unknown as { window: EventTarget }).window.addEventListener("dd-cookie-consent", (event) => (seen = (event as CustomEvent).detail));
    const record = setConsent(false, false);
    expect(seen).toEqual(record);
  });
});

describe("the beacon", () => {
  test("loads on a first visit with empty storage, from the manual script's exact path", () => {
    startWebAnalytics(TOKEN);
    expect(scripts).toHaveLength(1);
    expect(scripts[0]!.src).toBe("https://static.cloudflareinsights.com/beacon.min.js");
    expect(BEACON_SRC).toBe(scripts[0]!.src);
    expect(scripts[0]!.defer).toBe(true);
    expect(JSON.parse(scripts[0]!.attrs["data-cf-beacon"]!)).toEqual({ token: TOKEN });
  });

  test("asks to count route changes only when told the site is client-routed", () => {
    startWebAnalytics(TOKEN, { spa: true });
    expect(JSON.parse(scripts[0]!.attrs["data-cf-beacon"]!)).toEqual({ token: TOKEN, spa: true });
  });

  test("is not governed by Accept or Reject", () => {
    for (const accept of [false, true]) {
      browser();
      setConsent(accept);
      startWebAnalytics(TOKEN);
      expect(scripts, `accept=${accept}`).toHaveLength(1);
    }
  });

  test("does not load once the visitor has objected, even after Accept all", () => {
    setConsent(false, false);
    startWebAnalytics(TOKEN);
    expect(scripts).toHaveLength(0);
    setConsent(true);
    startWebAnalytics(TOKEN);
    expect(scripts).toHaveLength(0);
  });

  test("restarts on this page when Visit statistics are switched back on, once", () => {
    setConsent(false, false);
    startWebAnalytics(TOKEN);
    setConsent(false, true);
    expect(scripts).toHaveLength(1);
    setConsent(true, true);
    expect(scripts).toHaveLength(1);
  });

  test("an objection made while the page is open adds nothing, and the stop function ends the listening", () => {
    startWebAnalytics(TOKEN);
    setConsent(false, false);
    expect(scripts).toHaveLength(1);
    browser();
    setConsent(false, false);
    const stop = startWebAnalytics(TOKEN);
    stop();
    setConsent(false, true);
    expect(scripts).toHaveLength(0);
  });

  test("a site with no token loads nothing", () => {
    expect(loadBeacon(null)).toBe(false);
    expect(loadBeacon("")).toBe(false);
    expect(scripts).toHaveLength(0);
  });
});

describe("the notice wording", () => {
  const read = (file: string) => readFileSync(join(PACKAGE_ROOT, "templates", file), "utf8");
  /** The text of the Visit statistics paragraph, as a reader sees it. */
  const notice = (file: string) => {
    const text = read(file);
    const start = text.indexOf("<strong>Visit statistics (Cloudflare Web Analytics).</strong>");
    const end = text.indexOf("</p>", start);
    return text
      .slice(start, end)
      .replace("<CookieSettingsLink />", "cookie settings")
      .replace(/<[^>]+>/g, " ")
      .replace(/\{" "\}|&apos;/g, (m) => (m === "&apos;" ? "'" : " "))
      .replace(/\s+/g, " ")
      .replace(/ \./g, ".")
      .trim();
  };

  test("is the same in the Next and Astro privacy pages, and carries the rule's sentences", () => {
    const next = notice("next/app/privacy/page.tsx");
    expect(next).toBe(notice("astro/pages/privacy.astro"));
    for (const sentence of [
      "Visit statistics (Cloudflare Web Analytics).",
      "Cloudflare runs this for us as our processor.",
      "It sets no cookies and stores nothing on your device.",
      "Cloudflare keeps these statistics for up to six months, and we keep daily totals.",
      "we'll stop.",
      "Our lawful basis is our legitimate interest in understanding and improving the site.",
    ]) {
      expect(next, sentence).toContain(sentence);
    }
  });

  test("the cookie page has the row, in both frameworks", () => {
    for (const file of ["next/app/cookies/page.tsx", "astro/pages/cookies.astro"]) {
      const text = read(file);
      for (const cell of ["Cloudflare Web Analytics", "Visit statistics", "None (no cookie or local storage)"]) expect(text, `${file}: ${cell}`).toContain(cell);
    }
  });

  test("both banners say in one line that visit statistics run without cookies and can be switched off", () => {
    for (const file of ["next/components/CookieBanner.tsx", "astro/components/CookieBanner.astro"]) {
      expect(read(file).replace(/\s+/g, " ")).toContain("Visit statistics run without cookies and you can switch them off in settings.");
    }
  });
});
