// Wires redirects.json into next.config / astro.config, but only at a single
// anchor it recognises. Anything unusual gets instructions instead of a
// guess, and tests/seo/config.test.ts keeps failing until it is wired.

import type { Framework } from "./detect.js";

export type ConfigPatch = { kind: "patched"; text: string } | { kind: "already" } | { kind: "manual"; reason: string };

const HEADER_COMMENT = `// redirects.json is the site's one redirect list; tests/seo/redirects.test.ts
// checks it against every earned link. Added by @domandigital/create-site.`;

export const MANUAL_INSTRUCTIONS: Record<Framework, string> = {
  next: "read redirects.json in next.config and return its entries from redirects() as { source: from, destination: to, permanent: permanent ?? true }",
  astro: "read redirects.json in astro.config and set redirects to { [from]: { status: permanent === false ? 302 : 301, destination: to } }",
};

function insertAfterImports(text: string, block: string): string {
  const lines = text.split("\n");
  // The last line that ends an import statement: `... from "x";` (which also
  // closes a multi-line import) or a bare `import "x";`.
  let last = -1;
  lines.forEach((line, i) => {
    if (/from\s+["'][^"']+["'];?\s*$/.test(line) || /^import\s+["'][^"']+["'];?\s*$/.test(line)) last = i;
  });
  lines.splice(last + 1, 0, ...(last === -1 ? [block, ""] : ["", block]));
  return lines.join("\n");
}

export function patchConfig(framework: Framework, file: string, text: string): ConfigPatch {
  if (text.includes("redirects.json")) return { kind: "already" };
  if (/\bredirects\b/.test(text)) return { kind: "manual", reason: `${file} already defines redirects` };
  if (file.endsWith(".js") && /module\.exports/.test(text)) return { kind: "manual", reason: `${file} is CommonJS` };

  const typed = file.endsWith(".ts");
  const anchor = framework === "next" ? /const nextConfig(?:\s*:\s*NextConfig)?\s*=\s*\{/g : /defineConfig\(\s*\{/g;
  const matches = [...text.matchAll(anchor)];
  if (matches.length !== 1) return { kind: "manual", reason: `${file} does not have the one config object this can edit safely` };

  const shape = "{ from: string; to: string; permanent?: boolean }[]";
  const type = typed ? `: ${shape}` : "";
  // A .mjs config may run under // @ts-check: type the list with JSDoc there.
  const jsdoc = typed ? "" : `\n/** @type {${shape}} */`;
  const read =
    framework === "next"
      ? `JSON.parse(readFileSync(join(process.cwd(), "redirects.json"), "utf8")).redirects`
      : `JSON.parse(readFileSync(new URL("./redirects.json", import.meta.url), "utf8")).redirects`;
  const imports =
    framework === "next"
      ? `import { readFileSync } from "node:fs";\nimport { join } from "node:path";`
      : `import { readFileSync } from "node:fs";`;
  const block = `${imports}\n\n${HEADER_COMMENT}${jsdoc}\nconst siteRedirects${type} = ${read};`;

  const property =
    framework === "next"
      ? `\n  async redirects() {\n    return siteRedirects.map((r) => ({ source: r.from, destination: r.to, permanent: r.permanent ?? true }));\n  },`
      : `\n  redirects: Object.fromEntries(\n    siteRedirects.map((r) => [r.from, { status: r.permanent === false ? 302 : 301, destination: r.to }]),\n  ),`;

  const match = matches[0]!;
  const at = match.index! + match[0].length;
  // An empty object (`defineConfig({})`) gets its closing brace on its own line.
  const rest = text.slice(at);
  const withProperty = `${text.slice(0, at)}${property}${rest.startsWith("}") ? "\n" : ""}${rest}`;
  return { kind: "patched", text: insertAfterImports(withProperty, block) };
}
