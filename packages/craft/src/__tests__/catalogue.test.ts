import { describe, expect, it } from "vitest";
import { CATALOGUE, CATALOGUE_VERSION, runTell, tellById } from "../character/check.js";
import { AI_WORDS, STOCK_PHRASES } from "../character/tells/copy.js";
import type { FixtureCase } from "../character/types.js";

const files = (c: FixtureCase) => (Array.isArray(c) ? c : [c]);

describe("the tell catalogue", () => {
  it("has unique kebab-case ids", () => {
    const ids = CATALOGUE.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it("carries a dated version", () => {
    expect(CATALOGUE_VERSION).toMatch(/^\d{4}\.\d{2}\.\d+$/);
  });

  it("ships every tell as warn until the estate hits have been read", () => {
    // Flip one to block deliberately, with the baseline in the ROADMAP, and
    // update this test in the same change.
    expect(CATALOGUE.filter((t) => t.severity !== "warn").map((t) => t.id)).toEqual([]);
  });

  it("says why and what to do instead for every tell", () => {
    for (const t of CATALOGUE) {
      expect(t.why.length, `${t.id} why`).toBeGreaterThan(30);
      expect(t.fix.length, `${t.id} fix`).toBeGreaterThan(20);
    }
  });

  it("does not use em dashes in its own guidance", () => {
    for (const t of CATALOGUE) expect(`${t.name} ${t.why} ${t.fix}`, t.id).not.toContain("—");
  });

  // A guard that cannot fail is not a guard. Each entry proves both directions.
  describe.each(CATALOGUE.map((t) => [t.id, t] as const))("%s", (_id, tell) => {
    it("has at least one flag and one pass fixture", () => {
      expect(tell.fixtures.flag.length).toBeGreaterThan(0);
      expect(tell.fixtures.pass.length).toBeGreaterThan(0);
    });

    it("fires on every flag case, each on its own", () => {
      for (const c of tell.fixtures.flag) {
        const hits = runTell(tell, files(c));
        expect(hits.length, files(c)[0].text.slice(0, 60)).toBeGreaterThan(0);
        for (const hit of hits) expect(hit.message.length).toBeGreaterThan(0);
      }
    });

    it("stays quiet on every pass case", () => {
      for (const c of tell.fixtures.pass) expect(runTell(tell, files(c))).toEqual([]);
    });
  });
});

describe("the copy lists", () => {
  // The lists are data; each entry proves itself so an escaping slip or a typo
  // cannot leave one word silently unmatched.
  it.each([...AI_WORDS])("ai-vocabulary matches %s", (word) => {
    expect(runTell(tellById("ai-vocabulary")!, [{ path: "a.md", text: `We ${word} it.` }])).toHaveLength(1);
  });

  it.each([...STOCK_PHRASES])("stock-phrase matches %s", (phrase) => {
    expect(runTell(tellById("stock-phrase")!, [{ path: "a.md", text: `Honestly, ${phrase} here.` }])).toHaveLength(1);
  });
});
