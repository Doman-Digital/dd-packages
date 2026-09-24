import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { detectPackageManager, detectProject } from "../detect";
import { run } from "../run";
import { captureIo, cleanup, makeProject, snapshotTree, writeAnswers } from "./fixtures";

const roots: string[] = [];
const project = (...args: Parameters<typeof makeProject>) => {
  const root = makeProject(...args);
  roots.push(root);
  return root;
};
afterEach(() => roots.splice(0).forEach(cleanup));

describe("detectProject", () => {
  test("finds a Next.js App Router project at the root", () => {
    const p = detectProject(project("next-root"));
    expect(typeof p !== "string" && [p.framework, p.routesDir, p.srcBase, p.configFile]).toEqual(["next", "app", "", "next.config.ts"]);
  });

  test("finds a Next.js project that keeps the app under src/", () => {
    const p = detectProject(project("next-src"));
    expect(typeof p !== "string" && [p.routesDir, p.srcBase]).toEqual(["src/app", "src/"]);
  });

  test("finds an Astro project", () => {
    const p = detectProject(project("astro"));
    expect(typeof p !== "string" && [p.framework, p.routesDir, p.configFile]).toEqual(["astro", "src/pages", "astro.config.mjs"]);
  });

  test("takes the package manager from the lockfile, and warns when the runner disagrees", () => {
    const root = project("next-root");
    expect(detectPackageManager(root, "npm/10.9.0 node/v22")).toEqual({
      pm: "pnpm",
      warning: "this project uses pnpm but this ran under npm: installing with pnpm",
    });
    rmSync(join(root, "pnpm-lock.yaml"));
    expect(detectPackageManager(root, "yarn/4.5.0").pm).toBe("yarn");
    expect(detectPackageManager(root, undefined).pm).toBe("npm");
    writeFileSync(join(root, "package.json"), '{"packageManager":"pnpm@10.33.0","dependencies":{"next":"16"}}');
    expect(detectPackageManager(root, "npm/10.9.0").pm).toBe("pnpm");
  });
});

describe("refusals write nothing", () => {
  const cases: [string, (root: string) => void, RegExp][] = [
    ["no package.json", (r) => rmSync(join(r, "package.json")), /no package\.json/],
    ["no tsconfig.json", (r) => rmSync(join(r, "tsconfig.json")), /no tsconfig\.json/],
    ["neither framework", (r) => writeFileSync(join(r, "package.json"), '{"dependencies":{"react":"19.0.0"}}'), /not a Next\.js or Astro project/],
    ["both frameworks", (r) => writeFileSync(join(r, "package.json"), '{"dependencies":{"next":"16","astro":"5"}}'), /both next and astro/],
    [
      "the Pages Router only",
      (r) => {
        rmSync(join(r, "app"), { recursive: true });
        writeFileSync(join(r, "tsconfig.json"), "{}");
        rmSync(join(r, "next.config.ts"));
        mkdirSync(join(r, "pages"));
      },
      /Pages Router only/,
    ],
  ];

  for (const [name, breakIt, message] of cases) {
    test(`refuses ${name}, exit 1, and leaves the project exactly as it was`, async () => {
      const root = project("next-root");
      breakIt(root);
      const before = snapshotTree(root);
      const { io, err, execs } = captureIo(root);
      const code = await run(["--yes", "--skip-install", "--answers", writeAnswers(root)], io);
      expect(code).toBe(1);
      expect(err.join("\n")).toMatch(message);
      expect(snapshotTree(root)).toEqual(before);
      expect(execs).toEqual([]);
      expect(existsSync(join(root, "site.facts.ts"))).toBe(false);
    });
  }
});
