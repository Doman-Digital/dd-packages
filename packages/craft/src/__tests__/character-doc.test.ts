import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CATALOGUE, catalogueTable } from "../character/check.js";

const CHARACTER = readFileSync(fileURLToPath(new URL("../../CHARACTER.md", import.meta.url)), "utf8");
const STANDARD = readFileSync(fileURLToPath(new URL("../../STANDARD.md", import.meta.url)), "utf8");

describe("CHARACTER.md is bound to the catalogue", () => {
  it("carries the generated table, unedited", () => {
    const start = "<!-- craft:catalogue:start -->\n";
    const end = "\n<!-- craft:catalogue:end -->";
    const a = CHARACTER.indexOf(start);
    const b = CHARACTER.indexOf(end);
    expect(a, "CHARACTER.md has no catalogue markers").toBeGreaterThan(-1);
    expect(CHARACTER.slice(a + start.length, b), "run `pnpm --filter @domandigital/craft run docs`").toBe(catalogueTable());
  });

  it("names every tell", () => {
    for (const t of CATALOGUE) expect(CHARACTER).toContain(`\`${t.id}\``);
  });

  it("is written without em dashes, like the copy it checks", () => {
    expect(CHARACTER).not.toContain("—");
  });
});

describe("STANDARD.md hands layout defaults to CHARACTER.md", () => {
  it("says so in section 10", () => {
    const section10 = STANDARD.split(/^## /m).find((s) => s.startsWith("10."))!;
    expect(section10).toMatch(/CHARACTER\.md/);
  });
});
