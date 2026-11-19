import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { chromium, type Browser } from "playwright";
import { afterAll, describe, expect, it } from "vitest";
import { blockReason, isPaymentHost, WriteGuard } from "../guard.js";

describe("blockReason", () => {
  const req = (method: string, url: string, resourceType = "fetch") => ({ method, url, resourceType });
  it("lets reads through", () => {
    expect(blockReason(req("GET", "https://shop.example.org/", "document"))).toBeUndefined();
    expect(blockReason(req("HEAD", "https://shop.example.org/a.css", "stylesheet"))).toBeUndefined();
    expect(blockReason(req("get", "https://cdn.sanity.io/images/x.jpg", "image"))).toBeUndefined();
  });
  it("blocks every write method", () => {
    for (const m of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) expect(blockReason(req(m, "https://shop.example.org/api/waitlist"))).toBe("write-method");
  });
  it("blocks payment hosts even for GET, and their subdomains", () => {
    expect(blockReason(req("GET", "https://checkout.stripe.com/c/pay/cs_live_1", "document"))).toBe("payment-host");
    expect(blockReason(req("GET", "https://js.stripe.com/v3/", "script"))).toBe("payment-host");
    expect(blockReason(req("POST", "https://api.stripe.com/v1/payment_methods"))).toBe("payment-host");
    expect(isPaymentHost("notstripe.com")).toBe(false);
    expect(isPaymentHost("stripe.com.example.org")).toBe(false);
  });
  it("blocks beacons, GET or not, and URLs it cannot read", () => {
    expect(blockReason(req("GET", "https://example.org/p", "ping"))).toBe("beacon");
    expect(blockReason(req("POST", "https://eu.i.posthog.com/e/", "ping"))).toBe("beacon");
    expect(blockReason(req("GET", "not a url"))).toBe("unreadable-url");
  });
});

describe("WriteGuard bookkeeping", () => {
  it("always keeps a form, payment or same-site write, and caps only third-party noise", () => {
    const g = new WriteGuard("https://shop.example.org");
    const add = (e: { kind: "request" | "form"; reason: string; url: string }) =>
      (g as unknown as { add(x: unknown): void }).add({ method: "POST", resourceType: "fetch", page: "", ...e });
    for (let i = 0; i < 400; i++) add({ kind: "request", reason: "write-method", url: "https://eu.i.posthog.com/e/" });
    add({ kind: "form", reason: "form-submit", url: "https://shop.example.org/waitlist" });
    add({ kind: "request", reason: "write-method", url: "https://shop.example.org/api/enquiry" });
    add({ kind: "request", reason: "payment-host", url: "https://checkout.stripe.com/x" });
    expect(g.total).toBe(403);
    expect(g.blocked).toHaveLength(303);
    expect(g.noticeable(0).map((b) => b.reason)).toEqual(["form-submit", "write-method", "payment-host"]);
    expect(g.note(0)).toContain("read-only");
    expect(g.note(g.blocked.length)).toBe("");
  });
});

// Needs Chromium, like click-duplicates.test.ts: skipped where there is none, run by the Browser workflow.
let browser: Browser | undefined;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.BUYER_PANEL_CHROMIUM || undefined });
} catch {
  browser = undefined;
}

let server: Server | undefined;
const writes: string[] = [];
const reads: string[] = [];

afterAll(async () => {
  await browser?.close();
  await new Promise<void>((r) => (server ? server.close(() => r()) : r()));
});

const PAGE = `<!doctype html><meta charset="utf-8"><title>Guard fixture</title><body>
<form id="post" method="post" action="/waitlist"><input name="email" value="a@b.c"><button>Join the waitlist</button></form>
<form id="get" method="get" action="/search"><input name="q" value="x"><button>Search</button></form>
<form id="js" method="post" action="/js-submit"></form><form id="rs" method="post" action="/request-submit"></form>
<a id="pay" href="https://checkout.stripe.com/c/pay/cs_live_fixture">Pay now</a>
<script>
  fetch('/api/enquiry', { method: 'POST', body: 'hello' }).catch(() => {});
  fetch('/api/read').catch(() => {});
  navigator.sendBeacon('/beacon', 'x');
  document.getElementById('js').submit();
  document.getElementById('rs').requestSubmit();
  try { new WebSocket('ws://127.0.0.1:1/ws'); } catch {}
  fetch('https://api.stripe.com/v1/payment_intents', { method: 'POST', body: 'x', mode: 'no-cors' }).catch(() => {});
</script></body>`;

describe.skipIf(!browser)("the write guard in a real browser", () => {
  it("stops every kind of send before it reaches the server, and records each", async () => {
    server = createServer((req, res) => {
      (req.method === "GET" || req.method === "HEAD" ? reads : writes).push(`${req.method} ${req.url}`);
      res.setHeader("content-type", "text/html");
      res.end(req.url === "/" ? PAGE : "<!doctype html><title>x</title>ok");
    });
    await new Promise<void>((r) => server!.listen(0, "127.0.0.1", () => r()));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const context = await browser!.newContext({ serviceWorkers: "block" });
    const guard = new WriteGuard(origin);
    await guard.install(context);
    const page = await context.newPage();
    try {
      await page.goto(`${origin}/`, { waitUntil: "load" });
      await page.waitForTimeout(500);
      // A real tap on the real submit button, and on the payment link.
      await page.getByRole("button", { name: "Join the waitlist" }).click();
      await page.getByRole("button", { name: "Search" }).click();
      await page.waitForTimeout(300);
      // The forms stayed on the page: the buyer is not sent to a browser error page.
      expect(new URL(page.url()).origin).toBe(origin);
      // A payment link is aborted (the browser shows its own error page): nothing reaches Stripe.
      await page.getByRole("link", { name: "Pay now" }).click({ timeout: 3000 }).catch(() => undefined);
      await page.waitForTimeout(500);

      // Nothing that is not a GET ever reached the server, and the page itself loaded.
      expect(writes).toEqual([]);
      expect(reads).toContain("GET /");
      expect(reads.filter((r) => r.startsWith("GET /api/read"))).toHaveLength(1);
      const kinds = new Set(guard.blocked.map((b) => `${b.kind}:${b.reason}`));
      expect(kinds).toContain("request:write-method");
      expect(kinds).toContain("request:beacon");
      expect(kinds).toContain("request:payment-host");
      expect(kinds).toContain("form:form-submit");
      expect(kinds).toContain("websocket:websocket");
      // Both the native submit and form.submit() / requestSubmit() are recorded as forms.
      const forms = guard.blocked.filter((b) => b.kind === "form").map((b) => new URL(b.url).pathname);
      expect(forms).toEqual(expect.arrayContaining(["/waitlist", "/search", "/js-submit", "/request-submit"]));
      const posts = guard.blocked.filter((b) => b.reason === "write-method").map((b) => new URL(b.url).pathname);
      expect(posts).toContain("/api/enquiry");
      expect(guard.blocked.some((b) => b.reason === "payment-host" && b.url.startsWith("https://api.stripe.com/"))).toBe(true);
      expect(guard.total).toBe(guard.blocked.length);
    } finally {
      await context.close();
    }
  }, 30_000);
});
