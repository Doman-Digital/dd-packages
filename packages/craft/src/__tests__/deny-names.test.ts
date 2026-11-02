import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { formatHit, loadDenyList, scanFiles, scanText, shippedFiles, walk } from "../../scripts/deny-check.mjs";

/**
 * The name guard. craft names no client, client domain, client person, studio
 * staff member or reviewer: not in what npm ships, and not anywhere else in the
 * package folder, because the repository is public. The names are held only as
 * salted hashes in fixtures/deny-names.json; the plain list is kept privately.
 * The packed tarball gets the same check in scripts/check-tarballs.mjs.
 */

const PKG = fileURLToPath(new URL("../../", import.meta.url));
const LIST = loadDenyList();

// Built at run time, so this file never holds the canary as a word.
const CANARY = "x2q7yranacynedtfarc".split("").reverse().join("");

describe("the deny list", () => {
  it("holds hashes only, with the canary among them", () => {
    expect(LIST.hashes.size).toBeGreaterThan(20);
    for (const h of LIST.hashes) expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(LIST.hashes.has(LIST.canary)).toBe(true);
    expect(createHash("sha256").update(`${LIST.salt}:${CANARY}`).digest("hex")).toBe(LIST.canary);
  });

  it("goes red on the canary, alone, inside a sentence and split across a separator", () => {
    expect(scanText(`A line that names ${CANARY} once.`, LIST)).toEqual([{ line: 1, form: CANARY }]);
    expect(scanText(`first line\n<h1>${CANARY.toUpperCase()}</h1>`, LIST)).toEqual([{ line: 2, form: CANARY }]);
    const [a, b] = [CANARY.slice(0, 9), CANARY.slice(9)];
    expect(scanText(`${a}-${b}`, LIST).map((h) => h.form)).toEqual([CANARY]);
    expect(scanText(`${a} and ${b}`, LIST).map((h) => h.form)).toEqual([CANARY]);
  });

  it("passes ordinary words", () => {
    expect(scanText("A two-chair studio above the bakery, and a plumber on call until 10pm.", LIST)).toEqual([]);
  });
});

describe("craft names nobody", () => {
  it("in the files npm ships (package.json, the files list, and dist when built)", () => {
    const files = shippedFiles(PKG);
    expect(files.length).toBeGreaterThan(10);
    if (!existsSync(join(PKG, "dist"))) console.warn("deny-names: dist/ is not built, so only the tarball check covers it");
    expect(scanFiles(files, LIST, PKG).map(formatHit)).toEqual([]);
  });

  it("anywhere else in the package folder", () => {
    expect(scanFiles(walk(PKG), LIST, PKG).map(formatHit)).toEqual([]);
  });
});
