import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CAPSULE_ARCHIVE, type Panel } from "./config.js";
import type { RunMeta } from "./report.js";

/** Where a run is kept. `cloud` is true only when `dd-storage publish` returned 0 for it. */
export interface StorageRecord {
  cloud: boolean;
  reason?: string;
}

const REPORT_SECTION = "\n## Where this run is stored\n";

/** The panel keeps its runs in the cloud capsule (R2, through dd-storage), not in a folder of its own. */
export const isCloudArchive = (panel: Panel): boolean => panel.archive === CAPSULE_ARCHIVE;

interface DdStorage {
  missing: boolean;
  status: number | null;
  stdout: string;
  stderr: string;
}

/** Runs the claude-kit resolver. The bucket and the folders are its business, never this package's. */
function ddStorage(args: string[]): DdStorage {
  const r = spawnSync("dd-storage", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (r.error && (r.error as NodeJS.ErrnoException).code === "ENOENT") return { missing: true, status: null, stdout: "", stderr: "" };
  return { missing: false, status: r.status, stdout: r.stdout ?? "", stderr: r.error ? r.error.message : (r.stderr ?? "") };
}

/** The local working copy of the client capsule, as dd-storage names it. Throws with the reason when it cannot. */
export function capsuleWorkingCopy(): string {
  const r = ddStorage(["get", "local.capsule_dir"]);
  if (r.missing) {
    throw new Error(`archive ${CAPSULE_ARCHIVE} needs dd-storage on PATH (claude-kit, tools/storage). Install claude-kit, or set the panel's archive to a folder for an offline run.`);
  }
  const dir = r.stdout.trim();
  if (r.status !== 0 || !dir) throw new Error(`dd-storage get local.capsule_dir failed${r.status ? ` (exit ${r.status})` : ""}: ${r.stderr.trim() || "no folder returned"}`);
  return dir;
}

/** The folder runs are written into: the capsule's working copy, or the panel's own folder. */
export function archiveRoot(panel: Panel): string {
  return isCloudArchive(panel) ? capsuleWorkingCopy() : panel.archive;
}

/** Publishes the client's capsule to R2. Exit 3 means the cloud cannot be reached: the run stays local. */
export function publishCapsule(panel: Panel): StorageRecord {
  const r = ddStorage(["publish", panel.client]);
  if (r.missing) return { cloud: false, reason: "dd-storage is not on PATH" };
  if (r.status === 0) return { cloud: true };
  const why = r.status === 3 ? "the cloud could not be reached" : `dd-storage publish exited ${r.status}`;
  const detail = r.stderr.trim();
  return { cloud: false, reason: detail ? `${why}: ${detail}` : why };
}

const sectionFor = (panel: Panel, r: StorageRecord): string =>
  r.cloud
    ? `${REPORT_SECTION}\nPublished to R2 with \`dd-storage publish ${panel.client}\`.\n`
    : `${REPORT_SECTION}\n**Local only:** ${r.reason}. Nothing from this run has reached R2 yet. \`dd-capsule-push\` will carry it.\n`;

/**
 * Stores a finished run: publishes it when the archive is the cloud capsule and publishing is not turned off, records
 * where it went in run.json and at the foot of report.md, and prints a loud notice on stderr when a cloud run stayed local.
 */
export function storeRun(panel: Panel, runDir: string, opts: { publish?: boolean; log?: (line: string) => void } = {}): StorageRecord {
  const log = opts.log ?? console.log;
  const record: StorageRecord = !isCloudArchive(panel)
    ? { cloud: false, reason: "the archive is a folder, an offline working copy" }
    : opts.publish === false
      ? { cloud: false, reason: "--no-publish was passed" }
      : publishCapsule(panel);

  const runFile = join(runDir, "run.json");
  const meta = JSON.parse(readFileSync(runFile, "utf8")) as RunMeta;
  meta.storage = record;
  writeFileSync(runFile, JSON.stringify(meta, null, 1));

  const reportFile = join(runDir, "report.md");
  if (existsSync(reportFile)) {
    const body = readFileSync(reportFile, "utf8").replace(new RegExp(`${REPORT_SECTION}[\\s\\S]*$`), "");
    writeFileSync(reportFile, body + sectionFor(panel, record));
  }

  if (record.cloud) {
    log(`stored: published run ${meta.runId} to R2 with dd-storage publish ${panel.client}`);
  } else if (isCloudArchive(panel)) {
    process.stderr.write(`NOTICE: run ${meta.runId} is only in the local working copy (${record.reason}). dd-capsule-push will carry it to R2; the cloud does not have it yet.\n`);
  } else {
    log(`stored locally only in ${runDir} (${record.reason}); dd-capsule-push will carry it to R2`);
  }
  return record;
}
