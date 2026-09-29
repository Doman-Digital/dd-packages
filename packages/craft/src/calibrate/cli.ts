/**
 * `craft calibrate <labels.json>`: measure a labelled set and report how well
 * the catalogue separates it.
 *
 * Paths in the labels file are relative to it. A page's `snapshot` is read if
 * it exists; otherwise one is taken from its `source` (a local HTML file) or
 * its `url`, and kept at `snapshot`, or under `--out`, so a second run does
 * not take it again. `--fresh` takes every snapshot again, which is how a set
 * pinned on an older snapshot version is measured on the current one.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { auditSnapshot, scanSource } from "../character/check.js";
import { parseFlags, type Io } from "../character/cli.js";
import { toJson } from "../character/json.js";
import { fingerprint } from "../fingerprint/index.js";
import { expandNullTargets, loadNull } from "../null/cli.js";
import { typicality, type NullRun } from "../null/index.js";
import { readSnapshot } from "../snapshot/migrate.js";
import { SNAPSHOT_VERSION, type Snapshot } from "../snapshot/types.js";
import { calibrate, formatCalibration, LABELS, type Label, type MeasuredPage, type UnmeasuredPage } from "./index.js";

export const LABELS_VERSION = 1;

export interface LabelEntry {
  /** Lower case, digits and hyphens: it names the cached snapshot file. */
  id: string;
  label: Label;
  /** A saved snapshot, read as it is. */
  snapshot?: string;
  /** The page's HTML: scanned for source tells, and snapshotted when there is no snapshot. */
  source?: string;
  /** A live page, snapshotted when there is no snapshot and no source. */
  url?: string;
  /** Why this page is listed and not measured: a gated preview, a page that has gone. */
  skip?: string;
  note?: string;
}

export interface LabelFile {
  version: typeof LABELS_VERSION;
  /** Null models, pooled for typicality: null.json files, or directories of them. */
  null?: string[];
  pages: LabelEntry[];
}

const USAGE = "usage: craft calibrate <labels.json> [--out <dir>] [--fresh] [--json]";

export function parseLabels(raw: unknown, name: string): LabelFile {
  const file = raw as Partial<LabelFile>;
  if (!file || typeof file !== "object" || file.version !== LABELS_VERSION) throw new Error(`${name}: needs "version": ${LABELS_VERSION}`);
  if (!Array.isArray(file.pages) || file.pages.length === 0) throw new Error(`${name}: "pages" needs at least one page`);
  const seen = new Set<string>();
  for (const [i, p] of file.pages.entries()) {
    const at = `${name}: pages[${i}]`;
    if (typeof p?.id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(p.id)) throw new Error(`${at}: "id" needs lower case, digits and hyphens`);
    if (seen.has(p.id)) throw new Error(`${at}: "${p.id}" is listed twice`);
    seen.add(p.id);
    if (!LABELS.includes(p.label)) throw new Error(`${at} (${p.id}): "label" is one of ${LABELS.join(", ")}`);
    if (!p.skip && !p.snapshot && !p.source && !p.url) throw new Error(`${at} (${p.id}): needs a snapshot, a source or a url, or a skip saying why not`);
  }
  if (file.null !== undefined && (!Array.isArray(file.null) || file.null.some((n) => typeof n !== "string"))) throw new Error(`${name}: "null" is a list of paths`);
  return file as LabelFile;
}

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));

export async function runCalibrate(args: string[], io: Io): Promise<number> {
  try {
    const flags = parseFlags(args);
    if (typeof flags === "string") throw new Error(flags);
    const [target] = flags.positional;
    if (!target || flags.positional.length > 1) throw new Error(USAGE);
    const path = resolve(io.cwd, target);
    if (!existsSync(path)) throw new Error(`no labels file at ${target}`);
    const labels = parseLabels(readJson(path), target);
    const base = dirname(path);
    const out = flags.out ? resolve(io.cwd, flags.out) : undefined;

    // Pooled, as the AI set was scored: a page's own brief is not always known.
    const models = expandNullTargets(labels.null ?? [], base).map((p) => loadNull(p, base));
    const pool: NullRun[] = models.flatMap((m, i) => m.runs.map((r) => ({ ...r, id: `${i}/${r.id}` })));

    const snapshots = new Map<string, Snapshot>();
    const unmeasured: UnmeasuredPage[] = [];
    const toTake: { entry: LabelEntry; url: string; keep?: string }[] = [];
    for (const entry of labels.pages) {
      if (entry.skip) {
        unmeasured.push({ id: entry.id, label: entry.label, reason: entry.skip });
        continue;
      }
      const pinned = entry.snapshot ? resolve(base, entry.snapshot) : undefined;
      if (pinned && existsSync(pinned) && !flags.fresh) {
        snapshots.set(entry.id, readSnapshot(readJson(pinned), entry.snapshot ?? entry.id));
        continue;
      }
      const cached = out ? join(out, "snapshots", `${entry.id}.json`) : undefined;
      if (cached && existsSync(cached)) {
        snapshots.set(entry.id, readSnapshot(readJson(cached), `${entry.id}.json`));
        continue;
      }
      const url = entry.source ? pathToFileURL(resolve(base, entry.source)).href : entry.url;
      if (!url) {
        const why = flags.fresh ? "--fresh" : `no snapshot at ${entry.snapshot}`;
        unmeasured.push({ id: entry.id, label: entry.label, reason: `${why}, and no source or url to take one from` });
        continue;
      }
      // --fresh writes under --out and leaves a pinned snapshot as it was recorded.
      toTake.push({ entry, url, keep: flags.fresh ? cached : pinned ?? cached });
    }

    if (toTake.length) {
      io.err(`craft calibrate: taking ${toTake.length} snapshot${toTake.length === 1 ? "" : "s"}`);
      try {
        // Loaded only here: a set of saved snapshots needs no browser.
        const { snapshotUrls } = await import("../audit/index.js");
        const results = await snapshotUrls(toTake.map((t) => t.url));
        results.forEach((r, i) => {
          const { entry, keep } = toTake[i];
          if (!r.snapshot) return void unmeasured.push({ id: entry.id, label: entry.label, reason: `would not render: ${r.error}` });
          snapshots.set(entry.id, r.snapshot);
          if (keep) {
            mkdirSync(dirname(keep), { recursive: true });
            writeFileSync(keep, `${JSON.stringify(r.snapshot, null, 2)}\n`);
          }
        });
      } catch (error) {
        for (const { entry } of toTake) unmeasured.push({ id: entry.id, label: entry.label, reason: `no browser: ${(error as Error).message}` });
      }
    }

    const measured: MeasuredPage[] = labels.pages
      .filter((e) => snapshots.has(e.id))
      .map((entry) => {
        const snap = snapshots.get(entry.id) as Snapshot;
        const rendered = auditSnapshot(snap);
        const source = entry.source && existsSync(resolve(base, entry.source)) ? scanSource([{ path: entry.source, text: readFileSync(resolve(base, entry.source), "utf8") }]) : undefined;
        const tells = new Set([...rendered.findings, ...(source?.findings ?? [])].map((f) => f.tell));
        const t = pool.length ? typicality(fingerprint(snap), pool) : undefined;
        return {
          id: entry.id,
          label: entry.label,
          tells: [...tells].sort(),
          blocking: rendered.summary.blocking + (source?.summary.blocking ?? 0),
          ...(t ? { typicality: { score: t.score, typical: t.typical } } : {}),
        };
      });

    const result = calibrate(measured, unmeasured);
    const older = [...snapshots.values()].filter((s) => s.migratedFrom !== undefined).length;
    const notes = [
      ...(models.length ? [`Typicality against ${pool.length} null pages from ${models.length} brief${models.length === 1 ? "" : "s"}, pooled.`] : []),
      ...(older ? [`${older} of ${snapshots.size} snapshots are older than version ${SNAPSHOT_VERSION}: tells that read newer fields cannot fire on them. --fresh takes them again.`] : []),
    ];
    const pages = Object.fromEntries(measured.map((m) => [m.id, m]));
    if (out) {
      mkdirSync(out, { recursive: true });
      writeFileSync(join(out, "results.json"), `${toJson({ labelsFile: relative(out, path), notes, ...result, pages })}\n`);
    }
    io.out(flags.json ? toJson({ notes, ...result, pages }) : formatCalibration(result, notes));
    if (out && !flags.json) io.out(`\nWritten to ${relative(io.cwd, join(out, "results.json")) || "results.json"}`);
    return 0;
  } catch (error) {
    io.err(`craft: ${(error as Error).message}`);
    return 2;
  }
}
