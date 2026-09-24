// The pages under src/pages, as the two lists validateCoverage takes. Written
// by @domandigital/create-site; the generator seeds site.routes.ts from the
// same file, so the two cannot disagree.
//
//   routesOnDisk()         concrete URL paths: "/", "/press"
//   dynamicRoutesOnDisk()  bracket paths: "/blog/[slug]", "/docs/[...slug]"
//
// Skipped: "_x" files and folders (Astro ignores them), endpoints (.ts/.js),
// and the 404 and 500 pages, which are never indexed.

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PAGE_FILE = /^(.+)\.(astro|md|mdx|html)$/;
const NOT_PAGES = new Set(["404", "500"]);

function walk(root: string): { routes: string[]; dynamicRoutes: string[] } {
  const pagesDir = join(root, "src", "pages");
  const routes = new Set<string>();
  const dynamicRoutes = new Set<string>();
  if (!existsSync(pagesDir)) return { routes: [], dynamicRoutes: [] };

  const visit = (dir: string, segments: string[]) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const name = entry.name;
      if (name.startsWith("_")) continue;
      if (entry.isDirectory()) {
        visit(join(dir, name), [...segments, name]);
        continue;
      }
      const match = PAGE_FILE.exec(name);
      if (!match) continue;
      const base = match[1]!;
      if (segments.length === 0 && NOT_PAGES.has(base)) continue;
      const parts = base === "index" ? segments : [...segments, base];
      const path = `/${parts.join("/")}`;
      (parts.some((p) => p.startsWith("[")) ? dynamicRoutes : routes).add(path);
    }
  };

  visit(pagesDir, []);
  return { routes: [...routes].sort(), dynamicRoutes: [...dynamicRoutes].sort() };
}

export function routesOnDisk(root: string = process.cwd()): string[] {
  return walk(root).routes;
}

export function dynamicRoutesOnDisk(root: string = process.cwd()): string[] {
  return walk(root).dynamicRoutes;
}
