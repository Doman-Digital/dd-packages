/// <reference types="node" />
/**
 * The preset against real Sentry clients, v10 and v11: the SDK's own filter
 * matching, hook order and envelope, with only the network replaced. If a
 * Sentry major changes how ignoreErrors, beforeSend or PII collection behave,
 * this is where it shows.
 */

import type { BrowserOptions } from "@sentry/browser";
import { replayIntegration } from "@sentry/browser";
import type { BrowserOptions as BrowserOptionsV10 } from "@sentry/browser-v10";
import { withSentry } from "@sentry/cloudflare";
import { replayIntegration as replayIntegrationV10 } from "@sentry/browser-v10";
import * as v11 from "@sentry/core";
import * as v11server from "@sentry/core/server";
import * as v10 from "@sentry/core-v10";
import * as v10server from "@sentry/core-v10/server";
import { describe, expect, it, vi } from "vitest";
import { browserOptions } from "../browser";
import { cloudflareOptions } from "../cloudflare";
import { nextClientOptions, nextServerOptions } from "../next";

const DSN = "https://public@o4511927792238592.ingest.de.sentry.io/1";

const sdks = [
  { major: "v10", core: v10 as unknown as typeof v11, server: v10server as unknown as typeof v11server },
  { major: "v11", core: v11, server: v11server },
];

describe.each(sdks)("through a real Sentry $major client", ({ core, server }) => {
  function start(options: { integrations?: unknown }) {
    const sent: Record<string, unknown>[] = [];
    const urls: string[] = [];
    core.initAndBind(server.ServerRuntimeClient, {
      ...options,
      integrations: [core.eventFiltersIntegration(), ...(options.integrations as [])],
      stackParser: core.createStackParser(server.nodeStackLineParser()),
      transport: (transportOptions) =>
        core.createTransport(transportOptions, async (request) => {
          urls.push(transportOptions.url);
          const lines = String(request.body).split("\n");
          // Envelope: header, then item header / item payload pairs.
          for (let i = 1; i + 1 < lines.length; i += 2) {
            const header = JSON.parse(lines[i] as string);
            if (header.type === "event") sent.push(JSON.parse(lines[i + 1] as string));
          }
          return { statusCode: 200 };
        }),
    } as Parameters<typeof core.initAndBind>[1]);
    return { sent, urls };
  }

  async function stop() {
    core.setUser(null);
    await core.close(1000);
  }

  it("drops the shared noise and keeps a real error", async () => {
    const { sent } = start(cloudflareOptions({ dsn: DSN, environment: "production", release: "abc123" }));
    core.captureException(new ReferenceError("googletag is not defined"));
    core.captureException(new Error('Failed to find Server Action "x". This request might be from an older or newer deployment.'));
    core.captureException(new TypeError("Cannot redefine property: ethereum"));
    core.captureException(new Error("Java object is gone"));
    core.captureException(new Error("Enquiry sink failed"));
    await core.flush(1000);
    await stop();
    expect(sent.map((e) => (e.exception as { values: { value: string }[] }).values[0]?.value)).toEqual(["Enquiry sink failed"]);
    expect(sent[0]).toMatchObject({ environment: "production", release: "abc123" });
  });

  it("sends to the org's own ingest host, with the customer's details scrubbed", async () => {
    const { sent, urls } = start(cloudflareOptions({ dsn: DSN, environment: "staging" }));
    core.setUser({ id: "u1", email: "jo@example.com" });
    core.captureMessage("Booking for jo@example.com on 07700 900123 failed");
    await core.flush(1000);
    await stop();
    expect(urls[0]).toContain("o4510784554991616.ingest.de.sentry.io");
    expect(sent[0]?.message).toBe("Booking for [REDACTED_EMAIL] on [REDACTED_PHONE] failed");
    expect(sent[0]?.user).toEqual({ id: "u1", email: "[REDACTED]" });
    expect(sent[0]?.environment).toBe("staging");
  });

  it("starts without a warning from the SDK", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      start(nextServerOptions({ dsn: DSN, environment: "production", beforeSend: (e) => e }));
      expect(warn.mock.calls.flat().filter((m) => String(m).includes("[Sentry]"))).toEqual([]);
    } finally {
      warn.mockRestore();
      await stop();
    }
  });

  it("sends nothing when the environment is a developer's machine", async () => {
    const { sent } = start(cloudflareOptions({ dsn: DSN, environment: "development" }));
    core.captureException(new Error("local"));
    await core.flush(1000);
    await stop();
    expect(sent).toEqual([]);
  });
});

describe("types", () => {
  it("are what each SDK's init accepts, on v10 and v11", () => {
    // Compile-time: a type error here fails `pnpm typecheck`.
    const browser: BrowserOptions = browserOptions({ dsn: DSN, integrations: [replayIntegration()] });
    const next: BrowserOptions = nextClientOptions({ dsn: DSN, tunnel: "/monitoring" });
    const server: BrowserOptions = nextServerOptions({ env: process.env, beforeSend: (event) => event });
    const browserV10: BrowserOptionsV10 = browserOptions({ dsn: DSN, integrations: [replayIntegrationV10()] });
    const serverV10: BrowserOptionsV10 = nextServerOptions({ env: process.env, beforeSend: (event) => event });
    expect(browser.replaysOnErrorSampleRate).toBe(1);
    expect(next.tunnel).toBe("/monitoring");
    expect(server.dataCollection?.userInfo).toBe(false);
    expect(browserV10.replaysOnErrorSampleRate).toBe(1);
    expect(serverV10.sendDefaultPii).toBeUndefined();
  });

  it("pass @sentry/cloudflare v11's strict withSentry, which rejects any key it does not know", () => {
    type Env = { SENTRY_DSN: string; SENTRY_ENVIRONMENT: string };
    const fetch = async () => new Response("ok");
    const handler = withSentry((env: Env) => cloudflareOptions({ env }), { fetch });
    // The check is live: one unknown key and it fails.
    // @ts-expect-error -- sendDefaultPii is not a v11 option
    withSentry((env: Env) => ({ ...cloudflareOptions({ env }), sendDefaultPii: false }), { fetch });
    expect(typeof handler.fetch).toBe("function");
  });
});
