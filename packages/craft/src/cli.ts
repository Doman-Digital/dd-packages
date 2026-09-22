#!/usr/bin/env node
import { run } from "./character/cli.js";

// `craft scan | head` closes the pipe early. That is the reader's choice, not a
// crash: exit quietly with the code the run already chose.
process.stdout.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EPIPE") process.exit(process.exitCode ?? 0);
  throw error;
});

process.exitCode = run(process.argv.slice(2), {
  cwd: process.cwd(),
  out: (text) => process.stdout.write(`${text}\n`),
  err: (text) => process.stderr.write(`${text}\n`),
});
