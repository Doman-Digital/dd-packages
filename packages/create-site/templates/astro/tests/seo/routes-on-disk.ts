// Every concrete page route under src/pages, as URL paths ("/", "/press").
// Written by @domandigital/create-site; the same file enumerates the routes
// the generator seeds site.routes.ts from, so the two cannot disagree.
//
// Skipped: "_x" files and folders (Astro ignores them), dynamic "[x]"
// routes, which validateCoverage expects the caller to leave out, endpoints
// (.ts/.js), and the 404 and 500 pages, which are never indexed.

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PAGE_FILE = /^(.+)\.(astro|md|mdx|html)$/;
const NOT_PAGES = new Set(["404", "500"]);

export function routesOnDisk(root: string = process.cwd()): string[] {
  const pagesDir = join(root, "src", "pages");
  if (!existsSync(pagesDir)) return [];
  const routes = new Set<string>();

  const walk = (dir: string, segments: string[]) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const name = entry.name;
      if (name.startsWith("_") || name.includes("[")) continue;
      if (entry.isDirectory()) {
        walk(join(dir, name), [...segments, name]);
        continue;
      }
      const match = PAGE_FILE.exec(name);
      if (!match) continue;
      const base = match[1]!;
      if (segments.length === 0 && NOT_PAGES.has(base)) continue;
      const path = base === "index" ? segments : [...segments, base];
      routes.add(`/${path.join("/")}`);
    }
  };

  walk(pagesDir, []);
  return [...routes].sort();
}
