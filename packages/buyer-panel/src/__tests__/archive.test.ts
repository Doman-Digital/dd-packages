import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { archiveRoot, capsuleWorkingCopy, publishCapsule, storeRun } from "../archive.js";
import { validatePanel, type Panel } from "../config.js";

// A fake dd-storage on PATH: it records each call, prints the capsule folder for `get`, and for `publish` exits 0,
// or 3 with a reason when FAKE_PUBLISH=3 (the cloud cannot be reached).
const FAKE = `#!/bin/sh
echo "$@" >> "$FAKE_LOG"
case "$1" in
  get) echo "$FAKE_CAPSULE" ;;
  publish)
    if [ "$FAKE_PUBLISH" = "3" ]; then echo "no R2 token in this shell" >&2; exit 3; fi
    exit 0 ;;
  *) exit 2 ;;
esac
`;

const panelFile = fileURLToPath(new URL("../../panels/dd-live-build.json", import.meta.url));
const basePanel = validatePanel(JSON.parse(readFileSync(panelFile, "utf8")) as Panel, "/base");

let dir: string;
let fakeBin: string;
let capsule: string;
let log: string;
const savedPath = process.env.PATH;
const savedEnv = { FAKE_LOG: process.env.FAKE_LOG, FAKE_CAPSULE: process.env.FAKE_CAPSULE, FAKE_PUBLISH: process.env.FAKE_PUBLISH };

const calls = () => (existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").filter(Boolean) : []);

/** A finished run folder with a report, as evaluateRun leaves it. */
function runFolder(): string {
  const run = join(dir, "run");
  mkdirSync(run, { recursive: true });
  writeFileSync(join(run, "run.json"), JSON.stringify({ runId: "ec2e8424-2026-11-18T0900", version: "ec2e8424", evaluator: {} }));
  writeFileSync(join(run, "report.md"), "# Buyer panel run ec2e8424-2026-11-18T0900\n");
  return run;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "archive-test-"));
  fakeBin = join(dir, "bin");
  capsule = join(dir, "capsule");
  log = join(dir, "calls.log");
  mkdirSync(fakeBin);
  mkdirSync(capsule);
  writeFileSync(join(fakeBin, "dd-storage"), FAKE);
  chmodSync(join(fakeBin, "dd-storage"), 0o755);
  process.env.PATH = `${fakeBin}:${savedPath}`;
  process.env.FAKE_LOG = log;
  process.env.FAKE_CAPSULE = capsule;
  delete process.env.FAKE_PUBLISH;
});

afterEach(() => {
  process.env.PATH = savedPath;
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  vi.restoreAllMocks();
});

describe("the cloud capsule archive", () => {
  it("resolves the capsule's local working copy with dd-storage", () => {
    expect(capsuleWorkingCopy()).toBe(capsule);
    expect(archiveRoot(basePanel)).toBe(capsule);
    expect(calls()).toEqual(["get local.capsule_dir", "get local.capsule_dir"]);
  });

  it("expands a leading ~ in the folder dd-storage names, so runs never land in a folder called ~", () => {
    process.env.FAKE_CAPSULE = "~/dd-client-capsule";
    expect(capsuleWorkingCopy()).toBe(join(homedir(), "dd-client-capsule"));
    expect(archiveRoot(basePanel)).toBe(join(homedir(), "dd-client-capsule"));
  });

  it("fails clearly, before any session, when dd-storage is not on PATH", () => {
    process.env.PATH = join(dir, "empty");
    mkdirSync(join(dir, "empty"));
    expect(() => archiveRoot(basePanel)).toThrow(/needs dd-storage on PATH/);
  });

  it("publishes the client's capsule and records it as cloud", () => {
    const run = runFolder();
    const notice = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const record = storeRun(basePanel, run, { log: () => {} });
    expect(record).toEqual({ cloud: true });
    expect(calls()).toContain("publish doman-digital");
    expect(notice).not.toHaveBeenCalled();
    expect(JSON.parse(readFileSync(join(run, "run.json"), "utf8")).storage).toEqual({ cloud: true });
    expect(readFileSync(join(run, "report.md"), "utf8")).toContain("Published to R2 with `dd-storage publish doman-digital`.");
  });

  it("prints a loud notice and reports local only when the cloud cannot be reached (exit 3)", () => {
    process.env.FAKE_PUBLISH = "3";
    const run = runFolder();
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const record = storeRun(basePanel, run, { log: () => {} });
    expect(record.cloud).toBe(false);
    expect(record.reason).toContain("the cloud could not be reached");
    expect(stderr.mock.calls.map((c) => String(c[0])).join("")).toMatch(/NOTICE: run ec2e8424-2026-11-18T0900 is only in the local working copy.*dd-capsule-push will carry it/);
    const report = readFileSync(join(run, "report.md"), "utf8");
    expect(report).toContain("**Local only:**");
    expect(report).toContain("dd-capsule-push");
  });

  it("keeps one storage section when a run is stored twice, as an evaluate after a run does", () => {
    process.env.FAKE_PUBLISH = "3";
    const run = runFolder();
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    storeRun(basePanel, run, { log: () => {} });
    storeRun(basePanel, run, { log: () => {} });
    expect(readFileSync(join(run, "report.md"), "utf8").match(/## Where this run is stored/g)).toHaveLength(1);
  });

  it("keeps the run in the working copy and never publishes when --no-publish is passed", () => {
    const run = runFolder();
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const record = storeRun(basePanel, run, { publish: false, log: () => {} });
    expect(record).toEqual({ cloud: false, reason: "--no-publish was passed" });
    expect(calls().some((c) => c.startsWith("publish"))).toBe(false);
    expect(stderr).toHaveBeenCalled();
  });

  it("reports a missing dd-storage at publish time as local only, loudly", () => {
    const run = runFolder();
    process.env.PATH = join(dir, "empty");
    mkdirSync(join(dir, "empty"), { recursive: true });
    expect(publishCapsule(basePanel)).toEqual({ cloud: false, reason: "dd-storage is not on PATH" });
  });
});

describe("a plain folder archive", () => {
  it("writes to the folder and never calls dd-storage", () => {
    const folder = join(dir, "offline");
    mkdirSync(folder);
    const panel = { ...basePanel, archive: folder };
    expect(archiveRoot(panel)).toBe(folder);
    const run = runFolder();
    const logs: string[] = [];
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const record = storeRun(panel, run, { log: (l) => logs.push(l) });
    expect(record.cloud).toBe(false);
    expect(record.reason).toMatch(/offline working copy/);
    expect(calls()).toEqual([]);
    expect(stderr).not.toHaveBeenCalled();
    expect(logs.join("\n")).toContain("stored locally only");
    expect(readFileSync(join(run, "report.md"), "utf8")).toContain("**Local only:**");
  });
});
