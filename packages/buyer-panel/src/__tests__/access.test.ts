import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyHeaderAccess, probeHeaderAccess, routed, tokenFor, waitOutBounces, type HeaderAccess } from "../access.js";
import { validatePanel, type Panel } from "../config.js";

const TOKEN = { "CF-Access-Client-Id": "test-id", "CF-Access-Client-Secret": "test-secret" };
const access = (origins: string[], followHosts: string[] = []): HeaderAccess => ({ headers: TOKEN, origins: new Set(origins), followHosts });

describe("Access headers mode: where the token goes", () => {
  const a = access(["https://staging.example.test"], [".signin.example"]);
  it("sends the token to a token origin only, matched on scheme, host and port", () => {
    expect(tokenFor("https://staging.example.test/book", a)).toEqual(TOKEN);
    expect(tokenFor("http://staging.example.test/book", a)).toEqual({});
    expect(tokenFor("https://staging.example.test:8443/book", a)).toEqual({});
    expect(tokenFor("https://evil.staging.example.test/", a)).toEqual({});
    expect(tokenFor("https://staging.example.test.evil.example/", a)).toEqual({});
  });
  it("routes the token origins and the follow hosts, and nothing else", () => {
    expect(routed(new URL("https://staging.example.test/x"), a)).toBe(true);
    expect(routed(new URL("https://abc.signin.example/handshake"), a)).toBe(true);
    expect(routed(new URL("https://signin.example/"), a)).toBe(false);
    expect(routed(new URL("https://pay.example/form"), a)).toBe(false);
  });
  it("never sends the token to a follow host", () => {
    expect(tokenFor("https://abc.signin.example/handshake", a)).toEqual({});
  });
});

describe("Access headers mode: panel config", () => {
  const raw = JSON.parse(readFileSync(fileURLToPath(new URL("../../panels/dd-redesign.json", import.meta.url)), "utf8")) as Panel;
  const target = (access: object) => ({ ...raw, target: { origin: "https://site.example", start: "/", access } }) as Panel;
  const env = { idEnv: "ID", secretEnv: "SECRET" };
  it("keeps cookie mode as the default", () => {
    expect(validatePanel(target(env)).target.access?.mode).toBeUndefined();
  });
  it("accepts headers mode with origins and follow hosts", () => {
    const p = validatePanel(target({ ...env, mode: "headers", origins: ["https://site.example", "https://book.example"], followHosts: [".signin.example"] }));
    expect(p.target.access?.origins).toHaveLength(2);
  });
  it("refuses an unknown mode, and origins or follow hosts without headers mode", () => {
    expect(() => validatePanel(target({ ...env, mode: "token" }))).toThrow(/mode must be/);
    expect(() => validatePanel(target({ ...env, origins: ["https://site.example"] }))).toThrow(/need mode "headers"/);
    expect(() => validatePanel(target({ ...env, followHosts: [".signin.example"] }))).toThrow(/need mode "headers"/);
  });
  it("refuses origins with a path or plain http, and follow hosts with a scheme", () => {
    expect(() => validatePanel(target({ ...env, mode: "headers", origins: ["https://site.example/"] }))).toThrow(/bare origin/);
    expect(() => validatePanel(target({ ...env, mode: "headers", origins: ["http://site.example"] }))).toThrow(/bare origin/);
    expect(() => validatePanel(target({ ...env, mode: "headers", followHosts: ["https://signin.example"] }))).toThrow(/host name/);
  });
  it("requires the target origin among the token origins", () => {
    expect(() => validatePanel(target({ ...env, mode: "headers", origins: ["https://book.example"] }))).toThrow(/must include target.origin/);
  });
});

// Two local servers stand in for a site behind Access (A, the token origin) and a sign-in provider (B, a follow host).
// A refuses anything without the token, sends a fresh visitor to B's handshake, and B sends them back with a code that
// A turns into a session cookie: the redirect chain that loses the token when it is left to the browser.
// B records any request that arrives with the token: the test fails if one does.
let browser: Browser | undefined;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.BUYER_PANEL_CHROMIUM || undefined });
} catch {
  browser = undefined;
}

const leaks: string[] = [];
const seenWithToken: string[] = [];
let A = "";
let B = "";
const servers: Server[] = [];

const listen = (host: string, handler: (req: IncomingMessage, res: ServerResponse) => void): Promise<string> =>
  new Promise((done) => {
    const s = createServer(handler);
    servers.push(s);
    s.listen(0, host, () => done(`http://${host}:${(s.address() as AddressInfo).port}`));
  });

const hasToken = (req: IncomingMessage) => req.headers["cf-access-client-id"] === "test-id" && req.headers["cf-access-client-secret"] === "test-secret";

beforeAll(async () => {
  A = await listen("127.0.0.1", (req, res) => {
    const url = new URL(req.url ?? "/", A);
    if (!hasToken(req)) {
      res.writeHead(302, { location: "https://team.cloudflareaccess.com/cdn-cgi/access/login" }).end();
      return;
    }
    seenWithToken.push(url.pathname);
    if (url.pathname === "/handshake-done") {
      res.writeHead(302, { location: "/start", "set-cookie": "sess=1; Path=/; HttpOnly" }).end();
      return;
    }
    if (url.pathname === "/pixel") {
      res.writeHead(302, { location: `${B}/pixel` }).end(); // a sub-request redirected off the token origin
      return;
    }
    if (url.pathname === "/img") {
      res.writeHead(200, { "content-type": "image/svg+xml" }).end('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');
      return;
    }
    if (!(req.headers.cookie ?? "").includes("sess=1")) {
      res.writeHead(302, { location: `${B}/handshake` }).end();
      return;
    }
    res.writeHead(200, { "content-type": "text/html" }).end(`<!doctype html><title>Signed in</title><h1>Signed in</h1><img src="/img"><img src="/pixel"><a href="${B}/elsewhere">Leave</a>`);
  });
  B = await listen("localhost", (req, res) => {
    if (req.headers["cf-access-client-id"] || req.headers["cf-access-client-secret"]) leaks.push(req.url ?? "");
    const url = new URL(req.url ?? "/", B);
    if (url.pathname === "/handshake") res.writeHead(302, { location: `${A}/handshake-done` }).end();
    else res.writeHead(200, { "content-type": "text/html" }).end("<!doctype html><h1>Elsewhere</h1>");
  });
});

afterAll(async () => {
  await browser?.close();
  for (const s of servers) s.close();
});

describe.skipIf(!browser)("Access header mode in a real browser", () => {
  it("follows a sign-in handshake through another host and keeps the token off it", async () => {
    const context = await browser!.newContext();
    try {
      const problems = await applyHeaderAccess(context, access([A], ["localhost"]));
      const page = await context.newPage();
      await page.goto(`${A}/start`);
      await waitOutBounces(page, 10_000);
      await page.waitForLoadState("load");
      expect(problems).toEqual([]);
      expect(page.url()).toBe(`${A}/start`);
      expect(await page.locator("h1").textContent()).toBe("Signed in");
      expect(seenWithToken).toContain("/img");
      await page.getByRole("link", { name: "Leave" }).click();
      await page.waitForURL(`${B}/elsewhere`);
      expect(leaks).toEqual([]);
    } finally {
      await context.close();
    }
  });
  it("probes each token origin and refuses a token Access sends to its login", async () => {
    const panel = { target: { origin: A, start: "/start" } } as Panel;
    await expect(probeHeaderAccess(panel, access([A]))).resolves.toBeUndefined();
    const wrong: HeaderAccess = { ...access([A]), headers: { "CF-Access-Client-Id": "x", "CF-Access-Client-Secret": "y" } };
    await expect(probeHeaderAccess(panel, wrong)).rejects.toThrow(/sent to the Access login/);
  });
});
