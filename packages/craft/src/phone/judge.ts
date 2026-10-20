/**
 * The judging half of the phone-first gate: pure text work, tested without a
 * browser or a disk.
 *
 * Two kinds of breach, one baseline:
 *
 * - **Static.** A `max-width` media query (`max-width:`, or the range syntax
 *   `width <`, `width <=`, `600px > width`) or a Tailwind `max-*` variant
 *   (`max-sm:`, `max-[40rem]:`) in source. Base styles are the phone; wider
 *   layouts are added with `min-width`. The same patterns as create-site's
 *   mobile-first.mjs (DOM-774).
 * - **Measured.** What `measurePhone` found on a rendered route at 375px.
 *
 * A repo that already breaks the rule records what it breaks in a baseline,
 * counted per file and per route, so the gate blocks every new breach from
 * the day it goes in while the existing ones stay listed in the open. The
 * baseline only shrinks: a count higher than what is found fails as well
 * ("lower the baseline"), so a fix cannot leave room for the next breach.
 *
 * Shrinking is also enforced against the base branch (DOM-1053): a baseline
 * entry, or a higher count, that main's copy does not have fails, unless the
 * entry carries a `reason` (a named exception: third-party UI, a
 * destructive-only form).
 */

import type { SourceFile } from "../character/types.js";
import type { PhoneCheck, RawPhoneFinding } from "./measure-in-page.js";

export interface StaticFinding {
  file: string;
  line: number;
  what: string;
}

export interface FileException {
  file: string;
  reason: string;
}

export interface MeasuredRoute {
  route: string;
  viewport?: { width: number; height: number };
  /** Set by the every-viewport measure: the viewports and widths the findings were gathered across, phone first. */
  viewports?: string[];
  /** Phone screens to the footer (page height at 375 x 667 over 667), from the every-viewport measure. Absent when the short phone was not measured. */
  screens?: number;
  findings: RawPhoneFinding[];
}

export interface Baseline {
  /** Why the baseline exists and which issue burns it down. Free text, for a person. */
  note?: string;
  /**
   * `reason` makes an entry a named exception: it may be added, or raised,
   * after the baseline went in. Absent on the faults that were there first.
   */
  static: { file: string; count: number; found?: string[]; reason?: string }[];
  measured: { route: string; check: PhoneCheck; element: string; count: number; reason?: string }[];
}

/** An entry is a named exception when its `reason` says something. */
export const hasReason = (entry: { reason?: unknown }): boolean => typeof entry.reason === "string" && entry.reason.trim() !== "";

/** A baseline file, read. Old files (no `reason`, no `note`) read as before; a `reason` that is not text is an error. */
export function parseBaseline(raw: unknown, where: string): Baseline {
  const b = (raw ?? {}) as Partial<Baseline>;
  const entries = [...(b.static ?? []), ...(b.measured ?? [])] as { reason?: unknown }[];
  const bad = entries.find((e) => e.reason !== undefined && typeof e.reason !== "string");
  if (bad) throw new Error(`${where}: an entry has a "reason" that is not text: ${JSON.stringify(bad)}`);
  return { ...(b.note ? { note: b.note } : {}), static: b.static ?? [], measured: b.measured ?? [] };
}

export const EMPTY_BASELINE: Baseline = { static: [], measured: [] };

// A media query whose condition caps the width. The prelude runs to the rule's `{` (or the `;` of @custom-media).
const MEDIA = /@(?:custom-)?media\b([^{;]*)/g;
const CAPS_WIDTH = /\bmax-(?:device-)?width\s*:|\bwidth\s*<|>=?\s*(?:device-)?width\b/i;
// A Tailwind max-* variant. Single-word CSS properties and media features spelt max-* are not variants.
const VARIANT = /(?<![\w@-])max-(\[[^\]\s]+\]|[a-z0-9]+):/g;
const NOT_VARIANTS = new Set(["width", "height", "lines", "resolution", "zoom", "inline-size", "block-size"]);
const OK = /mobile-first-ok\b:?(.*)/;
// Tailwind 3 compiles `bg-[var(--x)]/95` to nothing: it cannot split a var() into channels to apply the opacity.
const VAR_OPACITY = /[^\s"'`]*var\([^)]*\)\]\/[0-9]+/g;

/** The reason in a `mobile-first-ok: <reason>` comment, "" for the marker with no reason, null for none. */
export function reasonOf(line: string | undefined): string | null {
  const m = line?.match(OK);
  return m ? m[1].replace(/\*\/|-->|[{}]/g, "").trim() : null;
}

/**
 * Every desktop-first rule in the files that is not excused. An excuse is
 * `mobile-first-ok: <reason>` on the line or the line above, or the whole file
 * in `exceptions` with a reason. A marker with no reason is itself a finding.
 */
export function scanPhoneFirst(
  files: SourceFile[],
  exceptions: FileException[] = [],
  options: {
    /** True for a file in an app whose tailwindcss is v3: it is also scanned for `/NN` opacity on a `var()` colour. */
    tailwind3?: (path: string) => boolean;
  } = {},
): { findings: StaticFinding[]; excused: number } {
  const excusedFiles = new Set(exceptions.filter((e) => e.reason?.trim()).map((e) => e.file));
  const findings: StaticFinding[] = [];
  let excused = 0;
  for (const { path, text } of files) {
    if (excusedFiles.has(path)) continue;
    const lines = text.split("\n");
    const lineOf = (index: number): number => text.slice(0, index).split("\n").length;
    const found: { line: number; what: string }[] = [];
    for (const m of text.matchAll(MEDIA)) {
      if (CAPS_WIDTH.test(m[1])) found.push({ line: lineOf(m.index!), what: `${m[0].slice(0, m[0].length - m[1].length)}${m[1].replace(/\s+/g, " ").trimEnd()}` });
    }
    for (const m of text.matchAll(VARIANT)) {
      if (!NOT_VARIANTS.has(m[1])) found.push({ line: lineOf(m.index!), what: m[0] });
    }
    // A bug, not a style: the class emits no CSS, so no mobile-first-ok marker excuses it.
    const silent = new Set<number>();
    if (options.tailwind3?.(path)) {
      for (const m of text.matchAll(VAR_OPACITY)) {
        silent.add(found.push({ line: lineOf(m.index!), what: `${m[0]} (Tailwind 3 emits no CSS for opacity on a var() colour)` }) - 1);
      }
    }
    const order = found.map((f, i) => ({ ...f, silent: silent.has(i) })).sort((a, b) => a.line - b.line);
    for (const { line, what, silent: cannotExcuse } of order) {
      if (cannotExcuse) {
        findings.push({ file: path, line, what });
        continue;
      }
      const here = reasonOf(lines[line - 1]);
      const above = reasonOf(lines[line - 2]);
      if (here || above) {
        excused++;
        continue;
      }
      findings.push({ file: path, line, what: here === "" || above === "" ? `${what} (mobile-first-ok with no reason)` : what });
    }
  }
  return { findings, excused };
}

/** Problems with the exceptions themselves: no file, no reason, or a file that is not there. */
export function checkExceptions(exceptions: unknown[], exists: (file: string) => boolean): string[] {
  const problems: string[] = [];
  exceptions.forEach((e, i) => {
    const at = `exceptions[${i}]`;
    const x = e as Partial<FileException> | null;
    if (typeof x?.file !== "string" || !x.file.trim()) problems.push(`${at}: names no file`);
    else if (typeof x.reason !== "string" || !x.reason.trim()) problems.push(`${at} (${x.file}): no reason. Say why this file needs a max-width query, or remove the exception.`);
    else if (!exists(x.file)) problems.push(`${at}: ${x.file} is not there. Remove the exception.`);
  });
  return problems;
}

/**
 * Digits become `#`, so a date or an amount in fixture data does not make the
 * same button a different one.
 */
export const normaliseElement = (element: string): string => element.replace(/("[^]*)$/, (text) => text.replace(/\d+/g, "#"));

const tally = <T>(items: T[], key: (t: T) => string): Map<string, { item: T; count: number }> => {
  const m = new Map<string, { item: T; count: number }>();
  for (const item of items) {
    const k = key(item);
    const had = m.get(k);
    if (had) had.count++;
    else m.set(k, { item, count: 1 });
  }
  return m;
};

export interface Judgement {
  /** Breaches the baseline does not cover: the gate fails on these. */
  fresh: string[];
  /** Baseline lines that claim more than is there now: the gate fails on these too, so the baseline only shrinks. */
  stale: string[];
  /** How many breaches the baseline covers. Printed every run, so the debt stays in sight. */
  known: number;
}

export function judgeStatic(findings: StaticFinding[], baseline: Baseline): Judgement {
  const byFile = tally(findings, (f) => f.file);
  const allowed = new Map(baseline.static.map((b) => [b.file, b.count]));
  const fresh: string[] = [];
  const stale: string[] = [];
  let known = 0;
  for (const [file, { count }] of byFile) {
    const allow = allowed.get(file) ?? 0;
    known += Math.min(count, allow);
    if (count > allow) {
      const here = findings.filter((f) => f.file === file);
      const lead = allow ? `${file}: ${count} desktop-first rules, the baseline allows ${allow}. One of these is new:` : `${file}:`;
      fresh.push(`${lead}\n${here.map((f) => `    line ${f.line}: ${f.what}`).join("\n")}`);
    }
  }
  for (const { file, count } of baseline.static) {
    const now = byFile.get(file)?.count ?? 0;
    if (now < count) stale.push(`${file}: the baseline allows ${count}, there ${now === 1 ? "is" : "are"} ${now} now. Lower it to ${now}${now ? "" : " (remove the line)"}.`);
  }
  return { fresh, stale, known };
}

const measuredKey = (route: string, check: string, element: string): string => `${route}\u0000${check}\u0000${element}`;

export function judgeMeasured(routes: MeasuredRoute[], baseline: Baseline): Judgement {
  const fresh: string[] = [];
  const stale: string[] = [];
  let known = 0;
  const allowed = new Map(baseline.measured.map((b) => [measuredKey(b.route, b.check, b.element), b.count]));
  const seen = new Map<string, number>();
  const measured = new Set(routes.map((r) => r.route));
  for (const { route, findings } of routes) {
    const counted = tally(findings, (f) => measuredKey(route, f.check, normaliseElement(f.element)));
    for (const [key, { item, count }] of counted) {
      seen.set(key, count);
      const allow = allowed.get(key) ?? 0;
      known += Math.min(count, allow);
      if (count > allow) {
        const times = allow ? ` (${count} found, the baseline allows ${allow})` : count > 1 ? ` (${count} of them)` : "";
        fresh.push(`${route}: ${LABEL[item.check]} ${item.element}: ${item.detail}${times}`);
      }
    }
  }
  const missing = new Set<string>();
  for (const b of baseline.measured) {
    const key = measuredKey(b.route, b.check, b.element);
    if (!measured.has(b.route)) {
      if (!missing.has(b.route)) stale.push(`${b.route}: in the baseline but not measured this run. Measure it, or remove its lines.`);
      missing.add(b.route);
      continue;
    }
    const now = seen.get(key) ?? 0;
    if (now < b.count) stale.push(`${b.route}: ${LABEL[b.check]} ${b.element}: the baseline allows ${b.count}, ${now} found. Lower it to ${now}${now ? "" : " (remove the line)"}.`);
  }
  return { fresh, stale, known };
}

const LABEL: Record<PhoneCheck, string> = {
  scroll: "scrolls sideways",
  target: "small target",
  field: "small field",
  text: "small text",
  title: "title cut off",
  overlap: "text overlaps text",
  action: "main action out of reach",
  layers: "fixed layers cover too much",
  landscape: "landscape screen eaten by fixed layers",
  image: "image not sized for its place",
  input: "wrong keyboard",
  autocomplete: "field the phone cannot fill in",
  tel: "phone number is not a link",
  linelength: "line too long",
  screens: "page too long for a phone",
};

/** The baseline that makes this run pass: what is there now, counted. */
export function writeBaseline(findings: StaticFinding[], routes: MeasuredRoute[], note?: string, previous?: Baseline): Baseline {
  const byFile = tally(findings, (f) => f.file);
  const measured = routes.flatMap(({ route, findings }) =>
    [...tally(findings, (f) => measuredKey(route, f.check, normaliseElement(f.element))).values()].map(({ item, count }) => ({ route, check: item.check, element: normaliseElement(item.element), count })),
  );
  // A rewrite never strips a named exception: its reason follows the entry.
  const staticReasons = new Map((previous?.static ?? []).filter(hasReason).map((b) => [b.file, b.reason!]));
  const measuredReasons = new Map((previous?.measured ?? []).filter(hasReason).map((b) => [measuredKey(b.route, b.check, b.element), b.reason!]));
  return {
    ...(note ? { note } : {}),
    static: [...byFile.values()]
      .map(({ item, count }) => ({ file: item.file, count, found: findings.filter((f) => f.file === item.file).map((f) => f.what), ...(staticReasons.has(item.file) ? { reason: staticReasons.get(item.file)! } : {}) }))
      .sort((a, b) => a.file.localeCompare(b.file)),
    measured: measured
      .map((m) => (measuredReasons.has(measuredKey(m.route, m.check, m.element)) ? { ...m, reason: measuredReasons.get(measuredKey(m.route, m.check, m.element))! } : m))
      .sort((a, b) => a.route.localeCompare(b.route) || a.check.localeCompare(b.check) || a.element.localeCompare(b.element)),
  };
}

/**
 * Entries the baseline holds that the base branch's copy does not, or holds
 * at a lower count, and that name no reason. The baseline lists the faults
 * that were there when the gate arrived; a new breach is fixed where it is.
 * An entry with a `reason` is a named exception and may be added or raised.
 */
export function judgeGrowth(current: Baseline, base: Baseline, baseName = "main"): string[] {
  const out: string[] = [];
  const baseStatic = new Map(base.static.map((b) => [b.file, b.count]));
  for (const b of current.static) {
    const was = baseStatic.get(b.file) ?? 0;
    if (b.count > was && !hasReason(b)) out.push(`${b.file}: ${was ? `${b.count} desktop-first rules, ${baseName} allows ${was}` : `${b.count} desktop-first rule${b.count === 1 ? "" : "s"} added to the baseline`}`);
  }
  const baseMeasured = new Map(base.measured.map((b) => [measuredKey(b.route, b.check, b.element), b.count]));
  for (const b of current.measured) {
    const was = baseMeasured.get(measuredKey(b.route, b.check, b.element)) ?? 0;
    if (b.count > was && !hasReason(b)) out.push(`${b.route}: ${LABEL[b.check]} ${b.element}: ${was ? `${b.count} in the baseline, ${baseName} allows ${was}` : `added to the baseline (${b.count})`}`);
  }
  return out;
}

/** Whether the baseline holds anything a reason does not name: only then is the base branch's copy needed. */
export const hasUnexcusedEntries = (b: Baseline): boolean => [...b.static, ...b.measured].some((e) => !hasReason(e));

const PAGE_FILE = /(?:^|\/)page\.(?:tsx|ts|jsx|js|mdx)$/;
const INTERCEPTING = /^\(\.{1,3}\)/;

/**
 * Page routes from the page files of a Next app directory, as paths relative
 * to it (`portal/(shell)/invoices/[id]/page.tsx`). Route groups `(x)`, parallel
 * slots `@x` and private folders `_x` are not part of the URL; an intercepting
 * route `(.)x` is a second way into a page, not a page of its own.
 */
export function routesFromPages(files: string[]): string[] {
  const routes = new Set<string>();
  for (const file of files) {
    const rel = file.replace(/\\/g, "/");
    if (!PAGE_FILE.test(rel)) continue;
    const dirs = rel.split("/").slice(0, -1);
    if (dirs.some((d) => INTERCEPTING.test(d) || d.startsWith("_"))) continue;
    const url = dirs.filter((d) => !/^\(.*\)$/.test(d) && !d.startsWith("@"));
    routes.add(`/${url.join("/")}`);
  }
  return [...routes].sort();
}

/** Page routes from Next's `app-path-routes-manifest.json` (`{ "/portal/page": "/portal" }`). Route handlers and internal `_` routes are not pages. */
export function routesFromManifest(manifest: unknown): string[] {
  const routes = new Set<string>();
  for (const [key, route] of Object.entries((manifest ?? {}) as Record<string, unknown>)) {
    if (!/(?:^|\/)page$/.test(key) || typeof route !== "string") continue;
    if (route.split("/").some((d) => d.startsWith("_"))) continue;
    routes.add(route);
  }
  return [...routes].sort();
}

export interface ExcludedRoute {
  route: string;
  reason: string;
}

const segmentsOf = (route: string): string[] => route.split("/").filter(Boolean);
// How specific a segment is, as Next ranks them: a name, then [id], then [...rest], then [[...rest]].
const rank = (seg: string): number => (seg.startsWith("[[...") ? 3 : seg.startsWith("[...") ? 2 : seg.startsWith("[") ? 1 : 0);

/** A route as the gate names it: no query, no hash, no trailing slash. */
export const cleanRoute = (route: string): string => {
  const path = route.replace(/[?#].*$/, "").replace(/\/+$/, "");
  return path === "" ? "/" : path;
};

/** Whether a measured route (`/portal/projects/p1`, or the pattern itself) is a page route (`/portal/projects/[id]`). */
export function routeMatches(pattern: string, route: string): boolean {
  if (pattern === route) return true;
  const want = segmentsOf(pattern);
  const have = segmentsOf(route);
  for (let i = 0; i < want.length; i++) {
    const seg = want[i];
    if (seg.startsWith("[[...")) return true;
    if (seg.startsWith("[...")) return have.length > i;
    if (have[i] === undefined) return false;
    if (!seg.startsWith("[") && seg !== have[i]) return false;
  }
  return want.length === have.length;
}

const moreSpecific = (a: string, b: string): boolean => {
  const x = segmentsOf(a).map(rank);
  const y = segmentsOf(b).map(rank);
  for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i] < y[i];
  return x.length > y.length;
};

/** `excludeRoutes` reaches a page by its route pattern, or by `/prefix/*` for the prefix and everything below it. */
const excludes = (entry: string, page: string): boolean => (entry.endsWith("/*") ? page === entry.slice(0, -2) || page.startsWith(entry.slice(0, -1)) : entry === page);

export interface RouteJudgement {
  /** Page routes nothing measured and no exclusion covers: the gate fails on these. */
  missing: string[];
  /** Problems with `excludeRoutes` itself: no reason, or names no page. */
  problems: string[];
  /** Pages measured or excluded with a reason. */
  covered: number;
}

/**
 * Every page route of the app is in the gate's route list. A measured route
 * counts for the most specific page it matches, so `/portal/projects/new` does
 * not cover `/portal/projects/[id]`. A page that only redirects measures
 * nothing: it is excluded with that reason.
 */
export function judgeRoutes(pages: string[], measuredRoutes: string[], excluded: ExcludedRoute[] = []): RouteJudgement {
  const problems: string[] = [];
  excluded.forEach((e, i) => {
    const at = `excludeRoutes[${i}]`;
    const x = e as Partial<ExcludedRoute> | null;
    if (typeof x?.route !== "string" || !x.route.startsWith("/")) problems.push(`${at}: names no route (start it with /)`);
    else if (typeof x.reason !== "string" || !x.reason.trim()) problems.push(`${at} (${x.route}): no reason. Say why the gate cannot measure this page, or remove the entry.`);
    else if (!pages.some((p) => excludes(x.route!, p))) problems.push(`${at}: ${x.route} is not a page route of the app. Remove the entry.`);
  });
  const named = excluded.filter((e) => typeof e?.route === "string" && typeof e.reason === "string" && e.reason.trim());
  const covered = new Set<string>();
  for (const route of measuredRoutes.map(cleanRoute)) {
    const hit = pages.filter((p) => routeMatches(p, route)).sort((a, b) => (moreSpecific(a, b) ? -1 : moreSpecific(b, a) ? 1 : 0))[0];
    if (hit) covered.add(hit);
  }
  for (const page of pages) if (named.some((e) => excludes(e.route, page))) covered.add(page);
  return { missing: pages.filter((p) => !covered.has(p)), problems, covered: covered.size };
}
