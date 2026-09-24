import { describe, expect, it } from "vitest";
import { CATALOGUE, CATALOGUE_VERSION, runTell, tellById } from "../character/check.js";
import { AI_PHRASES, AI_WORDS, BUZZWORDS, NEGATIVE_REASSURANCE, PLAINER_WORDS, REVIEW_PHRASES, STOCK_PHRASES, VAGUE_WORDS } from "../character/tells/copy.js";
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
    if (tell.surface === "rendered") {
      it("is seen on a rendered page, so it carries a rendered path", () => {
        expect(tell.rendered).toBeDefined();
      });
    } else {
      const { fixtures } = tell;
      it("has at least one flag and one pass fixture", () => {
        expect(fixtures.flag.length).toBeGreaterThan(0);
        expect(fixtures.pass.length).toBeGreaterThan(0);
      });

      it("fires on every flag case, each on its own", () => {
        for (const c of fixtures.flag) {
          const hits = runTell(tell, files(c));
          expect(hits.length, files(c)[0].text.slice(0, 60)).toBeGreaterThan(0);
          for (const hit of hits) expect(hit.message.length).toBeGreaterThan(0);
        }
      });

      it("stays quiet on every pass case", () => {
        for (const c of fixtures.pass) expect(runTell(tell, files(c))).toEqual([]);
      });
    }

    if (tell.rendered) {
      const rendered = tell.rendered;
      it("fires on every rendered flag snapshot, each on its own", () => {
        expect(rendered.fixtures.flag.length).toBeGreaterThan(0);
        for (const s of rendered.fixtures.flag) {
          const hits = rendered.detect(s);
          expect(hits.length, JSON.stringify(s).slice(0, 80)).toBeGreaterThan(0);
          for (const hit of hits) expect(hit.message.length).toBeGreaterThan(0);
        }
      });

      it("stays quiet on every rendered pass snapshot", () => {
        expect(rendered.fixtures.pass.length).toBeGreaterThan(0);
        for (const s of rendered.fixtures.pass) expect(rendered.detect(s)).toEqual([]);
      });
    }
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

  const lists: [string, readonly string[]][] = [
    ["ai-phrase", AI_PHRASES],
    ["plainer-word", PLAINER_WORDS],
    ["buzzword", BUZZWORDS],
    ["negative-reassurance", NEGATIVE_REASSURANCE],
    ["vague-word", VAGUE_WORDS],
    ["review-phrase", REVIEW_PHRASES],
  ];
  describe.each(lists)("%s", (id, list) => {
    it.each([...list])("matches %s, straight or curly", (phrase) => {
      const tell = tellById(id)!;
      expect(runTell(tell, [{ path: "a.md", text: `Well, ${phrase} here.` }])).toHaveLength(1);
      const curly = phrase.replace(/'/g, "’");
      expect(runTell(tell, [{ path: "a.md", text: `Well, ${curly} here.` }])).toHaveLength(1);
    });
  });

  it("gives each word and phrase to exactly one tell, so a finding names its tier", () => {
    const all = [...AI_WORDS, ...STOCK_PHRASES, ...AI_PHRASES, ...PLAINER_WORDS, ...BUZZWORDS, ...NEGATIVE_REASSURANCE, ...VAGUE_WORDS, ...REVIEW_PHRASES];
    const lists = [AI_WORDS, STOCK_PHRASES, AI_PHRASES, PLAINER_WORDS, BUZZWORDS, NEGATIVE_REASSURANCE, VAGUE_WORDS, REVIEW_PHRASES];
    for (const phrase of all) expect(lists.filter((l) => (l as readonly string[]).includes(phrase)), phrase).toHaveLength(1);
  });
});
