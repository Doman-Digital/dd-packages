import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LICENCES, faceLicence, licencesJson } from "../direction/licences.js";

const FILE = readFileSync(fileURLToPath(new URL("../../licences.json", import.meta.url)), "utf8");

describe("the licence register", () => {
  it("licences.json carries the generated document, unedited", () => {
    expect(FILE, "run `pnpm --filter @domandigital/craft run docs`").toBe(licencesJson());
  });

  it("cites the licensor for every entry, never an aggregator, with a date", () => {
    for (const l of LICENCES) {
      expect(l.source, l.name).toMatch(/^https:\/\//);
      expect(l.checked, l.name).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(l.note.split(/\s+/).length, l.name).toBeGreaterThanOrEqual(3);
    }
  });

  it("gives a cap wherever it says capped", () => {
    for (const l of LICENCES.filter((e) => e.multiClient === "capped")) expect(l.cap, l.name).toBeGreaterThan(0);
  });

  it("finds a face by family name, whatever the case, and never a foundry or icon set", () => {
    expect(faceLicence("le murmure")?.licence).toBe("OFL-1.1");
    expect(faceLicence("Blaze Type")).toBeUndefined();
    expect(faceLicence("Phosphor")).toBeUndefined();
  });
});
