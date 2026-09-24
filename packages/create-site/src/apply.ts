// Carries out a plan: files, package.json, the framework config, the install,
// then craft's art direction file through the craft bin the install added.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { Plan } from "./plan.js";

export type Exec = (cmd: string, args: string[], cwd: string) => void;

function writeInside(root: string, path: string, contents: string) {
  const abs = resolve(root, path);
  if (!abs.startsWith(resolve(root))) throw new Error(`refusing to write outside the project: ${path}`);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, contents);
}

export function applyPlan(plan: Plan, clientName: string, exec: Exec): string[] {
  const { root } = plan.project;
  const pending: string[] = [];

  for (const f of plan.files) {
    if (f.action === "create" || f.action === "overwrite") writeInside(root, f.path, f.contents);
  }
  if (plan.packageJson) writeInside(root, "package.json", plan.packageJson.text);
  if (plan.config) writeInside(root, plan.config.file, plan.config.text);
  if (plan.claudeMd) writeInside(root, "CLAUDE.md", plan.claudeMd.text);

  for (const c of plan.commands) exec(c.cmd, c.args, root);

  if (plan.craftInit) {
    const manifest = join(root, "node_modules", "@domandigital", "craft", "package.json");
    if (existsSync(manifest)) {
      const bin = (JSON.parse(readFileSync(manifest, "utf8")) as { bin?: Record<string, string> }).bin?.craft;
      if (bin) exec(process.execPath, [join(dirname(manifest), bin), "direction", "init", "--client", clientName], root);
      else pending.push(`npx craft direction init --client ${JSON.stringify(clientName)}`);
    } else {
      pending.push(`npx craft direction init --client ${JSON.stringify(clientName)}`);
    }
  }
  return pending;
}
