// Capture a public site the way a visitor sees it, for a person (or a model with
// vision) to LOOK at. Nothing here decides what is on the page: it only takes
// viewport screenshots as the page is scrolled, so scroll reveals have fired.
//
//   node scripts/visual/capture.mjs --site https://example.co.uk --out <dir> [--pages 5]
//
// Home plus up to N more same-origin pages, found from the links on the home page
// and picked by what they are for (services, about, gallery, pricing, contact,
// journal). For each: desktop 1440x900 and mobile 390x844, first screen, then a
// screenshot every viewport-height down the page (max 8, or --max). Originals are kept.
// No form is submitted, and cookie banners are left as found.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1]; };
const site = arg("site");
const out = arg("out");
const extra = Number(arg("pages", 5));
// --max: most screens per page and device (default 8; a long single-page site needs more).
const maxSteps = Number(arg("max", 8));
// --urls "services=https://x/services,about=https://x/about": exact pages, for sites whose links the crawl cannot find.
const explicit = arg("urls") ? Object.fromEntries(arg("urls").split(",").map((kv) => kv.split(/=(.+)/).slice(0, 2))) : null;
if (!site || !out) throw new Error("usage: --site <url> --out <dir> [--pages 5]");
mkdirSync(out, { recursive: true });

const KINDS = [
  ["services", /(service|treatment|what-we-do|work|products?|solutions|electrical|packages|menu)/i],
  ["about", /(about|our-story|meet|team|why)/i],
  ["gallery", /(gallery|portfolio|projects|results|case-stud)/i],
  ["pricing", /(pric|cost|rates|book)/i],
  ["contact", /(contact|get-in-touch|enquir|quote)/i],
  ["journal", /(blog|journal|news|article|insight)/i],
];
const DEVICES = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };

// CHROME_BIN lets a box without the Playwright system libraries use another Chrome (e.g. Remotion's headless shell).
const browser = await chromium.launch(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {});
const origin = new URL(site).origin;
const pages = [{ page: "home", url: site }];
if (explicit) for (const [page, url] of Object.entries(explicit)) pages.push({ page, url });

if (!explicit) {
  const ctx = await browser.newContext({ viewport: DEVICES.desktop });
  const p = await ctx.newPage();
  await p.goto(site, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  const links = await p.$$eval("a[href]", (as) => as.map((a) => [a.href, (a.textContent || "").trim().slice(0, 40)]));
  const seen = new Set([new URL(site).pathname.replace(/\/$/, "")]);
  for (const [kind, re] of KINDS) {
    if (pages.length > extra) break;
    const hit = links.find(([href, text]) => {
      try { const u = new URL(href); return u.origin === origin && !seen.has(u.pathname.replace(/\/$/, "")) && !u.hash && u.pathname.length > 1 && u.pathname.split("/").length <= 3 && (re.test(u.pathname) || re.test(text)); } catch { return false; }
    });
    if (hit) { seen.add(new URL(hit[0]).pathname.replace(/\/$/, "")); pages.push({ page: kind, url: hit[0] }); }
  }
  await ctx.close();
}

const manifest = { site, capturedAt: new Date().toISOString(), tool: "scripts/visual/capture.mjs (playwright chromium)", shots: [] };
for (const { page, url } of pages) {
  for (const [device, viewport] of Object.entries(DEVICES)) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: device === "mobile" });
    const p = await ctx.newPage();
    const status = await p.goto(url, { waitUntil: "networkidle", timeout: 45000 }).then((r) => r?.status()).catch((e) => `error: ${e.message.slice(0, 60)}`);
    await p.waitForTimeout(2500);
    const total = await p.evaluate(() => document.documentElement.scrollHeight);
    const steps = Math.min(maxSteps, Math.max(1, Math.ceil(total / viewport.height)));
    for (let s = 0; s < steps; s += 1) {
      await p.evaluate((y) => window.scrollTo(0, y), s * viewport.height);
      await p.waitForTimeout(1200);
      const file = `${page}-${device}-${String(s + 1).padStart(2, "0")}.jpg`;
      await p.screenshot({ path: join(out, file), type: "jpeg", quality: 72 });
      manifest.shots.push({ page, device, url, status, file, scrollY: s * viewport.height, pageHeight: total });
    }
    await ctx.close();
  }
}
await browser.close();
writeFileSync(join(out, "manifest.json"), `${JSON.stringify(manifest, null, 1)}\n`);
console.log(`${site}: ${pages.map((x) => x.page).join(", ")}; ${manifest.shots.length} screenshots`);
