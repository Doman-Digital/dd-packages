#!/usr/bin/env node
/**
 * Stops `npm publish` of a package whose dependencies use pnpm's `workspace:`
 * protocol. npm sends the range as written, and the published package cannot
 * be installed anywhere (EUNSUPPORTEDPROTOCOL). pnpm publish, which
 * `changeset publish` uses, rewrites it to the real version.
 *
 * @domandigital/sentry 0.1.0 went out this way on 2026-10-09, by hand, during
 * the first-release step. Run from a package's `prepublishOnly`.
 */

import { readFileSync } from "node:fs";

const agent = process.env.npm_config_user_agent ?? "";
const manifest = JSON.parse(readFileSync("package.json", "utf8"));
const linked = Object.entries({ ...manifest.dependencies, ...manifest.peerDependencies, ...manifest.optionalDependencies })
  .filter(([, range]) => String(range).startsWith("workspace:"))
  .map(([name]) => name);

if (linked.length && !agent.startsWith("pnpm/")) {
  console.error(
    `${manifest.name} depends on ${linked.join(", ")} through workspace:, which npm would publish unrewritten.\n` +
      `Publish with pnpm instead: pnpm publish --access public --no-git-checks --provenance false`,
  );
  process.exit(1);
}
