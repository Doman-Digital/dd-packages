/** `craft estate add | compare`. All file I/O for the estate register lives here. */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { auditSnapshot } from "../character/check.js";
import { parseFlags, type Io } from "../character/cli.js";
import { fingerprint } from "../fingerprint/index.js";
import { loadNull } from "../null/cli.js";
import { SNAPSHOT_VERSION, type Snapshot } from "../snapshot/types.js";
import { addSite, compareToEstate, emptyEstate, ESTATE_VERSION, estatePairs, SIBLING_AT, siblingLine, type EstateMatch, type EstatePair, type EstateRegister } from "./index.js";
import { toJson } from "../character/json.js";

const USAGE = "usage: craft estate add <url | snapshot.json> --id <id> [--client <name>] | craft estate compare [<url | snapshot.json | id>] [--null <dir>] [--json] [--strict]";

export function loadEstate(path: string): EstateRegister {
  if (!existsSync(path)) return emptyEstate();
  const data = JSON.parse(readFileSync(path, "utf8")) as EstateRegister;
  if (data.version !== ESTATE_VERSION || !Array.isArray(data.sites)) throw new Error(`${path} is not an estate register (version ${ESTATE_VERSION})`);
  return data;
}

async function snapshotOf(target: string, cwd: string): Promise<Snapshot> {
  const local = resolve(cwd, target);
  if (/\.json$/i.test(target) && existsSync(local)) {
    const snap = JSON.parse(readFileSync(local, "utf8")) as Snapshot;
    if (snap.version !== SNAPSHOT_VERSION) throw new Error(`${target} is not a snapshot`);
    return snap;
  }
  if (!/^https?:\/\//.test(target)) throw new Error(`${target} is neither a URL, a snapshot file, nor a site in the register`);
  const { snapshotUrl } = await import("../audit/index.js");
  return snapshotUrl(target);
}

const line = (distance: number, sibling: boolean, shared: string[]) =>
  `${distance.toFixed(2)}${sibling ? "  SIBLING" : ""}${shared.length ? `  shares ${shared.join(", ")}` : ""}`;

export function formatMatches(label: string, matches: EstateMatch[], at: number): string {
  const lines = [`${label}: nearest sites in the estate (siblings below ${at.toFixed(2)})`];
  for (const m of matches) lines.push(`  ${m.id.padEnd(20)} ${line(m.distance, m.sibling, m.shared)}`);
  if (matches.length === 0) lines.push("  the register is empty");
  return lines.join("\n");
}

export function formatPairs(pairs: EstatePair[], at: number, sites: number): string {
  const siblings = pairs.filter((p) => p.sibling).length;
  const lines = [`craft estate: ${sites} sites, ${pairs.length} pair${pairs.length === 1 ? "" : "s"}, ${siblings} sibling pair${siblings === 1 ? "" : "s"} (below ${at.toFixed(2)})`];
  for (const p of pairs) lines.push(`  ${`${p.a} + ${p.b}`.padEnd(34)} ${line(p.distance, p.sibling, p.shared)}`);
  return lines.join("\n");
}

export async function runEstate(args: string[], io: Io): Promise<number> {
  try {
    const flags = parseFlags(args);
    if (typeof flags === "string") throw new Error(flags);
    const [sub, target] = flags.positional;
    const file = resolve(io.cwd, flags.estate ?? "estate.json");
    const register = loadEstate(file);
    const at = flags.null ? siblingLine(flags.null.split(",").map((p) => loadNull(p.trim(), io.cwd).runs.map((r) => r.fingerprint))) : SIBLING_AT;

    if (sub === "add") {
      if (!target || !flags.id) throw new Error(USAGE);
      const snap = await snapshotOf(target, io.cwd);
      const fp = fingerprint(snap);
      const next = addSite(register, {
        id: flags.id,
        client: flags.client ?? flags.id,
        url: snap.url,
        fingerprint: fp,
        tells: [...new Set(auditSnapshot(snap).findings.map((f) => f.tell))].sort(),
        addedAt: snap.capturedAt,
      });
      writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
      io.out(`craft estate: ${flags.id} ${register.sites.some((s) => s.id === flags.id) ? "updated" : "added"}, ${next.sites.length} sites in ${flags.estate ?? "estate.json"}`);
      io.out(formatMatches(flags.id, compareToEstate(fp, next, { exclude: flags.id, siblingAt: at }).slice(0, 3), at));
      return 0;
    }

    if (sub === "compare") {
      if (!target) {
        const pairs = estatePairs(register, at);
        io.out(flags.json ? toJson({ siblingAt: at, pairs }) : formatPairs(pairs, at, register.sites.length));
        return flags.strict && pairs.some((p) => p.sibling) ? 1 : 0;
      }
      const known = register.sites.find((s) => s.id === target);
      const fp = known ? known.fingerprint : fingerprint(await snapshotOf(target, io.cwd));
      const matches = compareToEstate(fp, register, { exclude: known?.id, siblingAt: at });
      io.out(flags.json ? toJson({ siblingAt: at, matches }) : formatMatches(known?.id ?? target, matches, at));
      return flags.strict && matches.some((m) => m.sibling) ? 1 : 0;
    }

    throw new Error(USAGE);
  } catch (error) {
    io.err(`craft: ${(error as Error).message}`);
    return 2;
  }
}
