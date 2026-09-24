/**
 * Baselines: adopt craft on a repo that already has findings, and fail only
 * on new ones.
 *
 * A finding is keyed on its tell, its path and a hash of its excerpt with the
 * whitespace collapsed, never on its line: an edit above a known finding
 * moves it, and a moved finding is not a new one. Keys are counted, so a file
 * with two identical findings and a baseline of one reports the second.
 *
 * Pure. The command line reads and writes the file.
 */

import type { CheckReport, Finding, Generation } from "./types.js";

export const BASELINE_VERSION = 1;

export interface BaselineEntry {
  tell: string;
  path: string;
  /** FNV-1a of the excerpt, whitespace collapsed. */
  excerpt: string;
  count: number;
}

export interface Baseline {
  version: typeof BASELINE_VERSION;
  catalogueVersion: string;
  entries: BaselineEntry[];
}

/** 32-bit FNV-1a, as 8 hex characters. Stable across machines and Node versions. */
export function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

const excerptHash = (f: Finding): string => fnv1a(f.excerpt.replace(/\s+/g, " ").trim());
const keyOf = (tell: string, path: string, excerpt: string): string => `${tell}\u0000${path}\u0000${excerpt}`;

/** The key a finding is matched on. Also the SARIF partial fingerprint. */
export function findingKey(f: Finding): string {
  return keyOf(f.tell, f.path, excerptHash(f));
}

/** Every finding in a report, as a baseline. */
export function createBaseline(report: CheckReport): Baseline {
  const counts = new Map<string, BaselineEntry>();
  for (const f of report.findings) {
    const excerpt = excerptHash(f);
    const key = keyOf(f.tell, f.path, excerpt);
    const entry = counts.get(key);
    if (entry) entry.count += 1;
    else counts.set(key, { tell: f.tell, path: f.path, excerpt, count: 1 });
  }
  const entries = [...counts.values()].sort((a, b) => a.path.localeCompare(b.path) || a.tell.localeCompare(b.tell) || a.excerpt.localeCompare(b.excerpt));
  return { version: BASELINE_VERSION, catalogueVersion: report.catalogueVersion, entries };
}

/** Validate a parsed baseline file. */
export function parseBaseline(data: unknown, source = "baseline"): Baseline {
  const b = data as Partial<Baseline> | null;
  if (!b || typeof b !== "object" || b.version !== BASELINE_VERSION || !Array.isArray(b.entries)) {
    throw new Error(`${source}: not a craft baseline (version ${BASELINE_VERSION})`);
  }
  for (const e of b.entries) {
    if (typeof e?.tell !== "string" || typeof e.path !== "string" || typeof e.excerpt !== "string" || !Number.isInteger(e.count) || e.count < 1) {
      throw new Error(`${source}: malformed entry ${JSON.stringify(e)}`);
    }
  }
  return b as Baseline;
}

/** A report's summary, recounted from its findings. */
export function recount(report: CheckReport, findings: Finding[]): CheckReport {
  const byGeneration: Record<Generation, number> = { 1: 0, 2: 0, 3: 0 };
  const byTell: Record<string, number> = {};
  for (const f of findings) {
    byGeneration[f.generation] += 1;
    byTell[f.tell] = (byTell[f.tell] ?? 0) + 1;
  }
  return {
    ...report,
    findings,
    summary: { ...report.summary, findings: findings.length, byGeneration, byTell, blocking: findings.filter((f) => f.severity === "block").length },
  };
}

/**
 * The report without the findings the baseline already knows about.
 * `baselined` is how many were removed, so the output can say so: a
 * baseline that hides findings silently is a hole.
 */
export function applyBaseline(report: CheckReport, baseline: Baseline): CheckReport & { baselined: number } {
  const remaining = new Map<string, number>();
  for (const e of baseline.entries) {
    const key = keyOf(e.tell, e.path, e.excerpt);
    remaining.set(key, (remaining.get(key) ?? 0) + e.count);
  }
  const kept: Finding[] = [];
  let baselined = 0;
  for (const f of report.findings) {
    const key = findingKey(f);
    const left = remaining.get(key) ?? 0;
    if (left > 0) {
      remaining.set(key, left - 1);
      baselined += 1;
    } else kept.push(f);
  }
  return { ...recount(report, kept), baselined };
}
