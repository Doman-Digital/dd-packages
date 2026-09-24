// Regenerates licences.json from the built package.
// The test in src/__tests__/licences.test.ts fails until this is run.
import { writeFileSync } from "node:fs";
import { licencesJson } from "../dist/index.js";

const path = new URL("../licences.json", import.meta.url);
writeFileSync(path, licencesJson());
console.log("licences.json updated");
