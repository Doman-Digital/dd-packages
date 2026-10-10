// Stage 05 gate: the visual direction is decided before anything is built on
// it. Refuses the build when art-direction.json is missing, when craft does
// not find it valid, or when a layer is still undecided (the job, every
// declared page's hierarchy, at least five of the seven tokens). Then, when
// site.programme.json names a registered copy (the one in the craft estate on
// the work box), the two must match byte for byte, so a change made in one
// place reaches the other on purpose. Off the work box the registered copy is
// absent and the gate says so and passes on the site's own copy.
//
// Lifted from apps/site/scripts/check-direction.mjs in Doman-Digital (DOM-647).

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { craftBin, programme, root, sitePath, stop } from "./programme.mjs";

const GATE = "check-direction";
const file = join(root, "art-direction.json");
if (!existsSync(file)) stop(GATE, "05", "no art-direction.json. Run craft direction init, then decide the job, the hierarchy and the tokens with their reasons.");

const bin = craftBin();
if (!bin) stop(GATE, "05", "@domandigital/craft is not installed, so the direction cannot be validated. Install the site's dependencies.");

const run = spawnSync(process.execPath, [bin, "direction", "validate", "--json"], { cwd: root, encoding: "utf8" });
let report;
try {
  report = JSON.parse(run.stdout);
} catch {
  stop(GATE, "05", `craft direction validate did not report: ${(run.stderr || run.stdout).trim()}`);
}
const errors = report.problems.filter((p) => p.severity === "error");
if (!report.valid) stop(GATE, "05", `art-direction.json is not valid:\n${errors.map((p) => `  ${p.at || "(file)"}  ${p.message}`).join("\n")}`);
if (!report.layers.complete) {
  const l = report.layers;
  const pages = l.hierarchy.map((h) => `${h.page} ${h.decided} of ${h.total}`).join(", ") || "none";
  stop(GATE, "05", `the direction is not decided yet: job ${l.job ? "decided" : "not decided"}; hierarchy ${pages}; tokens ${l.tokens.decided} of ${l.tokens.total} (five is the least).`);
}

const { registeredDirection } = programme();
if (!registeredDirection) {
  console.log(`${GATE}: decided; no registered copy named in site.programme.json`);
} else {
  const registered = sitePath(registeredDirection);
  if (!existsSync(registered)) {
    console.log(`${GATE}: decided; no registered copy on this machine (${registeredDirection}), so the site's copy stands`);
  } else if (readFileSync(file, "utf8") !== readFileSync(registered, "utf8")) {
    stop(GATE, "05", `art-direction.json differs from ${registered}. Copy the newer one over the other and run craft direction validate on it.`);
  } else {
    console.log(`${GATE}: decided, and matches the registered copy`);
  }
}
