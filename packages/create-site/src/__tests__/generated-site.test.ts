// The end of the line: generate a site, then run the checks it ships with
// against it, using the workspace seo and graph source. If a template and a
// package stop agreeing, this fails here rather than on a client's first build.

import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { afterAll, describe, expect, test } from "vitest";
import { findGraphIssues } from "@domandigital/graph";
import { liveLinkedUrls, validateCoverage, validateRedirects } from "@domandigital/seo";
import { run } from "../run";
import { PACKAGE_ROOT, captureIo, cleanup, makeProject, writeAnswers } from "./fixtures";
import type { Kind } from "./fixtures";

const roots: string[] = [];
afterAll(() => roots.forEach(cleanup));

async function generate(kind: Kind): Promise<string> {
  const root = makeProject(kind);
  roots.push(root);
  const { io } = captureIo(root);
  expect(await run(["--yes", "--skip-install", "--answers", writeAnswers(root)], io)).toBe(0);
  return root;
}

const load = async <T>(root: string, path: string): Promise<T> => (await import(pathToFileURL(join(root, path)).href)) as T;

function tsFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name);
      if (statSync(abs).isDirectory()) {
        if (name !== "node_modules") walk(abs);
      } else if (name.endsWith(".ts")) out.push(abs);
    }
  };
  walk(root);
  // These two need the framework itself installed; a real site typechecks them.
  return out.filter((f) => !/config\.test\.ts$|(next|astro)\.config\./.test(f));
}

function typeErrors(root: string): string[] {
  const src = (pkg: string) => join(PACKAGE_ROOT, "..", pkg, "src", "index.ts");
  const program = ts.createProgram(tsFiles(root), {
    strict: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    resolveJsonModule: true,
    esModuleInterop: true,
    skipLibCheck: true,
    types: ["node"],
    typeRoots: [join(PACKAGE_ROOT, "node_modules", "@types")],
    paths: { "@domandigital/seo": [src("seo")], "@domandigital/graph": [src("graph")] },
  });
  return ts.getPreEmitDiagnostics(program).map((d) => {
    const where = d.file ? `${relative(root, d.file.fileName)}:${d.file.getLineAndCharacterOfPosition(d.start ?? 0).line + 1}` : "";
    return `${where} ${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`;
  });
}

for (const kind of ["next-root", "next-src", "astro"] as const) {
  describe(`a generated ${kind} site`, () => {
    test("passes its own coverage, redirect and JSON-LD checks on the first day", async () => {
      const root = await generate(kind);
      const { routesOnDisk } = await load<{ routesOnDisk: (root: string) => string[] }>(root, "tests/seo/routes-on-disk.ts");
      const routes = await load<typeof import("./fixtures-types").Routes>(root, "site.routes.ts");
      const { facts } = await load<typeof import("./fixtures-types").Facts>(root, "site.facts.ts");
      const { buildPageGraph } = await load<typeof import("./fixtures-types").PageGraph>(
        root,
        kind === "next-root" ? "lib/graph/page-graph.ts" : "src/lib/graph/page-graph.ts",
      );

      const onDisk = routesOnDisk(root);
      expect(onDisk).toEqual(["/", "/press", "/resources", "/services/rewiring"]);
      expect(validateCoverage({ routesOnDisk: onDisk, policy: routes.policy, moneyRoutes: routes.moneyRoutes, targets: routes.targets })).toEqual([]);
      expect(
        validateRedirects({ linkedUrls: liveLinkedUrls({ links: [] }), routesOnDisk: onDisk, redirects: [], policy: routes.policy, hosts: [new URL(facts.url).hostname] }),
      ).toEqual([]);
      for (const entry of routes.policy.filter((p) => p.indexable)) {
        expect(findGraphIssues(buildPageGraph({ path: entry.path, name: entry.path })), entry.path).toEqual([]);
      }
    });

    test("typechecks", async () => {
      const root = await generate(kind);
      expect(typeErrors(root)).toEqual([]);
    });

    test("the coverage check fails when a page is added without a policy entry", async () => {
      const root = await generate(kind);
      const page = kind === "astro" ? "src/pages/new-page.astro" : `${kind === "next-src" ? "src/app" : "app"}/new-page/page.tsx`;
      mkdirSync(dirname(join(root, page)), { recursive: true });
      writeFileSync(join(root, page), kind === "astro" ? "<h1>New</h1>\n" : "export default function P() { return null; }\n");
      const { routesOnDisk } = await load<{ routesOnDisk: (root: string) => string[] }>(root, "tests/seo/routes-on-disk.ts");
      const routes = await load<typeof import("./fixtures-types").Routes>(root, "site.routes.ts");
      expect(validateCoverage({ routesOnDisk: routesOnDisk(root), policy: routes.policy })).toEqual([{ kind: "route-missing-policy", path: "/new-page" }]);
    });
  });
}
