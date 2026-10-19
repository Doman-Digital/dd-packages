/**
 * `craft viewports`: the every-viewport measure for a page anyone can open
 * (DOM-787). It sits beside `craft phone-first`, which judges the portal's own
 * measured routes and its source: this command opens a running site itself,
 * measures every route at the whole ladder and the width sweep, writes the
 * measured routes where `craft phone-first --measured` reads them, and judges
 * them against the same baseline.
 *
 *     craft viewports --url http://127.0.0.1:4321 --route / --route /contact
 *     craft viewports --config viewports.json
 *
 * `viewports.json` (every key optional):
 *
 *     {
 *       "url": "http://127.0.0.1:4321",
 *       "routes": ["/", "/contact"],
 *       "mainAction": ".cta",                 // or { "/": ".cta", "*": "a.book" }
 *       "thresholds": { "maxLineCh": 75 },
 *       "floors": { "textPx": 12 },
 *       "sweep": { "step": 16 },              // or false
 *       "baseline": "phone-first.baseline.json",
 *       "out": "phone-first/measured"
 *     }
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadPlaywright } from "../audit/index.js";
import type { Io } from "../character/cli.js";
import { toJson } from "../character/json.js";
import { DEFAULT_MEASURED_DIR, routeFile } from "./constants.js";
import { EMPTY_BASELINE, judgeMeasured, parseBaseline, writeBaseline, type Baseline } from "./judge.js";
import type { PhoneFloors } from "./measure-in-page.js";
import { measureSite, type SiteBrowser, type SitePage } from "./run.js";
import type { MainAction, Sweep, Thresholds } from "./viewports.js";

export interface ViewportsConfig {
  url?: string;
  routes?: string[];
  mainAction?: MainAction;
  thresholds?: Partial<Thresholds>;
  floors?: Partial<PhoneFloors>;
  sweep?: Partial<Sweep> | false;
  baseline?: string;
  out?: string;
}

const USAGE = "usage: craft viewports [--url <base>] [--route <path>]... [--config viewports.json] [--out <dir>] [--captures <dir>] [--baseline <file>] [--update-baseline] [--no-sweep] [--json]";

interface Flags {
  config?: string;
  url?: string;
  routes: string[];
  out?: string;
  captures?: string;
  baseline?: string;
  update: boolean;
  sweep: boolean;
  json: boolean;
}

function parse(args: string[]): Flags | string {
  const flags: Flags = { routes: [], update: false, sweep: true, json: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--update-baseline") flags.update = true;
    else if (a === "--no-sweep") flags.sweep = false;
    else if (a === "--json") flags.json = true;
    else if (["--config", "--url", "--route", "--routes", "--out", "--captures", "--baseline"].includes(a)) {
      const v = args[++i];
      if (!v || v.startsWith("--")) return `${a} needs a value`;
      if (a === "--route") flags.routes.push(v);
      else if (a === "--routes") flags.routes.push(...v.split(",").filter(Boolean));
      else flags[a.slice(2) as "config" | "url" | "out" | "captures" | "baseline"] = v;
    } else return `unknown argument ${a}`;
  }
  return flags;
}

function loadConfig(path: string | undefined, cwd: string): ViewportsConfig {
  const file = resolve(cwd, path ?? "viewports.json");
  if (!existsSync(file)) {
    if (path) throw new Error(`no ${path}`);
    return {};
  }
  return JSON.parse(readFileSync(file, "utf8")) as ViewportsConfig;
}

function loadBaseline(path: string): Baseline {
  if (!existsSync(path)) return EMPTY_BASELINE;
  return parseBaseline(JSON.parse(readFileSync(path, "utf8")), path);
}

export async function runViewports(args: string[], io: Io): Promise<number> {
  const flags = parse(args);
  if (typeof flags === "string") {
    io.err(`craft viewports: ${flags}\n${USAGE}`);
    return 2;
  }
  try {
    const config = loadConfig(flags.config, io.cwd);
    const base = (flags.url ?? config.url)?.replace(/\/$/, "");
    const routes = flags.routes.length ? flags.routes : (config.routes ?? ["/"]);
    if (!base) throw new Error(`no site to open. Pass --url <base>, or set "url" in viewports.json.\n${USAGE}`);
    for (const r of routes) if (!r.startsWith("/")) throw new Error(`route "${r}" should start with /`);
    const out = resolve(io.cwd, flags.out ?? config.out ?? DEFAULT_MEASURED_DIR);
    const baselinePath = resolve(io.cwd, flags.baseline ?? config.baseline ?? "phone-first.baseline.json");
    const captures = flags.captures ? resolve(io.cwd, flags.captures) : undefined;
    if (captures) mkdirSync(captures, { recursive: true });

    const pw = await loadPlaywright();
    const executablePath = process.env.CRAFT_CHROMIUM || undefined;
    const browser = (await pw.chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })) as unknown as SiteBrowser & { close(): Promise<void> };
    let site;
    try {
      site = await measureSite(browser, {
        base,
        routes,
        out,
        ...(config.mainAction ? { mainAction: config.mainAction } : {}),
        ...(config.thresholds ? { thresholds: config.thresholds } : {}),
        ...(config.floors ? { floors: config.floors } : {}),
        sweep: flags.sweep ? config.sweep : false,
        ...(captures
          ? {
              onViewport: async (page, viewport, route) => {
                await (page as SitePage & { screenshot(o: { path: string; fullPage: boolean }): Promise<unknown> }).screenshot({ path: join(captures, `${routeFile(route).replace(/\.json$/, "")}-${viewport.name}.png`), fullPage: true });
              },
            }
          : {}),
      });
    } finally {
      await browser.close();
    }

    const baseline = loadBaseline(baselinePath);
    const measuredRoutes = new Set(site.routes.map((r) => r.route));
    if (flags.update) {
      const next = writeBaseline([], site.routes, baseline.note, baseline);
      // Routes this run did not measure keep their lines, and so does everything static.
      next.static = baseline.static;
      next.measured = [...baseline.measured.filter((m) => !measuredRoutes.has(m.route)), ...next.measured].sort((a, b) => a.route.localeCompare(b.route) || a.check.localeCompare(b.check) || a.element.localeCompare(b.element));
      writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`);
      io.out(`craft viewports: wrote ${flags.baseline ?? config.baseline ?? "phone-first.baseline.json"} (${next.measured.reduce((n, m) => n + m.count, 0)} measured)`);
      return site.errors.length ? 1 : 0;
    }
    // Only the routes this run measured are judged: the baseline's other routes belong to other runs.
    const judged = judgeMeasured(site.routes, { ...baseline, measured: baseline.measured.filter((m) => measuredRoutes.has(m.route)) });
    const failed = site.errors.length + judged.fresh.length + judged.stale.length > 0;
    if (flags.json) {
      io.out(toJson({ pass: !failed, routes: site.routes.map((r) => ({ route: r.route, viewports: r.viewports, findings: r.findings.length })), errors: site.errors, measured: judged }));
      return failed ? 1 : 0;
    }
    const section = (title: string, lines: string[]): string => (lines.length ? `\n${title}\n${lines.map((l) => `  ${l}`).join("\n")}` : "");
    const viewports = site.routes[0]?.viewports ?? [];
    const summary = `${site.routes.length} route${site.routes.length === 1 ? "" : "s"} at ${viewports.length} viewports${judged.known ? `, ${judged.known} known breach${judged.known === 1 ? "" : "es"} in the baseline` : ""}`;
    if (!failed) {
      io.out(`craft viewports: pass. ${summary}.`);
      return 0;
    }
    io.err(
      [
        `craft viewports: fail. ${summary}.`,
        section("Did not answer (not measured, so not passed):", site.errors.map((e) => `${e.route}: ${e.error}`)),
        section("Measured across the viewports, phone first:", judged.fresh),
        section("The baseline claims more than is there (good: lower it, so the fix stays fixed):", judged.stale),
      ].join(""),
    );
    return 1;
  } catch (error) {
    io.err(`craft viewports: ${(error as Error).message}`);
    return 2;
  }
}
