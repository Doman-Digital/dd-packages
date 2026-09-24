/**
 * `craft`: the command line over the catalogue.
 *
 * All I/O lives here. The checks themselves are pure, so this file is the only
 * part that knows about the filesystem, git or exit codes.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { applyBaseline, createBaseline, parseBaseline } from "./baseline.js";
import { CATALOGUE, CATALOGUE_VERSION, applyHouseGate, checkCopy, scanSource } from "./check.js";
import { type CraftConfig, DEFAULT_IGNORE, applySeverity, ignoreMatcher, parseCraftConfig, severityExceptions } from "./config.js";
import { toJson } from "./json.js";
import { toSarif } from "./sarif.js";
import { houseRule } from "./house.js";
import { findClaims, formatClaims } from "./claims.js";
import { compareFacts, formatComparison, visibleText } from "./facts.js";
import { formatReport } from "./format.js";
import { fileKind } from "./parse.js";
import type { CheckReport, SourceFile, TellException } from "./types.js";

export interface Io {
  cwd: string;
  out(text: string): void;
  err(text: string): void;
}

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "out", ".next", ".turbo", ".vercel", "coverage", "vendor", ".cache"]);
const MAX_BYTES = 1_000_000;
/** Documents for the people who build the site, not the people who visit it. */
const NOT_SITE_COPY = /^(?:README|CHANGELOG|CLAUDE|AGENTS|CONTRIBUTING|LICENSE|CODE_OF_CONDUCT|SECURITY)(?:\.[a-z]+)?$/i;

const HELP = `craft: find the AI look and say what to do instead.

Usage
  craft scan [paths...] [--staged] [--json] [--strict] [--direction <file>] [ci options]
  craft copy [paths...] [--gate] [--json] [--strict] [--direction <file>] [ci options]
  craft copy compare <before> <after> [--json]
  craft copy claims <paths...> [--json]
  craft tells list [--json]
  craft tells harvest <null.json | dir>... [--share 0.25] [--json]
  craft snapshot <url> [--out <file>] [--width <px>] [--height <px>]
  craft audit <url | snapshot.json> [--repo <dir>] [--null <null.json>] [--out <file>] [--json] [--strict] [ci options]
  craft audit --pages <sitemap.xml | urls.txt> [--viewport 390,768,1440] [the same]
  craft direction init [--snapshot <file>] [--client <name>] [--out <file>]
  craft direction validate [--snapshot <file>] [--direction <file>] [--json]
  craft direction propose [--snapshot <file>] [--estate <estate.json | dir>] [--out <file>]
  craft null build --brief "<text>" --out <dir> [--runs 20] [--parallel 4] [--model <name>]
  craft estate add <url | snapshot.json> --id <id> [--client <name>] [--estate <file>]
  craft estate compare [<url | snapshot.json | id>] [--null <dir>] [--json] [--strict]
  craft report <url | snapshot.json> [--repo <dir>] [--null <dir>] [--estate <file>] [--direction <file>] [--json] [--strict]
  craft retrofit <url | snapshot.json> [the same] [--out RETROFIT.md]

scan      Markup, component code and stylesheets (source and compiled CSS).
          --staged reads the git index, for a pre-commit hook.
copy      The prose in Markdown, markup and content files.
          --gate applies the house copy policy: the blocking tier of COPY.md
          fails the run. What copy-check and the pre-commit hook run.
          compare lists the protected facts (prices, numbers, dates, times,
          phones, emails, links, postcodes, names) a rewrite lost or added.
          Exit 1 if any: restore it, source it, or say why.
          claims lists every sentence holding a price, figure, date or named
          source, marked sourced or UNSOURCED, for a person to check against
          the primary source. It cannot tell true from false. Always exit 0.
tells     The catalogue this build judges against. harvest reads null models
          for choices the model keeps making that the catalogue does not know.
snapshot  Render a page in a browser and save what it looks like, as JSON.
audit     Judge a rendered page (live, or a saved snapshot) and fingerprint it.
          --repo also scans that site's source, so one report covers both.
          --null scores how typical it is against a null model (comma-separate
          several to pool them).
          --pages audits every URL in a sitemap (a URL or a file) or a file of
          URLs, one per line. --viewport audits each page at these widths.
          snapshot and audit need Playwright: npm i -D playwright.
direction The site's art-direction.json: every choice with a reason from the
          client's world. init writes today's choices with empty reasons;
          validate applies the reason rule; propose reads colours off the
          sources' PNG photos and drafts choices for a person to confirm.
null      The counterfactual: about 20 pages \`claude -p\` builds from the brief
          alone, snapshotted and fingerprinted into null.json. Resumable.
estate    The register of shipped sites (estate.json). add fingerprints a site;
          compare lists the nearest, and marks siblings: two sites closer than
          two pages Claude builds for one brief. --strict exits 1 on a sibling.
report    Every signal for one site: tells, typicality, the estate, the reasons.
          A verdict (default, mixed, decided, unproven) and what to do, in order.
          Anything not given is "not measured", and never counts as a pass.
retrofit  The report as a checklist: decide, then change type, colour, shape,
          effects, motion and copy. Never the page grammar.

ci options (scan, copy, audit)
  --baseline <file>     Report only findings the baseline does not already
                        hold. Keyed on tell, path and excerpt, not line.
  --update-baseline     Write every current finding to --baseline, exit 0.
  --sarif <file>        Also write SARIF 2.1.0, for GitHub code scanning.
  --config <file>       craft.config.json, default: the working directory.

Exceptions come from art-direction.json in the working directory, or --direction.
craft.config.json holds ignore globs, copyPaths, and severity changes, each
with a because. .claude, .agents and .cursor are never walked.
Every tell ships as warn: exit 1 only on a block, or on any finding with --strict.
--json output always carries schemaVersion.`;

export interface Flags {
  positional: string[];
  json: boolean;
  strict: boolean;
  staged: boolean;
  gate: boolean;
  updateBaseline: boolean;
  direction?: string;
  config?: string;
  baseline?: string;
  sarif?: string;
  pages?: string;
  viewport?: string;
  out?: string;
  repo?: string;
  width?: string;
  height?: string;
  snapshot?: string;
  estate?: string;
  client?: string;
  brief?: string;
  runs?: string;
  parallel?: string;
  model?: string;
  share?: string;
  null?: string;
  id?: string;
}

const VALUE_FLAGS = {
  "--direction": "direction",
  "--out": "out",
  "--repo": "repo",
  "--width": "width",
  "--height": "height",
  "--snapshot": "snapshot",
  "--estate": "estate",
  "--client": "client",
  "--brief": "brief",
  "--runs": "runs",
  "--parallel": "parallel",
  "--model": "model",
  "--share": "share",
  "--null": "null",
  "--id": "id",
  "--config": "config",
  "--baseline": "baseline",
  "--sarif": "sarif",
  "--pages": "pages",
  "--viewport": "viewport",
} as const;

export function parseFlags(args: string[]): Flags | string {
  const flags: Flags = { positional: [], json: false, strict: false, staged: false, gate: false, updateBaseline: false };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--json") flags.json = true;
    else if (a === "--strict") flags.strict = true;
    else if (a === "--staged") flags.staged = true;
    else if (a === "--gate") flags.gate = true;
    else if (a === "--update-baseline") flags.updateBaseline = true;
    else if (a in VALUE_FLAGS) {
      const value = args[i + 1];
      i += 1;
      if (!value || value.startsWith("--")) return `${a} needs a value`;
      flags[VALUE_FLAGS[a as keyof typeof VALUE_FLAGS]] = value;
    } else if (a.startsWith("--")) return `unknown option ${a}`;
    else flags.positional.push(a);
  }
  return flags;
}

function walk(
  root: string,
  cwd: string,
  into: SourceFile[],
  wanted: (name: string) => boolean,
  skipDir = (_: string) => false,
  ignored = (_: string) => false,
): void {
  const stat = statSync(root);
  if (stat.isFile()) {
    if (stat.size <= MAX_BYTES) into.push({ path: relative(cwd, root) || root, text: readFileSync(root, "utf8") });
    return;
  }
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (ignored(relative(cwd, path))) continue;
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && !skipDir(entry.name)) walk(path, cwd, into, wanted, skipDir, ignored);
    } else if (entry.isFile() && wanted(entry.name)) {
      walk(path, cwd, into, wanted, skipDir, ignored);
    }
  }
}

/**
 * A path named on the command line is always read. Filters apply only to what
 * a directory walk finds, so `craft copy README.md` still checks the README.
 * `ignore` is `craft.config.json`'s globs; `DEFAULT_IGNORE` always applies.
 */
export function readPaths(
  paths: string[],
  cwd: string,
  wanted: (name: string) => boolean,
  skipDir?: (name: string) => boolean,
  ignore: string[] = [],
): SourceFile[] {
  const files: SourceFile[] = [];
  const ignored = ignoreMatcher([...DEFAULT_IGNORE, ...ignore]);
  for (const p of paths) {
    const abs = resolve(cwd, p);
    if (!existsSync(abs)) throw new Error(`no such path: ${p}`);
    walk(abs, cwd, files, wanted, skipDir, ignored);
  }
  return files;
}

function readStaged(cwd: string, wanted: (path: string) => boolean, ignore: string[]): SourceFile[] {
  const ignored = ignoreMatcher([...DEFAULT_IGNORE, ...ignore]);
  const names = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"], { cwd, encoding: "utf8" })
    .split("\0")
    .filter((p) => p && wanted(p) && !ignored(p));
  return names.map((path) => ({
    path,
    // The index, not the working tree: the commit is what gets checked.
    text: execFileSync("git", ["show", `:${path}`], { cwd, encoding: "utf8", maxBuffer: MAX_BYTES * 4 }),
  }));
}

const NO_CONFIG: CraftConfig = { ignore: [], severity: {} };

/** `craft.config.json` in `root`, or `--config`. None is an empty config. */
export function loadConfig(flags: Flags, root: string): CraftConfig {
  const path = resolve(root, flags.config ?? "craft.config.json");
  if (!existsSync(path)) {
    if (flags.config) throw new Error(`no such file: ${flags.config}`);
    return NO_CONFIG;
  }
  return parseCraftConfig(JSON.parse(readFileSync(path, "utf8")), new Set(CATALOGUE.map((t) => t.id)), flags.config ?? "craft.config.json");
}

/** Exceptions from art-direction.json, and every `off` in craft.config.json. */
export function loadExceptions(flags: Flags, cwd: string): TellException[] {
  const fromConfig = severityExceptions(loadConfig(flags, cwd));
  const path = resolve(cwd, flags.direction ?? "art-direction.json");
  if (!existsSync(path)) {
    if (flags.direction) throw new Error(`no such file: ${flags.direction}`);
    return fromConfig;
  }
  const data = JSON.parse(readFileSync(path, "utf8")) as { exceptions?: TellException[] };
  return [...(Array.isArray(data.exceptions) ? data.exceptions : []), ...fromConfig];
}

/**
 * The ci options, in order: the config's severity changes, then the
 * baseline (written, or subtracted), then SARIF. Returns `null` when the run
 * only wrote a baseline.
 */
export function prepareReport(report: CheckReport, flags: Flags, io: Io, config: CraftConfig): (CheckReport & { baselined?: number }) | null {
  let result: CheckReport & { baselined?: number } = applySeverity(report, config);
  if (flags.updateBaseline) {
    if (!flags.baseline) throw new Error("--update-baseline needs --baseline <file>");
    const baseline = createBaseline(result);
    writeFileSync(resolve(io.cwd, flags.baseline), `${JSON.stringify(baseline, null, 2)}\n`);
    io.out(`craft: baseline of ${result.findings.length} finding${result.findings.length === 1 ? "" : "s"} written to ${flags.baseline}`);
    return null;
  }
  if (flags.baseline) {
    const path = resolve(io.cwd, flags.baseline);
    if (!existsSync(path)) throw new Error(`no such file: ${flags.baseline} (create it with --update-baseline)`);
    result = applyBaseline(result, parseBaseline(JSON.parse(readFileSync(path, "utf8")), flags.baseline));
  }
  if (flags.sarif) {
    writeFileSync(resolve(io.cwd, flags.sarif), `${JSON.stringify(toSarif(result, { tells: CATALOGUE }), null, 2)}\n`);
  }
  return result;
}

export function finish(report: CheckReport & { baselined?: number }, flags: Flags, title: string, io: Io): number {
  io.out(flags.json ? toJson(report) : formatReport(report, title));
  if (!flags.json && report.baselined) {
    io.out(`${report.baselined} known finding${report.baselined === 1 ? "" : "s"} not shown: already in ${flags.baseline}.`);
  }
  if (report.summary.blocking > 0) return 1;
  if (flags.strict && report.summary.findings > 0) return 1;
  return 0;
}

export const SOURCE_FILE = (p: string): boolean => ["markup", "script", "css"].includes(fileKind(p)) && !/\.d\.ts$|\.min\.js$/.test(p);
export const COPY_FILE = (p: string): boolean =>
  (["markup", "prose", "script"].includes(fileKind(p)) || /\.jsonl?$/i.test(p)) && !NOT_SITE_COPY.test(p.split("/").pop() ?? p) && !/(?:^|\/)(?:package(?:-lock)?|tsconfig[\w.-]*|art-direction)\.json$/.test(p);
/** Folders prefixed `_` hold notes and drafts by convention. */
export const NOT_COPY_DIR = (name: string): boolean => name.startsWith("_");

export function run(argv: string[], io: Io): number | Promise<number> {
  const [command, ...rest] = argv;
  if (command === "direction") {
    return import("../direction/cli.js").then((m) => m.runDirection(rest, io));
  }
  if (command === "report" || command === "retrofit") {
    return import("../report/cli.js").then((m) => m.runReport(command, rest, io));
  }
  if (command === "estate") {
    return import("../estate/cli.js").then((m) => m.runEstate(rest, io));
  }
  if (command === "null") {
    return import("../null/cli.js").then((m) => m.runNull(rest, io));
  }
  if (command === "tells" && rest[0] === "harvest") {
    return import("../null/cli.js")
      .then((m) => m.runHarvest(rest, io))
      .catch((error: Error) => {
        io.err(`craft: ${error.message}`);
        return 2;
      });
  }
  if (command === "snapshot" || command === "audit") {
    // Loaded only here: the browser half never touches a scan or a copy check.
    return import("../audit/cli.js").then((m) => m.runAudit(command, rest, io));
  }
  if (!command || command === "help" || command === "--help" || command === "-h") {
    io.out(HELP);
    return command ? 0 : 2;
  }

  try {
    if (command === "tells") {
      const flags = parseFlags(rest);
      if (typeof flags === "string") throw new Error(flags);
      if (flags.positional[0] !== "list") throw new Error("usage: craft tells list [--json] | craft tells harvest <null.json>...");
      if (flags.json) {
        // `house` is the copy policy: copy-check reads it rather than keeping its own list.
        const data = CATALOGUE.map(({ id, name, generation, surface, severity, why, fix }) => ({
          id, name, generation, surface, severity, why, fix,
          ...(surface === "copy" ? { house: houseRule(id, name).tier, houseLabel: houseRule(id, name).label } : {}),
        }));
        io.out(toJson({ version: CATALOGUE_VERSION, tells: data }));
      } else {
        io.out(`Catalogue ${CATALOGUE_VERSION}`);
        for (const t of CATALOGUE) io.out(`  ${t.id.padEnd(24)} gen ${t.generation}  ${t.surface.padEnd(6)}  ${t.name}`);
      }
      return 0;
    }

    if (command === "copy" && rest[0] === "compare") {
      const flags = parseFlags(rest.slice(1));
      if (typeof flags === "string") throw new Error(flags);
      if (flags.positional.length !== 2) throw new Error("usage: craft copy compare <before> <after> [--json]");
      const [before, after] = flags.positional.map((p) => {
        const abs = resolve(io.cwd, p);
        if (!existsSync(abs)) throw new Error(`no such path: ${p}`);
        return visibleText({ path: p, text: readFileSync(abs, "utf8") });
      });
      const result = compareFacts(before, after);
      io.out(flags.json ? toJson(result) : formatComparison(result, flags.positional[0], flags.positional[1]));
      return result.lost.length || result.added.length ? 1 : 0;
    }

    if (command === "copy" && rest[0] === "claims") {
      const flags = parseFlags(rest.slice(1));
      if (typeof flags === "string") throw new Error(flags);
      if (flags.positional.length === 0) throw new Error("usage: craft copy claims <paths...> [--json]");
      const report = findClaims(readPaths(flags.positional, io.cwd, COPY_FILE, NOT_COPY_DIR));
      io.out(flags.json ? toJson(report) : formatClaims(report));
      // A checklist, not a gate: nothing here is a verdict.
      return 0;
    }

    if (command === "scan" || command === "copy") {
      const flags = parseFlags(rest);
      if (typeof flags === "string") throw new Error(flags);
      const wanted = command === "scan" ? SOURCE_FILE : COPY_FILE;
      const config = loadConfig(flags, io.cwd);
      const paths = flags.positional.length > 0 ? flags.positional : command === "copy" ? config.copyPaths ?? [] : ["."];
      if (command === "copy" && paths.length === 0 && !flags.staged) throw new Error("usage: craft copy <paths...> (or copyPaths in craft.config.json)");
      const files = flags.staged
        ? readStaged(io.cwd, wanted, config.ignore)
        : readPaths(paths, io.cwd, wanted, command === "copy" ? NOT_COPY_DIR : undefined, config.ignore);
      const exceptions = loadExceptions(flags, io.cwd);
      let report = command === "scan" ? scanSource(files, { exceptions }) : checkCopy(files, { exceptions });
      if (command === "copy" && flags.gate) report = applyHouseGate(report);
      const prepared = prepareReport(report, flags, io, config);
      if (!prepared) return 0;
      return finish(prepared, flags, command === "scan" ? "craft scan" : "craft copy", io);
    }

    throw new Error(`unknown command "${command}". Run craft --help.`);
  } catch (error) {
    io.err(`craft: ${(error as Error).message}`);
    return 2;
  }
}
