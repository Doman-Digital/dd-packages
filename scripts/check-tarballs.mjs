#!/usr/bin/env node
/**
 * The tarball gate: test what npm will actually receive, not the workspace.
 *
 * Workspace tests import source through pnpm's symlinks, so a missing entry in
 * `files`, a broken `exports` map, a lost bin or types that only resolve for
 * ESM all pass them. This packs every package, runs publint and
 * @arethetypeswrong/cli on each tarball, installs all of them into two clean
 * consumer projects (one ESM, one CommonJS) and loads every export there.
 *
 * Run after `pnpm -r run build`. Exits 1 on the first class of failure it
 * finds, after printing everything it found.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const bin = (name) => join(root, "node_modules", ".bin", name);
const failures = [];
const fail = (msg) => {
  failures.push(msg);
  console.error(`  FAIL ${msg}`);
};

/** CSS has no types, so attw reports it as unresolvable. Nothing else is excused. */
const ATTW_EXCLUDE = { "@domandigital/craft": ["./craft.css", "./craft.tailwind.css"] };

const packages = readdirSync(join(root, "packages"))
  .map((dir) => ({ dir: join(root, "packages", dir), manifest: JSON.parse(readFileSync(join(root, "packages", dir, "package.json"), "utf8")) }))
  .filter((p) => !p.manifest.private);

const work = mkdtempSync(join(tmpdir(), "dd-tarballs-"));
const packs = join(work, "packs");
mkdirSync(packs);

try {
  console.log("Packing");
  const tarballs = [];
  for (const { dir, manifest } of packages) {
    if (!existsSync(join(dir, "dist"))) throw new Error(`${manifest.name} has no dist/. Run \`pnpm -r run build\` first.`);
    const before = new Set(readdirSync(packs));
    execFileSync("pnpm", ["pack", "--pack-destination", packs], { cwd: dir, stdio: "ignore" });
    const made = readdirSync(packs).find((f) => !before.has(f));
    if (!made) throw new Error(`pnpm pack produced nothing for ${manifest.name}`);
    tarballs.push({ manifest, file: join(packs, made) });
    console.log(`  ${manifest.name}@${manifest.version} -> ${made}`);
  }

  console.log("publint");
  for (const { manifest, file } of tarballs) {
    const r = spawnSync(bin("publint"), [file, "--strict"], { encoding: "utf8" });
    if (r.status !== 0) fail(`publint ${manifest.name}\n${r.stdout}${r.stderr}`);
    else console.log(`  ok ${manifest.name}`);
  }

  console.log("are the types wrong");
  for (const { manifest, file } of tarballs) {
    const exclude = ATTW_EXCLUDE[manifest.name] ?? [];
    const args = [file, "--profile", "node16", "--format", "ascii", ...(exclude.length ? ["--exclude-entrypoints", ...exclude] : [])];
    const r = spawnSync(bin("attw"), args, { encoding: "utf8" });
    if (r.status !== 0) fail(`attw ${manifest.name}\n${r.stdout}${r.stderr}`);
    else console.log(`  ok ${manifest.name}`);
  }

  for (const mode of ["esm", "cjs"]) {
    console.log(`Clean ${mode} consumer`);
    const consumer = join(work, mode);
    mkdirSync(consumer);
    writeFileSync(join(consumer, "package.json"), JSON.stringify({ name: `consumer-${mode}`, private: true, type: mode === "esm" ? "module" : "commonjs" }));
    execFileSync("npm", ["install", "--no-audit", "--no-fund", "--silent", ...tarballs.map((t) => t.file)], { cwd: consumer, stdio: "inherit" });

    for (const { manifest } of tarballs) {
      for (const key of Object.keys(manifest.exports ?? { ".": "" })) {
        const spec = key === "." ? manifest.name : `${manifest.name}/${key.slice(2)}`;
        const isAsset = /\.(css|json)$/.test(key);
        // Assets are resolved (and JSON parsed); code is loaded the way this consumer would load it.
        const code = isAsset
          ? `const p = require.resolve(${JSON.stringify(spec)}); if (p.endsWith(".json")) JSON.parse(require("fs").readFileSync(p, "utf8"));`
          : mode === "esm"
            ? `const m = await import(${JSON.stringify(spec)}); if (!m || typeof m !== "object") throw new Error("empty module");`
            : `const m = require(${JSON.stringify(spec)}); if (!m || typeof m !== "object") throw new Error("empty module");`;
        const args = isAsset || mode === "cjs" ? ["-e", code] : ["--input-type=module", "-e", code];
        const r = spawnSync(process.execPath, args, { cwd: consumer, encoding: "utf8" });
        if (r.status !== 0) fail(`${mode} ${spec}\n${r.stderr}`);
        else console.log(`  ok ${spec}`);
      }
      for (const [name, path] of Object.entries(typeof manifest.bin === "string" ? { [manifest.name]: manifest.bin } : manifest.bin ?? {})) {
        const r = spawnSync(join(consumer, "node_modules", ".bin", name), ["--help"], { encoding: "utf8" });
        if (r.status !== 0) fail(`${mode} bin ${name} (${path}) exited ${r.status}\n${r.stderr}`);
        else console.log(`  ok bin ${name}`);
      }
      for (const file of manifest.files ?? []) {
        if (file === "dist" || file === "CHANGELOG.md") continue;
        if (!existsSync(join(consumer, "node_modules", manifest.name, file))) fail(`${manifest.name} is missing ${file} in the tarball`);
      }
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`\n${failures.length} tarball check(s) failed.`);
  process.exit(1);
}
console.log("\nAll tarballs are what the workspace says they are.");
