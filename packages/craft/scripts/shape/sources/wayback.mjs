// Human baseline, marketing and service copy: UK small-business sites as the
// Wayback Machine saw them before 2021. The register craft's shape tells are
// aimed at, so it is also the main false-positive gate: a tell that fires here
// fires on good sales copy, and does not ship.
//
//   node scripts/shape/sources/wayback.mjs --seeds     crawl DMOZ for domains
//   node scripts/shape/sources/wayback.mjs             measure their pages
//
// Seeds come from DMOZ (the Open Directory, CC BY, frozen 2017), read through
// Wayback: the Business_and_Economy categories of UK counties, by trade. Only
// domains, trades and categories are committed (wayback-domains.json).
// Pages are copyrighted: the fetch cache lives in ~/.cache/craft-shape and is
// deleted after the run, and only feature vectors are written.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { Baseline, CALIBRATION, fetchText, flag, htmlProse as prose, memory, sleep } from "../lib.mjs";

const DOMAINS = join(CALIBRATION, "wayback-domains.json");
const CACHE = join(homedir(), ".cache", "craft-shape", "wayback");
const WB = "https://web.archive.org/web";
const PER_SECOND = 1000;

const COUNTIES = [
  "England/Bedfordshire", "England/Berkshire", "England/Buckinghamshire", "England/Cambridgeshire", "England/Cheshire",
  "England/Cornwall", "England/Cumbria", "England/Derbyshire", "England/Devon", "England/Dorset", "England/Essex",
  "England/Gloucestershire", "England/Hampshire", "England/Hertfordshire", "England/Kent", "England/Lancashire",
  "England/Leicestershire", "England/Lincolnshire", "England/Norfolk", "England/Northamptonshire", "England/Nottinghamshire",
  "England/Oxfordshire", "England/Shropshire", "England/Somerset", "England/Staffordshire", "England/Suffolk", "England/Surrey",
  "England/Sussex", "England/Warwickshire", "England/Wiltshire", "England/Worcestershire", "England/Yorkshire",
  "Scotland/Fife", "Scotland/Highland", "Wales/Gwynedd", "Wales/Powys",
];

// Directories, chambers and councils are not small businesses writing about themselves.
const NOT_SME = /(?:dmoz|yippy|duckduckgo|aol\.|gigablast|yahoo|bing\.|google\.|ixquick|yandex|ask\.com|twitter|facebook|mozilla|chamber|council|gov\.uk|nhs\.uk|ac\.uk|police|yell\.com|thomsonlocal|wikipedia)/i;

const cachePath = (url) => join(CACHE, `${createHash("sha1").update(url).digest("hex")}.html`);

let last = 0;
async function polite(url) {
  const cached = cachePath(url);
  if (existsSync(cached)) return readFileSync(cached, "utf8");
  const wait = last + PER_SECOND - Date.now();
  if (wait > 0) await sleep(wait);
  last = Date.now();
  const text = await fetchText(url);
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(cached, text ?? "");
  return text ?? "";
}

// ------------------------------------------------------------- phase 1: seeds

async function seeds() {
  const target = Number(flag("target", 320));
  const perTrade = Number(flag("per-trade", 12));
  const found = new Map();
  const trades = new Map();
  const queue = COUNTIES.map((c) => ({ path: `/Regional/Europe/United_Kingdom/${c}/Business_and_Economy/`, depth: 0 }));
  const visited = new Set();
  while (queue.length && found.size < target) {
    const { path, depth } = queue.shift();
    if (visited.has(path)) continue;
    visited.add(path);
    const html = await polite(`${WB}/2016id_/http://www.dmoz.org${path}`);
    const trade = decodeURIComponent(path.split("/Business_and_Economy/")[1]?.split("/")[0] ?? "") || "General";
    for (const m of html.matchAll(/href="(https?:\/\/[^"]+)"/g)) {
      let host;
      try {
        host = new URL(m[1]).hostname.replace(/^www\./, "");
      } catch {
        continue;
      }
      if (NOT_SME.test(host) || !/\.(?:co\.uk|uk|com|net)$/.test(host) || found.has(host)) continue;
      if ((trades.get(trade) ?? 0) >= perTrade) continue;
      trades.set(trade, (trades.get(trade) ?? 0) + 1);
      found.set(host, { domain: host, trade, category: path.replace(/^\/Regional\/Europe\/United_Kingdom\//, "") });
    }
    if (depth < 2) {
      for (const m of html.matchAll(/href="(\/Regional\/Europe\/United_Kingdom\/[^"]*\/Business_and_Economy\/[^"]+\/)"/g)) {
        if (m[1].startsWith(path)) queue.push({ path: m[1], depth: depth + 1 });
      }
    }
    if (visited.size % 25 === 0) console.error(`  ${visited.size} categories, ${found.size} domains, ${trades.size} trades`);
  }
  const list = [...found.values()].sort((a, b) => a.domain.localeCompare(b.domain));
  writeFileSync(
    DOMAINS,
    `${JSON.stringify({ note: "UK small-business domains from DMOZ (CC BY, frozen 2017) Business_and_Economy categories, read through the Wayback Machine. Domains only: no page text.", crawledAt: new Date().toISOString().slice(0, 10), domains: list }, null, 1)}\n`,
  );
  console.error(`wayback seeds: ${list.length} domains across ${trades.size} trades -> ${DOMAINS}`);
}

// ------------------------------------------------------------- phase 2: measure

const PAGE_TYPES = [
  ["home", /^https?:\/\/(?:www\.)?[^/]+\/?(?:index\.(?:html?|php|asp))?$/i],
  ["about", /\/(?:about|about-us|our-story|who-we-are)(?:\.html?|\.php|\/)?$/i],
  ["services", /\/(?:services|our-services|what-we-do)(?:\.html?|\.php|\/)?$/i],
];

async function measure() {
  if (!existsSync(DOMAINS)) throw new Error(`no ${DOMAINS}. Run with --seeds first.`);
  const { domains } = JSON.parse(readFileSync(DOMAINS, "utf8"));
  const out = new Baseline({
    source: "wayback-uk-sme",
    register: "marketing",
    licence: "Copyrighted pages; derived statistics only, no text stored. Domains from DMOZ (CC BY).",
    note: "UK small-business home, about and services pages, latest Wayback capture before 2021-01-01. <p> prose outside nav, header, footer and cookie text. Writer = domain. Tag = page type.",
  });
  let pages = 0;
  for (const [i, d] of domains.entries()) {
    const cdx = await polite(`https://web.archive.org/cdx/search/cdx?url=${d.domain}/*&to=20201231&filter=statuscode:200&filter=mimetype:text/html&collapse=urlkey&fl=original,timestamp&limit=400`);
    const rows = cdx
      .split("\n")
      .map((l) => l.trim().split(" "))
      .filter((r) => r.length === 2);
    for (const [type, pattern] of PAGE_TYPES) {
      const hits = rows.filter(([url]) => pattern.test(url.split("?")[0]));
      if (hits.length === 0) continue;
      // The latest capture before 2021 of the shortest matching URL.
      hits.sort((a, b) => a[0].length - b[0].length || b[1].localeCompare(a[1]));
      const [url, ts] = hits[0];
      const html = await polite(`${WB}/${ts}id_/${url}`);
      if (!html) continue;
      pages += 1;
      for (const p of prose(html)) out.add(p, d.domain, type);
    }
    if ((i + 1) % 20 === 0) console.error(`  ${i + 1}/${domains.length} domains, ${pages} pages, ${out.counts.blurbs} blurbs, ${memory()}`);
  }
  const result = out.write("wayback-uk-sme-v1.json", { force: Boolean(flag("force", false)) });
  console.log(JSON.stringify({ ...result, pages }));
  if (!flag("keep-cache", false)) rmSync(CACHE, { recursive: true, force: true });
}

if (flag("seeds", false)) await seeds();
else await measure();
