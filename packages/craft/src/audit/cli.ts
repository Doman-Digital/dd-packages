/**
 * `craft snapshot` and `craft audit`: the commands that need a browser.
 *
 * Kept out of the main CLI module so `craft scan` in a pre-commit hook never
 * loads any of this.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { auditSnapshot, scanSource } from "../character/check.js";
import { finish, loadExceptions, parseFlags, readPaths, SOURCE_FILE, type Io } from "../character/cli.js";
import type { CheckReport } from "../character/types.js";
import { fingerprint, type Fingerprint } from "../fingerprint/index.js";
import { SNAPSHOT_VERSION, type Snapshot } from "../snapshot/types.js";
import { describeTypicality, loadNull } from "../null/cli.js";
import { typicality } from "../null/index.js";
import { snapshotUrl } from "./index.js";

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

function readSnapshot(path: string): Snapshot {
  const data = JSON.parse(readFileSync(path, "utf8")) as Snapshot;
  if (data.version !== SNAPSHOT_VERSION) throw new Error(`${path} is snapshot version ${String(data.version)}; this craft reads ${SNAPSHOT_VERSION}`);
  return data;
}

export async function runAudit(command: "snapshot" | "audit", args: string[], io: Io): Promise<number> {
  try {
    const flags = parseFlags(args);
    if (typeof flags === "string") throw new Error(flags);
    const target = flags.positional[0];
    if (!target) throw new Error(`usage: craft ${command} <url${command === "audit" ? " | snapshot.json" : ""}>`);
    const viewport = flags.width || flags.height ? { width: Number(flags.width ?? 1440), height: Number(flags.height ?? 900) } : undefined;

    const local = resolve(io.cwd, target);
    const snapshot = command === "audit" && /\.json$/i.test(target) && existsSync(local) ? readSnapshot(local) : await snapshotUrl(target, { viewport });

    if (flags.out) writeFileSync(resolve(io.cwd, flags.out), `${JSON.stringify(snapshot, null, 2)}\n`);
    if (command === "snapshot") {
      if (!flags.out) io.out(JSON.stringify(snapshot, null, 2));
      else io.out(`craft snapshot: ${snapshot.url} saved to ${flags.out}`);
      return 0;
    }

    const exceptions = loadExceptions(flags, flags.repo ? resolve(io.cwd, flags.repo) : io.cwd);
    let report = auditSnapshot(snapshot, { exceptions });
    if (flags.repo) {
      const repo = resolve(io.cwd, flags.repo);
      report = merge(scanSource(readPaths(["."], repo, SOURCE_FILE), { exceptions }), report);
    }
    const fp = fingerprint(snapshot);
    const nulls = flags.null ? flags.null.split(",").map((p) => loadNull(p.trim(), io.cwd)) : [];
    const typical = nulls.length ? typicality(fp, nulls.flatMap((m, i) => m.runs.map((r) => (nulls.length > 1 ? { ...r, id: `${i + 1}/${r.id}` } : r)))) : null;
    if (flags.json) {
      io.out(JSON.stringify({ report, fingerprint: fp, typicality: typical, snapshot: flags.out ?? null }, null, 2));
      return report.summary.blocking > 0 || (flags.strict && report.summary.findings > 0) ? 1 : 0;
    }
    const code = finish(report, { ...flags, json: false }, `craft audit ${snapshot.url}`, io);
    io.out("");
    io.out(describeFingerprint(fp));
    if (typical) {
      io.out("");
      io.out(describeTypicality(typical, nulls.reduce((s, m) => s + m.runs.length, 0), nulls.length));
    }
    return code;
  } catch (error) {
    io.err(`craft: ${(error as Error).message}`);
    return 2;
  }
}
