// What kind of project this is, and whether the scaffold belongs in it.
// Refusals come back as a message and nothing is written.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type Framework = "next" | "astro";
export type PackageManager = "pnpm" | "npm" | "yarn" | "bun";

export type Project = {
  root: string;
  framework: Framework;
  /** "app" or "src/app" for Next; "src/pages" for Astro. */
  routesDir: string;
  /** "" or "src/": where components/ and lib/ go. */
  srcBase: string;
  /** Framework config file, relative to root, if one exists. */
  configFile: string | null;
  packageManager: PackageManager;
  packageManagerWarning: string | null;
  packageJson: string;
};

const LOCKFILES: [string, PackageManager][] = [
  ["pnpm-lock.yaml", "pnpm"],
  ["package-lock.json", "npm"],
  ["yarn.lock", "yarn"],
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
];

const MANAGERS = ["pnpm", "yarn", "bun", "npm"] as const;

/** Lockfile first, then package.json's packageManager field, then whatever ran this. */
export function detectPackageManager(root: string, userAgent: string | undefined): { pm: PackageManager; warning: string | null } {
  let fromField: PackageManager | undefined;
  try {
    const field = (JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { packageManager?: string }).packageManager;
    fromField = MANAGERS.find((pm) => field?.startsWith(`${pm}@`));
  } catch {
    fromField = undefined;
  }
  const fromLock = LOCKFILES.find(([file]) => existsSync(join(root, file)))?.[1] ?? fromField;
  const fromAgent = MANAGERS.find((pm) => userAgent?.startsWith(`${pm}/`));
  if (fromLock && fromAgent && fromLock !== fromAgent) {
    return { pm: fromLock, warning: `this project uses ${fromLock} but this ran under ${fromAgent}: installing with ${fromLock}` };
  }
  return { pm: fromLock ?? fromAgent ?? "npm", warning: null };
}

export function detectProject(root: string, userAgent?: string): Project | string {
  const pkgPath = join(root, "package.json");
  if (!existsSync(pkgPath)) {
    return `no package.json in ${root}. Create the site first (pnpm create next-app@latest, or pnpm create astro@latest), then run this inside it.`;
  }
  const packageJson = readFileSync(pkgPath, "utf8");
  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    pkg = JSON.parse(packageJson);
  } catch {
    return `package.json in ${root} is not valid JSON.`;
  }
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const hasNext = "next" in deps;
  const hasAstro = "astro" in deps;
  if (hasNext && hasAstro) return "this project depends on both next and astro. Run it in a project that uses one.";
  if (!hasNext && !hasAstro) return "this is not a Next.js or Astro project (neither next nor astro is a dependency).";
  if (!existsSync(join(root, "tsconfig.json"))) return "no tsconfig.json. House sites are TypeScript: create the project with TypeScript on.";

  const { pm, warning } = detectPackageManager(root, userAgent);
  const configFile = (names: string[]) => names.find((n) => existsSync(join(root, n))) ?? null;

  if (hasNext) {
    const routesDir = ["app", "src/app"].find((d) => existsSync(join(root, d)));
    if (!routesDir) {
      const pages = ["pages", "src/pages"].some((d) => existsSync(join(root, d)));
      return pages
        ? "this Next.js project uses the Pages Router only. The scaffold supports the App Router."
        : "no app/ or src/app/ directory. Run it in a Next.js App Router project.";
    }
    return {
      root,
      framework: "next",
      routesDir,
      srcBase: routesDir === "src/app" ? "src/" : "",
      configFile: configFile(["next.config.ts", "next.config.mjs", "next.config.js"]),
      packageManager: pm,
      packageManagerWarning: warning,
      packageJson,
    };
  }

  if (!existsSync(join(root, "src", "pages"))) return "no src/pages/ directory. Run it in an Astro project.";
  return {
    root,
    framework: "astro",
    routesDir: "src/pages",
    srcBase: "src/",
    configFile: configFile(["astro.config.mjs", "astro.config.ts", "astro.config.js"]),
    packageManager: pm,
    packageManagerWarning: warning,
    packageJson,
  };
}
