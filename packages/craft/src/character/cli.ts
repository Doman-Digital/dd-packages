/**
 * `craft`: the command line over the catalogue.
 *
 * All I/O lives here. The checks themselves are pure, so this file is the only
 * part that knows about the filesystem, git or exit codes.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { CATALOGUE, CATALOGUE_VERSION, checkCopy, scanSource } from "./check.js";
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
  craft scan [paths...] [--staged] [--json] [--strict] [--direction <file>]
  craft copy <paths...> [--json] [--strict] [--direction <file>]
  craft tells list [--json]

scan    Markup, component code and stylesheets (source and compiled CSS).
        --staged reads the git index, for a pre-commit hook.
copy    The prose in Markdown, markup and content files.
tells   The catalogue this build judges against.

Exceptions come from art-direction.json in the working directory, or --direction.
Every tell ships as warn: exit 1 only on a block, or on any finding with --strict.`;

interface Flags {
  positional: string[];
  json: boolean;
  strict: boolean;
  staged: boolean;
  direction?: string;
}

function parseFlags(args: string[]): Flags | string {
  const flags: Flags = { positional: [], json: false, strict: false, staged: false };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--json") flags.json = true;
    else if (a === "--strict") flags.strict = true;
    else if (a === "--staged") flags.staged = true;
    else if (a === "--direction") {
      flags.direction = args[i + 1];
      i += 1;
      if (!flags.direction) return "--direction needs a file";
    } else if (a.startsWith("--")) return `unknown option ${a}`;
    else flags.positional.push(a);
  }
  return flags;
}

function walk(root: string, cwd: string, into: SourceFile[], wanted: (name: string) => boolean, skipDir = (_: string) => false): void {
  const stat = statSync(root);
  if (stat.isFile()) {
    if (stat.size <= MAX_BYTES) into.push({ path: relative(cwd, root) || root, text: readFileSync(root, "utf8") });
    return;
  }
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && !skipDir(entry.name)) walk(join(root, entry.name), cwd, into, wanted, skipDir);
    } else if (entry.isFile() && wanted(entry.name)) {
      walk(join(root, entry.name), cwd, into, wanted, skipDir);
    }
  }
}

/**
 * A path named on the command line is always read. Filters apply only to what
 * a directory walk finds, so `craft copy README.md` still checks the README.
 */
function readPaths(paths: string[], cwd: string, wanted: (name: string) => boolean, skipDir?: (name: string) => boolean): SourceFile[] {
  const files: SourceFile[] = [];
  for (const p of paths) {
    const abs = resolve(cwd, p);
    if (!existsSync(abs)) throw new Error(`no such path: ${p}`);
    walk(abs, cwd, files, wanted, skipDir);
  }
  return files;
}

function readStaged(cwd: string, wanted: (path: string) => boolean): SourceFile[] {
  const names = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"], { cwd, encoding: "utf8" })
    .split("\0")
    .filter((p) => p && wanted(p));
  return names.map((path) => ({
    path,
    // The index, not the working tree: the commit is what gets checked.
    text: execFileSync("git", ["show", `:${path}`], { cwd, encoding: "utf8", maxBuffer: MAX_BYTES * 4 }),
  }));
}

function loadExceptions(flags: Flags, cwd: string): TellException[] {
  const path = resolve(cwd, flags.direction ?? "art-direction.json");
  if (!existsSync(path)) {
    if (flags.direction) throw new Error(`no such file: ${flags.direction}`);
    return [];
  }
  const data = JSON.parse(readFileSync(path, "utf8")) as { exceptions?: TellException[] };
  return Array.isArray(data.exceptions) ? data.exceptions : [];
}

function finish(report: CheckReport, flags: Flags, title: string, io: Io): number {
  io.out(flags.json ? JSON.stringify(report, null, 2) : formatReport(report, title));
  if (report.summary.blocking > 0) return 1;
  if (flags.strict && report.summary.findings > 0) return 1;
  return 0;
}

const SOURCE_FILE = (p: string): boolean => ["markup", "script", "css"].includes(fileKind(p)) && !/\.d\.ts$|\.min\.js$/.test(p);
const COPY_FILE = (p: string): boolean =>
  (["markup", "prose", "script"].includes(fileKind(p)) || /\.jsonl?$/i.test(p)) && !NOT_SITE_COPY.test(p.split("/").pop() ?? p) && !/(?:^|\/)(?:package(?:-lock)?|tsconfig[\w.-]*|art-direction)\.json$/.test(p);
/** Folders prefixed `_` hold notes and drafts by convention. */
const NOT_COPY_DIR = (name: string): boolean => name.startsWith("_");

export function run(argv: string[], io: Io): number {
  const [command, ...rest] = argv;
  if (!command || command === "help" || command === "--help" || command === "-h") {
    io.out(HELP);
    return command ? 0 : 2;
  }

  try {
    if (command === "tells") {
      const flags = parseFlags(rest);
      if (typeof flags === "string") throw new Error(flags);
      if (flags.positional[0] !== "list") throw new Error("usage: craft tells list [--json]");
      if (flags.json) {
        const data = CATALOGUE.map(({ id, name, generation, surface, severity, why, fix }) => ({ id, name, generation, surface, severity, why, fix }));
        io.out(JSON.stringify({ version: CATALOGUE_VERSION, tells: data }, null, 2));
      } else {
        io.out(`Catalogue ${CATALOGUE_VERSION}`);
        for (const t of CATALOGUE) io.out(`  ${t.id.padEnd(24)} gen ${t.generation}  ${t.surface.padEnd(6)}  ${t.name}`);
      }
      return 0;
    }

    if (command === "scan" || command === "copy") {
      const flags = parseFlags(rest);
      if (typeof flags === "string") throw new Error(flags);
      const wanted = command === "scan" ? SOURCE_FILE : COPY_FILE;
      if (command === "copy" && flags.positional.length === 0 && !flags.staged) throw new Error("usage: craft copy <paths...>");
      const files = flags.staged
        ? readStaged(io.cwd, wanted)
        : readPaths(flags.positional.length > 0 ? flags.positional : ["."], io.cwd, wanted, command === "copy" ? NOT_COPY_DIR : undefined);
      const exceptions = loadExceptions(flags, io.cwd);
      const report = command === "scan" ? scanSource(files, { exceptions }) : checkCopy(files, { exceptions });
      return finish(report, flags, command === "scan" ? "craft scan" : "craft copy", io);
    }

    throw new Error(`unknown command "${command}". Run craft --help.`);
  } catch (error) {
    io.err(`craft: ${(error as Error).message}`);
    return 2;
  }
}
