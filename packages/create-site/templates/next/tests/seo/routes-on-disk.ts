// Every concrete page route in the App Router, as URL paths ("/", "/press").
// Written by @domandigital/create-site; the same file enumerates the routes
// the generator seeds site.routes.ts from, so the two cannot disagree.
//
// Skipped: route groups "(x)" (they add no URL segment), private folders
// "_x", parallel slots "@x", intercepting routes "(.)x", and dynamic
// segments "[x]", which validateCoverage expects the caller to leave out.

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PAGE_FILE = /^page\.(tsx|ts|jsx|js|mdx|md)$/;

export function routesOnDisk(root: string = process.cwd()): string[] {
  const appDir = [join(root, "app"), join(root, "src", "app")].find((dir) => existsSync(dir));
  if (!appDir) return [];
  const routes = new Set<string>();

  const walk = (dir: string, segments: string[]) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const name = entry.name;
      if (entry.isDirectory()) {
        if (name.startsWith("_") || name.startsWith("@") || name.startsWith("(.") || name.startsWith("[")) continue;
        const isGroup = name.startsWith("(") && name.endsWith(")");
        walk(join(dir, name), isGroup ? segments : [...segments, name]);
      } else if (PAGE_FILE.test(name)) {
        routes.add(`/${segments.join("/")}`);
      }
    }
  };

  walk(appDir, []);
  return [...routes].sort();
}
