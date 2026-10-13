/**
 * `craft phone-first`: the phone-first gate for a repo, most of all a portal
 * (DOM-775). Reads `phone-first.json`:
 *
 *     {
 *       "source": ["apps/portal/app", "apps/portal/components", "packages/ui/src"],
 *       "ignore": ["**\/emails/**"],
 *       "exceptions": [{ "file": "apps/portal/app/print.css", "reason": "..." }],
 *       "baseline": "phone-first.baseline.json"
 *     }
 *
 * and fails on a max-width rule in `source` and, with `--measured <dir>`, on
 * what `measurePhone` found at 375px, unless the baseline already lists it.
 * `--update-baseline` writes the baseline that makes this run pass; use it
 * once when the gate goes in, and after that only to lower the counts.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { readPaths, SOURCE_FILE, type Io } from "../character/cli.js";
import { toJson } from "../character/json.js";
import { checkExceptions, EMPTY_BASELINE, judgeMeasured, judgeStatic, scanPhoneFirst, writeBaseline, type Baseline, type FileException, type MeasuredRoute } from "./judge.js";

export interface PhoneConfig {
  source: string[];
  ignore?: string[];
  exceptions?: FileException[];
  baseline?: string;
}

const USAGE = "usage: craft phone-first [--config phone-first.json] [--measured <dir>] [--update-baseline] [--json]";

interface PhoneFlags {
  config: string;
  measured?: string;
  update: boolean;
  json: boolean;
}

function parse(args: string[]): PhoneFlags | string {
  const flags: PhoneFlags = { config: "phone-first.json", update: false, json: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--update-baseline") flags.update = true;
    else if (a === "--json") flags.json = true;
    else if (a === "--config" || a === "--measured") {
      const v = args[++i];
      if (!v || v.startsWith("--")) return `${a} needs a value`;
      if (a === "--config") flags.config = v;
      else flags.measured = v;
    } else return `unknown argument ${a}`;
  }
  return flags;
}

function loadConfig(path: string): PhoneConfig {
  if (!existsSync(path)) throw new Error(`no ${path}. Write one: { "source": ["<dirs with styles and components>"], "baseline": "phone-first.baseline.json" }`);
  const c = JSON.parse(readFileSync(path, "utf8")) as Partial<PhoneConfig>;
  if (!Array.isArray(c.source) || c.source.length === 0 || c.source.some((s) => typeof s !== "string")) throw new Error(`${path}: "source" should list the folders to scan`);
  if (c.ignore !== undefined && (!Array.isArray(c.ignore) || c.ignore.some((s) => typeof s !== "string"))) throw new Error(`${path}: "ignore" should be a list of globs`);
  if (c.exceptions !== undefined && !Array.isArray(c.exceptions)) throw new Error(`${path}: "exceptions" should be a list of { "file", "reason" }`);
  return { source: c.source, ignore: c.ignore ?? [], exceptions: c.exceptions ?? [], baseline: c.baseline ?? "phone-first.baseline.json" };
}

function loadBaseline(path: string): Baseline {
  if (!existsSync(path)) return EMPTY_BASELINE;
  const b = JSON.parse(readFileSync(path, "utf8")) as Partial<Baseline>;
  return { ...(b.note ? { note: b.note } : {}), static: b.static ?? [], measured: b.measured ?? [] };
}

function loadMeasured(dir: string): MeasuredRoute[] {
  if (!existsSync(dir)) throw new Error(`--measured ${dir}: no such folder. Run the portal's phone-first specs first; they write it.`);
  const routes = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as MeasuredRoute);
  if (routes.length === 0) throw new Error(`--measured ${dir}: no measured routes in it. Did the phone-first specs run?`);
  return routes;
}

export function runPhoneFirst(args: string[], io: Io): number {
  const flags = parse(args);
  if (typeof flags === "string") {
    io.err(`craft phone-first: ${flags}\n${USAGE}`);
    return 2;
  }
  try {
    const config = loadConfig(resolve(io.cwd, flags.config));
    const baselinePath = resolve(io.cwd, config.baseline!);
    const baseline = loadBaseline(baselinePath);
    const exceptionProblems = checkExceptions(config.exceptions!, (f) => existsSync(resolve(io.cwd, f)));
    const sources = config.source.filter((s) => existsSync(resolve(io.cwd, s)));
    const missing = config.source.filter((s) => !sources.includes(s));
    if (missing.length) throw new Error(`${flags.config}: source ${missing.join(", ")} not found`);
    const files = readPaths(sources, io.cwd, SOURCE_FILE, undefined, config.ignore);
    const { findings, excused } = scanPhoneFirst(files, config.exceptions);
    const routes = flags.measured ? loadMeasured(resolve(io.cwd, flags.measured)) : null;

    if (flags.update) {
      const next = writeBaseline(findings, routes ?? [], baseline.note);
      // Without --measured, the measured lines stay as they were.
      if (!routes) next.measured = baseline.measured;
      writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`);
      io.out(`craft phone-first: wrote ${config.baseline} (${next.static.reduce((n, s) => n + s.count, 0)} static, ${next.measured.reduce((n, m) => n + m.count, 0)} measured)`);
      return exceptionProblems.length ? 1 : 0;
    }

    const s = judgeStatic(findings, baseline);
    const m = routes ? judgeMeasured(routes, baseline) : { fresh: [], stale: [], known: 0 };
    const failed = exceptionProblems.length + s.fresh.length + s.stale.length + m.fresh.length + m.stale.length > 0;
    if (flags.json) {
      io.out(toJson({ pass: !failed, files: files.length, excused, routes: routes?.map((r) => r.route) ?? null, exceptionProblems, static: s, measured: m }));
      return failed ? 1 : 0;
    }
    const section = (title: string, lines: string[]): string => (lines.length ? `\n${title}\n${lines.map((l) => `  ${l}`).join("\n")}` : "");
    const known = s.known + m.known;
    const summary = [
      `${files.length} files${routes ? ` and ${routes.length} route${routes.length === 1 ? "" : "s"} at 375px` : ""}`,
      excused ? `${excused} recorded exception${excused === 1 ? "" : "s"}` : null,
      known ? `${known} known breach${known === 1 ? "" : "es"} in ${config.baseline}` : null,
    ]
      .filter(Boolean)
      .join(", ");
    if (!failed) {
      io.out(`craft phone-first: pass. ${summary}.`);
      return 0;
    }
    io.err(
      [
        `craft phone-first: fail. ${summary}.`,
        section("The exceptions:", exceptionProblems),
        section("Built desktop first (write the phone as the base styles and widen with min-width; a genuine exception takes `mobile-first-ok: <reason>` on its line):", s.fresh),
        section("Measured at 375px:", m.fresh),
        section("The baseline claims more than is there (good: lower it, so the fix stays fixed):", [...s.stale, ...m.stale]),
      ].join(""),
    );
    return 1;
  } catch (error) {
    io.err(`craft phone-first: ${(error as Error).message}`);
    return 2;
  }
}
