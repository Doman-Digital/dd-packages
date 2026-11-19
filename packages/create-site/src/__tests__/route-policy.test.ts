// The route policy must describe only the pages a site has. A handover without
// a visible piece has no /press, legal or /resources page, so its policy must
// not list one as in the sitemap. The planner runs for real here, and the check
// reads what it wrote: every inSitemap entry needs a page.

import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import { validateCoverage } from "@domandigital/seo";
import type { RoutePolicyEntry } from "@domandigital/seo";
import { run } from "../run";
import type { Io } from "../run";
import { captureIo, cleanup, makeProject, writeAnswers } from "./fixtures";
import type { Kind } from "./fixtures";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(cleanup));

const passes: Io["gate"] = async () => ({ ok: true, message: "" });
const LEGAL = ["/accessibility", "/cookies", "/privacy", "/terms"];

type Policy = RoutePolicyEntry[];
type Enumerators = { routesOnDisk: (root: string) => string[]; dynamicRoutesOnDisk: (root: string) => string[] };

const load = async <T>(root: string, path: string): Promise<T> => (await import(pathToFileURL(join(root, path)).href)) as T;

/** Runs the real command against a fixture project and returns its root. */
async function scaffold(kind: Kind, handover: string[] | null): Promise<string> {
  const root = makeProject(kind);
  roots.push(root);
  const { io, err } = captureIo(root, { gate: passes });
  const args = [
    "--yes",
    "--skip-install",
    "--answers",
    writeAnswers(root, { programme: "DOM-999" }),
    ...(handover === null ? [] : ["--handover", "--reason", "the client already has a site", ...(handover.length ? ["--with", handover.join(",")] : [])]),
  ];
  expect(await run(args, io)).toBe(0);
  expect(err.join("\n")).toBe("");
  return root;
}

/** Every inSitemap entry has a page on disk, and the whole policy agrees with the pages. */
async function expectPolicyMatchesPages(root: string) {
  const { routesOnDisk, dynamicRoutesOnDisk } = await load<Enumerators>(root, "tests/seo/routes-on-disk.ts");
  const { policy } = await load<{ policy: Policy }>(root, "site.routes.ts");
  const pages = new Set(routesOnDisk(root));
  for (const entry of policy) {
    if (entry.inSitemap && !entry.isDynamicPattern) expect(pages.has(entry.path), `${entry.path} is in the sitemap with no page`).toBe(true);
  }
  expect(validateCoverage({ routesOnDisk: routesOnDisk(root), dynamicRoutesOnDisk: dynamicRoutesOnDisk(root), policy })).toEqual([]);
}

async function listedPaths(root: string): Promise<string[]> {
  return (await load<{ policy: Policy }>(root, "site.routes.ts")).policy.map((p) => p.path);
}

for (const kind of ["astro", "next-root"] as const) {
  describe(`the route policy of a ${kind} site`, () => {
    test("a handover with no --with lists no press, legal or resources page", async () => {
      const root = await scaffold(kind, []);
      const listed = await listedPaths(root);
      for (const path of ["/press", "/resources", ...LEGAL]) expect(listed, path).not.toContain(path);
      await expectPolicyMatchesPages(root);
    }, 60_000);

    for (const piece of ["press", "resources", "legal"] as const) {
      test(`a handover with only --with ${piece} lists that piece and no other`, async () => {
        const root = await scaffold(kind, [piece]);
        const listed = await listedPaths(root);
        expect(listed.includes("/press")).toBe(piece === "press");
        expect(listed.includes("/resources")).toBe(piece === "resources");
        for (const path of LEGAL) expect(listed.includes(path), path).toBe(piece === "legal");
        await expectPolicyMatchesPages(root);
      }, 60_000);
    }

    test("a programme build still lists every press, legal and resources entry", async () => {
      const root = await scaffold(kind, null);
      const { policy } = await load<{ policy: Policy }>(root, "site.routes.ts");
      expect(policy.find((p) => p.path === "/press")?.inSitemap).toBe(true);
      expect(policy.find((p) => p.path === "/resources")?.inSitemap).toBe(false);
      for (const path of LEGAL) expect(policy.find((p) => p.path === path)?.inSitemap, path).toBe(false);
      await expectPolicyMatchesPages(root);
    }, 60_000);
  });
}
