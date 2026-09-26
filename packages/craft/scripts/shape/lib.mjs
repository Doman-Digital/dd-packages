// Shared by every shape baseline reader and the measurement script.
//
// A reader hands over paragraphs one at a time with the writer they came from.
// Only numbers leave this module: each blurb-sized paragraph becomes a feature
// vector, and no sentence, name or address is ever written.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { isBlurb, shapeOf } from "../../dist/index.js";

export const BASELINE_VERSION = 1;
export const FEATURES = [
  "tricolons",
  "parallelTriads",
  "stackedConditionals",
  "clauseDepth",
  "sentenceCv",
  "hedgeRate",
  "hedgedClose",
  "nominalisationRate",
  "pronounOpenerShare",
  "transitionOpenerShare",
  "impersonalOpenerShare",
  "commasPerSentence",
  "commasPer100",
  "participialRate",
  "coordinationRate",
  "skeletonRepeat",
];

export const CALIBRATION = resolve(new URL("../../calibration/copy-shape", import.meta.url).pathname);

const hash = (s) => createHash("sha256").update(s).digest("hex");

/** Paragraphs from a plain-text body: blank lines split, single newlines join. */
export function paragraphs(text) {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

/** The feature vector stored for one paragraph: numbers only, rounded. */
export function vector(f) {
  return FEATURES.map((k) => {
    const v = f[k];
    if (v === null || v === undefined) return null;
    if (typeof v === "boolean") return v ? 1 : 0;
    return Math.round(v * 1000) / 1000;
  });
}

/**
 * Collects one source. Deduplicates by paragraph hash, splits by writer hash
 * into tuning and holdout so one prolific writer cannot sit on both sides,
 * and caps each half by reservoir sampling so the committed file stays small.
 */
export class Baseline {
  constructor({ source, register, licence, note, cap = 6000 }) {
    Object.assign(this, { source, register, licence, note, cap });
    this.seen = new Set();
    this.halves = { tuning: [], holdout: [] };
    this.offered = { tuning: 0, holdout: 0 };
    this.counts = { paragraphs: 0, duplicates: 0, notBlurb: 0, blurbs: 0 };
    this.writers = new Set();
    this.byTag = {};
    // Deterministic sampling: the same corpus always gives the same file.
    this.seed = 1;
  }

  random() {
    this.seed = (this.seed * 1103515245 + 12345) % 2 ** 31;
    return this.seed / 2 ** 31;
  }

  /** `tag` is an optional sub-register, such as a page type. */
  add(text, writer, tag) {
    this.counts.paragraphs += 1;
    const key = hash(text.toLowerCase().replace(/\s+/g, " "));
    if (this.seen.has(key)) {
      this.counts.duplicates += 1;
      return;
    }
    this.seen.add(key);
    const f = shapeOf(text);
    if (!isBlurb(f)) {
      this.counts.notBlurb += 1;
      return;
    }
    this.counts.blurbs += 1;
    const w = hash(String(writer));
    this.writers.add(w);
    const half = parseInt(w.slice(0, 2), 16) % 2 === 0 ? "tuning" : "holdout";
    const row = tag ? [...vector(f), tag] : vector(f);
    if (tag) this.byTag[tag] = (this.byTag[tag] ?? 0) + 1;
    this.offered[half] += 1;
    const list = this.halves[half];
    if (list.length < this.cap) list.push(row);
    else {
      const j = Math.floor(this.random() * this.offered[half]);
      if (j < this.cap) list[j] = row;
    }
  }

  /** Written once. A baseline that exists is never overwritten: add a new version instead. */
  write(file, { force = false } = {}) {
    const path = resolve(CALIBRATION, "human", file);
    if (existsSync(path) && !force) throw new Error(`${path} exists. Baselines are frozen: write a new version, or pass --force only if this run replaces a broken one.`);
    mkdirSync(dirname(path), { recursive: true });
    const out = {
      baselineVersion: BASELINE_VERSION,
      measuredAt: new Date().toISOString().slice(0, 10),
      source: this.source,
      register: this.register,
      licence: this.licence,
      note: this.note,
      counts: { ...this.counts, writers: this.writers.size, tuning: this.halves.tuning.length, holdout: this.halves.holdout.length, byTag: this.byTag },
      features: this.byTag && Object.keys(this.byTag).length ? [...FEATURES, "tag"] : FEATURES,
      tuning: this.halves.tuning,
      holdout: this.halves.holdout,
    };
    writeFileSync(path, `${JSON.stringify(out)}\n`);
    return { path, ...out.counts };
  }
}

export function flag(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Polite fetch: one at a time, backs off on 429 and 5xx. */
export async function fetchText(url, { tries = 5, delay = 1000, headers = {} } = {}) {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const res = await fetch(url, { headers: { "user-agent": "craft-calibration (+https://github.com/Doman-Digital/dd-packages)", ...headers } }).catch((e) => ({ ok: false, status: 0, error: e }));
    if (res.ok) return res.text();
    if (res.status === 404) return null;
    if (res.status === 429 || res.status >= 500 || res.status === 0) {
      await sleep(delay * 2 ** attempt * 5);
      continue;
    }
    return null;
  }
  return null;
}

export function memory() {
  return `${Math.round(process.memoryUsage().rss / 1e6)} MB (peak ${Math.round(process.resourceUsage().maxRSS / 1e3)} MB)`;
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", pound: "£", ndash: "–", mdash: "—", hellip: "…" };
const decode = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);

/** Body prose from a page: <p> blocks outside nav, header, footer and cookie banners. */
export function htmlProse(html) {
  const main = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|nav|header|footer|aside|form|svg)\b[\s\S]*?<\/\1>/gi, " ")
    // The Wayback toolbar, when a page was not fetched with id_.
    .replace(/<div id="wm-ipp[\s\S]*?<!-- END WAYBACK TOOLBAR INSERT -->/i, " ");
  const out = [];
  for (const m of main.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const text = decode(m[1].replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    if (!text || /cookie|javascript|copyright|©|all rights reserved|registered in england|company no/i.test(text)) continue;
    out.push(text);
  }
  return out;
}
