// Templates are real files shipped in the package, so they can be read,
// linted and reviewed as what they are. The one substitution is the
// `~site/<key>` import specifier, rewritten to a relative path from where the
// file lands, so no alias has to exist in the site's tsconfig.

import { readFileSync } from "node:fs";
import { dirname, posix, relative } from "node:path";
import { fileURLToPath } from "node:url";

/** One level above both src/templates.ts (tests) and dist/cli.js (published). */
export const TEMPLATE_ROOT = fileURLToPath(new URL("../templates/", import.meta.url));

export function readTemplate(path: string): string {
  return readFileSync(`${TEMPLATE_ROOT}${path}`, "utf8");
}

const SITE_IMPORT = /(["'])~site\/([^"']+)\1/g;

/** Every `~site/<key>` a template imports. */
export function siteKeysIn(text: string): string[] {
  return [...text.matchAll(SITE_IMPORT)].map((m) => m[2]!);
}

/**
 * Rewrites `~site/<key>` to a relative specifier from `dest`. TypeScript
 * sources lose their extension (a .ts extension in an import needs a
 * compiler flag sites do not set); .json, .mjs, .js and .astro keep theirs.
 */
export function rewriteSiteImports(text: string, dest: string, siteKeys: Record<string, string>): string {
  return text.replace(SITE_IMPORT, (_match, quote: string, key: string) => {
    const target = siteKeys[key];
    if (!target) throw new Error(`template for ${dest} imports ~site/${key}, which this project layout does not provide`);
    const fromDir = dirname(dest);
    let spec = relative(fromDir, target).split("\\").join(posix.sep).replace(/\.tsx?$/, "");
    if (!spec.startsWith(".")) spec = `./${spec}`;
    return `${quote}${spec}${quote}`;
  });
}
