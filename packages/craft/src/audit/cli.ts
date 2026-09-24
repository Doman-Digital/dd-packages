/**
 * `craft snapshot` and `craft audit`: the commands that need a browser.
 *
 * Kept out of the main CLI module so `craft scan` in a pre-commit hook never
 * loads any of this.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { auditSnapshot, scanSource } from "../character/check.js";
import { finish, loadConfig, loadExceptions, parseFlags, prepareReport, readPaths, SOURCE_FILE, type Flags, type Io } from "../character/cli.js";
import { toJson } from "../character/json.js";
import type { CheckReport } from "../character/types.js";
import { fingerprint, type Fingerprint } from "../fingerprint/index.js";
import type { Snapshot } from "../snapshot/types.js";
import { readSnapshot } from "../snapshot/migrate.js";
import { describeTypicality, loadNull } from "../null/cli.js";
import { typicality } from "../null/index.js";
import { componentTypicalities, type ComponentTypicality } from "../fingerprint/component.js";
import { snapshotUrl, snapshotUrls } from "./index.js";
import { parseSitemap, parseUrlList, parseViewports, type Viewport } from "./pages.js";

/** Per-component typicality lines, or why there are none. */
export function describeComponents(components: ComponentTypicality[], pageMeasured: boolean, nullMeasured: boolean): string {
  if (!pageMeasured) return "  components  not measured: the page's snapshot predates version 2";
  if (!nullMeasured) return "  components  not measured: the null model predates snapshot version 2; rebuild it to compare components";
  if (components.length === 0) return "  components  none the null model has enough pages of to compare";
  return components
    .map((c, i) => `${i === 0 ? "  components" : "            "}  ${c.role.padEnd(13)} ${c.score.toFixed(2)}: ${c.typical ? "typical" : "not typical"} (${c.runs} null pages have one)`)
    .join("\n");
}

const fmt = (o: { l: number; c: number; h: number } | null): string =>
  o ? `oklch(${o.l.toFixed(3)} ${o.c.toFixed(3)} ${o.h.toFixed(1)})` : "none";

export function describeFingerprint(fp: Fingerprint): string {
  return [
    "Fingerprint",
    `  accent     ${fmt(fp.accent)}`,
    `  ground     ${fmt(fp.ground)}`,
    `  display    ${fp.display.family} (${fp.display.class})`,
    `  body       ${fp.body.family} (${fp.body.class})`,
    `  roundness  ${fp.roundness === null ? "no buttons" : fp.roundness.toFixed(2)}`,
    `  motion     ${Math.round(fp.motion * 100)}% of sections below the fold reveal on scroll`,
    `  effects    ${fp.effects.join(", ") || "none"}`,
    `  layout     ${fp.layout.join(" > ") || "none"}`,
  ].join("\n");
}

/** Two reports as one: the source scan and the rendered page. */
export function merge(a: CheckReport, b: CheckReport): CheckReport {
  const byTell: Record<string, number> = { ...a.summary.byTell };
  for (const [k, v] of Object.entries(b.summary.byTell)) byTell[k] = (byTell[k] ?? 0) + v;
  return {
    catalogueVersion: a.catalogueVersion,
    findings: [...a.findings, ...b.findings],
    rejectedExceptions: a.rejectedExceptions,
    excepted: [...a.excepted, ...b.excepted],
    suppressed: [...a.suppressed, ...b.suppressed],
    summary: {
      files: a.summary.files + b.summary.files,
      findings: a.summary.findings + b.summary.findings,
      byGeneration: { 1: a.summary.byGeneration[1] + b.summary.byGeneration[1], 2: a.summary.byGeneration[2] + b.summary.byGeneration[2], 3: a.summary.byGeneration[3] + b.summary.byGeneration[3] },
      byTell,
      blocking: a.summary.blocking + b.summary.blocking,
    },
  };
}

function readSnapshotFile(path: string): Snapshot {
  return readSnapshot(JSON.parse(readFileSync(path, "utf8")), path);
}

async function readText(source: string, cwd: string): Promise<string> {
  if (/^https?:\/\//i.test(source)) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`${source}: HTTP ${res.status}`);
    return res.text();
  }
  const path = resolve(cwd, source);
  if (!existsSync(path)) throw new Error(`no such file: ${source}`);
  return readFileSync(path, "utf8");
}

/** Every URL `--pages` names: a sitemap (or sitemap index, one level deep), or a list. */
export async function resolvePages(source: string, cwd: string): Promise<string[]> {
  const text = await readText(source, cwd);
  if (!/^\s*<(?:\?xml|urlset|sitemapindex)/i.test(text)) return parseUrlList(text);
  const { urls, sitemaps } = parseSitemap(text);
  const nested = await Promise.all(sitemaps.map(async (s) => parseSitemap(await readText(s, cwd)).urls));
  const all = [...urls, ...nested.flat()];
  if (all.length === 0) throw new Error(`${source}: no <loc> entries`);
  return [...new Set(all)];
}

interface Audited {
  url: string;
  viewport: Viewport | null;
  snapshot: Snapshot;
}

interface Failed {
  url: string;
  viewport: Viewport | null;
  error: string;
}

function viewportsOf(flags: Flags): (Viewport | undefined)[] {
  if (flags.viewport) return parseViewports(flags.viewport);
  if (flags.width || flags.height) return [{ width: Number(flags.width ?? 1440), height: Number(flags.height ?? 900) }];
  return [undefined];
}

export async function runAudit(command: "snapshot" | "audit", args: string[], io: Io): Promise<number> {
  try {
    const flags = parseFlags(args);
    if (typeof flags === "string") throw new Error(flags);
    const target = flags.positional[0];
    if (command === "snapshot" && (flags.pages || flags.viewport)) throw new Error("craft snapshot takes one page; use --width and --height");
    if (flags.pages && target) throw new Error("give a page or --pages, not both");
    if (!target && !flags.pages) throw new Error(`usage: craft ${command} <url${command === "audit" ? " | snapshot.json> | --pages <sitemap.xml | urls.txt>" : ">"}`);
    const viewports = viewportsOf(flags);

    const audited: Audited[] = [];
    const failed: Failed[] = [];
    const local = target ? resolve(io.cwd, target) : "";
    if (target && command === "audit" && /\.json$/i.test(target) && existsSync(local)) {
      audited.push({ url: target, viewport: null, snapshot: readSnapshotFile(local) });
    } else if (target && viewports.length === 1) {
      const snapshot = await snapshotUrl(target, { viewport: viewports[0] });
      audited.push({ url: target, viewport: viewports[0] ?? null, snapshot });
    } else {
      const urls = flags.pages ? await resolvePages(flags.pages, io.cwd) : [target!];
      for (const viewport of viewports) {
        for (const r of await snapshotUrls(urls, { viewport })) {
          if (r.snapshot) audited.push({ url: r.url, viewport: viewport ?? null, snapshot: r.snapshot });
          else failed.push({ url: r.url, viewport: viewport ?? null, error: r.error ?? "no snapshot" });
        }
      }
    }
    if (audited.length === 0) throw new Error(`no page could be measured:\n${failed.map((f) => `  ${f.url}: ${f.error}`).join("\n")}`);

    const single = audited.length === 1 && failed.length === 0;
    if (flags.out) {
      if (!single) throw new Error("--out saves one snapshot; drop --pages and --viewport, or snapshot each page");
      writeFileSync(resolve(io.cwd, flags.out), `${JSON.stringify(audited[0].snapshot, null, 2)}\n`);
    }
    if (command === "snapshot") {
      const { snapshot } = audited[0];
      if (!flags.out) io.out(JSON.stringify(snapshot, null, 2));
      else io.out(`craft snapshot: ${snapshot.url} saved to ${flags.out}`);
      return 0;
    }

    const root = flags.repo ? resolve(io.cwd, flags.repo) : io.cwd;
    const exceptions = loadExceptions(flags, root);
    const config = loadConfig(flags, root);
    // Several widths of one page are several findings: say which width each is from.
    const label = (a: Audited): string => (viewports.length > 1 && a.viewport ? `${a.snapshot.url} @ ${a.viewport.width}px` : a.snapshot.url);
    let report = audited
      .map((a) => {
        const r = auditSnapshot(a.snapshot, { exceptions });
        return { ...r, findings: r.findings.map((f) => ({ ...f, path: label(a) })) };
      })
      .reduce((acc, r) => merge(acc, r));
    if (flags.repo) {
      report = merge(scanSource(readPaths(["."], root, SOURCE_FILE, undefined, config.ignore), { exceptions }), report);
    }
    const prepared = prepareReport(report, flags, io, config);
    if (!prepared) return 0;

    const nulls = flags.null ? flags.null.split(",").map((p) => loadNull(p.trim(), io.cwd)) : [];
    const pooled = nulls.flatMap((m, i) => m.runs.map((r) => (nulls.length > 1 ? { ...r, id: `${i + 1}/${r.id}` } : r)));
    const pages = audited.map((a) => {
      const fp = fingerprint(a.snapshot);
      return {
        url: a.snapshot.url,
        viewport: a.viewport,
        fingerprint: fp,
        typicality: nulls.length ? typicality(fp, pooled) : null,
        components: nulls.length ? componentTypicalities(fp, pooled) : [],
      };
    });
    const unmeasured = failed.length > 0 && flags.strict ? 1 : 0;

    if (flags.json) {
      const extra = single ? { fingerprint: pages[0].fingerprint, typicality: pages[0].typicality, components: pages[0].components, snapshot: flags.out ?? null } : {};
      io.out(toJson({ report: prepared, ...extra, pages, failed }));
      return Math.max(prepared.summary.blocking > 0 || (flags.strict && prepared.summary.findings > 0) ? 1 : 0, unmeasured);
    }
    const title = single ? `craft audit ${audited[0].snapshot.url}` : `craft audit: ${audited.length} page${audited.length === 1 ? "" : "s"}`;
    const code = finish(prepared, { ...flags, json: false }, title, io);
    for (const page of pages) {
      io.out("");
      if (!single) io.out(`${page.url}${page.viewport ? ` @ ${page.viewport.width}px` : ""}`);
      io.out(describeFingerprint(page.fingerprint));
      if (page.typicality) {
        io.out("");
        io.out(describeTypicality(page.typicality, pooled.length, nulls.length));
        io.out(describeComponents(page.components, page.fingerprint.sections !== undefined, pooled.some((r) => r.fingerprint.sections !== undefined)));
      }
    }
    if (failed.length) {
      io.out("");
      io.out("Not measured (never counts as a pass):");
      for (const f of failed) io.out(`  ${f.url}${f.viewport ? ` @ ${f.viewport.width}px` : ""}: ${f.error}`);
    }
    return Math.max(code, unmeasured);
  } catch (error) {
    io.err(`craft: ${(error as Error).message}`);
    return 2;
  }
}
