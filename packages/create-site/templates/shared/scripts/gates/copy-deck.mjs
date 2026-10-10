// Stage 06 gate: every string the site carries lives in one copy deck (the
// TypeScript module site.programme.json names in paths.deck), and this
// renders it to one Markdown document in page order, so copy-check and a
// reviewer read the whole site in one place. `--check` fails when the deck is
// missing, empty, or newer than the committed document: copy that has not
// been through the deck has not been through the gates. Without --check it
// writes the document.
//
// Lifted from apps/site/scripts/copy-deck.mjs in Doman-Digital (DOM-647),
// with the page order taken from the deck itself instead of written out.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { programme, sitePath, stop } from "./programme.mjs";

const GATE = "copy-deck";
const check = process.argv.includes("--check");
const { paths } = programme();
const source = sitePath(paths.deck);
const out = sitePath(paths.deckMarkdown);
if (!existsSync(source)) stop(GATE, "06", `no copy deck at ${paths.deck}. Export \`deck\` from it: one key per page, every string the page shows.`);

// Node strips the types from a .ts module from 22.18; before that, tsx if the site has it.
let mod;
try {
  mod = await import(pathToFileURL(source).href);
} catch (error) {
  try {
    const { register } = await import("tsx/esm/api");
    register();
    mod = await import(pathToFileURL(source).href);
  } catch {
    stop(GATE, "06", `could not load ${paths.deck} (${error.message}). Use Node 22.18 or later, or add tsx.`);
  }
}
const deck = mod.deck ?? mod.default;
if (!deck || typeof deck !== "object" || Object.keys(deck).length === 0) stop(GATE, "06", `${paths.deck} exports no copy. Export \`deck\` with one key per page.`);

const lines = [
  "# Copy deck",
  "",
  `Generated from \`${paths.deck}\` by \`scripts/gates/copy-deck.mjs\`. Edit the deck, not this file. Figures are not in the deck: pages read them from the facts.`,
  "",
];
const isLink = (v) => v && typeof v === "object" && typeof v.label === "string" && typeof v.href === "string" && Object.keys(v).length <= 3;
const inline = (v) =>
  isLink(v)
    ? `[${v.label}](${v.href})`
    : Array.isArray(v)
      ? v.map(inline).join(" · ")
      : v && typeof v === "object"
        ? Object.values(v).map(inline).filter(Boolean).join(" · ")
        : v === null || v === undefined || typeof v === "boolean"
          ? ""
          : String(v);

function render(value, depth) {
  for (const [key, v] of Object.entries(value)) {
    if (v === null || v === undefined || typeof v === "boolean") continue;
    if (Array.isArray(v)) {
      lines.push(`**${key}**`, "", ...v.map((item) => `- ${inline(item)}`), "");
    } else if (isLink(v)) {
      lines.push(`**${key}**: ${inline(v)}`, "");
    } else if (typeof v === "object") {
      lines.push(`${"#".repeat(Math.min(depth, 6))} ${key}`, "");
      render(v, depth + 1);
    } else {
      lines.push(`**${key}**: ${String(v)}`, "");
    }
  }
}
render(deck, 2);

const text = `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
if (check) {
  const current = existsSync(out) ? readFileSync(out, "utf8") : "";
  if (current !== text) stop(GATE, "06", `${paths.deckMarkdown} is not the current deck. Run the deck script, read it, and put it through copy-check.`);
  console.log(`${GATE}: ${paths.deckMarkdown} is current`);
} else {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, text);
  console.log(`${GATE}: ${paths.deckMarkdown} written`);
}
