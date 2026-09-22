// Regenerates the catalogue table in CHARACTER.md from the built package.
// The test in src/__tests__/character-doc.test.ts fails until this is run.
import { readFileSync, writeFileSync } from "node:fs";
import { catalogueTable } from "../dist/index.js";

const path = new URL("../CHARACTER.md", import.meta.url);
const doc = readFileSync(path, "utf8");
const start = "<!-- craft:catalogue:start -->";
const end = "<!-- craft:catalogue:end -->";
const a = doc.indexOf(start);
const b = doc.indexOf(end);
if (a === -1 || b === -1) throw new Error("CHARACTER.md has no catalogue markers");
writeFileSync(path, `${doc.slice(0, a + start.length)}\n${catalogueTable()}\n${doc.slice(b)}`);
console.log("CHARACTER.md catalogue table updated");
