// Regenerates word-lists.json from the built package.
// The test in src/__tests__/word-lists-doc.test.ts fails until this is run.
import { writeFileSync } from "node:fs";
import { wordListsJson } from "../dist/index.js";

const path = new URL("../word-lists.json", import.meta.url);
writeFileSync(path, wordListsJson());
console.log("word-lists.json updated");
