/**
 * `craft.config.json`: what a repo tells craft about itself.
 *
 * Pure: the command line reads the file and hands the parsed JSON here. The
 * design choices live in `art-direction.json`; this file is about the tool:
 * which paths are not the site, where the copy is, and a repo's own decisions
 * about a tell's severity.
 *
 *   {
 *     "ignore": ["docs/archive/**", "*.stories.tsx"],
 *     "copyPaths": ["content", "src/app"],
 *     "severity": {
 *       "ai-violet": { "level": "off", "because": "The client's shopfront has been this violet since 1998." },
 *       "em-dash": { "level": "block", "because": "House style for this client bans them outright." }
 *     }
 *   }
 *
 * A severity change needs a `because`, like an exception in
 * `art-direction.json`, and for the same reason: a tell switched off with no
 * reason is a guard nobody can audit. `off` becomes an exception, so the
 * report still lists what it silenced.
 */

import type { CheckReport, TellException } from "./types.js";

export type SeverityLevel = "warn" | "block" | "off";

export interface SeverityOverride {
  level: SeverityLevel;
  because: string;
}

export interface CraftConfig {
  /** Glob patterns for paths that are not the site. Added to `DEFAULT_IGNORE`. */
  ignore: string[];
  /** Where `craft copy` looks when no path is given. */
  copyPaths?: string[];
  severity: Record<string, SeverityOverride>;
}

/**
 * Agent and tool folders: instructions for the people and models building
 * the site, not copy a visitor reads. Always ignored by a directory walk.
 */
export const DEFAULT_IGNORE = [".claude", ".agents", ".cursor"];

const KEYS = new Set(["$schema", "ignore", "copyPaths", "severity"]);
const LEVELS = new Set<SeverityLevel>(["warn", "block", "off"]);
/** The same bar the exception rule sets: a sentence, not "brand". */
const MIN_BECAUSE = 12;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === "string");

/**
 * Validate a parsed `craft.config.json`. Throws with the file name and the
 * key at fault: a config that half-applies is worse than one that stops the
 * run.
 */
export function parseCraftConfig(data: unknown, knownTells: ReadonlySet<string>, source = "craft.config.json"): CraftConfig {
  if (!isRecord(data)) throw new Error(`${source}: expected an object`);
  for (const key of Object.keys(data)) if (!KEYS.has(key)) throw new Error(`${source}: unknown key "${key}"`);
  const ignore = data.ignore ?? [];
  if (!isStringArray(ignore)) throw new Error(`${source}: "ignore" must be an array of glob strings`);
  if (data.copyPaths !== undefined && !isStringArray(data.copyPaths)) throw new Error(`${source}: "copyPaths" must be an array of paths`);
  const severity: Record<string, SeverityOverride> = {};
  const raw = data.severity ?? {};
  if (!isRecord(raw)) throw new Error(`${source}: "severity" must map a tell id to { level, because }`);
  for (const [tell, value] of Object.entries(raw)) {
    if (!knownTells.has(tell)) throw new Error(`${source}: severity names no tell called "${tell}"`);
    if (!isRecord(value) || !LEVELS.has(value.level as SeverityLevel)) {
      throw new Error(`${source}: severity.${tell} needs a level of "warn", "block" or "off"`);
    }
    if (typeof value.because !== "string" || value.because.trim().length < MIN_BECAUSE) {
      throw new Error(`${source}: severity.${tell} needs a because of at least a sentence`);
    }
    severity[tell] = { level: value.level as SeverityLevel, because: value.because };
  }
  return { ignore, severity, ...(data.copyPaths ? { copyPaths: data.copyPaths as string[] } : {}) };
}

/**
 * A glob as a regular expression over a `/`-separated relative path.
 * `*` is one segment's worth, `**` any depth, `?` one character. A pattern
 * with no `/` matches a file or folder of that name anywhere; otherwise it is
 * anchored at the repo root. Anything under a matched folder matches too.
 */
export function globToRegExp(glob: string): RegExp {
  // A trailing `/**` is the folder and everything in it, which the suffix
  // below already matches.
  const pattern = glob.replace(/^\.\//, "").replace(/\/$/, "").replace(/\/\*\*$/, "");
  let body = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const c = pattern[i];
    if (c === "*" && pattern[i + 1] === "*") {
      const slash = pattern[i + 2] === "/";
      body += slash ? "(?:.*/)?" : ".*";
      i += slash ? 2 : 1;
    } else if (c === "*") body += "[^/]*";
    else if (c === "?") body += "[^/]";
    else body += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  const anywhere = !pattern.includes("/");
  return new RegExp(`^${anywhere ? "(?:.*/)?" : ""}${body}(?:/.*)?$`);
}

/** A matcher for a set of globs. Paths are normalised to `/` before matching. */
export function ignoreMatcher(patterns: string[]): (path: string) => boolean {
  const res = patterns.map(globToRegExp);
  return (path) => {
    const p = path.replace(/\\/g, "/").replace(/^\.\//, "");
    return res.some((re) => re.test(p));
  };
}

/** `off` entries, as exceptions: applied, and listed as silenced in the report. */
export function severityExceptions(config: CraftConfig): TellException[] {
  return Object.entries(config.severity)
    .filter(([, o]) => o.level === "off")
    .map(([tell, o]) => ({ tell, because: `craft.config.json: ${o.because}` }));
}

/** `warn` and `block` entries, applied to a finished report. */
export function applySeverity(report: CheckReport, config: CraftConfig): CheckReport {
  const findings = report.findings.map((f) => {
    const o = config.severity[f.tell];
    return o && o.level !== "off" ? { ...f, severity: o.level } : f;
  });
  return { ...report, findings, summary: { ...report.summary, blocking: findings.filter((f) => f.severity === "block").length } };
}
