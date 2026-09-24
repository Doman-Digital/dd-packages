// The App Router's pages, as the two lists validateCoverage takes. Written by
// @domandigital/create-site; the generator seeds site.routes.ts from the same
// file, so the two cannot disagree.
//
//   routesOnDisk()         concrete URL paths: "/", "/press"
//   dynamicRoutesOnDisk()  bracket paths: "/blog/[slug]", "/docs/[[...slug]]"
//
// Route groups "(x)" add no URL segment and are dropped. Private folders
// "_x", parallel slots "@x" and intercepting routes "(.)x" have no URL of
// their own and are skipped. An optional catch-all also serves its parent,
// so "/docs/[[...slug]]" puts "/docs" in routesOnDisk too.

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PAGE_FILE = /^page\.(tsx|ts|jsx|js|mdx|md)$/;
const OPTIONAL_CATCH_ALL = /^\[\[\.\.\..+\]\]$/;

function walk(root: string): { routes: string[]; dynamicRoutes: string[] } {
  const appDir = [join(root, "app"), join(root, "src", "app")].find((dir) => existsSync(dir));
  const routes = new Set<string>();
  const dynamicRoutes = new Set<string>();
  if (!appDir) return { routes: [], dynamicRoutes: [] };

  const visit = (dir: string, segments: string[]) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const name = entry.name;
      if (entry.isDirectory()) {
        if (name.startsWith("_") || name.startsWith("@") || name.startsWith("(.")) continue;
        const isGroup = name.startsWith("(") && name.endsWith(")");
        visit(join(dir, name), isGroup ? segments : [...segments, name]);
      } else if (PAGE_FILE.test(name)) {
        const path = `/${segments.join("/")}`;
        const firstDynamic = segments.findIndex((s) => s.startsWith("["));
        if (firstDynamic === -1) {
          routes.add(path);
          continue;
        }
        dynamicRoutes.add(path);
        if (OPTIONAL_CATCH_ALL.test(segments[firstDynamic]!)) routes.add(`/${segments.slice(0, firstDynamic).join("/")}`);
      }
    }
  };

  visit(appDir, []);
  return { routes: [...routes].sort(), dynamicRoutes: [...dynamicRoutes].sort() };
}

export function routesOnDisk(root: string = process.cwd()): string[] {
  return walk(root).routes;
}

export function dynamicRoutesOnDisk(root: string = process.cwd()): string[] {
  return walk(root).dynamicRoutes;
}
