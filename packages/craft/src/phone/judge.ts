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
  findings: RawPhoneFinding[];
}

export interface Baseline {
  /** Why the baseline exists and which issue burns it down. Free text, for a person. */
  note?: string;
  static: { file: string; count: number; found?: string[] }[];
  measured: { route: string; check: PhoneCheck; element: string; count: number }[];
}

export const EMPTY_BASELINE: Baseline = { static: [], measured: [] };

// A media query whose condition caps the width. The prelude runs to the rule's `{` (or the `;` of @custom-media).
const MEDIA = /@(?:custom-)?media\b([^{;]*)/g;
const CAPS_WIDTH = /\bmax-(?:device-)?width\s*:|\bwidth\s*<|>=?\s*(?:device-)?width\b/i;
// A Tailwind max-* variant. Single-word CSS properties and media features spelt max-* are not variants.
const VARIANT = /(?<![\w@-])max-(\[[^\]\s]+\]|[a-z0-9]+):/g;
const NOT_VARIANTS = new Set(["width", "height", "lines", "resolution", "zoom", "inline-size", "block-size"]);
const OK = /mobile-first-ok\b:?(.*)/;

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
export function scanPhoneFirst(files: SourceFile[], exceptions: FileException[] = []): { findings: StaticFinding[]; excused: number } {
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
    for (const { line, what } of found.sort((a, b) => a.line - b.line)) {
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
};

/** The baseline that makes this run pass: what is there now, counted. */
export function writeBaseline(findings: StaticFinding[], routes: MeasuredRoute[], note?: string): Baseline {
  const byFile = tally(findings, (f) => f.file);
  const measured = routes.flatMap(({ route, findings }) =>
    [...tally(findings, (f) => measuredKey(route, f.check, normaliseElement(f.element))).values()].map(({ item, count }) => ({ route, check: item.check, element: normaliseElement(item.element), count })),
  );
  return {
    ...(note ? { note } : {}),
    static: [...byFile.values()]
      .map(({ item, count }) => ({ file: item.file, count, found: findings.filter((f) => f.file === item.file).map((f) => f.what) }))
      .sort((a, b) => a.file.localeCompare(b.file)),
    measured: measured.sort((a, b) => a.route.localeCompare(b.route) || a.check.localeCompare(b.check) || a.element.localeCompare(b.element)),
  };
}
