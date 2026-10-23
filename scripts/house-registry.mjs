#!/usr/bin/env node
/**
 * A local npm registry holding this commit's house packages, for the starter
 * check on pull requests.
 *
 * A pull request that moves a house package to a new minor also moves
 * create-site's range to it (versions.test.ts insists), and that version is
 * not on npm until the Version Packages PR publishes it. So `dd new` on the
 * pull request cannot install what it asks for. Here every public workspace
 * package is packed as it stands (run `changeset version` and
 * `pnpm -r run build` first, so each carries the version it will publish
 * as) and served on 127.0.0.1. Point the @domandigital scope at it in
 * ~/.npmrc and the starter installs this commit's packages at the ranges a
 * real site asks for; everything else still comes from npm.
 *
 * The nightly run never uses this: it installs from npm, so a broken release
 * stays visible.
 *
 *   node scripts/house-registry.mjs [port]   (default 4873; runs until killed)
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.argv[2] ?? 4873);
const base = `http://127.0.0.1:${port}`;
const packs = mkdtempSync(join(tmpdir(), "dd-house-registry-"));

/** name -> { packument, tarballs: Map<file, Buffer> } */
const registry = new Map();
const published = new Date().toISOString();

for (const dir of readdirSync(join(root, "packages")).map((d) => join(root, "packages", d))) {
  const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  if (manifest.private) continue;
  const before = new Set(readdirSync(packs));
  execFileSync("pnpm", ["pack", "--pack-destination", packs], { cwd: dir, stdio: "ignore" });
  const file = readdirSync(packs).find((f) => !before.has(f));
  if (!file) throw new Error(`pnpm pack produced nothing for ${manifest.name}`);
  const tarball = readFileSync(join(packs, file));
  // The packed manifest, not the workspace one: pack turns workspace: ranges into real ones.
  const packed = JSON.parse(execFileSync("tar", ["-xzOf", join(packs, file), "package/package.json"], { encoding: "utf8" }));
  const version = {
    ...packed,
    _id: `${packed.name}@${packed.version}`,
    dist: {
      tarball: `${base}/${packed.name}/-/${file}`,
      shasum: createHash("sha1").update(tarball).digest("hex"),
      integrity: `sha512-${createHash("sha512").update(tarball).digest("base64")}`,
    },
  };
  registry.set(packed.name, {
    packument: {
      name: packed.name,
      "dist-tags": { latest: packed.version },
      versions: { [packed.version]: version },
      time: { created: published, modified: published, [packed.version]: published },
    },
    tarballs: new Map([[file, tarball]]),
  });
  console.log(`  ${packed.name}@${packed.version}`);
}

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? "/", base).pathname).slice(1);
  const [scope, name, dash, file] = path.split("/");
  const entry = registry.get(`${scope}/${name}`);
  if (entry && dash === undefined) {
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(entry.packument));
  } else if (entry && dash === "-" && entry.tarballs.has(file)) {
    res.writeHead(200, { "content-type": "application/octet-stream" }).end(entry.tarballs.get(file));
  } else {
    res.writeHead(404, { "content-type": "application/json" }).end(JSON.stringify({ error: `not in this commit's house packages: ${path}` }));
  }
}).listen(port, "127.0.0.1", () => console.log(`house registry on ${base}`));
