// Stage 06 gate: the phone is the base layout (STANDARD.md section 10 in
// @domandigital/craft). Base styles are the phone; wider layouts are added
// with min-width queries. This fails on a max-width media query (`max-width:`,
// or the range syntax `width <`, `width <=`, `600px > width`) and on a
// Tailwind max-* variant (`max-sm:`, `max-md:`, `max-[40rem]:`) anywhere in
// the site's source, because a layout written desktop first and taken away
// for the phone is how a site ends up designed for the desktop.
//
// An exception is recorded, never assumed: `mobile-first-ok: <reason>` in a
// comment on the line or the line above, or the whole file in
// site.programme.json mobileFirst.exceptions as { "file", "reason" }. An
// exception with no reason fails, and so does one naming a file that is not
// there.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, normalize, relative } from "node:path";
import { programme, root, sitePath, stop } from "./programme.mjs";

const GATE = "mobile-first";
const { paths = {}, mobileFirst = {} } = programme();

// The source paths.source names, and the usual homes of styles even when it does not.
const DIRS = [...new Set([...(paths.source ?? []), "src", "app", "components", "styles"])];
const EXTENSIONS = /\.(css|scss|sass|less|astro|tsx|jsx|ts|js|mjs|vue|svelte|mdx|html)$/;
const SKIP_DIRS = new Set(["generated", "node_modules", ".next", ".astro", "dist"]);
const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return SKIP_DIRS.has(f) ? [] : walk(p);
    return [p];
  });

const files = new Set();
for (const dir of DIRS) {
  const abs = sitePath(dir);
  if (existsSync(abs) && statSync(abs).isDirectory()) for (const f of walk(abs)) if (EXTENSIONS.test(f)) files.add(f);
}

const problems = [];
const excepted = new Map();
for (const [i, e] of (mobileFirst.exceptions ?? []).entries()) {
  const at = `site.programme.json mobileFirst.exceptions[${i}]`;
  if (typeof e?.file !== "string" || !e.file.trim()) problems.push(`  ${at}: names no file`);
  else if (typeof e.reason !== "string" || !e.reason.trim()) problems.push(`  ${at} (${e.file}): no reason. Say why this file needs a max-width query, or remove the exception.`);
  else if (!existsSync(sitePath(e.file))) problems.push(`  ${at}: ${e.file} is not there. Remove the exception.`);
  else excepted.set(normalize(e.file), e.reason.trim());
}

// A media query whose condition caps the width. The prelude runs to the rule's `{` (or the `;` of @custom-media).
const MEDIA = /@(?:custom-)?media\b([^{;]*)/g;
const CAPS_WIDTH = /\bmax-(?:device-)?width\s*:|\bwidth\s*<|>=?\s*(?:device-)?width\b/i;
// A Tailwind max-* variant. Single-word CSS properties and media features spelt max-* are not variants.
const VARIANT = /(?<![\w@-])max-(\[[^\]\s]+\]|[a-z0-9]+):/g;
const NOT_VARIANTS = new Set(["width", "height", "lines", "resolution", "zoom"]);
const OK = /mobile-first-ok\b:?(.*)/;
const reasonOf = (line) => {
  const m = line?.match(OK);
  return m ? m[1].replace(/\*\/|-->|[{}]/g, "").trim() : null;
};

let exceptions = excepted.size;
for (const file of files) {
  const rel = relative(root, file);
  if (excepted.has(normalize(rel))) continue;
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  const lineOf = (index) => text.slice(0, index).split("\n").length;
  const found = [];
  for (const m of text.matchAll(MEDIA)) {
    if (CAPS_WIDTH.test(m[1])) found.push({ line: lineOf(m.index), what: `a max-width media query (@media${m[1].replace(/\s+/g, " ").trimEnd()})` });
  }
  for (const m of text.matchAll(VARIANT)) {
    if (!NOT_VARIANTS.has(m[1])) found.push({ line: lineOf(m.index), what: `a Tailwind max-* variant (${m[0]})` });
  }
  for (const { line, what } of found) {
    const here = reasonOf(lines[line - 1]);
    const above = reasonOf(lines[line - 2]);
    const reason = here ?? above;
    if (reason) {
      exceptions++;
      continue;
    }
    if (here === "" || above === "") problems.push(`  ${rel}:${line}: mobile-first-ok with no reason, on ${what}`);
    else problems.push(`  ${rel}:${line}: ${what}`);
  }
}

if (problems.length) {
  stop(GATE, "06", `the phone is not the base layout. Write the phone as the base styles and add wider layouts with min-width (Tailwind: sm: md: lg:). A genuine exception takes mobile-first-ok: <reason> on its line, or the file in site.programme.json mobileFirst.exceptions with a reason.\n${problems.join("\n")}`);
}
console.log(`${GATE}: ${files.size} files build the phone first, with min-width only${exceptions ? ` (${exceptions} recorded exception${exceptions === 1 ? "" : "s"})` : ""}`);
