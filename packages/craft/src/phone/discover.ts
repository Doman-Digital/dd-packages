/**
 * What `craft phone-first` reads from the repo around it, apart from the
 * measured files: the app's page files, its tailwindcss version, and the base
 * branch's copy of the baseline (DOM-1053). Disk and git work only; the
 * judging is in ./judge.ts.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { parseBaseline, routesFromManifest, routesFromPages, type Baseline } from "./judge.js";

const PAGE_FILE = /^page\.(?:tsx|ts|jsx|js|mdx)$/;

function pageFiles(dir: string, base = dir, into: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && !entry.name.startsWith(".")) pageFiles(join(dir, entry.name), base, into);
    } else if (entry.isFile() && PAGE_FILE.test(entry.name)) into.push(relative(base, join(dir, entry.name)));
  }
  return into;
}

/**
 * The page routes of the app, and where they came from. `appDir` names the
 * Next app folders; left out, any `source` folder called `app` (or holding an
 * `app` or `src/app`) that has page files is one. `routesManifest` reads a
 * built app's `app-path-routes-manifest.json` as well.
 */
export function discoverRoutes(cwd: string, source: string[], appDir?: string | string[], routesManifest?: string): { routes: string[]; from: string[] } {
  const explicit = appDir === undefined ? undefined : Array.isArray(appDir) ? appDir : [appDir];
  const candidates = explicit ?? source.flatMap((s) => [s, join(s, "app"), join(s, "src", "app")]).filter((s) => basename(resolve(cwd, s)) === "app");
  const routes = new Set<string>();
  const from: string[] = [];
  for (const dir of candidates) {
    const abs = resolve(cwd, dir);
    if (!existsSync(abs)) {
      if (explicit) throw new Error(`appDir ${dir} is not there`);
      continue;
    }
    const pages = pageFiles(abs);
    if (pages.length === 0) continue;
    from.push(dir);
    for (const r of routesFromPages(pages)) routes.add(r);
  }
  if (routesManifest) {
    const file = resolve(cwd, routesManifest);
    if (!existsSync(file)) throw new Error(`routesManifest ${routesManifest} is not there. Build the app first, or use appDir.`);
    from.push(routesManifest);
    for (const r of routesFromManifest(JSON.parse(readFileSync(file, "utf8")))) routes.add(r);
  }
  return { routes: [...routes].sort(), from };
}

const majorOf = (range: unknown): number | null => {
  if (typeof range !== "string" || /^(?:catalog|workspace|link|file):/.test(range)) return null;
  const m = range.match(/\d+/);
  return m ? Number(m[0]) : null;
};

const readJson = (file: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
};

/**
 * The tailwindcss major an app folder builds with: the installed package
 * nearest above it, else the nearest package.json that declares it. `null`
 * when the folder has no tailwindcss to find.
 */
export function tailwindMajor(dir: string): number | null {
  for (let at = resolve(dir); ; at = dirname(at)) {
    const installed = majorOf(readJson(join(at, "node_modules", "tailwindcss", "package.json"))?.version);
    if (installed !== null) return installed;
    const pkg = readJson(join(at, "package.json"));
    const declared = majorOf((pkg?.dependencies as Record<string, unknown> | undefined)?.tailwindcss) ?? majorOf((pkg?.devDependencies as Record<string, unknown> | undefined)?.tailwindcss);
    if (declared !== null) return declared;
    if (dirname(at) === at) return null;
  }
}

/**
 * Whether a source file belongs to a tailwindcss v3 app. `forced` is
 * phone-first.json's `tailwind` for the odd setup; left out, each source
 * folder is asked.
 */
export function tailwind3Files(cwd: string, source: string[], forced?: number): { isV3: (path: string) => boolean; versions: Record<string, number | null> } {
  const dirs = source.map((s) => resolve(cwd, s));
  const versions = Object.fromEntries(source.map((s, i) => [s, forced ?? tailwindMajor(dirs[i])]));
  return {
    versions,
    isV3: (path) => {
      const abs = resolve(cwd, path);
      return source.some((s, i) => (abs === dirs[i] || abs.startsWith(dirs[i] + sep)) && versions[s] === 3);
    },
  };
}

const git = (cwd: string, args: string[]): string => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

export type BaseCopy =
  | { kind: "found"; ref: string; baseline: Baseline }
  /** The base branch has no baseline yet: this is the PR that brings the gate in. */
  | { kind: "no-file"; ref: string }
  /** Not a git checkout: there is no base branch to compare with. */
  | { kind: "not-git" }
  /** A git checkout that cannot see the base branch (a shallow clone): the gate cannot judge, so it fails. */
  | { kind: "no-ref"; ref: string };

/** The base ref: `--base`, else the pull request's target branch on GitHub, else `origin/main`. */
export const defaultBase = (flag: string | undefined, env: NodeJS.ProcessEnv = process.env): string => flag ?? (env.GITHUB_BASE_REF ? `origin/${env.GITHUB_BASE_REF}` : "origin/main");

/** The baseline as `ref` has it, found by git from the folder the gate runs in. */
export function readBaseCopy(cwd: string, baselinePath: string, ref: string): BaseCopy {
  try {
    git(cwd, ["rev-parse", "--is-inside-work-tree"]);
  } catch {
    return { kind: "not-git" };
  }
  try {
    git(cwd, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
  } catch {
    return { kind: "no-ref", ref };
  }
  const rel = relative(cwd, baselinePath).split(sep).join("/");
  let text: string;
  try {
    text = git(cwd, ["show", `${ref}:${rel.startsWith("..") ? rel : `./${rel}`}`]);
  } catch {
    return { kind: "no-file", ref };
  }
  return { kind: "found", ref, baseline: parseBaseline(JSON.parse(text), `${ref}:${rel}`) };
}
