// Stage 05 gate: writes the token stylesheet from the direction, both sides
// of the sheet. The day side takes its ground, accent, faces and shape from
// art-direction.json, where each is decided with its reason; the inks, the
// rule and the night side come from art-direction.sheets.json, because the
// direction's schema holds a choice's value, reason and evidence and nothing
// else. Nothing in the stylesheet is a value the direction does not record,
// and a value still null stops the build: night is designed, never derived
// by flipping. night-contrast.mjs then measures what this wrote.
//
// Lifted from apps/site/scripts/tokens.mjs in Doman-Digital (DOM-647).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { programme, root, sitePath, stop } from "./programme.mjs";

const GATE = "tokens";
const read = (name) => {
  const path = join(root, name);
  if (!existsSync(path)) stop(GATE, "05", `no ${name}.`);
  return JSON.parse(readFileSync(path, "utf8"));
};
const direction = read("art-direction.json");
const sheets = read("art-direction.sheets.json");
const c = direction.choices ?? {};

const HEX = /^#[0-9a-f]{6}$/i;
const missing = [];
const colour = (where, value) => {
  if (typeof value !== "string" || !HEX.test(value)) missing.push(where);
  return typeof value === "string" ? value.toLowerCase() : value;
};

const ground = colour("art-direction.json choices.ground.value", c.ground?.value);
const accent = colour("art-direction.json choices.accent.value", c.accent?.value);
const display = c.display?.value;
const body = c.body?.value;
if (!display) missing.push("art-direction.json choices.display.value");
if (!body) missing.push("art-direction.json choices.body.value");

const INKS = ["ink", "ink-2", "ink-3", "rule", "accent-soft"];
const light = Object.fromEntries(INKS.map((k) => [k, colour(`art-direction.sheets.json light.${k}`, sheets.light?.[k])]));
const night = Object.fromEntries(["ground", "accent", ...INKS].map((k) => [k, colour(`art-direction.sheets.json night.${k}`, sheets.night?.[k])]));
if (typeof sheets.because !== "string" || sheets.because.trim().split(/\s+/).length < 8) missing.push("art-direction.sheets.json because (a sentence: why the night side is these values)");

if (missing.length) stop(GATE, "05", `the sheet is not decided yet. Still to fill:\n${missing.map((m) => `  ${m}`).join("\n")}`);

// "2px corners, 1px rules, 2px leader lines" becomes --shape-corners: 2px, and so on.
const shape = [...String(c.shape?.value ?? "").matchAll(/(\d+(?:\.\d+)?px)\s+([a-z][a-z-]*)/gi)].map((m) => [m[2].toLowerCase(), m[1]]);

const vars = (t) => Object.entries(t).map(([k, v]) => `  --${k}: ${v};`).join("\n");
const nightVars = vars(night).replace(/^/gm, "  ");
const css = `/* Generated from art-direction.json and art-direction.sheets.json by scripts/gates/tokens.mjs.
   Edit the direction, not this file. */
:root {
  --ground: ${ground};
  --accent: ${accent};
${vars(light)}
  --display: "${display}", sans-serif;
  --body: "${body}", system-ui, sans-serif;
${shape.map(([k, v]) => `  --shape-${k}: ${v};\n`).join("")}}

/* Night: ${sheets.because.trim().replace(/\*\//g, "* /")}
   Follows the visitor's own setting; data-theme on <html> forces either side
   for review. Measured by scripts/gates/night-contrast.mjs before every build. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${nightVars}
  }
}
:root[data-theme="dark"] {
${vars(night)}
}
`;

const { paths } = programme();
const out = sitePath(paths.tokens);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, css);
console.log(`${GATE}: ${paths.tokens} written, day and night`);
