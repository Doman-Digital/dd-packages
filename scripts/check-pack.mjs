#!/usr/bin/env node
// Checks what npm will actually ship, not what the workspace resolves.
//
// Every package passed typecheck, test and build while all five shipped
// CommonJS consumers the ESM type declarations ("Masquerading as ESM" in
// attw, found 2026-09-24). Workspace tests import source through vitest
// aliases, so nothing in CI had ever looked at a packed tarball. This does:
//
//   1. `pnpm pack` each public package (workspace:^ ranges get rewritten
//      to real versions, exactly as on publish).
//   2. publint --strict and attw --profile node16 on each tarball.
//   3. Installs every tarball into one throwaway consumer and, per package:
//      require() and import() each JS entry point, runs each bin with
//      --help, and checks every non-JS export and every `files` entry landed.
//
// Run after a build: `pnpm run check:pack` does both. Zero dependencies
// beyond publint and attw, which are root devDependencies.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bin = (name) => join(root, "node_modules", ".bin", process.platform === "win32" ? `${name}.cmd` : name);
const work = mkdtempSync(join(tmpdir(), "dd-pack-"));
const tarballs = join(work, "tarballs");
const consumer = join(work, "consumer");
mkdirSync(tarballs);
mkdirSync(consumer);

const failures = [];
const fail = (pkg, what, detail) => failures.push({ pkg, what, detail: String(detail ?? "").trim() });

function run(cmd, args, cwd) {
  try {
    return { ok: true, out: execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) };
  } catch (err) {
    return { ok: false, out: `${err.stdout ?? ""}${err.stderr ?? ""}` || err.message };
  }
}

const packages = readdirSync(join(root, "packages"))
  .map((dir) => ({ dir: join(root, "packages", dir), manifest: JSON.parse(readFileSync(join(root, "packages", dir, "package.json"), "utf8")) }))
  .filter(({ manifest }) => !manifest.private);

// Exports keys split by what a consumer does with them.
const isAsset = (key) => /\.(css|json)$/.test(key);
const jsEntries = (manifest) => Object.keys(manifest.exports ?? {}).filter((k) => !isAsset(k));
const assetEntries = (manifest) => Object.keys(manifest.exports ?? {}).filter((k) => isAsset(k) && k !== "./package.json");
const specifier = (name, key) => (key === "." ? name : `${name}/${key.slice(2)}`);

// 1 + 2: pack, then lint the tarball itself.
for (const pkg of packages) {
  const { name, version } = pkg.manifest;
  const packed = run("pnpm", ["pack", "--pack-destination", tarballs], pkg.dir);
  if (!packed.ok) {
    fail(name, "pnpm pack", packed.out);
    continue;
  }
  pkg.tarball = join(tarballs, `${name.replace("@", "").replace("/", "-")}-${version}.tgz`);
  if (!existsSync(pkg.tarball)) {
    fail(name, "pnpm pack", `expected ${pkg.tarball}`);
    continue;
  }

  const lint = run(bin("publint"), ["run", pkg.tarball, "--strict", "--level", "warning"], root);
  if (!lint.ok) fail(name, "publint --strict", lint.out);

  // node16 profile: node10 resolution predates exports maps and cannot see
  // subpaths at all. CSS entry points are not modules; attw cannot resolve them.
  const cssEntries = Object.keys(pkg.manifest.exports ?? {}).filter((k) => k.endsWith(".css"));
  const attwArgs = [pkg.tarball, "--profile", "node16", "--format", "ascii", "--no-emoji", "--no-color"];
  if (cssEntries.length) attwArgs.push("--exclude-entrypoints", ...cssEntries);
  const types = run(bin("attw"), attwArgs, root);
  if (!types.ok) fail(name, "attw --profile node16", types.out);
}

// 3: one consumer, every tarball, the way a user installs them.
const packed = packages.filter((p) => p.tarball && existsSync(p.tarball));
writeFileSync(join(consumer, "package.json"), JSON.stringify({ name: "dd-pack-consumer", private: true }, null, 2));
const install = run("npm", ["install", "--no-audit", "--no-fund", "--no-package-lock", ...packed.map((p) => p.tarball)], consumer);
if (!install.ok) {
  fail("(all)", "npm install of the tarballs", install.out);
} else {
  for (const pkg of packed) {
    const { name } = pkg.manifest;
    const installed = join(consumer, "node_modules", ...name.split("/"));

    for (const key of jsEntries(pkg.manifest)) {
      const spec = specifier(name, key);
      const cjs = run("node", ["-e", `require(${JSON.stringify(spec)})`], consumer);
      if (!cjs.ok) fail(name, `require("${spec}")`, cjs.out);
      const esm = run("node", ["--input-type=module", "-e", `await import(${JSON.stringify(spec)})`], consumer);
      if (!esm.ok) fail(name, `import("${spec}")`, esm.out);
    }

    for (const key of assetEntries(pkg.manifest)) {
      const target = pkg.manifest.exports[key];
      if (!existsSync(join(installed, target))) fail(name, `export ${key}`, `${target} is not in the tarball`);
    }

    for (const entry of pkg.manifest.files ?? []) {
      if (!existsSync(join(installed, entry))) fail(name, `files entry ${entry}`, "listed in files but not in the tarball");
    }

    for (const binName of Object.keys(pkg.manifest.bin ?? {})) {
      const help = run(join(consumer, "node_modules", ".bin", binName), ["--help"], consumer);
      if (!help.ok) fail(name, `${binName} --help`, help.out);
    }
  }
}

rmSync(work, { recursive: true, force: true });

const checked = packed.map((p) => p.manifest.name).join(", ");
if (failures.length === 0) {
  console.log(`check-pack: ${packed.length} tarballs clean (${checked})`);
  process.exit(0);
}
for (const f of failures) console.error(`\n✗ ${f.pkg}: ${f.what}\n${f.detail.split("\n").slice(0, 25).join("\n")}`);
const byPkg = new Set(failures.map((f) => f.pkg));
console.error(`\ncheck-pack: ${failures.length} failure(s) across ${byPkg.size} package(s)`);
process.exit(1);
