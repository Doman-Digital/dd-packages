// What every gate shares: the site's root, its site.programme.json (the
// site's own file, written once by create-site and never replaced), and one
// way to stop. Each gate names the programme stage it belongs to, so a
// failing build says which stage is not done. docs/site-programme.md has the
// ten stages and the gate each one owns.

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** site.programme.json, or a stop naming the file when it is missing or unreadable. */
export function programme() {
  const path = join(root, "site.programme.json");
  if (!existsSync(path)) stop("programme", "01", "no site.programme.json. Run create-site again: it writes the file and never replaces it.");
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    stop("programme", "01", `site.programme.json is not JSON: ${error.message}`);
  }
}

/** A path from site.programme.json: `~/` is the home directory, anything else is relative to the site. */
export function sitePath(path) {
  return path.startsWith("~/") ? join(homedir(), path.slice(2)) : resolve(root, path);
}

/** Exit 1 with the gate, its stage and the reason. A gate never warns its way past a failure. */
export function stop(gate, stage, message) {
  console.error(`${gate} (Stage ${stage}): ${message}`);
  process.exit(1);
}

/** The installed craft bin, so a gate runs the craft the site pinned, never a global one. */
export function craftBin() {
  const manifest = join(root, "node_modules", "@domandigital", "craft", "package.json");
  if (!existsSync(manifest)) return null;
  const bin = JSON.parse(readFileSync(manifest, "utf8")).bin?.craft;
  return bin ? join(dirname(manifest), bin) : null;
}
