import { describe, expect, it } from "vitest";
import { LEXICAL_FEATURES, STUDY_WORDS, lexicalOf, vocabulary, vocabularyCounts } from "../index.js";

const GENERIC = "We pride ourselves on delivering seamless, tailored solutions that elevate your journey and showcasing our meticulous craft.";
const PARTICULAR = "Boilers fixed the same day in Brackley, from £85. Call Hinton Heating on 01604 555 123.";

describe("lexicalOf", () => {
  it("returns every declared feature as a finite number", () => {
    const f = lexicalOf(GENERIC);
    for (const k of LEXICAL_FEATURES) expect(Number.isFinite(f[k])).toBe(true);
  });

  it("counts tell words and phrases per 100 words", () => {
    const f = lexicalOf(GENERIC);
    expect(f.listRate).toBeGreaterThan(10);
    expect(f.generic).toBe(1);
  });

  it("counts a study word once in each rate it belongs to", () => {
    // "showcasing" is in craft's own list and in the published excess-use list.
    const f = lexicalOf("Showcasing every job we do, this is what we offer to anyone who asks about it today.");
    expect(f.studyRate).toBeGreaterThan(0);
    expect(f.listRate).toBeGreaterThan(0);
  });

  it("scores particular copy high on specifics and clean on tell words", () => {
    const f = lexicalOf(PARTICULAR);
    expect(f.listRate).toBe(0);
    expect(f.generic).toBe(0);
    expect(f.figures).toBeGreaterThanOrEqual(1);
    expect(f.hardPer100).toBeGreaterThan(10);
  });

  it("does not match a listed word inside another word", () => {
    expect(vocabularyCounts("The realm of realms and the tapestries hung there.").has("realm")).toBe(true);
    expect(vocabularyCounts("Surrealm and unrealmed are not words.").size).toBe(0);
  });

  it("reads curly apostrophes in phrases", () => {
    expect(vocabularyCounts("We’ve got you covered, whatever the weather.").has("we've got you covered")).toBe(true);
  });
});

describe("vocabulary", () => {
  it("has no duplicates and gives every word a source", () => {
    const v = vocabulary();
    expect(new Set(v.map((x) => x.word)).size).toBe(v.length);
    expect(v.every((x) => x.source.length > 0)).toBe(true);
  });

  it("dates every study word to its paper", () => {
    expect(STUDY_WORDS.length).toBeGreaterThan(0);
    expect(STUDY_WORDS.every((s) => /arXiv:\d{4}\.\d{5}/.test(s.source))).toBe(true);
  });
});
