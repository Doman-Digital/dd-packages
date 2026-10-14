// Stage 06 gate: measures the rendered pages rather than trusting the
// stylesheet, at every viewport, phone first (STANDARD.md section 10 in
// @domandigital/craft, DOM-787). The measure itself is craft's
// (@domandigital/craft/phone), the same one the portal gates use: this file
// serves the build, names the pages, adds what only a site has (labels,
// noindex on a preview) and fails the build on what it finds.
//
// On every page named in site.programme.json measure.pages, in order:
//   - the viewport ladder, phone first: 320, 375, 390, 430, landscape 844 x 390,
//     768, 1024, 1280, 1440, 1920, and a width sweep from 320 to 1920 in
//     16 to 32px steps, so what breaks between the breakpoints shows;
//   - at any width: the page answers, nothing scrolls sideways, no visible
//     text sits on other text, no page title is cut off, no visible text is
//     smaller than measure.minFontPx, and, when measure.labels names them,
//     every label sits inside its container, over no other label and no copy;
//   - on a phone (320 to 430, and landscape): every link, button, field and
//     summary a thumb has to hit is at least 44 x 44 CSS px (a link inside a
//     sentence is exempt, as in WCAG 2.5.5; a field's label counts as its
//     target), and every text field is set at 16px or more, so Safari on iOS
//     does not zoom on focus;
//   - on a short phone, 375 x 667: the main action (measure.mainAction, a
//     selector, or one per page) is on the first screen or pinned; fixed and
//     sticky layers cover at most a quarter of the screen; images are neither
//     far larger than they are shown nor stretched; phone, email and number
//     fields use the keyboard that fits and carry autocomplete; phone numbers
//     in the text are tel: links;
//   - on a landscape phone, header and fixed layers leave half the height;
//   - at 1440 and 1920: body text lines stay under 80 characters and no image
//     is stretched past its file.
// With --preview, every page must also carry a noindex robots meta, so a
// preview cannot be indexed. Thresholds are craft's house defaults;
// measure.thresholds overrides one. measure.baseline names a file of known
// failures (craft's phone-first baseline format, written by --update-baseline):
// those stay listed and visible, and anything new fails. Writes
// measure/measure.json, with the hash of the direction it measured, and a
// full-page capture per page and ladder viewport under measure/out, phone
// captures first. Exits 1 on any failure.
//
// --serve serves the last build itself and measures that: static output in
// dist/ is served from here the way the host serves it (no trailing slash,
// the 404 page for anything missing); a Next build runs next start.
// deploy-preview.mjs runs `--serve --preview` before every preview deploy.
// --base <url> measures a server that is already running instead.
//
// Lifted from apps/site/scripts/measure.mjs in Doman-Digital (DOM-647), with
// the redesign's own label component generalised to a selector; the
// measuring moved into craft so a site and a portal are measured the same way
// (DOM-787).

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { parseArgs } from "node:util";
import { programme, root, sitePath, stop } from "./programme.mjs";

const GATE = "measure";
const { values } = parseArgs({ options: { base: { type: "string" }, serve: { type: "boolean", default: false }, preview: { type: "boolean", default: false }, "update-baseline": { type: "boolean", default: false } } });
const { measure = {}, paths } = programme();
const port = measure.port ?? 4410;
const base = (values.base ?? `http://127.0.0.1:${port}`).replace(/\/$/, "");
const pages = measure.pages?.length ? measure.pages : ["/"];
const minFontPx = measure.minFontPx ?? 12;
const labels = measure.labels ?? null;
const outDir = join(root, "measure", "out");
mkdirSync(outDir, { recursive: true });

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  stop(GATE, "06", "playwright is not installed. Add it as a dev dependency and run `npx playwright install chromium`.");
}
let craft;
try {
  craft = await import("@domandigital/craft/phone");
} catch {
  stop(GATE, "06", "@domandigital/craft is not installed, or is older than the every-viewport measure (0.20). Install the site's dependencies.");
}
const { measureSite, judgeMeasured, writeBaseline, EMPTY_BASELINE, LADDER, PHONE_FLOORS, DEFAULT_THRESHOLDS } = craft;

const close = values.serve ? await serveBuild() : () => {};

const hash = (p) => (existsSync(p) ? createHash("sha256").update(readFileSync(p)).digest("hex").slice(0, 16) : null);
const slug = (route) => (route === "/" ? "home" : route.replace(/^\//, "").replace(/\//g, "-"));

// What only a site has, read at each ladder viewport as craft hands over the page.
const extras = Object.fromEntries(pages.map((route) => [route, { noindex: false, labels: {} }]));
async function atViewport(page, viewport, route) {
  const found = await page.evaluate(
    ({ labels }) => {
      const R = (e) => {
        const r = e.getBoundingClientRect();
        return { l: r.left, t: r.top, r: r.right, b: r.bottom };
      };
      const ov = (a, b) => !(a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t);
      const shown = (e) => {
        const s = getComputedStyle(e);
        return s.display !== "none" && s.visibility !== "hidden" && e.getClientRects().length > 0;
      };
      const out = { noindex: /noindex/i.test(document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? ""), labels: [] };
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
    { labels },
  );
  extras[route].noindex = found.noindex;
  extras[route].labels[viewport.name] = found.labels;
  await page.screenshot({ path: join(outDir, `${slug(route)}-${viewport.name}.png`), fullPage: true });
}

const browser = await chromium.launch();
let site;
try {
  site = await measureSite(browser, {
    base,
    routes: pages,
    out: false,
    floors: { textPx: minFontPx },
    ...(measure.mainAction ? { mainAction: measure.mainAction } : {}),
    ...(measure.thresholds ? { thresholds: measure.thresholds } : {}),
    ...(measure.sweep !== undefined ? { sweep: measure.sweep } : {}),
    onViewport: atViewport,
  });
} finally {
  await browser.close();
  close();
}

const baselineFile = measure.baseline ? sitePath(measure.baseline) : null;
const updating = values["update-baseline"];
if (updating) {
  if (!baselineFile) stop(GATE, "06", "--update-baseline needs measure.baseline in site.programme.json: the file the known failures go in.");
  const note = existsSync(baselineFile) ? JSON.parse(readFileSync(baselineFile, "utf8")).note : undefined;
  writeFileSync(baselineFile, `${JSON.stringify(writeBaseline([], site.routes, note), null, 2)}\n`);
  console.log(`${GATE}: wrote ${measure.baseline}. Each line in it is a failure to fix; the count only goes down.`);
}
const baseline = baselineFile && existsSync(baselineFile) ? { static: [], measured: [], ...JSON.parse(readFileSync(baselineFile, "utf8")) } : EMPTY_BASELINE;
const judged = judgeMeasured(site.routes, baseline);

const failures = [...site.errors.map((e) => `${e.route}: ${e.error}`), ...judged.fresh, ...judged.stale];
for (const [route, { noindex, labels: byViewport }] of Object.entries(extras)) {
  if (site.errors.some((e) => e.route === route)) continue;
  for (const [name, list] of Object.entries(byViewport)) {
    const at = `${route} at ${name}`;
    for (const l of list) {
      if (l.inside === false) failures.push(`${at}: label "${l.text}" leaves its ${labels.within}`);
      if (l.overLabels) failures.push(`${at}: label "${l.text}" sits over another label`);
      if (l.overCopy) failures.push(`${at}: label "${l.text}" sits over copy`);
    }
  }
  if (values.preview && !noindex) failures.push(`${route}: no noindex robots meta on a preview build (read PUBLIC_PREVIEW)`);
}

const res = {
  base,
  measuredAt: new Date().toISOString(),
  preview: values.preview,
  direction: hash(join(root, "art-direction.json")),
  tokens: hash(sitePath(paths.tokens)),
  minFontPx,
  minTargetPx: PHONE_FLOORS.targetPx,
  minFieldFontPx: PHONE_FLOORS.fieldFontPx,
  thresholds: { ...DEFAULT_THRESHOLDS, ...(measure.thresholds ?? {}) },
  mainAction: measure.mainAction ?? null,
  baseline: measure.baseline ?? null,
  knownBreaches: judged.known,
  pages: Object.fromEntries(site.routes.map((r) => [r.route, { viewports: r.viewports, findings: r.findings, noindex: extras[r.route].noindex, labels: extras[r.route].labels }])),
  errors: site.errors,
  failures,
};
writeFileSync(join(root, "measure", "measure.json"), `${JSON.stringify(res, null, 1)}\n`);
const ladder = LADDER.map((v) => v.name).join(", ");
console.log(`${GATE}: ${pages.length} page(s) at ${ladder} and the width sweep, phone first, against ${base}${judged.known ? `; ${judged.known} known breach${judged.known === 1 ? "" : "es"} in ${measure.baseline}` : ""}; captures in measure/out, report in measure/measure.json`);
if (!updating && failures.length) stop(GATE, "06", `${failures.length} failure(s):\n${failures.map((f) => `  ${f}`).join("\n")}`);

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
