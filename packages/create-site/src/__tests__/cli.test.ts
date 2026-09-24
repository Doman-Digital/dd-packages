import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { run } from "../run";
import { NEXT_CONFIG, captureIo, cleanup, makeProject, snapshotTree, writeAnswers } from "./fixtures";

const roots: string[] = [];
const project = (...args: Parameters<typeof makeProject>) => {
  const root = makeProject(...args);
  roots.push(root);
  return root;
};
afterEach(() => roots.splice(0).forEach(cleanup));

const scaffold = async (root: string, extra: string[] = []) => {
  const captured = captureIo(root);
  const code = await run(["--yes", "--skip-install", "--answers", writeAnswers(root), ...extra], captured.io);
  return { code, ...captured };
};

describe("--dry-run", () => {
  test("prints the plan, writes nothing and runs nothing", async () => {
    const root = project("next-root");
    const before = snapshotTree(root);
    const { code, out, execs } = await scaffold(root, ["--dry-run"]);
    expect(code).toBe(0);
    expect(out.join("\n")).toMatch(/create\s+site\.facts\.ts/);
    expect(snapshotTree(root)).toEqual(before);
    expect(execs).toEqual([]);
  });
});

describe("a first run", () => {
  test("writes the house files for Next.js at the root", async () => {
    const root = project("next-root");
    const { code } = await scaffold(root);
    expect(code).toBe(0);
    for (const file of [
      "site.facts.ts",
      "site.routes.ts",
      "links.json",
      "redirects.json",
      "CLAUDE.md",
      "docs/HOUSE.md",
      "docs/DIRECTION.md",
      "docs/seo-launch-checklist.md",
      "docs/seo-baseline.md",
      "lib/graph/site-adapter.ts",
      "lib/graph/page-graph.ts",
      "components/JsonLd.tsx",
      "components/DesignerCredit.tsx",
      "app/press/page.tsx",
      "app/resources/page.tsx",
      "tests/seo/coverage.test.ts",
      "tests/seo/config.test.ts",
      "tests/house.test.ts",
      ".github/workflows/seo-check.yml",
    ]) {
      expect(existsSync(join(root, file)), file).toBe(true);
    }
  });

  test("rewrites ~site imports to relative paths from where each file lands", async () => {
    const root = project("next-src");
    await scaffold(root);
    const press = readFileSync(join(root, "src/app/press/page.tsx"), "utf8");
    expect(press).toContain('from "../../../site.facts"');
    expect(press).toContain('from "../../components/JsonLd"');
    expect(press).toContain('from "../../../links.json"');
    expect(press).not.toContain("~site/");
  });

  test("seeds the route policy from the pages already on disk, plus the pages it adds, and a pattern for each dynamic route", async () => {
    const root = project("next-root");
    await scaffold(root);
    const routes = readFileSync(join(root, "site.routes.ts"), "utf8");
    for (const path of ["/", "/services/rewiring", "/press"]) expect(routes).toContain(`{ path: ${JSON.stringify(path)}, indexable: true, inSitemap: true }`);
    expect(routes).toContain('{ path: "/resources", indexable: false, inSitemap: false');
    expect(routes).toContain('{ path: "/blog/*", indexable: true, inSitemap: false, isDynamicPattern: true, reason: "Served by /blog/[slug].');
    expect(routes).not.toMatch(/path: "\/blog\/\[slug\]"/);
  });

  test("adds scripts and, with --skip-install, the house package ranges, keeping indentation and key order", async () => {
    const root = project("next-root");
    await scaffold(root);
    const text = readFileSync(join(root, "package.json"), "utf8");
    const pkg = JSON.parse(text);
    expect(Object.keys(pkg)).toEqual(["name", "scripts", "dependencies", "devDependencies"]);
    expect(pkg.scripts).toMatchObject({ dev: "next dev", "seo:check": expect.any(String), "launch:check": expect.any(String), test: "vitest run" });
    expect(pkg.dependencies["@domandigital/seo"]).toMatch(/^\^0\./);
    expect(text).toMatch(/^ {2}"name"/m);
    expect(text.endsWith("\n")).toBe(true);
  });

  test("wires redirects.json into next.config", async () => {
    const root = project("next-root");
    await scaffold(root);
    const config = readFileSync(join(root, "next.config.ts"), "utf8");
    expect(config).toContain('readFileSync(join(process.cwd(), "redirects.json"), "utf8")');
    expect(config).toMatch(/const nextConfig: NextConfig = \{\n {2}async redirects\(\) \{/);
    expect(config.indexOf('import type { NextConfig } from "next";')).toBeLessThan(config.indexOf("const siteRedirects"));
  });

  test("records the facts it was given, and null for what it was not", async () => {
    const root = project("astro");
    const captured = captureIo(root);
    await run(["--yes", "--skip-install", "--answers", writeAnswers(root, { phone: undefined, email: null })], captured.io);
    const facts = readFileSync(join(root, "site.facts.ts"), "utf8");
    expect(facts).toContain('legalName: "Acme Electrical Ltd"');
    expect(facts).toContain("phone: null");
    expect(facts).toContain("email: null");
    expect(facts).toContain('businessTypes: ["LocalBusiness", "HomeAndConstructionBusiness"]');
  });

  test("with --yes and a required answer missing, exits 2 and names the flag", async () => {
    const root = project("next-root");
    const { io, err } = captureIo(root);
    expect(await run(["--yes", "--skip-install", "--client", "Acme Ltd"], io)).toBe(2);
    expect(err.join("\n")).toMatch(/--site-url, --sector, --description/);
    expect(existsSync(join(root, "site.facts.ts"))).toBe(false);
  });
});

describe("running it again", () => {
  test("changes nothing and says there is nothing to do", async () => {
    const root = project("astro");
    await scaffold(root);
    const after = snapshotTree(root);
    const { out } = await scaffold(root);
    expect(snapshotTree(root)).toEqual(after);
    expect(out.join("\n")).toMatch(/nothing to do/);
  });

  test("reports a changed house template as differing, and --force restores it but never a data file", async () => {
    const root = project("next-root");
    await scaffold(root);
    const credit = join(root, "components/DesignerCredit.tsx");
    const original = readFileSync(credit, "utf8");
    writeFileSync(credit, original.replace(' rel="nofollow">', ">"));
    writeFileSync(join(root, "site.facts.ts"), "// edited by hand\n");

    const { out } = await scaffold(root);
    expect(out.join("\n")).toMatch(/differs\s+components\/DesignerCredit\.tsx/);
    expect(readFileSync(credit, "utf8")).not.toContain(' rel="nofollow">');

    await scaffold(root, ["--force"]);
    expect(readFileSync(credit, "utf8")).toBe(original);
    expect(readFileSync(join(root, "site.facts.ts"), "utf8")).toBe("// edited by hand\n");
  });
});

describe("CLAUDE.md", () => {
  test("keeps an existing CLAUDE.md (create-next-app writes one) and adds an import of the house rules, once", async () => {
    const root = project("next-root", { "CLAUDE.md": "@AGENTS.md\n", "AGENTS.md": "framework notes\n" });
    await scaffold(root);
    expect(readFileSync(join(root, "CLAUDE.md"), "utf8")).toBe("@AGENTS.md\n@docs/HOUSE.md\n");
    await scaffold(root);
    expect(readFileSync(join(root, "CLAUDE.md"), "utf8")).toBe("@AGENTS.md\n@docs/HOUSE.md\n");
  });
});

describe("installing", () => {
  test("installs the house packages with the project's package manager, then runs craft's direction init through the installed bin", async () => {
    const root = project("next-root");
    const craft = join(root, "node_modules/@domandigital/craft");
    mkdirSync(craft, { recursive: true });
    writeFileSync(join(craft, "package.json"), JSON.stringify({ name: "@domandigital/craft", bin: { craft: "dist/cli.js" } }));
    const captured = captureIo(root);
    expect(await run(["--yes", "--answers", writeAnswers(root)], captured.io)).toBe(0);
    expect(captured.execs[0]!.slice(0, 2)).toEqual(["pnpm", "add"]);
    expect(captured.execs[1]!.slice(0, 3)).toEqual(["pnpm", "add", "-D"]);
    expect(captured.execs[2]).toEqual([process.execPath, join(craft, "dist/cli.js"), "direction", "init", "--client", "Acme Electrical"]);
  });

  test("never runs craft over an existing art-direction.json", async () => {
    const root = project("next-root", { "art-direction.json": '{"version":1}\n' });
    const captured = captureIo(root);
    await run(["--yes", "--answers", writeAnswers(root)], captured.io);
    expect(captured.execs.some((e) => e.includes("direction"))).toBe(false);
  });
});

describe("a config it cannot edit safely", () => {
  test("is left alone, with instructions, instead of being guessed at", async () => {
    const root = project("next-root", { "next.config.ts": `${NEXT_CONFIG}\nexport const other = { redirects: [] };\n` });
    const before = readFileSync(join(root, "next.config.ts"), "utf8");
    const { out } = await scaffold(root);
    expect(readFileSync(join(root, "next.config.ts"), "utf8")).toBe(before);
    expect(out.join("\n")).toMatch(/already defines redirects: read redirects\.json in next\.config/);
  });
});
