/** `craft report` and `craft retrofit`: every signal for one site, and what to do about it. */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { merge } from "../audit/cli.js";
import { auditSnapshot, CATALOGUE, checkCopy, scanSource } from "../character/check.js";
import { COPY_FILE, loadConfig, loadExceptions, NOT_COPY_DIR, parseFlags, readPaths, SOURCE_FILE, type Io } from "../character/cli.js";
import { applySeverity } from "../character/config.js";
import type { ArtDirection } from "../direction/types.js";
import { validateDirection } from "../direction/validate.js";
import { loadEstate } from "../estate/cli.js";
import { compareToEstate, SIBLING_AT } from "../estate/index.js";
import { fingerprint } from "../fingerprint/index.js";
import { loadNull } from "../null/cli.js";
import { typicality } from "../null/index.js";
import type { Snapshot } from "../snapshot/types.js";
import { readSnapshot } from "../snapshot/migrate.js";
import { characterReport, type CharacterReport } from "./index.js";
import { retrofitPlan } from "./retrofit.js";
import { toJson } from "../character/json.js";

const USAGE = "usage: craft report|retrofit <url | snapshot.json> [--repo <dir>] [--null <dir>] [--estate <estate.json>] [--direction <file>] [--json] [--out <file>]";

const sameUrl = (a: string, b: string) => a.replace(/\/+$/, "").toLowerCase() === b.replace(/\/+$/, "").toLowerCase();

export function formatCharacter(r: CharacterReport): string {
  const lines = [`craft report ${r.site}`, "", `Verdict: ${r.verdict.toUpperCase()}. ${r.summary}`, ""];
  for (const s of r.signals) lines.push(`  ${s.id.padEnd(11)} ${s.raised === null ? "·" : s.raised ? "RAISED" : "ok"}  ${s.detail}`);
  lines.push("", "What to do, in order:");
  r.actions.slice(0, 12).forEach((a, i) => lines.push(`  ${String(i + 1).padStart(2)}. [${a.area}] ${a.what}`, `      ${a.why}`));
  if (r.actions.length > 12) lines.push(`  ...and ${r.actions.length - 12} more: craft retrofit writes them all.`);
  return lines.join("\n");
}

export async function runReport(command: "report" | "retrofit", args: string[], io: Io): Promise<number> {
  try {
    const flags = parseFlags(args);
    if (typeof flags === "string") throw new Error(flags);
    const target = flags.positional[0];
    if (!target) throw new Error(USAGE);

    const local = resolve(io.cwd, target);
    let snap: Snapshot;
    if (/\.json$/i.test(target) && existsSync(local)) {
      snap = readSnapshot(JSON.parse(readFileSync(local, "utf8")), target);
    } else {
      const { snapshotUrl } = await import("../audit/index.js");
      snap = await snapshotUrl(target);
    }
    const fp = fingerprint(snap);
    const repo = flags.repo ? resolve(io.cwd, flags.repo) : null;
    const exceptions = loadExceptions(flags, repo ?? io.cwd);
    const config = loadConfig(flags, repo ?? io.cwd);

    // Signal 1: the rendered page, and the source and its copy when the repo is given.
    let findings = auditSnapshot(snap, { exceptions });
    if (repo) {
      findings = merge(scanSource(readPaths(["."], repo, SOURCE_FILE, undefined, config.ignore), { exceptions }), findings);
      // The site's copy, not the notes its developers keep in docs/.
      const copyPaths = config.copyPaths ?? ["."];
      findings = merge(findings, checkCopy(readPaths(copyPaths, repo, COPY_FILE, (d) => NOT_COPY_DIR(d) || d === "docs", config.ignore), { exceptions }));
    }
    findings = applySeverity(findings, config);

    // Signal 2.
    const nulls = flags.null ? flags.null.split(",").map((p) => loadNull(p.trim(), io.cwd)) : [];
    const typical = nulls.length ? typicality(fp, nulls.flatMap((m, i) => m.runs.map((r) => (nulls.length > 1 ? { ...r, id: `${i + 1}/${r.id}` } : r)))) : null;

    // Signal 3. The site itself is left out of its own comparison.
    let estate = null;
    if (flags.estate) {
      const register = loadEstate(resolve(io.cwd, flags.estate));
      const self = register.sites.find((s) => sameUrl(s.url, snap.url));
      estate = compareToEstate(fp, register, { exclude: self?.id, siblingAt: SIBLING_AT });
    }

    // The reason rule.
    const directionFile = resolve(repo ?? io.cwd, flags.direction ?? "art-direction.json");
    let direction: ArtDirection | null = null;
    let directionReport = null;
    if (existsSync(directionFile)) {
      direction = JSON.parse(readFileSync(directionFile, "utf8")) as ArtDirection;
      directionReport = validateDirection(direction, { fingerprint: fp, pathExists: (p) => existsSync(resolve(dirname(directionFile), p)) });
    } else if (flags.direction) {
      throw new Error(`no such file: ${flags.direction}`);
    }

    const copyTells = new Set(CATALOGUE.filter((t) => t.surface === "copy").map((t) => t.id));
    const report = characterReport({ site: snap.url, findings, typicality: typical, estate, direction: directionReport }, copyTells);

    if (command === "retrofit") {
      const plan = retrofitPlan(report, direction);
      if (flags.out) {
        writeFileSync(resolve(io.cwd, flags.out), plan);
        io.out(`craft retrofit: ${report.actions.length} step${report.actions.length === 1 ? "" : "s"} for ${snap.url} in ${flags.out}`);
      } else io.out(plan);
      return 0;
    }
    io.out(flags.json ? toJson(report) : formatCharacter(report));
    if (flags.out) writeFileSync(resolve(io.cwd, flags.out), `${toJson(report)}\n`);
    return flags.strict && report.verdict !== "decided" ? 1 : 0;
  } catch (error) {
    io.err(`craft: ${(error as Error).message}`);
    return 2;
  }
}
