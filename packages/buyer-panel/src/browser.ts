import { chromium, devices, type Browser, type BrowserContext, type Locator, type Page } from "playwright";
import type { Device, Panel } from "./config.js";

const { defaultBrowserType: _ignored, ...IPHONE } = devices["iPhone 14"];

/** Desktop is a 1440 laptop screen; the phone is a 390-wide iPhone with the browser's own bars taken off the height. */
export const DEVICE_OPTIONS: Record<Device, Parameters<Browser["newContext"]>[0]> = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  phone: IPHONE,
};

/**
 * Exchanges the Access service token for Access's own session cookie, outside the browser. The browser only
 * ever holds the cookie (24 hours, this application only), so the service token never reaches a page, a
 * screenshot or a Playwright trace.
 */
export async function accessCookie(panel: Panel): Promise<string | undefined> {
  const a = panel.target.access;
  if (!a) return undefined;
  const id = process.env[a.idEnv];
  const secret = process.env[a.secretEnv];
  if (!id || !secret) throw new Error(`Access token missing: set ${a.idEnv} and ${a.secretEnv} (doppler run -p dd-work-box -c prd -- ...)`);
  const res = await fetch(new URL(panel.target.start, panel.target.origin), {
    redirect: "manual",
    headers: { "CF-Access-Client-Id": id, "CF-Access-Client-Secret": secret },
  });
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith("CF_Authorization="));
  if (res.status !== 200 || !cookie) throw new Error(`Access refused the service token (HTTP ${res.status})`);
  return cookie.split(";")[0]!.slice("CF_Authorization=".length);
}

/** The text a person can see on screen right now, in reading order, one element a line. Runs in the page. */
const VISIBLE_SCRIPT = `(() => {
  const vh = innerHeight, vw = innerWidth, out = [], seen = new Set();
  const containers = 'p,li,h1,h2,h3,h4,h5,h6,td,dd,blockquote,figcaption';
  const sel = 'h1,h2,h3,h4,h5,h6,p,li,a,button,summary,label,input,select,textarea,td,th,dt,dd,figcaption,blockquote,[role=button],[role=link],[role=tab],[role=status],[role=alert],img[alt]';
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute('role');
    let kind = 'text';
    let text = '';
    if (/^h[1-6]$/.test(tag)) kind = 'heading ' + tag[1];
    else if (tag === 'a' || role === 'link') kind = 'link';
    else if (tag === 'button' || tag === 'summary' || role === 'button' || role === 'tab') kind = 'button';
    else if (tag === 'img') { kind = 'image'; text = el.getAttribute('alt') || ''; }
    else if (role === 'status' || role === 'alert') kind = role;
    if (tag === 'input' || tag === 'select' || tag === 'textarea') {
      const type = tag === 'input' ? (el.getAttribute('type') || 'text') : tag;
      if (type === 'hidden') continue;
      const label = (el.labels && el.labels[0] && el.labels[0].innerText) || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name') || '';
      kind = 'field ' + type;
      text = label.replace(/\\s+/g, ' ').trim() + (el.value ? ' = "' + String(el.value).slice(0, 80) + '"' : '');
    } else if (!text) {
      if (kind === 'text' && el.querySelector(containers)) continue;
      text = (el.getAttribute('aria-label') || el.innerText || '').replace(/\\s+/g, ' ').trim();
    }
    if (!text) continue;
    if (text.length > 400) text = text.slice(0, 400) + '…';
    const key = kind + '|' + text;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push('[' + kind + '] ' + text);
  }
  const max = Math.max(1, document.documentElement.scrollHeight - vh);
  return { lines: out, scrolledPct: Math.round(100 * Math.min(1, scrollY / max)), atBottom: scrollY + vh >= document.documentElement.scrollHeight - 4 };
})()`;

export interface Observation {
  url: string;
  title: string;
  visible: string;
  scrolledPct: number;
  atBottom: boolean;
  screenshot: Buffer;
}

export interface ElementEvidence {
  description: string;
  resolved: boolean;
  box?: { x: number; y: number; width: number; height: number };
  screenshot: Buffer;
}

export class BrowserSession {
  private constructor(
    readonly browser: Browser,
    readonly context: BrowserContext,
    public page: Page,
    readonly origin: string,
  ) {}

  static async open(panel: Panel, device: Device, cookie: string | undefined, trace: boolean): Promise<BrowserSession> {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ ...DEVICE_OPTIONS[device], locale: "en-GB", timezoneId: "Europe/London" });
    const origin = new URL(panel.target.origin).origin;
    if (cookie) {
      await context.addCookies([{ name: "CF_Authorization", value: cookie, domain: new URL(origin).hostname, path: "/", secure: true, httpOnly: true, sameSite: "None" }]);
    }
    if (trace) await context.tracing.start({ screenshots: true, snapshots: true });
    const page = await context.newPage();
    return new BrowserSession(browser, context, page, origin);
  }

  async goto(path: string): Promise<void> {
    await this.page.goto(new URL(path, this.origin).toString(), { waitUntil: "domcontentloaded" });
    await this.settle();
    if (new URL(this.page.url()).hostname.endsWith("cloudflareaccess.com")) throw new Error("Cloudflare Access login page shown: the session cookie was refused");
  }

  private async settle(): Promise<void> {
    await this.page.waitForLoadState("load", { timeout: 8000 }).catch(() => undefined);
    await this.page.waitForTimeout(400);
  }

  async shot(): Promise<Buffer> {
    return this.page.screenshot({ type: "jpeg", quality: 70, scale: "css", timeout: 15000 });
  }

  async observe(): Promise<Observation> {
    const v = (await this.page.evaluate(VISIBLE_SCRIPT)) as { lines: string[]; scrolledPct: number; atBottom: boolean };
    return {
      url: this.page.url(),
      title: await this.page.title(),
      visible: v.lines.join("\n").slice(0, 6000),
      scrolledPct: v.scrolledPct,
      atBottom: v.atBottom,
      screenshot: await this.shot(),
    };
  }

  /** Finds what a buyer means by a piece of visible text: an exact link or button first, then looser matches. */
  async resolve(text: string, prefer: "action" | "any" = "action"): Promise<Locator | undefined> {
    const p = this.page;
    // The screen text lists a card link with its arrow and full text; its accessible name often has neither.
    const t = text.trim().replace(/^\[[^\]]+\]\s*/, "").replace(/^["“]|["”]$/g, "").replace(/\s*[→›»>]+\s*$/, "").trim();
    if (!t) return undefined;
    const words = t.split(/\s+/);
    const heads = [...new Set([t.length > 40 ? t.slice(0, 40) : "", words.length > 5 ? words.slice(0, 4).join(" ") : ""].filter(Boolean))];
    const action = [
      p.getByRole("link", { name: t, exact: true }),
      p.getByRole("button", { name: t, exact: true }),
      p.getByRole("tab", { name: t, exact: true }),
    ];
    const loose = [p.getByRole("link", { name: t }), p.getByRole("button", { name: t }), p.getByLabel(t)];
    for (const h of heads) loose.push(p.getByRole("link", { name: h }), p.getByRole("button", { name: h }));
    const anyText = [p.getByText(t, { exact: true }), p.getByText(t), ...heads.map((h) => p.getByText(h))];
    const order = prefer === "action" ? [...action, ...loose, ...anyText] : [...anyText, ...action, ...loose];
    const vh = p.viewportSize()?.height ?? 900;
    let fallback: Locator | undefined;
    for (const cand of order) {
      const n = Math.min(await cand.count().catch(() => 0), 12);
      for (let i = 0; i < n; i++) {
        const loc = cand.nth(i);
        if (!(await loc.isVisible().catch(() => false))) continue;
        const box = await loc.boundingBox().catch(() => null);
        if (box && box.y + box.height > 0 && box.y < vh) return loc;
        fallback ??= loc;
      }
    }
    return fallback;
  }

  async click(text: string): Promise<string> {
    const loc = await this.resolve(text, "action");
    if (!loc) return `Nothing on the page matches "${text}".`;
    const before = this.page.url();
    const popup = this.context.waitForEvent("page", { timeout: 1500 }).catch(() => null);
    try {
      await loc.click({ timeout: 6000 });
    } catch (e) {
      return `Could not click "${text}": ${(e as Error).message.split("\n")[0]}`;
    }
    // A link's navigation can start after the click resolves: wait for the URL to move before reading the screen,
    // or the buyer is shown the old page and concludes the link is broken.
    await this.page.waitForURL((u) => u.toString() !== before, { timeout: 2500, waitUntil: "commit" }).catch(() => undefined);
    const opened = await popup;
    if (opened) {
      await opened.waitForLoadState("domcontentloaded").catch(() => undefined);
      this.page = opened;
      await this.settle();
      return `"${text}" opened a new tab.`;
    }
    await this.settle();
    return this.page.url() === before ? `Clicked "${text}".` : `Clicked "${text}"; the page changed.`;
  }

  async type(field: string, text: string): Promise<string> {
    const p = this.page;
    for (const cand of [p.getByLabel(field), p.getByPlaceholder(field), p.getByRole("textbox", { name: field }), p.getByRole("combobox", { name: field })]) {
      const n = Math.min(await cand.count().catch(() => 0), 5);
      for (let i = 0; i < n; i++) {
        const loc = cand.nth(i);
        if (!(await loc.isVisible().catch(() => false))) continue;
        try {
          const tag = await loc.evaluate((el) => el.tagName.toLowerCase());
          if (tag === "select") await loc.selectOption({ label: text });
          else await loc.fill(text, { timeout: 5000 });
          return `Typed into "${field}".`;
        } catch (e) {
          return `Could not type into "${field}": ${(e as Error).message.split("\n")[0]}`;
        }
      }
    }
    return `No field called "${field}" is visible.`;
  }

  async scroll(direction: "down" | "up"): Promise<string> {
    await this.page.evaluate((d) => window.scrollBy({ top: (d === "down" ? 0.85 : -0.85) * window.innerHeight, behavior: "instant" }), direction);
    await this.page.waitForTimeout(300);
    return `Scrolled ${direction}.`;
  }

  async back(): Promise<string> {
    const r = await this.page.goBack({ waitUntil: "domcontentloaded" }).catch(() => null);
    await this.settle();
    return r ? "Went back." : "There is nothing to go back to.";
  }

  /** A screenshot with the named element outlined, and where it is. Restores the scroll position after. */
  async evidence(description: string): Promise<ElementEvidence> {
    const loc = await this.resolve(description, "any");
    if (!loc) return { description, resolved: false, screenshot: await this.shot() };
    const y = await this.page.evaluate(() => window.scrollY);
    try {
      await loc.scrollIntoViewIfNeeded({ timeout: 3000 });
      const box = (await loc.boundingBox()) ?? undefined;
      await loc.evaluate((el) => {
        (el as HTMLElement).dataset.panelOutline = (el as HTMLElement).style.outline;
        (el as HTMLElement).style.outline = "3px solid #ff0080";
        (el as HTMLElement).style.outlineOffset = "2px";
      });
      const screenshot = await this.shot();
      await loc.evaluate((el) => {
        (el as HTMLElement).style.outline = (el as HTMLElement).dataset.panelOutline ?? "";
      });
      return { description, resolved: true, box, screenshot };
    } catch {
      return { description, resolved: false, screenshot: await this.shot() };
    } finally {
      await this.page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
    }
  }

  async close(tracePath?: string): Promise<void> {
    if (tracePath) await this.context.tracing.stop({ path: tracePath }).catch(() => undefined);
    await this.context.close().catch(() => undefined);
    await this.browser.close().catch(() => undefined);
  }
}
