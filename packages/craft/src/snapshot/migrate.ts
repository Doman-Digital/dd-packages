/**
 * Read a saved snapshot of any version this craft understands. Pure.
 *
 * Version 2 only added optional fields, so a version 1 snapshot is a valid
 * version 2 snapshot without them. It is marked `migratedFrom: 1` so a report
 * can say which measures it lacks, rather than reading their absence as zero.
 */

import { SNAPSHOT_VERSION, type Snapshot } from "./types.js";

export const READABLE_SNAPSHOT_VERSIONS = [1, 2] as const;

export function readSnapshot(data: unknown, source = "snapshot"): Snapshot {
  const v = (data as { version?: unknown } | null)?.version;
  if (typeof data !== "object" || data === null || !READABLE_SNAPSHOT_VERSIONS.includes(v as 1 | 2)) {
    throw new Error(`${source} is not a snapshot this craft reads (version ${String(v)}; reads ${READABLE_SNAPSHOT_VERSIONS.join(" and ")})`);
  }
  const snap = data as Omit<Snapshot, "version"> & { version: 1 | 2 };
  if (snap.version === 1) return { ...snap, version: SNAPSHOT_VERSION, migratedFrom: 1 };
  return snap as Snapshot;
}
