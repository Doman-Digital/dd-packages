/**
 * One `claude -p` call with nothing loaded: no tools, no settings, no skills,
 * no MCP servers, run from an empty directory. What the model writes from the
 * prompt alone. Set CRAFT_CLAUDE to use another binary.
 *
 * Shared by `craft null build` and the shape calibration scripts, so every
 * generated sample in `calibration/` comes from the same call.
 */

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function generate(prompt: string, model: string | undefined): Promise<string> {
  const bin = process.env.CRAFT_CLAUDE ?? "claude";
  const args = ["-p", "--tools", "", "--no-session-persistence", "--disable-slash-commands", "--setting-sources", "", "--strict-mcp-config", ...(model ? ["--model", model] : []), prompt];
  // An empty directory: no CLAUDE.md, no repo, nothing to read but the brief.
  const cwd = mkdtempSync(join(tmpdir(), "craft-null-"));
  return new Promise((done, fail) => {
    const child = spawn(bin, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => (err += d.toString()));
    child.on("error", (e) => fail(new Error(`${bin}: ${e.message}. Install Claude Code, or set CRAFT_CLAUDE.`)));
    child.on("close", (code) => {
      rmSync(cwd, { recursive: true, force: true });
      if (code === 0) done(out);
      else fail(new Error(`${bin} exited ${code}: ${(err || out).trim().slice(0, 200)}`));
    });
  });
}
