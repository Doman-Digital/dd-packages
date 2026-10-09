import { describe, expect, it } from "vitest";
import { browserOptions } from "../browser";
import { cloudflareOptions } from "../cloudflare";
import { DATA_COLLECTION, DENY_URLS, IGNORE_ERRORS, INGEST_HOST } from "../index";
import { nextClientOptions, nextEdgeOptions, nextServerOptions } from "../next";

const DSN = "https://k@o4511373625655296.ingest.de.sentry.io/42";

describe("the defaults", () => {
  it("sets environment, release, DSN, no PII and the shared filters", () => {
    const o = cloudflareOptions({ env: { SENTRY_DSN: DSN, SENTRY_ENVIRONMENT: "production", SENTRY_RELEASE: "abc123" } });
    expect(o).toMatchObject({
      dsn: `https://k@${INGEST_HOST}/42`,
      environment: "production",
      release: "abc123",
      tracesSampleRate: 0.1,
    });
    expect(o.ignoreErrors).toEqual(IGNORE_ERRORS);
    expect(o.denyUrls).toEqual(DENY_URLS);
    expect(typeof o.beforeSend).toBe("function");
    expect(typeof o.beforeSendSpan).toBe("function");
    expect("beforeSendTransaction" in o).toBe(false);
  });

  it("collects no personal data on v11 either, and lets a site loosen one part", () => {
    expect(browserOptions().dataCollection).toEqual(DATA_COLLECTION);
    expect(DATA_COLLECTION).toMatchObject({ userInfo: false, cookies: false, httpBodies: [], stackFrameVariables: false });
    expect(browserOptions({ dataCollection: { frameContextLines: 3 } }).dataCollection).toEqual({ ...DATA_COLLECTION, frameContextLines: 3 });
  });

  it("samples 5% of browser traces and 10% of server ones", () => {
    expect(browserOptions().tracesSampleRate).toBe(0.05);
    expect(nextClientOptions().tracesSampleRate).toBe(0.05);
    expect(nextServerOptions().tracesSampleRate).toBe(0.1);
    expect(nextEdgeOptions().tracesSampleRate).toBe(0.1);
    expect(browserOptions({ tracesSampleRate: 0.5 }).tracesSampleRate).toBe(0.5);
  });

  it("leaves out what it does not know, so the SDK's own defaults survive", () => {
    const o = browserOptions({});
    for (const key of ["dsn", "release", "enabled", "replaysSessionSampleRate", "replaysOnErrorSampleRate"]) {
      expect(key in o).toBe(false);
    }
    expect(Object.values(o).includes(undefined)).toBe(false);
  });

  it("turns itself off on a developer's machine", () => {
    expect(browserOptions({ environment: "development" }).enabled).toBe(false);
  });

  it("never turns on v10's default PII, whatever it is given", () => {
    // @ts-expect-error -- the input type only allows false
    expect("sendDefaultPii" in browserOptions({ sendDefaultPii: true })).toBe(false);
    expect("sendDefaultPii" in cloudflareOptions({ sendDefaultPii: false })).toBe(false);
  });

  it("sets replay rates in the browser only", () => {
    expect("replaysOnErrorSampleRate" in cloudflareOptions({ integrations: [{ name: "Replay" }] })).toBe(false);
  });

  it("adds a site's own filters to the shared ones and passes other options through", () => {
    const o = browserOptions({ ignoreErrors: ["Mine"], denyUrls: [/widget\.example/], tunnel: "/monitoring", debug: true });
    expect(o.ignoreErrors).toEqual([...IGNORE_ERRORS, "Mine"]);
    expect(o.denyUrls).toEqual([...DENY_URLS, /widget\.example/]);
    expect(o.tunnel).toBe("/monitoring");
    expect(o.debug).toBe(true);
    expect("env" in o).toBe(false);
    expect("firstPartyHosts" in o).toBe(false);
  });
});

describe("replay", () => {
  it("sets replay rates only when the Replay integration is there", () => {
    const replay = { name: "Replay" };
    expect(browserOptions({ integrations: [replay] })).toMatchObject({ replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 1 });
    const without = browserOptions({ integrations: [{ name: "BrowserTracing" }], replaysSessionSampleRate: 0.1 });
    expect("replaysSessionSampleRate" in without).toBe(false);
    expect(browserOptions({ integrations: [replay], replaysOnErrorSampleRate: 0.5 }).replaysOnErrorSampleRate).toBe(0.5);
  });
});

describe("beforeSend", () => {
  const event = () => ({ message: "for jo@example.com", request: { url: "https://site.example/" } });

  it("scrubs after the site's own hook, which can still drop", async () => {
    const seen: unknown[] = [];
    const o = browserOptions({
      beforeSend: (e: { message: string }) => {
        seen.push(e.message);
        return e.message.includes("drop") ? null : { ...e, tags: { added: "yes" } };
      },
    });
    expect(await o.beforeSend(event())).toMatchObject({ message: "for [REDACTED_EMAIL]", tags: { added: "yes" } });
    expect(seen).toEqual(["for jo@example.com"]);
    expect(await o.beforeSend({ message: "drop me" })).toBeNull();
  });

  it("scrubs what an async hook returns", async () => {
    const o = cloudflareOptions({ beforeSend: async (e: object) => e });
    expect(await o.beforeSend(event())).toMatchObject({ message: "for [REDACTED_EMAIL]" });
  });

});

describe("transactions and spans", () => {
  it("scrubs transactions in an integration, added to the site's own", () => {
    const mine = { name: "Mine" };
    const list = nextServerOptions({ integrations: [mine] }).integrations as { name: string; processEvent?: (e: object) => object }[];
    expect(list.map((i) => i.name)).toEqual(["Mine", "DomanDigitalScrubTransactions"]);
    const scrub = list[1]?.processEvent as (e: object) => object;
    expect(scrub({ type: "transaction", extra: { email: "a@b.co" } })).toEqual({ type: "transaction", extra: { email: "[REDACTED]" } });
    const error = { message: "a@b.co" };
    expect(scrub(error)).toBe(error);
  });

  it("keeps the function form of integrations working", () => {
    const fn = nextServerOptions({ integrations: (defaults: { name: string }[]) => defaults.filter((d) => d.name !== "Drop") }).integrations;
    expect(typeof fn).toBe("function");
    expect((fn as (d: object[]) => { name: string }[])([{ name: "Keep" }, { name: "Drop" }]).map((i) => i.name)).toEqual([
      "Keep",
      "DomanDigitalScrubTransactions",
    ]);
  });

  it("scrubs span names and attributes without changing their shape", () => {
    const o = browserOptions();
    const span = {
      span_id: "s",
      name: "GET /lookup?email=jo@example.com",
      attributes: { "url.full": "https://site.example/?email=jo@example.com", "http.request.header.cookie": "s=1", "http.status_code": 200 },
    };
    expect(o.beforeSendSpan(span)).toEqual({
      span_id: "s",
      name: "GET /lookup?email=[REDACTED_EMAIL]",
      attributes: { "url.full": "https://site.example/?email=[REDACTED_EMAIL]", "http.request.header.cookie": "[REDACTED]", "http.status_code": 200 },
    });
    expect(o.beforeSendSpan({ description: "x-dd-synth-sig: v1", data: { "x-dd-synth-run": "r" } })).toEqual({
      description: "x-dd-synth-sig: v1",
      data: { "x-dd-synth-run": "[REDACTED]" },
    });
    const own = (s: object) => s;
    expect(browserOptions({ beforeSendSpan: own }).beforeSendSpan).toBe(own);
  });
});

describe("third-party network errors", () => {
  const failed = (value: string, page = "https://www.site.example/contact") => ({
    exception: { values: [{ type: "TypeError", value }] },
    request: { url: page },
  });

  it("drops a failed fetch to another site in the browser", async () => {
    const o = browserOptions();
    expect(await o.beforeSend(failed("Failed to fetch (www.google-analytics.com)"))).toBeNull();
    expect(await o.beforeSend(failed("Load failed (widget.chat.example)"))).toBeNull();
  });

  it("keeps the site's own failures, unknown hosts and server-side ones", async () => {
    const o = browserOptions({ firstPartyHosts: ["api.partner.example"] });
    expect(await o.beforeSend(failed("Failed to fetch (site.example)"))).not.toBeNull();
    expect(await o.beforeSend(failed("Failed to fetch (api.site.example)"))).not.toBeNull();
    expect(await o.beforeSend(failed("Failed to fetch (api.partner.example)"))).not.toBeNull();
    expect(await o.beforeSend(failed("Failed to fetch"))).not.toBeNull();
    expect(await cloudflareOptions().beforeSend(failed("Failed to fetch (www.google-analytics.com)"))).not.toBeNull();
  });

  it("reads the host the SDK leaves on the error in report-only mode", async () => {
    const o = browserOptions();
    const hint = { originalException: Object.assign(new TypeError("Failed to fetch"), { __sentry_fetch_url_host__: "ads.example" }) };
    expect(await o.beforeSend(failed("Failed to fetch"), hint)).toBeNull();
  });
});
