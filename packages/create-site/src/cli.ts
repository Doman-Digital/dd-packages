#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { run } from "./run.js";

// `create-site --help | head` closes the pipe early: exit quietly.
process.stdout.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EPIPE") process.exit(process.exitCode ?? 0);
  throw error;
});

/** Whether dd-programme is on the PATH. Without it the programme gate cannot run, and a real run is refused. */
function hasProgrammeTool(): boolean {
  return spawnSync("dd-programme", ["--help"], { stdio: "ignore" }).status === 0;
}

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
  gate: hasProgrammeTool()
    ? async (programme, kind) => {
        const args = kind === "handover" ? ["gate", programme, "--handover"] : ["gate", programme, "--stage", "05"];
        const result = spawnSync("dd-programme", args, { encoding: "utf8" });
        return { ok: result.status === 0, message: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim() };
      }
    : undefined,
  userAgent: process.env.npm_config_user_agent,
  noGateEnv: process.env.DD_CREATE_SITE_NO_GATE,
})
  .then((code) => {
    process.exitCode = code;
  })
  .finally(() => rl?.close());
