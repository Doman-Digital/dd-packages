/**
 * Running the catalogue: source scan and copy check.
 *
 * Both are pure over `{ path, text }[]`. The CLI reads files and git; a hook,
 * a CI job and trawl all call these with the same input and get the same
 * answer.
 */

import {
  AI_PHRASES,
  AI_WORDS,
  BUZZWORDS,
  COPY_TELLS,
  NEGATIVE_REASSURANCE,
  PLAINER_WORDS,
  REVIEW_PHRASES,
  STOCK_PHRASES,
  VAGUE_WORDS,
  RESEARCH_TELLS,
} from "./tells/copy.js";
import { DENSITY_TELLS } from "./tells/density.js";
import { SOURCE_TELLS } from "./tells/source.js";
import { houseRule } from "./house.js";
import { excerptAt, lineAt, parseFile } from "./parse.js";
import { extractCopy, extractStrings } from "./prose.js";
import { RENDERED_PATHS } from "../snapshot/rendered.js";
import type { Snapshot } from "../snapshot/types.js";
import type {
  CheckOptions,
  CheckReport,
  Finding,
  Generation,
  Hit,
  SourceFile,
  Tell,
  TellException,
} from "./types.js";

/**
 * Bumped whenever an entry is added, removed or its detection changes, so a
 * report can say which list it was judged against.
 */
export const CATALOGUE_VERSION = "2026.09.5";

export const CATALOGUE: readonly Tell[] = [...SOURCE_TELLS, ...COPY_TELLS, ...RESEARCH_TELLS, ...DENSITY_TELLS].map((t) =>
  RENDERED_PATHS[t.id] ? { ...t, rendered: RENDERED_PATHS[t.id] } : t,
);

export function tellById(id: string): Tell | undefined {
  return CATALOGUE.find((t) => t.id === id);
}

function validateExceptions(exceptions: TellException[]): {
  applied: TellException[];
  rejected: CheckReport["rejectedExceptions"];
} {
  const applied: TellException[] = [];
  const rejected: CheckReport["rejectedExceptions"] = [];
  for (const exception of exceptions) {
    if (!tellById(exception.tell)) {
      rejected.push({ exception, reason: `no tell called "${exception.tell}"` });
    } else if (typeof exception.because !== "string" || exception.because.trim().length < 12) {
      // The reason is the point. "brand" or "client asked" is not one.
      rejected.push({ exception, reason: "an exception needs a because of at least a sentence" });
    } else {
      applied.push(exception);
    }
  }
  return { applied, rejected };
}

/**
 * A one-off exception written where it applies: `copy-ok` or `craft-ok` on the
 * finding's line or the line directly above. For a real person's own words, a
 * testimonial or a quoted review, which must never be edited to pass.
 */
const MARKER = /\b(?:copy|craft)-ok\b/;

function marked(lines: string[], line: number): boolean {
  return MARKER.test(lines[line - 1] ?? "") || MARKER.test(lines[line - 2] ?? "");
}

function toFinding(tell: Tell, hit: Hit, texts: Map<string, string>): Finding {
  const text = texts.get(hit.path) ?? "";
  return {
    tell: tell.id,
    name: tell.name,
    generation: tell.generation,
    severity: tell.severity,
    path: hit.path,
    line: texts.has(hit.path) ? lineAt(text, hit.offset) : 0,
    excerpt: hit.excerpt ?? excerptAt(text, hit.offset),
    message: hit.message,
    fix: tell.fix,
    ...(tell.surface === "copy" ? { house: houseRule(tell.id, tell.name).tier } : {}),
  };
}

function report(
  tells: readonly Tell[],
  files: SourceFile[],
  run: (tell: Tell) => Hit[],
  options: CheckOptions,
): CheckReport {
  const { applied, rejected } = validateExceptions(options.exceptions ?? []);
  const texts = new Map(files.map((file) => [file.path, file.text]));
  const selected = options.only ? tells.filter((t) => options.only!.includes(t.id)) : tells;

  const findings: Finding[] = [];
  const suppressed: CheckReport["suppressed"] = [];
  const lineCache = new Map<string, string[]>();
  const linesOf = (path: string): string[] => {
    let lines = lineCache.get(path);
    if (!lines) lineCache.set(path, (lines = (texts.get(path) ?? "").split("\n")));
    return lines;
  };
  const excepted = new Map<TellException, number>();
  for (const tell of selected) {
    for (const hit of run(tell)) {
      const exception = applied.find((e) => e.tell === tell.id && (!e.path || hit.path.includes(e.path)));
      if (exception) {
        excepted.set(exception, (excepted.get(exception) ?? 0) + 1);
        continue;
      }
      const finding = toFinding(tell, hit, texts);
      if (marked(linesOf(hit.path), finding.line)) {
        suppressed.push({ tell: tell.id, path: finding.path, line: finding.line });
        continue;
      }
      findings.push(finding);
    }
  }
  findings.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.tell.localeCompare(b.tell));

  const byGeneration: Record<Generation, number> = { 1: 0, 2: 0, 3: 0 };
  const byTell: Record<string, number> = {};
  for (const finding of findings) {
    byGeneration[finding.generation] += 1;
    byTell[finding.tell] = (byTell[finding.tell] ?? 0) + 1;
  }

  return {
    catalogueVersion: CATALOGUE_VERSION,
    findings,
    rejectedExceptions: rejected,
    excepted: [...excepted].map(([e, count]) => ({ tell: e.tell, because: e.because, count })),
    suppressed,
    summary: {
      files: files.length,
      findings: findings.length,
      byGeneration,
      byTell,
      blocking: findings.filter((x) => x.severity === "block").length,
    },
  };
}

/**
 * Apply the house copy policy (`house.ts`): a finding from a house-blocking
 * tell becomes a block, so the run fails on it. Everything else keeps its
 * catalogue severity, which is `warn`.
 */
export function applyHouseGate(result: CheckReport): CheckReport {
  const findings = result.findings.map((f) => (f.house === "block" ? { ...f, severity: "block" as const } : f));
  return { ...result, findings, summary: { ...result.summary, blocking: findings.filter((f) => f.severity === "block").length } };
}

/** Scan markup, component code and stylesheets for design tells. */
export function scanSource(files: SourceFile[], options: CheckOptions = {}): CheckReport {
  const ctx = { files: files.map(parseFile) };
  const tells = CATALOGUE.filter((t) => t.surface === "source");
  return report(tells, files, (tell) => (tell.surface === "source" ? tell.detect(ctx) : []), options);
}

function copyContext(files: SourceFile[]) {
  return { files, blocks: files.flatMap(extractCopy), strings: files.flatMap(extractStrings) };
}

/** Check the prose in files for copy tells. */
export function checkCopy(files: SourceFile[], options: CheckOptions = {}): CheckReport {
  const ctx = copyContext(files);
  const tells = CATALOGUE.filter((t) => t.surface === "copy");
  return report(tells, files, (tell) => (tell.surface === "copy" ? tell.detect(ctx) : []), options);
}

/**
 * Judge a rendered page. Every tell with a rendered path runs over the
 * snapshot; findings carry the URL as their path and line 0.
 */
export function auditSnapshot(snapshot: Snapshot, options: CheckOptions = {}): CheckReport {
  const tells = CATALOGUE.filter((t) => t.rendered);
  const result = report(tells, [], (tell) => tell.rendered!.detect(snapshot), options);
  result.summary.files = 1;
  return result;
}

/** Run one tell's detector over some files. What the fixture test calls. */
export function runTell(tell: Tell, files: SourceFile[]): Hit[] {
  if (tell.surface === "source") return tell.detect({ files: files.map(parseFile) });
  return tell.detect(copyContext(files));
}

/**
 * The catalogue as a Markdown table. CHARACTER.md carries this between
 * markers, and a test fails if the two differ.
 */
export function catalogueTable(): string {
  const rows = CATALOGUE.map(
    (t) =>
      `| \`${t.id}\` | ${t.generation} | ${t.surface}${t.rendered ? " + rendered" : ""} | ${t.severity} | ${t.name} | ${t.why.replace(/\|/g, "\\|")} |`,
  );
  return [
    `Catalogue version \`${CATALOGUE_VERSION}\`, ${CATALOGUE.length} tells.`,
    "",
    "| Id | Gen | Surface | Severity | Tell | Why it is a default |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

/**
 * The copy word and phrase lists, as portable JSON.
 *
 * These are the only part of the copy catalogue a non-TypeScript consumer can
 * use directly: a word list is data, a regex-shaped tell (contrastive
 * negation, the "No X" badge, em dash, emoji) is not something worth
 * re-deriving from a JSON export, so those stay TypeScript-only here.
 *
 * `claude-kit`'s `copy_check.py` is the reason this exists. It hardcoded its
 * own copies of these same lists rather than reading this package, and the
 * two drifted (documented in claude-kit's `house-style/copy-rules.md`, "Note
 * the enforcement gap"). `word-lists.json` is the file that ends the drift:
 * `install/sync-copy-wordlists.sh` on that side copies it in verbatim, same
 * shape as `sync-craft-standard.sh` does for `STANDARD.md`. Regenerate the
 * checked-in `word-lists.json` with `pnpm --filter @domandigital/craft run
 * docs` after changing any list in `tells/copy.ts`.
 */
export function wordListsJson(): string {
  return (
    JSON.stringify(
      {
        catalogueVersion: CATALOGUE_VERSION,
        lists: {
          aiWords: AI_WORDS,
          stockPhrases: STOCK_PHRASES,
          aiPhrases: AI_PHRASES,
          plainerWords: PLAINER_WORDS,
          buzzwords: BUZZWORDS,
          negativeReassurance: NEGATIVE_REASSURANCE,
          vagueWords: VAGUE_WORDS,
          reviewPhrases: REVIEW_PHRASES,
        },
      },
      null,
      2,
    ) + "\n"
  );
}
