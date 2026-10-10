// The build gates, in stage order, run before every build (the `prebuild`
// script). A gate is a script that blocks the build, never a reminder: the
// first one to fail stops the build and names its stage. The order matters:
// the direction is decided before tokens are written from it, the tokens are
// written before they are measured, and the deck is current before the null
// set reads it. The measurement at 1440 and 390 needs a running build, so
// deploy-preview.mjs runs it before every preview deploy instead.

import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { programme, root, stop } from "./programme.mjs";

const GATES = [
  ["check-direction.mjs"],
  ["tokens.mjs"],
  ["night-contrast.mjs"],
  ["facts.mjs"],
  ["copy-deck.mjs", "--check"],
  ["null-check.mjs"],
];

// Stage 01: the site has a programme in Linear before anything is built.
const { issue } = programme();
if (typeof issue !== "string" || !/^[A-Z]+-\d+$/.test(issue)) {
  stop("programme", "01", "site.programme.json names no programme issue. Open the programme from the Site programme template in Linear and put its id (DOM-123) in issue.");
}

for (const [script, ...args] of GATES) {
  const run = spawnSync(process.execPath, [join(root, "scripts", "gates", script), ...args], { cwd: root, stdio: "inherit" });
  if (run.status !== 0) {
    console.error(`\nThe build stops at ${script}. docs/site-programme.md says what its stage needs.`);
    process.exit(run.status || 1);
  }
}
