// Prepares the blind-test pack described in docs/blind-test.md. It makes
// materials and nothing else: no votes, no scoring.
//
//   node scripts/blind/prepare.mjs <config.json> --verify   check each human site (live, and its design date)
//   node scripts/blind/prepare.mjs <config.json>            screenshots, pairs, schedule, key
//
// Writes beside the config:
//   judge/pair-NN-a-1440.png (and -b, and -390)  what a judge sees, neutral names
//   judge/sessions.csv                            which pairs are in which session
//   votes.csv                                     header only, filled in from the judges' answers
//   .key/key.json                                 which side is ours: keep out of the judge folder and out of
//                                                 git until scoring (.gitignore holds it back)
// Set CRAFT_CHROMIUM to a Chrome or Chromium binary if Playwright has none.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const [configPath, ...rest] = process.argv.slice(2);
if (!configPath) throw new Error("usage: node scripts/blind/prepare.mjs <config.json> [--verify]");
const verify = rest.includes("--verify");
const dir = dirname(resolve(configPath));
const cfg = JSON.parse(readFileSync(configPath, "utf8"));
const craft = resolve(dir, "..", "..", "..");

// Seeded, so the coin flips are reproducible and fixed before any session.
function rng(seed) {
  let s = parseInt(createHash("sha1").update(seed).digest("hex").slice(0, 8), 16) >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}
const rand = rng(cfg.seed);
const shuffle = (a) => a.map((v) => [rand(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
const UA = "Mozilla/5.0 (compatible; dd-packages-blind-test-prep)";

const curl = (url) => execFileSync("curl", ["-sL", "-m", "40", "-A", UA, url], { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
const assets = (html) =>
  new Set(
    [...html.matchAll(/(?:href|src)="([^"]+\.(?:css|js)[^"]*)"/g)]
      .map((m) => m[1].replace(/^https?:\/\/[^/]+/, "").replace(/[?#].*$/, ""))
      .filter((p) => p.startsWith("/") && !/wp-includes|jquery|gtag|cdn/i.test(p)),
  );

async function humanEvidence(domain) {
  const out = { domain, live: null, capture: null, sharedAssets: null };
  try {
    const live = await fetch(`https://${domain}/`, { redirect: "follow", headers: { "user-agent": UA }, signal: AbortSignal.timeout(20000) });
    out.live = { status: live.status, url: live.url };
    const liveAssets = assets(live.ok ? await live.text() : "");
    await new Promise((r) => setTimeout(r, 2500));
    // Node's fetch is served an HTML error page by archive.org; curl is not.
    const av = JSON.parse(curl(`https://archive.org/wayback/available?url=${domain}&timestamp=20221231`));
    const snap = av.archived_snapshots?.closest;
    if (snap) {
      out.capture = snap.timestamp;
      const old = curl(snap.url.replace(/\/web\/(\d+)\//, "/web/$1id_/"));
      const shared = [...assets(old)].filter((p) => liveAssets.has(p));
      out.sharedAssets = { count: shared.length, examples: shared.slice(0, 3), liveAssets: liveAssets.size };
    }
  } catch (e) {
    out.error = String(e.message ?? e);
  }
  return out;
}

if (verify) {
  const rows = [];
  for (const d of Object.values(cfg.humans).flat()) {
    rows.push(await humanEvidence(d));
    console.log(JSON.stringify(rows.at(-1)));
  }
  writeFileSync(join(dir, "humans-verified.json"), `${JSON.stringify({ checkedAt: new Date().toISOString(), rows }, null, 2)}\n`);
  process.exit(0);
}

// Test pairs: ours against each human of its trade. Control pairs: a null page for the same brief against the same human.
const nullBrief = { dd: "dd", mmm: "mmm", sensphere: "sensphere", hj: "harrison-james", hjbeauty: "hj-beauty", chair: "chair-and-blade", rmp: "rmp" };
const pairs = [];
for (const [site, humans] of Object.entries(cfg.humans)) {
  for (const h of humans) pairs.push({ kind: "test", site, ours: { kind: "ours", id: site, url: cfg.ours[site].url }, other: { kind: "human", id: h, url: `https://${h}/` } });
}
for (const [site, n] of Object.entries(cfg.controls)) {
  const humans = shuffle(cfg.humans[site]).slice(0, n);
  const nullDir = join(craft, "calibration", "null", nullBrief[site], "pages");
  const pages = shuffle(readdirSync(nullDir).filter((f) => f.endsWith(".html")));
  humans.forEach((h, i) =>
    pairs.push({ kind: "control", site, ours: { kind: "null", id: `${nullBrief[site]}/${pages[i].replace(".html", "")}`, url: pathToFileURL(join(nullDir, pages[i])).href }, other: { kind: "human", id: h, url: `https://${h}/` } }),
  );
}
const perSession = Math.ceil(pairs.length / cfg.sessions);
const order = shuffle(pairs).map((p, i) => ({ ...p, pair: String(i + 1).padStart(2, "0"), left: rand() < 0.5 ? "ours" : "other", session: Math.floor(i / perSession) + 1 }));

const judge = join(dir, "judge");
mkdirSync(judge, { recursive: true });
mkdirSync(join(dir, ".key"), { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CRAFT_CHROMIUM || undefined });
const notMeasured = [];
async function shoot(url, width, file) {
  const ctx = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, deviceScaleFactor: 1, userAgent: UA });
  const page = await ctx.newPage();
  try {
    const r = await page.goto(url, { waitUntil: "load", timeout: 45000 });
    if (r && r.status() >= 400) throw new Error(`HTTP ${r.status()}`);
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    // Scroll down and back so lazy images and reveal-on-scroll blocks have drawn.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(800);
    await page.screenshot({ path: file, fullPage: true });
    return true;
  } catch (e) {
    notMeasured.push(`${url} @${width}: ${e.message}`);
    return false;
  } finally {
    await ctx.close();
  }
}

const key = { seed: cfg.seed, madeAt: new Date().toISOString(), pairs: {} };
for (const p of order) {
  const sides = p.left === "ours" ? [p.ours, p.other] : [p.other, p.ours];
  let ok = true;
  for (const w of [1440, 390]) {
    for (const [i, s] of sides.entries()) {
      if (!(await shoot(s.url, w, join(judge, `pair-${p.pair}-${"ab"[i]}-${w}.png`)))) ok = false;
    }
  }
  key.pairs[p.pair] = { kind: p.kind, site: p.site, session: p.session, left: `${sides[0].kind}:${sides[0].id}`, right: `${sides[1].kind}:${sides[1].id}`, complete: ok };
  console.log(`pair ${p.pair} ${p.kind} ${ok ? "ok" : "INCOMPLETE"}`);
}
await browser.close();
writeFileSync(join(dir, ".key", "key.json"), `${JSON.stringify(key, null, 2)}\n`);
writeFileSync(join(dir, "not-measured.txt"), `${notMeasured.join("\n")}\n`);
writeFileSync(join(dir, "votes.csv"), "judge,session,pair,kind,left,right,picked,excluded\n");
writeFileSync(join(judge, "sessions.csv"), `pair,session\n${order.map((p) => `${p.pair},${p.session}`).join("\n")}\n`);
console.log(`${order.length} pairs (${order.filter((p) => p.kind === "test").length} test, ${order.filter((p) => p.kind === "control").length} control). Not measured: ${notMeasured.length}`);
