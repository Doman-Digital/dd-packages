// Stage 06 gate: measures the rendered pages rather than trusting the
// stylesheet, phone first (STANDARD.md section 10 in @domandigital/craft):
// 375 x 812, the floor every surface is designed at, then 390 x 844, the
// width the design is accepted at, then 1440 x 900. On every page named in
// site.programme.json measure.pages, at every width: the page answers,
// nothing scrolls sideways, no visible text is smaller than
// measure.minFontPx, and, when measure.labels names them, every label sits
// inside its container, over no other label and no copy. At the two phone
// widths, also: every link, button, field and summary a thumb has to hit is
// at least 44 x 44 CSS px (a link inside a sentence is exempt, as in WCAG
// 2.5.5; a field's label counts as its target), and every text field is set
// at 16px or more, so Safari on iOS does not zoom on focus. With --preview,
// every page must also carry a noindex robots meta, so a preview cannot be
// indexed. Writes measure/measure.json, with the hash of the direction it
// measured, and a full-page capture per page and width under measure/out,
// phone captures first. Exits 1 on any failure.
//
// --serve serves the last build itself and measures that: static output in
// dist/ is served from here the way the host serves it (no trailing slash,
// the 404 page for anything missing); a Next build runs next start.
// deploy-preview.mjs runs `--serve --preview` before every preview deploy.
// --base <url> measures a server that is already running instead.
//
// Lifted from apps/site/scripts/measure.mjs in Doman-Digital (DOM-647), with
// the redesign's own label component generalised to a selector.

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { parseArgs } from "node:util";
import { programme, root, sitePath, stop } from "./programme.mjs";

const GATE = "measure";
const { values } = parseArgs({ options: { base: { type: "string" }, serve: { type: "boolean", default: false }, preview: { type: "boolean", default: false } } });
const { measure = {}, paths } = programme();
const port = measure.port ?? 4410;
const base = (values.base ?? `http://127.0.0.1:${port}`).replace(/\/$/, "");
const pages = measure.pages?.length ? measure.pages : ["/"];
const minFontPx = measure.minFontPx ?? 12;
// The house floors at phone width: STANDARD.md section 10. Not per-site settings.
const MIN_TARGET_PX = 44;
const MIN_FIELD_FONT_PX = 16;
const labels = measure.labels ?? null;
const outDir = join(root, "measure", "out");
mkdirSync(outDir, { recursive: true });

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  stop(GATE, "06", "playwright is not installed. Add it as a dev dependency and run `npx playwright install chromium`.");
}

const close = values.serve ? await serveBuild() : () => {};

const hash = (p) => (existsSync(p) ? createHash("sha256").update(readFileSync(p)).digest("hex").slice(0, 16) : null);
const slug = (route) => (route === "/" ? "home" : route.replace(/^\//, "").replace(/\//g, "-"));
const VIEWPORTS = [
  { name: "375x812", phone: true, viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: "390x844", phone: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: "1440x900", phone: false, viewport: { width: 1440, height: 900 } },
];

const browser = await chromium.launch();
const failures = [];
const res = { base, measuredAt: new Date().toISOString(), preview: values.preview, direction: hash(join(root, "art-direction.json")), tokens: hash(sitePath(paths.tokens)), minFontPx, minTargetPx: MIN_TARGET_PX, minFieldFontPx: MIN_FIELD_FONT_PX, pages: {} };

for (const route of pages) {
  res.pages[route] = {};
  for (const { name, phone, ...options } of VIEWPORTS) {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    const resp = await page.goto(base + route).catch((error) => ({ ok: () => false, status: () => error.message }));
    if (!resp || !resp.ok()) {
      res.pages[route][name] = { error: `HTTP ${resp?.status()}` };
      failures.push(`${route} at ${name}: HTTP ${resp?.status()}`);
      await context.close();
      continue;
    }
    await page.evaluate(() => document.fonts.ready);
    await settle(page);
    const m = await page.evaluate(
      ({ labels, minFontPx, phone, minTargetPx, minFieldFontPx }) => {
        const R = (e) => {
          const r = e.getBoundingClientRect();
          return { l: r.left, t: r.top, r: r.right, b: r.bottom };
        };
        const ov = (a, b) => !(a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t);
        const shown = (e) => {
          const s = getComputedStyle(e);
          return s.display !== "none" && s.visibility !== "hidden" && e.getClientRects().length > 0;
        };
        // Text an element shows itself, not text it inherits from a child.
        const texty = [...document.querySelectorAll("body *")].filter(
          (e) => shown(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && !e.closest("[aria-hidden='true'], .sr-only, .visually-hidden"),
        );
        const small = texty
          .map((e) => ({ tag: e.tagName.toLowerCase(), cls: String(e.className || ""), px: parseFloat(getComputedStyle(e).fontSize), text: e.textContent.trim().slice(0, 40) }))
          .filter((t) => t.px < minFontPx);
        // The layout viewport. Under mobile emulation innerWidth grows with the page (the phone zooms out to fit it), so it can never show sideways scroll.
        const vw = document.documentElement.clientWidth;
        const out = {
          // No width=device-width viewport meta: the phone lays the page out at 980px and shrinks it. Otherwise, the page is wider than the phone.
          noViewportMeta: vw > window.screen.width + 1,
          horizontalScroll: vw <= window.screen.width + 1 && document.documentElement.scrollWidth > vw + 1,
          fontSizesUsed: [...new Set(texty.map((e) => getComputedStyle(e).fontSize))].sort((a, b) => parseFloat(a) - parseFloat(b)),
          smallText: small.slice(0, 10),
          noindex: /noindex/i.test(document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? ""),
          labels: [],
          smallTargets: [],
          smallFields: [],
        };
        if (phone) {
          const name = (e) => ({ tag: e.tagName.toLowerCase(), cls: String(e.className || ""), text: (e.textContent.trim() || e.getAttribute("aria-label") || e.getAttribute("name") || "").slice(0, 40) });
          // Visually hidden (an sr-only skip link) or parked off the page: not a target until it is shown.
          const hidden = (e, r) => e.closest("[aria-hidden='true'], .sr-only, .visually-hidden") || r.width <= 1 || r.height <= 1 || r.right <= 0 || r.bottom <= -window.scrollY || r.left >= vw;
          // WCAG 2.5.5's inline exception: a link in a sentence is sized by the line it sits in.
          const inline = (e) => {
            if (e.tagName !== "A" || getComputedStyle(e).display !== "inline") return false;
            const block = e.parentElement?.closest("p, li, dd, td, th, blockquote, figcaption, address");
            return !!block && block.textContent.trim().length > e.textContent.trim().length;
          };
          const targets = [...document.querySelectorAll("a[href], button, input:not([type='hidden']), select, textarea, [role='button'], summary")].filter(shown);
          for (const e of targets) {
            const r = e.getBoundingClientRect();
            if (hidden(e, r) || inline(e)) continue;
            // A field's label is a hit target too: a 20px checkbox in a 44px label passes.
            const boxes = [r, ...[...(e.labels ?? [])].filter(shown).map((l) => l.getBoundingClientRect())];
            const w = Math.max(...boxes.map((b) => b.width));
            const h = Math.max(...boxes.map((b) => b.height));
            if (Math.round(w) < minTargetPx || Math.round(h) < minTargetPx) out.smallTargets.push({ ...name(e), w: Math.round(w), h: Math.round(h) });
          }
          const NOT_TEXT = new Set(["checkbox", "radio", "range", "color", "file", "submit", "reset", "button", "image"]);
          for (const e of document.querySelectorAll("input:not([type='hidden']), select, textarea")) {
            if (!shown(e) || (e.tagName === "INPUT" && NOT_TEXT.has(e.type))) continue;
            const px = parseFloat(getComputedStyle(e).fontSize);
            if (px < minFieldFontPx) out.smallFields.push({ ...name(e), px: Math.round(px * 10) / 10 });
          }
        }
        if (labels?.selector) {
          const all = [...document.querySelectorAll(labels.selector)].filter(shown);
          const copy = [...document.querySelectorAll("main h1, main h2, main h3, main p, main li")].filter(shown);
          for (const l of all) {
            const r = R(l);
            const box = labels.within ? l.parentElement?.closest(labels.within) : null;
            const b = box ? R(box) : null;
            out.labels.push({
              text: l.textContent.trim().slice(0, 40),
              inside: b ? r.l >= b.l - 0.5 && r.t >= b.t - 0.5 && r.r <= b.r + 0.5 && r.b <= b.b + 0.5 : null,
              overLabels: all.filter((o) => o !== l && ov(r, R(o))).length,
              overCopy: copy.filter((t) => !l.contains(t) && !t.contains(l) && ov(r, R(t))).length,
              fontPx: parseFloat(getComputedStyle(l).fontSize),
            });
          }
        }
        return out;
      },
      { labels, minFontPx, phone, minTargetPx: MIN_TARGET_PX, minFieldFontPx: MIN_FIELD_FONT_PX },
    );
    const at = `${route} at ${name}`;
    if (m.noViewportMeta) failures.push(`${at}: the page lays out wider than the screen: no width=device-width viewport meta`);
    if (m.horizontalScroll) failures.push(`${at}: the page scrolls sideways`);
    for (const t of m.smallText) failures.push(`${at}: ${t.px}px text under ${minFontPx}px (<${t.tag}${t.cls ? ` class="${t.cls}"` : ""}> "${t.text}")`);
    const tag = (t) => `<${t.tag}${t.cls ? ` class="${t.cls}"` : ""}>${t.text ? ` "${t.text}"` : ""}`;
    for (const t of m.smallTargets.slice(0, 10)) failures.push(`${at}: a ${t.w}x${t.h}px target under ${MIN_TARGET_PX}x${MIN_TARGET_PX} (${tag(t)})`);
    if (m.smallTargets.length > 10) failures.push(`${at}: ${m.smallTargets.length - 10} more targets under ${MIN_TARGET_PX}x${MIN_TARGET_PX}; measure/measure.json lists them`);
    for (const t of m.smallFields) failures.push(`${at}: a field set at ${t.px}px, under ${MIN_FIELD_FONT_PX}px, so Safari on iOS zooms on focus (${tag(t)})`);
    for (const l of m.labels) {
      if (l.inside === false) failures.push(`${at}: label "${l.text}" leaves its ${labels.within}`);
      if (l.overLabels) failures.push(`${at}: label "${l.text}" sits over another label`);
      if (l.overCopy) failures.push(`${at}: label "${l.text}" sits over copy`);
    }
    if (values.preview && !m.noindex) failures.push(`${at}: no noindex robots meta on a preview build (read PUBLIC_PREVIEW)`);
    res.pages[route][name] = m;
    await page.screenshot({ path: join(outDir, `${slug(route)}-${name}.png`), fullPage: true });
    await context.close();
  }
}
await browser.close();
close();

res.failures = failures;
writeFileSync(join(root, "measure", "measure.json"), `${JSON.stringify(res, null, 1)}\n`);
console.log(`${GATE}: ${pages.length} page(s) at 375, 390 and 1440, phone first, against ${base}; captures in measure/out, report in measure/measure.json`);
if (failures.length) stop(GATE, "06", `${failures.length} failure(s):\n${failures.map((f) => `  ${f}`).join("\n")}`);

/** Serves the last build on measure.port and returns how to stop it. */
async function serveBuild() {
  // Something already answering on the port would be measured in this build's place.
  if (await fetch(base).then(() => true, () => false)) stop(GATE, "06", `something is already answering on ${base}. Stop it, or set measure.port in site.programme.json.`);
  const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".woff2": "font/woff2", ".ico": "image/x-icon", ".txt": "text/plain", ".xml": "application/xml" };
  const dist = join(root, "dist");
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  let stopServer;
  if (existsSync(join(dist, "index.html"))) {
    const server = createServer((req, res) => {
      const path = decodeURIComponent(new URL(req.url, base).pathname).replace(/\/+$/, "").slice(1);
      const candidates = path === "" ? ["index.html"] : [path, `${path}.html`, `${path}/index.html`];
      const file = candidates.map((c) => join(dist, c)).find((f) => f.startsWith(dist) && existsSync(f) && statSync(f).isFile());
      const notFound = join(dist, "404.html");
      const body = file ?? (existsSync(notFound) ? notFound : null);
      res.writeHead(file ? 200 : 404, { "content-type": TYPES[extname(body ?? ".html")] ?? "application/octet-stream" });
      res.end(body ? readFileSync(body) : "Not found");
    });
    await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
    stopServer = () => server.close();
  } else if (pkg.dependencies?.next ?? pkg.devDependencies?.next) {
    const child = spawn(join(root, "node_modules", ".bin", "next"), ["start", "-p", String(port), "-H", "127.0.0.1"], { cwd: root, stdio: "ignore" });
    stopServer = () => child.kill();
  } else {
    stop(GATE, "06", "no static build in dist/ and no next to start. Build first.");
  }
  for (let i = 0; i < 60; i++) {
    if (await fetch(base).then((r) => r.status < 500, () => false)) return stopServer;
    await new Promise((r) => setTimeout(r, 1000));
  }
  stopServer();
  stop(GATE, "06", `the build did not answer on ${base} within a minute.`);
}

// Scroll through the page so lazy images load before the capture, then back to the top.
async function settle(p) {
  await p.evaluate(async () => {
    const h = document.documentElement.scrollHeight;
    for (let y = 0; y < h; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
    window.scrollTo(0, 0);
  });
  await p.waitForTimeout(600);
}
