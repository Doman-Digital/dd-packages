import type { BrowserContext, Page } from "playwright";
import type { AccessConfig, Panel } from "./config.js";

/**
 * Cloudflare Access in headers mode (see AccessConfig): for an Access organisation that issues no session cookie to a
 * service token, so the token has to go on each request instead. It goes only to the origins the panel names, never to
 * a payment form, a sign-in provider or an analytics host, which would be offered a secret.
 *
 * Playwright runs a route handler only for the first URL of a redirect chain, and a request override (route.continue's
 * headers) is not carried to the redirected request. So a site that bounces through a sign-in handshake (target, sign-in
 * host, back to target) would reach Access without the token on the hop back. Each navigation to a routed host is
 * therefore fetched here one hop at a time, the token added only for the token origins, and a redirect is handed to the
 * browser as a small page that keeps the hop's cookies and moves on with location.replace. That next hop is a new
 * navigation, so this handler sees it too.
 */
export interface HeaderAccess {
  headers: Record<string, string>;
  origins: Set<string>;
  followHosts: string[];
}

/** Marks the stand-in page a redirect is handed over as; BrowserSession waits until none is showing. */
export const BOUNCE_MARK = "buyer-panel-access-bounce";
const MAX_BOUNCES = 20;

export const isHeaderMode = (a: AccessConfig | undefined): boolean => a?.mode === "headers";

/** The token and where it may go, from the environment. Undefined unless the panel uses headers mode. */
export function headerAccess(panel: Panel): HeaderAccess | undefined {
  const a = panel.target.access;
  if (!a || !isHeaderMode(a)) return undefined;
  const id = process.env[a.idEnv];
  const secret = process.env[a.secretEnv];
  if (!id || !secret) throw new Error(`Access token missing: set ${a.idEnv} and ${a.secretEnv}`);
  return {
    headers: { "CF-Access-Client-Id": id, "CF-Access-Client-Secret": secret },
    origins: new Set(a.origins?.length ? a.origins : [new URL(panel.target.origin).origin]),
    followHosts: a.followHosts ?? [],
  };
}

/** The token headers for a URL on a token origin (scheme, host and port all equal), else none. */
export function tokenFor(url: string | URL, a: HeaderAccess): Record<string, string> {
  return a.origins.has(new URL(String(url)).origin) ? a.headers : {};
}

const hostMatches = (host: string, pattern: string): boolean =>
  pattern.startsWith(".") ? host.endsWith(pattern) && host.length > pattern.length : host === pattern;

/** Whether the route handler takes a URL: a token origin, or a follow host. */
export function routed(url: URL, a: HeaderAccess): boolean {
  return a.origins.has(url.origin) || a.followHosts.some((h) => hostMatches(url.hostname, h));
}

/**
 * Routes a context's requests for headers mode. Returns the problems found as they happen (a navigation that could not
 * be fetched, a redirect loop); the session fails on any.
 */
export async function applyHeaderAccess(context: BrowserContext, a: HeaderAccess): Promise<string[]> {
  const problems: string[] = [];
  let bounces: string[] = [];
  await context.route(
    (u) => routed(u, a),
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      try {
        if (!request.isNavigationRequest()) {
          // A sub-request: the override applies to this request only, never to a redirect it causes.
          const token = tokenFor(url, a);
          await (Object.keys(token).length ? route.continue({ headers: { ...request.headers(), ...token } }) : route.continue());
          return;
        }
        const response = await route.fetch({ headers: { ...request.headers(), ...tokenFor(url, a) }, maxRedirects: 0 });
        const location = response.status() >= 300 && response.status() < 400 ? response.headers()["location"] : undefined;
        if (!location) {
          bounces = [];
          await route.fulfill({ response });
          return;
        }
        bounces.push(`${response.status()} ${url.host}${url.pathname}`);
        if (bounces.length > MAX_BOUNCES) {
          problems.push(`redirect loop: ${bounces.slice(-6).join(" -> ")}`);
          bounces = [];
          await route.abort();
          return;
        }
        const next = new URL(location, url).toString();
        const setCookie = response
          .headersArray()
          .filter((h) => h.name.toLowerCase() === "set-cookie")
          .map((h) => h.value);
        await route.fulfill({
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", ...(setCookie.length ? { "set-cookie": setCookie.join("\n") } : {}) },
          body: `<!doctype html><meta name="${BOUNCE_MARK}"><script>location.replace(${JSON.stringify(next)})</script>`,
        });
      } catch (error) {
        // Never throw from a route handler: it stalls the page.
        problems.push(`navigation to ${url.host}${url.pathname} failed: ${(error as Error).message}`);
        await route.abort().catch(() => undefined);
      }
    },
  );
  return problems;
}

/** Waits until the page is no longer one of the stand-in redirect pages (or the time runs out). */
export async function waitOutBounces(page: Page, timeoutMs = 30_000): Promise<void> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const bouncing = await page
      .locator(`meta[name="${BOUNCE_MARK}"]`)
      .count()
      .catch(() => 1); // mid-navigation: try again
    if (bouncing === 0) {
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      return;
    }
    await page.waitForTimeout(150);
  }
  throw new Error(`still redirecting after ${timeoutMs / 1000}s at ${page.url()}`);
}

/**
 * One request per token origin before the run, outside the browser, so a refused token stops the run at once rather
 * than in every session. A redirect is fine (a sign-in handshake, say) unless it is to Access's own login.
 */
export async function probeHeaderAccess(panel: Panel, a: HeaderAccess): Promise<void> {
  for (const origin of a.origins) {
    const path = origin === new URL(panel.target.origin).origin ? panel.target.start : "/";
    const res = await fetch(new URL(path, origin), { redirect: "manual", headers: a.headers });
    const location = res.headers.get("location") ?? "";
    let toLogin = false;
    try {
      toLogin = !!location && new URL(location, origin).hostname.endsWith("cloudflareaccess.com");
    } catch {
      toLogin = false;
    }
    if (res.status === 401 || res.status === 403 || toLogin) throw new Error(`Access refused the service token at ${origin} (HTTP ${res.status}${toLogin ? ", sent to the Access login" : ""})`);
  }
}
