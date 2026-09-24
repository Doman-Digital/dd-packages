#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { run } from "./run.js";

// `create-site --help | head` closes the pipe early: exit quietly.
process.stdout.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EPIPE") process.exit(process.exitCode ?? 0);
  throw error;
});

const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
const rl = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : undefined;

void run(process.argv.slice(2), {
  cwd: process.cwd(),
  out: (text) => process.stdout.write(`${text}\n`),
  err: (text) => process.stderr.write(`${text}\n`),
  ask: rl ? (question) => rl.question(question) : undefined,
  // No shell: arguments reach the command as they are, on every platform.
  exec: (cmd, args, cwd) => {
    execFileSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" && cmd !== process.execPath });
  },
  now: () => new Date(),
  userAgent: process.env.npm_config_user_agent,
})
  .then((code) => {
    process.exitCode = code;
  })
  .finally(() => rl?.close());
