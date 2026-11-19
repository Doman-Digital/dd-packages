import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { capsuleWorkingCopy } from "./archive.js";
import { CAPSULE_FILE_PREFIX, isCapsuleFile, type Panel } from "./config.js";

/** Plain text from an HTML document: scripts and styles dropped, tags removed, entities decoded, blank runs collapsed. */
export function htmlToText(html: string): string {
  const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", middot: "·", rarr: "→", larr: "←", mdash: "—", ndash: "–", pound: "£", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", hellip: "…" };
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/(p|div|tr|li|h[1-6]|section|table|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") return String.fromCodePoint(e[1]?.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      return entities[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n[ \n]*/g, "\n")
    .trim();
}

export interface GradingContext {
  journeyMap: string;
  brandFacts: string;
  brandFactsVersion: string;
  knownStates: string[];
  notes: string[];
}

/** A grading path as a file on this machine: a `storage:capsule/...` path is joined to the capsule's working copy. */
export function resolveGradingPath(p: string, capsuleDir: () => string = capsuleWorkingCopy): string {
  return isCapsuleFile(p) ? join(capsuleDir(), p.slice(CAPSULE_FILE_PREFIX.length)) : p;
}

const describePath = (given: string, file: string): string => (given === file ? file : `${file} (from ${given})`);

export interface GradingFiles {
  journeyMap: string;
  brandFacts: string;
  facts: Record<string, unknown>;
}

/**
 * Finds and checks the grading files: the journey map must be a non-empty file, the brand facts must parse and hold
 * every section the panel includes. Run at the start of a run, before any buyer session is paid for, so a panel naming
 * a map that is gone (the v1 redesign map was, DOM-18300) is refused instead of graded against nothing.
 */
export function checkGrading(panel: Panel, capsuleDir: () => string = capsuleWorkingCopy): GradingFiles {
  const g = panel.grading;
  const journeyMap = resolveGradingPath(g.journeyMap, capsuleDir);
  if (!existsSync(journeyMap) || !statSync(journeyMap).isFile()) throw new Error(`grading.journeyMap: no file at ${describePath(g.journeyMap, journeyMap)}`);
  if (!readFileSync(journeyMap, "utf8").trim()) throw new Error(`grading.journeyMap: ${describePath(g.journeyMap, journeyMap)} is empty`);
  const brandFacts = resolveGradingPath(g.brandFacts.path, capsuleDir);
  if (!existsSync(brandFacts)) throw new Error(`grading.brandFacts.path: no file at ${describePath(g.brandFacts.path, brandFacts)}`);
  let facts: Record<string, unknown>;
  try {
    facts = JSON.parse(readFileSync(brandFacts, "utf8")) as Record<string, unknown>;
  } catch (e) {
    throw new Error(`grading.brandFacts.path: ${brandFacts} is not JSON (${(e as Error).message})`);
  }
  const missing = g.brandFacts.include.filter((key) => !(key in facts));
  if (missing.length) throw new Error(`brand facts: no section ${missing.map((k) => `"${k}"`).join(", ")} in ${brandFacts}`);
  return { journeyMap, brandFacts, facts };
}

/** The reference material only the evaluator gets. The buyer never sees any of it. */
export function loadGradingContext(panel: Panel, capsuleDir: () => string = capsuleWorkingCopy): GradingContext {
  const g = panel.grading;
  const files = checkGrading(panel, capsuleDir);
  const map = readFileSync(files.journeyMap, "utf8");
  const facts = files.facts;
  const subset: Record<string, unknown> = {};
  for (const key of g.brandFacts.include) subset[key] = facts[key];
  return {
    journeyMap: /\.html?$/i.test(files.journeyMap) ? htmlToText(map) : map,
    brandFacts: JSON.stringify(subset),
    brandFactsVersion: String(facts.version ?? "unknown"),
    knownStates: g.knownStates,
    notes: g.notes ?? [],
  };
}
