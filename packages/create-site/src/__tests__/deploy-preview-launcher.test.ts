import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vitest";

const roots: string[] = [];
afterAll(() => roots.forEach(root => rmSync(root, { recursive: true, force: true })));
const templates = fileURLToPath(new URL("../../templates/shared/scripts/gates/", import.meta.url));

function fixture(kind: string, buildExit: number, measureExit = 0) {
  const root = mkdtempSync(join(tmpdir(), "create-site-preview-"));
  roots.push(root);
  mkdirSync(join(root, "scripts/gates"), { recursive: true });
  for (const file of ["deploy-preview.mjs", "programme.mjs", "protected-preview.mjs"]) cpSync(join(templates, file), join(root, "scripts/gates", file));
  writeFileSync(join(root, "site.programme.json"), JSON.stringify({ preview: { host: "cloudflare" } }));
  writeFileSync(join(root, "wrangler.json"), JSON.stringify({ name: "fixture-preview", workers_dev: true }));
  const native = kind === "native";
  const manager = join(root, native ? "pnpm native" : `package manager.${kind}`);
  const build = `import('node:fs').then(fs => { fs.writeFileSync('build.json', JSON.stringify({ args: process.argv.slice(${native ? 1 : 2}), preview: process.env.PUBLIC_PREVIEW, publicPreview: process.env.NEXT_PUBLIC_PREVIEW })); process.exit(${buildExit}); });`;
  if (native) {
    // A real native executable, not a JS file with a misleading extension.
    // Node treats the first argument (run) as the fixture's script filename.
    symlinkSync(process.execPath, manager);
    writeFileSync(join(root, "run"), build);
  } else writeFileSync(manager, build); // Deliberately not executable.
  writeFileSync(join(root, "scripts/gates/measure.mjs"), `import fs from 'node:fs'; if (!fs.existsSync('build.json')) process.exit(91); fs.writeFileSync('measure.json', JSON.stringify({ args: process.argv.slice(2), preview: process.env.PUBLIC_PREVIEW, publicPreview: process.env.NEXT_PUBLIC_PREVIEW })); process.exit(${measureExit});`);
  mkdirSync(join(root, "node_modules/.bin"), { recursive: true });
  writeFileSync(join(root, "node_modules/.bin/wrangler"), `#!/usr/bin/env node\nimport('node:fs').then(fs => fs.writeFileSync('deployed', 'unexpected'));\n`, { mode: 0o755 });
  const result = spawnSync(process.execPath, [join(root, "scripts/gates/deploy-preview.mjs"), "--dry-run"], { cwd: root, env: { ...process.env, npm_execpath: manager }, encoding: "utf8" });
  return { root, result, output: `${result.stdout}${result.stderr}`, native };
}

function checkBuild(root: string, native: boolean) {
  const record = JSON.parse(readFileSync(join(root, "build.json"), "utf8"));
  expect(record.preview).toBe("1");
  expect(record.publicPreview).toBe("1");
  if (native) expect(record.args).toEqual([join(realpathSync(root), "run"), "build"]);
  else expect(record.args).toEqual(["run", "build"]);
}

describe("preview package-manager launchers", () => {
  for (const kind of ["js", "mjs", "cjs", "native"]) {
    test(`${kind}: builds and measures with preview flags and does not deploy a dry run`, () => {
      const { root, result, output, native } = fixture(kind, 0);
      expect(result.status, output).toBe(0);
      checkBuild(root, native);
      const measured = JSON.parse(readFileSync(join(root, "measure.json"), "utf8"));
      expect(measured).toEqual({ args: ["--serve", "--preview"], preview: "1", publicPreview: "1" });
      expect(output).toContain("--dry-run");
      expect(existsSync(join(root, "deployed"))).toBe(false);
    });
    test(`${kind}: a failed build stops measurement and deployment`, () => {
      const { root, result, output, native } = fixture(kind, 7);
      expect(result.status, output).toBe(1);
      checkBuild(root, native);
      expect(output).toContain("preview build failed");
      expect(existsSync(join(root, "measure.json"))).toBe(false);
      expect(existsSync(join(root, "deployed"))).toBe(false);
    });
  }
  test("native: failed measurement stops deployment", () => {
    const { root, result, output } = fixture("native", 0, 9);
    expect(result.status, output).toBe(1);
    expect(existsSync(join(root, "build.json"))).toBe(true);
    expect(existsSync(join(root, "measure.json"))).toBe(true);
    expect(output).toContain("measurement failed");
    expect(existsSync(join(root, "deployed"))).toBe(false);
  });
});
