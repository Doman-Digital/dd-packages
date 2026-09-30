import { describe, expect, it } from "vitest";
import { REGISTER_FEATURES, registerOf } from "../register/features.js";

describe("registerOf", () => {
  it("measures words per sentence and letters per word", () => {
    const f = registerOf("Book a slot today. We call you back.");
    expect(f.meanSentenceWords).toBe(4);
    expect(f.meanWordLength).toBeCloseTo(27 / 8);
  });

  it("counts contractions but not possessives", () => {
    const f = registerOf("It's ready and you'll love it. Sam's van can't wait. We're here.");
    // it's, you'll, can't, we're: 4 of 12 words. Sam's is a possessive.
    expect(f.contractionsPer100).toBeCloseTo((100 * 4) / 12);
  });

  it("counts curly apostrophes the same", () => {
    expect(registerOf("It’s ready. You’ll see.").contractionsPer100).toBe(registerOf("It's ready. You'll see.").contractionsPer100);
  });

  it("counts second and first person", () => {
    const f = registerOf("You and your team get our report. I send it to you.");
    // you, your, you: 3 of 12. our, I: 2 of 12.
    expect(f.youPer100).toBeCloseTo(25);
    expect(f.firstPersonPer100).toBeCloseTo((100 * 2) / 12);
  });

  it("finds passives, regular and irregular, with an adverb between", () => {
    expect(registerOf("The form was completed by the applicant. It is sent on Monday.").passiveShare).toBe(1);
    expect(registerOf("The work was quickly done. We finished early.").passiveShare).toBe(0.5);
    expect(registerOf("She was given the keys. It works.").passiveShare).toBe(0.5);
  });

  it("does not take adjectives or perfect tenses for passives", () => {
    expect(registerOf("I am tired today. She was interested in the offer.").passiveShare).toBe(0);
    expect(registerOf("He has finished the job. They have painted the hall.").passiveShare).toBe(0);
    expect(registerOf("Given that it rained, the match is off. The garden is open.").passiveShare).toBe(0);
  });

  it("returns zeros for empty text and lists every feature", () => {
    expect(Object.values(registerOf("")).every((v) => v === 0)).toBe(true);
    expect(Object.keys(registerOf("One. Two."))).toEqual([...REGISTER_FEATURES]);
  });
});
