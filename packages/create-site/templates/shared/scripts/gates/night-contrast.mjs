// Stage 05 gate: measures both sides of the sheet the way the day side was
// measured, every text colour against its ground by WCAG 2.x relative
// luminance, from the stylesheet tokens.mjs wrote. Exits 1 when a pair that
// carries text falls under 4.5:1, so a palette change cannot ship an
// unreadable label by day or by night.
//
// Lifted from apps/site/scripts/night-contrast.mjs in Doman-Digital (DOM-647).

import { existsSync, readFileSync } from "node:fs";
import { programme, sitePath, stop } from "./programme.mjs";

const GATE = "night-contrast";
const { paths } = programme();
const file = sitePath(paths.tokens);
if (!existsSync(file)) stop(GATE, "05", `no ${paths.tokens}: tokens.mjs writes it first.`);
const css = readFileSync(file, "utf8");
const block = (sel) => {
  const i = css.indexOf(sel);
  if (i < 0) stop(GATE, "05", `${paths.tokens} has no ${sel} block. Run tokens.mjs.`);
  const body = css.slice(css.indexOf("{", i) + 1, css.indexOf("}", i));
  return Object.fromEntries([...body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2].toLowerCase()]));
};
const light = block(":root {");
const night = block(':root[data-theme="dark"]');

const lum = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
};
const ratio = (a, b) => {
  const x = lum(a);
  const y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

let failed = false;
for (const [name, t] of [
  ["day", light],
  ["night", night],
]) {
  const g = t.ground;
  const pairs = [
    ["ink on ground", t.ink, 4.5],
    ["ink-2 on ground", t["ink-2"], 4.5],
    ["ink-3 on ground", t["ink-3"], 4.5],
    ["accent on ground (labels and links)", t.accent, 4.5],
    ["ground on ink (primary button text)", g, 4.5, t.ink],
    ["ground on accent (button hover text)", g, 4.5, t.accent],
    ["rule on ground (1px rules, not text)", t.rule, 1.3],
  ];
  console.log(`${GATE}: ${name}, ground ${g}`);
  for (const [label, fg, min, bg = g] of pairs) {
    if (!fg || !bg) {
      failed = true;
      console.log(`  FAIL  missing  ${label}`);
      continue;
    }
    const r = ratio(fg, bg);
    const ok = r >= min;
    if (!ok) failed = true;
    console.log(`  ${ok ? "ok  " : "FAIL"}  ${r.toFixed(2)}:1  ${label} (${fg} on ${bg}, needs ${min})`);
  }
}
if (failed) stop(GATE, "05", "a pair falls short. Change the value in art-direction.json or art-direction.sheets.json, not the stylesheet.");
