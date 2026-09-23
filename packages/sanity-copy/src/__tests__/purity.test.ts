import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The library runs inside Sanity Studio, in the browser. Nothing a Studio
 * imports may reach a Node built-in, or the Studio build fails on a client's
 * machine rather than here. The sweep command is the one file allowed to.
 */
const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("the library a Studio imports", () => {
  for (const file of ["index.ts", "core.ts", "schema.ts"]) {
    it(`${file} imports no Node built-in and nothing from Sanity`, () => {
      const text = readFileSync(resolve(SRC, file), "utf8");
      expect(text).not.toMatch(/from\s+["']node:/);
      expect(text).not.toMatch(/from\s+["'](?:sanity|@sanity\/)/);
    });
  }

  it("does not export the sweep command", () => {
    expect(readFileSync(resolve(SRC, "index.ts"), "utf8")).not.toMatch(/cli/);
  });
});
