/**
 * `@domandigital/craft/audit`: capture a snapshot of a live page and judge it.
 *
 * The only part of craft that needs a browser, so the only part that imports
 * one, and only when called. `playwright` (or `playwright-core`) is an
 * optional peer dependency: the core import stays pure, and a machine without
 * a browser can still judge a snapshot someone else captured.
 */

import { auditSnapshot } from "../character/check.js";
import { fingerprint } from "../fingerprint/index.js";
import { SNAPSHOT_VERSION, type Snapshot } from "../snapshot/types.js";
import { collectInPage, overlayInPage } from "./collect.js";
import type { CheckOptions, CheckReport } from "../character/types.js";
import type { Fingerprint } from "../fingerprint/index.js";

export { collectInPage, overlayInPage } from "./collect.js";

export interface SnapshotOptions {
  viewport?: { width: number; height: number };
  /** How long an intro may run before it counts as one. Default 5000 ms. */
  introWindowMs?: number;
  /** A Chromium to launch instead of Playwright's own. Also read from CRAFT_CHROMIUM. */
  executablePath?: string;
  timeoutMs?: number;
}

interface MinimalPage {
  close?(): Promise<void>;
  goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  evaluate<R>(fn: () => R): Promise<R>;
  waitForTimeout(ms: number): Promise<void>;
}

interface MinimalBrowser {
  newPage(options?: { viewport?: { width: number; height: number } }): Promise<MinimalPage>;
  close(): Promise<void>;
}

type Launcher = {
  chromium: { launch(options?: { executablePath?: string; headless?: boolean; proxy?: { server: string } }): Promise<MinimalBrowser> };
};

/** Playwright, whichever flavour is installed, or a clear error saying how to get it. */
export async function loadPlaywright(): Promise<Launcher> {
  for (const name of ["playwright", "playwright-core"]) {
    try {
      return (await import(/* @vite-ignore */ name)) as Launcher;
    } catch {
      // try the next one
    }
  }
  throw new Error("craft audit needs a browser. Install one: npm i -D playwright && npx playwright install chromium");
}

/**
 * Capture a snapshot from a page someone else is already driving. The caller
 * owns the browser; craft only measures.
 */
export async function snapshotPage(page: MinimalPage, url: string, options: SnapshotOptions = {}): Promise<Snapshot> {
  // An intro covers the page at first paint and is gone a few seconds later.
  // A cookie wall covers it at both moments, so it does not count.
  const early = await page.evaluate(overlayInPage).catch(() => false);
  await page.waitForTimeout(options.introWindowMs ?? 5000);
  const late = await page.evaluate(overlayInPage).catch(() => false);
  const data = await page.evaluate(collectInPage);
  return {
    version: SNAPSHOT_VERSION,
    url,
    capturedAt: new Date().toISOString(),
    ...data,
    motion: { ...data.motion, introOverlay: early && !late },
  };
}

async function launch(pw: Launcher, url: string, options: SnapshotOptions): Promise<MinimalBrowser> {
  // Read without Node's types, so the declarations build for any consumer.
  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
  const executablePath = options.executablePath ?? env.CRAFT_CHROMIUM ?? undefined;
  // Chromium ignores HTTPS_PROXY unless told; a machine behind a proxy would
  // otherwise time out on every page and report nothing.
  // Playwright sends loopback through the proxy whatever the bypass list says,
  // so a host that should not be proxied gets no proxy at all.
  const host = new URL(url).hostname;
  const noProxy = [`localhost`, `127.0.0.1`, `::1`, ...(env.NO_PROXY ?? env.no_proxy ?? "").split(",")].map((h) => h.trim().replace(/^\*?\./, "")).filter(Boolean);
  const direct = /^(?:localhost|127\.|\[?::1\]?$)/.test(host) || noProxy.some((h) => host === h || host.endsWith(`.${h}`));
  const proxy = direct ? undefined : env.HTTPS_PROXY ?? env.https_proxy;
  return pw.chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}), ...(proxy ? { proxy: { server: proxy } } : {}) });
}

/** Launch a browser, open `url`, and capture a snapshot. */
export async function snapshotUrl(url: string, options: SnapshotOptions = {}): Promise<Snapshot> {
  const [result] = await snapshotUrls([url], options);
  if (!result.snapshot) throw new Error(result.error);
  return result.snapshot;
}

export interface SnapshotResult {
  url: string;
  snapshot?: Snapshot;
  /** Why this page has no snapshot. The others are still taken. */
  error?: string;
}

/**
 * Several pages through one browser, in order. A null model is twenty pages;
 * launching Chromium twenty times is most of the wait. One page that will not
 * load costs that page, not the batch.
 */
export async function snapshotUrls(urls: string[], options: SnapshotOptions = {}): Promise<SnapshotResult[]> {
  if (urls.length === 0) return [];
  const pw = await loadPlaywright();
  const browser = await launch(pw, urls[0], options);
  const out: SnapshotResult[] = [];
  try {
    for (const url of urls) {
      const page = await browser.newPage({ viewport: options.viewport ?? { width: 1440, height: 900 } });
      try {
        const response = (await page.goto(url, { waitUntil: "domcontentloaded", timeout: options.timeoutMs ?? 45000 })) as { status?(): number } | null;
        // An error page is not the page. Measuring it would report a 404 as a
        // clean page, and a page not measured never counts as a pass.
        const status = typeof response?.status === "function" ? response.status() : 200;
        if (status >= 400) throw new Error(`HTTP ${status}`);
        out.push({ url, snapshot: await snapshotPage(page, url, options) });
      } catch (error) {
        out.push({ url, error: (error as Error).message });
      } finally {
        await page.close?.();
      }
    }
    return out;
  } finally {
    await browser.close();
  }
}

export interface AuditResult {
  snapshot: Snapshot;
  report: CheckReport;
  fingerprint: Fingerprint;
}

/** Snapshot a URL, judge it against the rendered tells, and fingerprint it. */
export async function audit(url: string, options: SnapshotOptions & CheckOptions = {}): Promise<AuditResult> {
  const snapshot = await snapshotUrl(url, options);
  return { snapshot, report: auditSnapshot(snapshot, options), fingerprint: fingerprint(snapshot) };
}
