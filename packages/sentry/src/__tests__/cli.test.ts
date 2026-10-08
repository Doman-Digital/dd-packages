/// <reference types="node" />
/**
 * The CLI from its built file, with a fake `sentry` first on PATH that records
 * its arguments and fails when told to. Build first: `pnpm run build`.
 */

import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

const cli = join(import.meta.dirname, "../../dist/cli.js");
let work: string;

// CI tests before it builds, so a fresh checkout builds here first.
beforeAll(() => {
  if (!existsSync(cli)) spawnSync("pnpm", ["run", "build"], { cwd: join(import.meta.dirname, "../.."), stdio: "ignore" });
}, 120_000);

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "dd-sentry-cli-"));
  const bin = join(work, "bin");
  mkdirSync(bin);
  writeFileSync(
    join(bin, "sentry"),
    `#!/bin/sh\necho "$SENTRY_ORG|$SENTRY_PROJECT|$*" >> "${join(work, "calls.log")}"\ncase "$*" in *"$FAIL_ON"*) [ -n "$FAIL_ON" ] && exit 3;; esac\nexit 0\n`,
  );
  chmodSync(join(bin, "sentry"), 0o755);
  for (const dir of ["client/_astro", "server"]) mkdirSync(join(work, "dist", dir), { recursive: true });
  for (const file of ["client/_astro/a.js", "client/_astro/a.js.map", "server/entry.mjs", "server/entry.mjs.map"]) {
    writeFileSync(join(work, "dist", file), "x");
  }
});

afterEach(() => rmSync(work, { recursive: true, force: true }));

function run(args: string[], env: Record<string, string> = {}) {
  const r = spawnSync(process.execPath, [cli, ...args], {
    cwd: work,
    encoding: "utf8",
    env: { PATH: `${join(work, "bin")}:${process.env.PATH}`, SENTRY_AUTH_TOKEN: "sntrys_test", SENTRY_PROJECT: "rmp-electrical", ...env } as Record<string, string> as unknown as NodeJS.ProcessEnv,
  });
  const log = existsSync(join(work, "calls.log")) ? readFileSync(join(work, "calls.log"), "utf8").trim().split("\n") : [];
  return { status: r.status, out: r.stdout + r.stderr, calls: log };
}

const has = (path: string) => existsSync(join(work, "dist", path));

describe("dd-sentry-release upload", () => {
  it("creates the release, injects and uploads each directory, then deletes the maps it was not told to keep", () => {
    const r = run(["upload", "dist/client", "dist/server", "--keep-maps", "dist/server"], { GITHUB_SHA: "abc123" });
    expect(r.status).toBe(0);
    expect(r.calls).toEqual([
      "domandigital|rmp-electrical|release create domandigital/abc123 --project rmp-electrical",
      "domandigital|rmp-electrical|sourcemap inject dist/client",
      "domandigital|rmp-electrical|sourcemap upload dist/client --release abc123",
      "domandigital|rmp-electrical|sourcemap inject dist/server",
      "domandigital|rmp-electrical|sourcemap upload dist/server --release abc123",
    ]);
    expect(has("client/_astro/a.js.map")).toBe(false);
    expect(has("client/_astro/a.js")).toBe(true);
    expect(has("server/entry.mjs.map")).toBe(true);
  });

  it("always uses the domandigital org", () => {
    const r = run(["upload", "dist/client"], { GITHUB_SHA: "abc", SENTRY_ORG: "someone-else" });
    expect(r.calls.every((c) => c.startsWith("domandigital|"))).toBe(true);
    expect(r.out).toContain("using domandigital");
  });

  it("still deletes the maps, and does not fail the build, without a token", () => {
    const r = run(["upload", "dist/client"], { SENTRY_AUTH_TOKEN: "" });
    expect(r.status).toBe(0);
    expect(r.calls).toEqual([]);
    expect(r.out).toContain("SENTRY_AUTH_TOKEN is not set");
    expect(has("client/_astro/a.js.map")).toBe(false);
    expect(run(["upload", "dist/client", "--strict"], { SENTRY_AUTH_TOKEN: "" }).status).toBe(1);
  });

  it("carries on past a failed upload unless --strict", () => {
    expect(run(["upload", "dist/client"], { GITHUB_SHA: "abc", FAIL_ON: "sourcemap upload" }).status).toBe(0);
    expect(has("client/_astro/a.js.map")).toBe(false);
    expect(run(["upload", "dist/server", "--strict"], { GITHUB_SHA: "abc", FAIL_ON: "sourcemap upload" }).status).toBe(1);
  });

  it("refuses a directory that is not there", () => {
    expect(run(["upload", "dist/nope"]).status).toBe(2);
  });

  it("changes nothing on a dry run", () => {
    const r = run(["upload", "dist/client", "--dry-run"], { GITHUB_SHA: "abc" });
    expect(r.status).toBe(0);
    expect(r.calls).toEqual([]);
    expect(r.out).toContain("would run: sentry sourcemap upload dist/client --release abc");
    expect(has("client/_astro/a.js.map")).toBe(true);
  });
});

describe("dd-sentry-release finalize", () => {
  it("finalizes the release and records the deploy", () => {
    const r = run(["finalize"], { GITHUB_SHA: "abc", SENTRY_ENVIRONMENT: "production" });
    expect(r.status).toBe(0);
    expect(r.calls).toEqual([
      "domandigital|rmp-electrical|release finalize domandigital/abc",
      "domandigital|rmp-electrical|release deploy domandigital/abc production",
    ]);
  });

  it("records no deploy rather than guess the environment", () => {
    const r = run(["finalize", "--release", "abc"]);
    expect(r.calls).toEqual(["domandigital|rmp-electrical|release finalize domandigital/abc"]);
    expect(r.out).toContain("no deploy recorded");
    expect(run(["finalize", "--release", "abc", "--environment", "stg"]).calls.at(-1)).toBe(
      "domandigital|rmp-electrical|release deploy domandigital/abc staging",
    );
  });
});

describe("dd-sentry-release", () => {
  it("prints help and exits 0 with --help, 2 with nothing", () => {
    expect(run(["--help"]).status).toBe(0);
    expect(run([]).status).toBe(2);
    expect(run(["publish"]).status).toBe(2);
  });
});
