#!/usr/bin/env node
/// <reference types="node" />
/**
 * dd-sentry-release: the release and source-map step for Worker and Astro
 * builds, modelled on RMP-Electrical's deploy-astro.yml. Two halves, because
 * the maps must be gone before the deploy and the deploy record must come
 * after it:
 *
 *   dd-sentry-release upload <dir>... [--keep-maps <dir>]...   before deploying
 *   dd-sentry-release finalize                                  after deploying
 *
 * It drives the `sentry` CLI (the npm package `sentry`, a dev dependency of
 * the site). A Sentry outage or a missing token never fails a deploy; a map
 * that could not be deleted always does.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { SENTRY_ORG, resolveEnvironment, resolveRelease } from "./env";

const HELP = `dd-sentry-release: upload source maps and record a release in Sentry (org ${SENTRY_ORG})

Usage:
  dd-sentry-release upload <dir>... [options]   before deploying
  dd-sentry-release finalize [options]          after a successful deploy

upload   Creates the release, injects debug IDs into each <dir>, uploads its
         maps, then deletes every .map file in each <dir> not named by
         --keep-maps.
finalize Marks the release finished and records a deploy to the environment.

Options:
  --release <sha>       Default: SENTRY_RELEASE, CF_PAGES_COMMIT_SHA,
                        WORKERS_CI_COMMIT_SHA, VERCEL_GIT_COMMIT_SHA, GITHUB_SHA.
  --project <slug>      Default: SENTRY_PROJECT.
  --environment <env>   finalize: production, staging or preview.
                        Default: SENTRY_ENVIRONMENT (or PUBLIC_/NEXT_PUBLIC_).
  --keep-maps <dir>     upload: leave this directory's maps in place (a Worker
                        bundle wrangler still reads). Repeatable.
  --strict              Exit 1 when a Sentry step fails or is skipped.
  --dry-run             Print the sentry commands instead of running them.
                        Maps are still not deleted.
  -h, --help            This text.

Needs SENTRY_AUTH_TOKEN (Doppler; an org token). Without it nothing is sent,
the maps are still deleted, and the build carries on.
`;

interface Args {
  command?: string;
  dirs: string[];
  keep: string[];
  release?: string;
  project?: string;
  environment?: string;
  strict: boolean;
  dryRun: boolean;
  help: boolean;
}

function parse(argv: string[]): Args {
  const args: Args = { dirs: [], keep: [], strict: false, dryRun: false, help: false };
  const value = (i: number, flag: string) => {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new Error(`${flag} needs a value`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === "-h" || a === "--help") args.help = true;
    else if (a === "--strict") args.strict = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--release") args.release = value(i++, a);
    else if (a === "--project") args.project = value(i++, a);
    else if (a === "--environment") args.environment = value(i++, a);
    else if (a === "--keep-maps") args.keep.push(value(i++, a));
    else if (a.startsWith("-")) throw new Error(`unknown option ${a}`);
    else if (!args.command) args.command = a;
    else args.dirs.push(a);
  }
  return args;
}

const log = (msg: string) => console.log(`[dd-sentry-release] ${msg}`);
const warn = (msg: string) => console.warn(`[dd-sentry-release] ${msg}`);

/** Every .map file under dir. */
function maps(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...maps(path));
    else if (name.endsWith(".map")) out.push(path);
  }
  return out;
}

function main(argv: string[]): number {
  let args: Args;
  try {
    args = parse(argv);
  } catch (err) {
    console.error(`dd-sentry-release: ${(err as Error).message}\n\n${HELP}`);
    return 2;
  }
  if (args.help || !args.command) {
    console.log(HELP);
    return args.help ? 0 : 2;
  }
  if (args.command !== "upload" && args.command !== "finalize") {
    console.error(`dd-sentry-release: unknown command ${args.command}\n\n${HELP}`);
    return 2;
  }

  const env = process.env;
  const release = resolveRelease({ release: args.release, env });
  const project = args.project ?? env.SENTRY_PROJECT;
  const token = env.SENTRY_AUTH_TOKEN?.trim();
  let failed = false;

  if (env.SENTRY_ORG && env.SENTRY_ORG !== SENTRY_ORG) warn(`SENTRY_ORG is ${env.SENTRY_ORG}; using ${SENTRY_ORG}, the only org.`);
  const childEnv = { ...env, SENTRY_ORG, ...(project ? { SENTRY_PROJECT: project } : {}) };

  /** Runs one sentry command. A failure is reported and remembered, never thrown. */
  const sentry = (...cmd: string[]): boolean => {
    if (args.dryRun) {
      log(`would run: sentry ${cmd.join(" ")}`);
      return true;
    }
    log(`sentry ${cmd.join(" ")}`);
    const r = spawnSync("sentry", cmd, { env: childEnv, stdio: "inherit" });
    if (r.error && (r.error as NodeJS.ErrnoException).code === "ENOENT") {
      warn("the `sentry` CLI is not installed. Add it to the site: pnpm add -D sentry");
      failed = true;
      return false;
    }
    if (r.status !== 0) {
      warn(`sentry ${cmd[0]} ${cmd[1] ?? ""} failed (exit ${r.status ?? r.signal}); carrying on.`);
      failed = true;
      return false;
    }
    return true;
  };

  const ready = (() => {
    if (!token && !args.dryRun) return "SENTRY_AUTH_TOKEN is not set";
    if (!project) return "no project: set SENTRY_PROJECT or pass --project";
    return null;
  })();
  if (ready) {
    warn(`${ready}; nothing sent to Sentry.`);
    failed = true;
  }

  if (args.command === "upload") {
    if (args.dirs.length === 0) {
      console.error("dd-sentry-release upload: name at least one build directory.");
      return 2;
    }
    const missing = args.dirs.filter((d) => !existsSync(d));
    if (missing.length) {
      console.error(`dd-sentry-release upload: no such directory: ${missing.join(", ")}`);
      return 2;
    }

    if (!ready) {
      if (release) sentry("release", "create", `${SENTRY_ORG}/${release}`, "--project", project as string);
      else warn("no release SHA found; maps go up matched by debug ID only, with no release to finalize.");
      for (const dir of args.dirs) {
        if (sentry("sourcemap", "inject", dir)) {
          sentry("sourcemap", "upload", dir, ...(release ? ["--release", release] : []));
        }
      }
    }

    // Always, whether or not anything was sent: a map that ships is the
    // site's source handed to anyone who asks for it.
    const keep = new Set(args.keep.map((d) => resolve(d)));
    for (const dir of args.dirs) {
      if (keep.has(resolve(dir))) {
        log(`kept the maps in ${dir}`);
        continue;
      }
      const found = maps(dir);
      if (args.dryRun) {
        log(`would delete ${found.length} map(s) in ${dir}`);
        continue;
      }
      try {
        for (const file of found) unlinkSync(file);
        log(`deleted ${found.length} map(s) in ${dir}`);
      } catch (err) {
        console.error(`dd-sentry-release: could not delete the maps in ${dir}: ${(err as Error).message}`);
        return 1;
      }
    }
  } else {
    const { environment, enabled, from } = resolveEnvironment({ environment: args.environment, env });
    if (!ready && !release) {
      warn("no release SHA found; nothing to finalize.");
      failed = true;
    } else if (!ready && release) {
      sentry("release", "finalize", `${SENTRY_ORG}/${release}`);
      if (!from) {
        warn("no environment set (SENTRY_ENVIRONMENT or --environment); no deploy recorded rather than a guessed one.");
        failed = true;
      } else if (!enabled) {
        log(`environment ${args.environment ?? "from " + from} is local; no deploy recorded.`);
      } else {
        sentry("release", "deploy", `${SENTRY_ORG}/${release}`, environment);
      }
    }
  }

  return failed && args.strict ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
