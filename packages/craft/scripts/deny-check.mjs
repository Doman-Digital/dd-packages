#!/usr/bin/env node
// The name guard: no client business, client domain, client person, studio
// staff member or reviewer is named anywhere in craft, in the repository or in
// what npm receives. The names are kept only as salted hashes, in
// src/__tests__/fixtures/deny-names.json, so this public check names nobody.
//
// Used by src/__tests__/deny-names.test.ts (the files package.json ships, dist
// and the rest of the package folder) and by the repository's
// scripts/check-tarballs.mjs (the packed tarball). Run it by hand on a folder:
//
//   node packages/craft/scripts/deny-check.mjs <folder>...
//
// A hit prints the file, the line and the word, and exits 1.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
export const DENY_LIST = resolve(HERE, "../src/__tests__/fixtures/deny-names.json");

/** Words dropped before pairing, so "A and B" pairs as "a b" and "ab". */
const DROPPED = new Set(["and", "the"]);

/** Folders never read: installs, and the build output, which is checked on its own. */
const SKIPPED_DIRS = new Set(["node_modules", ".git", ".turbo"]);

export function loadDenyList(path = DENY_LIST) {
  const list = JSON.parse(readFileSync(path, "utf8"));
  return { salt: list.salt, canary: list.canary, hashes: new Set(list.hashes) };
}

const hashOf = (salt, form) => createHash("sha256").update(`${salt}:${form}`).digest("hex");

/** Every form the recipe hashes for one line: each token, and each adjacent pair spaced and run together. */
export function formsOf(line) {
  const tokens = line
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !DROPPED.has(t));
  const forms = [...tokens];
  for (let i = 0; i + 1 < tokens.length; i++) forms.push(`${tokens[i]} ${tokens[i + 1]}`, `${tokens[i]}${tokens[i + 1]}`);
  return forms;
}

/** Hits in one text: line number (from 1) and the form that matched. */
export function scanText(text, list) {
  const hits = [];
  text.split("\n").forEach((line, i) => {
    for (const form of formsOf(line)) if (list.hashes.has(hashOf(list.salt, form))) hits.push({ line: i + 1, form });
  });
  return hits;
}

/** A file is read as text unless it holds a NUL byte in its first 8 KB (images, fonts, archives). */
function readText(path) {
  const buf = readFileSync(path);
  if (buf.subarray(0, 8192).includes(0)) return null;
  return buf.toString("utf8");
}

/** Every file under a path (or the path itself), skipping installs. */
export function walk(path, skip = SKIPPED_DIRS) {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((d) => {
    if (d.isDirectory() && skip.has(d.name)) return [];
    return walk(join(path, d.name), skip);
  });
}

/** Hits across files: `{ file, line, form }`, with file relative to `base`. */
export function scanFiles(files, list, base = process.cwd()) {
  return files.flatMap((file) => {
    const text = readText(file);
    return text === null ? [] : scanText(text, list).map((h) => ({ file: relative(base, file), ...h }));
  });
}

/** What npm ships for a package folder: package.json, plus everything its `files` list names. */
export function shippedFiles(pkgDir) {
  const manifest = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
  const roots = ["package.json", ...(manifest.files ?? [])].map((f) => join(pkgDir, f));
  return roots.flatMap((p) => {
    try {
      return walk(p);
    } catch {
      return [];
    }
  });
}

export const formatHit = (h) => `${h.file}:${h.line} names "${h.form}"`;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dirs = process.argv.slice(2);
  if (!dirs.length) {
    console.error("usage: node scripts/deny-check.mjs <folder>...");
    process.exit(2);
  }
  const list = loadDenyList();
  const hits = dirs.flatMap((d) => scanFiles(walk(resolve(d)), list));
  for (const h of hits) console.error(`  ${formatHit(h)}`);
  console.log(hits.length ? `deny-check: ${hits.length} name(s) found` : `deny-check: no names in ${dirs.join(", ")}`);
  process.exit(hits.length ? 1 : 0);
}
