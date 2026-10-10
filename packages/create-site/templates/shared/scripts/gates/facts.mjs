// Stage 06 gate: governed facts are imported, never retyped. A price, a term
// or a response target a visitor reads comes from site.facts.ts, or from a
// generated file an importer writes from the governed source before every
// build (site.programme.json facts.importer: the site's own script, run
// first). This fails on a pound sign followed by digits, a response target
// in hours or days, a minimum term or a notice period typed anywhere in the
// site's source or its copy deck, so a figure typed by hand cannot ship.
//
// Lifted from apps/site/scripts/facts.ts and tests/facts.test.mjs in
// Doman-Digital (DOM-647).

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { programme, root, sitePath, stop } from "./programme.mjs";

const GATE = "facts";
const { paths, facts = {} } = programme();

if (facts.importer) {
  const importer = sitePath(facts.importer);
  if (!existsSync(importer)) stop(GATE, "06", `the importer ${facts.importer} named in site.programme.json does not exist.`);
  const args = importer.endsWith(".ts") ? ["--import", "tsx", importer] : [importer];
  const run = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit" });
  if (run.status !== 0) stop(GATE, "06", `the importer ${facts.importer} failed, so the generated facts are not current.`);
}

const patterns = [
  { name: "a pound figure", re: /£\s?\d/ },
  { name: "a response target in hours", re: /within \d+ (hours?|business hours)/i },
  { name: "a response target in days", re: /within \d+ (UK )?(business |working )?days?/i },
  { name: "a minimum term", re: /\d+[- ]months? minimum/i },
  { name: "a notice period", re: /\d+ days['’]? notice/i },
];
const SKIP_DIRS = new Set(["generated", "node_modules", ".next", ".astro", "dist"]);
const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return SKIP_DIRS.has(f) ? [] : walk(p);
    return [p];
  });

const files = new Set();
for (const dir of paths.source) {
  const abs = sitePath(dir);
  if (existsSync(abs)) for (const f of walk(abs)) if (/\.(astro|tsx?|jsx?|mjs|mdx?|css)$/.test(f)) files.add(f);
}
if (existsSync(sitePath(paths.deck))) files.add(sitePath(paths.deck));

const offenders = [];
for (const file of files) {
  if (relative(root, file) === "site.facts.ts") continue;
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (line.includes("facts-ok")) return;
    for (const { name, re } of patterns) {
      const m = line.match(re);
      if (m) offenders.push(`  ${relative(root, file)}:${i + 1}: ${name} (${m[0]})`);
    }
  });
}
if (offenders.length) {
  stop(GATE, "06", `typed figures found. Read each from site.facts.ts (or the generated facts) instead; a genuine non-claim takes facts-ok on its line.\n${offenders.join("\n")}`);
}
console.log(`${GATE}: ${files.size} files carry no typed price, term or response target`);
