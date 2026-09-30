// Regenerates the register briefs in REGISTERS.md from the built package.
// The test in src/__tests__/registers-doc.test.ts fails until this is run.
import { readFileSync, writeFileSync } from "node:fs";
import { registersDoc } from "../dist/index.js";

const path = new URL("../REGISTERS.md", import.meta.url);
const doc = readFileSync(path, "utf8");
const start = "<!-- craft:registers:start -->";
const end = "<!-- craft:registers:end -->";
const a = doc.indexOf(start);
const b = doc.indexOf(end);
if (a === -1 || b === -1) throw new Error("REGISTERS.md has no registers markers");
writeFileSync(path, `${doc.slice(0, a + start.length)}\n${registersDoc()}\n${doc.slice(b)}`);
console.log("REGISTERS.md registers updated");
