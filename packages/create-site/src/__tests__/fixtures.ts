// Fixture projects, built in code. They live under the package's own .tmp/
// (gitignored), not the OS temp dir, so a generated site's TypeScript can
// resolve vitest and @types/node from this package when the tests typecheck it.

import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { Io } from "../run.js";

export const PACKAGE_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const TMP = join(PACKAGE_ROOT, ".tmp");

export type Kind = "next-root" | "next-src" | "astro";

export const NEXT_CONFIG = `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
`;

export const ASTRO_CONFIG = `// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({});
`;

export function makeProject(kind: Kind, extra: Record<string, string> = {}): string {
  mkdirSync(TMP, { recursive: true });
  const root = mkdtempSync(join(TMP, `${kind}-`));
  const files: Record<string, string> = {
    "tsconfig.json": "{}\n",
    "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
  };
  if (kind === "astro") {
    files["package.json"] = `${JSON.stringify({ name: "acme", type: "module", scripts: { dev: "astro dev" }, dependencies: { astro: "^5.0.0" } }, null, 2)}\n`;
    files["astro.config.mjs"] = ASTRO_CONFIG;
    files["src/pages/index.astro"] = "<h1>Home</h1>\n";
    files["src/pages/services/rewiring.astro"] = "<h1>Rewiring</h1>\n";
    files["src/pages/404.astro"] = "<h1>Not found</h1>\n";
    files["src/pages/blog/[slug].astro"] = "<h1>Post</h1>\n";
  } else {
    const app = kind === "next-src" ? "src/app" : "app";
    files["package.json"] = `${JSON.stringify({ name: "acme", scripts: { dev: "next dev" }, dependencies: { next: "16.0.0", react: "19.0.0" } }, null, 2)}\n`;
    files["next.config.ts"] = NEXT_CONFIG;
    files[`${app}/page.tsx`] = "export default function Home() { return null; }\n";
    files[`${app}/(marketing)/services/rewiring/page.tsx`] = "export default function Page() { return null; }\n";
    files[`${app}/blog/[slug]/page.tsx`] = "export default function Page() { return null; }\n";
    files[`${app}/_components/x.tsx`] = "export const x = 1;\n";
  }
  for (const [path, text] of Object.entries({ ...files, ...extra })) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

export function cleanup(root: string) {
  rmSync(root, { recursive: true, force: true });
}

export const ANSWERS = {
  legalName: "Acme Electrical Ltd",
  tradingName: "Acme Electrical",
  siteUrl: "https://acme-electrical.example",
  sector: "trades",
  description: "Domestic and commercial electricians in Leeds.",
  phone: "0113 496 0000",
  email: "office@acme-electrical.example",
  locality: "Leeds",
  postalCode: "LS1 4AP",
  serviceAreas: ["Leeds", "Bradford"],
  registers: ["niceic", "trustmark"],
  previousHosts: ["www.acme-old.example"],
};

export function writeAnswers(root: string, overrides: Record<string, unknown> = {}): string {
  const path = join(root, "..", `${root.split(/[\\/]/).pop()}.answers.json`);
  writeFileSync(path, JSON.stringify({ ...ANSWERS, ...overrides }));
  return path;
}

export type Captured = { io: Io; out: string[]; err: string[]; execs: string[][] };

export function captureIo(cwd: string, overrides: Partial<Io> = {}): Captured {
  const out: string[] = [];
  const err: string[] = [];
  const execs: string[][] = [];
  return {
    out,
    err,
    execs,
    io: {
      cwd,
      out: (t) => out.push(t),
      err: (t) => err.push(t),
      ask: undefined,
      exec: (cmd, args) => execs.push([cmd, ...args]),
      now: () => new Date("2026-09-24T09:00:00Z"),
      ...overrides,
    },
  };
}

/** Every file under root with a hash of its bytes, for proving a run changed nothing. */
export function snapshotTree(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name);
      if (statSync(abs).isDirectory()) walk(abs);
      else out[relative(root, abs)] = createHash("sha256").update(readFileSync(abs)).digest("hex");
    }
  };
  walk(root);
  return out;
}
