import { describe, expect, it } from "vitest";
import {
  clauseDepth,
  hedgedClose,
  isBlurb,
  nominalisations,
  paragraphUniformity,
  participialClauses,
  phrasalCoordinations,
  shapeMoves,
  shapeOf,
  skeleton,
  splitSentences,
  stackedConditional,
  tricolons,
} from "../character/shape.js";

/** Passed copy-check on 2026-09-24; the founder could tell at a glance that a model wrote it. */
const FOUNDER_BLURB =
  "A 30-minute video call about your business, your website and the systems behind it. We look at where enquiries and admin get stuck, and what would fix it. You leave with a clear next step, and if it's a fit, a fixed quote follows in writing.";

/** Invented, in the register of a plain internal email. */
const PLAIN_EMAIL = "Mike, I talked to Sara about the Houston deal this morning. She wants the numbers by Friday. Can you send me what you have so far? Thanks.";

describe("splitSentences", () => {
  it("does not split on abbreviations or decimals", () => {
    expect(splitSentences("We fit e.g. boilers and taps. It costs £2.50 a mile. Call Dr. Shah today.")).toEqual([
      "We fit e.g. boilers and taps.",
      "It costs £2.50 a mile.",
      "Call Dr. Shah today.",
    ]);
  });
});

describe("tricolons", () => {
  it("finds the founder's parallel triad", () => {
    const [t] = tricolons(splitSentences(FOUNDER_BLURB)[0]);
    expect(t.parallel).toBe(true);
  });

  it("finds a plain list, not parallel", () => {
    expect(tricolons("We install, service and repair boilers.")).toEqual([expect.objectContaining({ parallel: false })]);
  });

  it("ignores two items and a long clause after the conjunction", () => {
    expect(tricolons("Bring your keys and your parking permit.")).toEqual([]);
    expect(tricolons("We came, we saw and then we spent the whole of the afternoon arguing about the invoice.")).toEqual([]);
  });
});

describe("clause stacking", () => {
  it("finds a conditional parked between commas", () => {
    expect(stackedConditional("You leave with a clear next step, and if it's a fit, a fixed quote follows.")).toBe(true);
    expect(stackedConditional("If it's a fit, a fixed quote follows.")).toBe(false);
  });

  it("counts commas and subordinators", () => {
    expect(clauseDepth("We look at where it gets stuck, and what would fix it.")).toBe(2);
    expect(clauseDepth("She wants the numbers by Friday.")).toBe(0);
  });
});

describe("hedgedClose", () => {
  it("fires when the last sentence ends on a qualifier or a condition", () => {
    expect(hedgedClose(["We fit boilers.", "A quote follows if needed."])).toBe(true);
    expect(hedgedClose(["We fit boilers.", "Call us on 01604 000000."])).toBe(false);
  });
});

describe("word-level features", () => {
  it("counts nominalisations, not ordinary nouns that share the ending", () => {
    expect(nominalisations("The implementation and management of the station")).toBe(2);
  });

  it("finds participial clauses after a comma and at the start", () => {
    expect(participialClauses("We cover the county, making it easy to book.")).toBe(1);
    expect(participialClauses("Drawing on this, we added evenings.")).toBe(1);
    expect(participialClauses("We cover everything, including gas.")).toBe(0);
  });

  it("finds X and Y between content words", () => {
    expect(phrasalCoordinations("Where enquiries and admin get stuck.")).toBe(1);
    expect(phrasalCoordinations("You and your team.")).toBe(0);
  });

  it("reduces a sentence to its function words", () => {
    expect(skeleton("We look at where enquiries and admin get stuck")).toEqual(["we", "_", "at", "where", "_", "and", "_"]);
  });
});

describe("shapeOf", () => {
  it("makes three moves on the founder's blurb and none on a plain email", () => {
    expect(shapeMoves(shapeOf(FOUNDER_BLURB))).toEqual(["parallel triad", "stacked conditional", "hedged close"]);
    expect(shapeMoves(shapeOf(PLAIN_EMAIL))).toEqual([]);
  });

  it("leaves sentence CV null below three sentences", () => {
    expect(shapeOf("One sentence here. And another one.").sentenceCv).toBeNull();
    expect(shapeOf(PLAIN_EMAIL).sentenceCv).not.toBeNull();
  });

  it("knows a blurb from a line and from an essay", () => {
    expect(isBlurb(shapeOf(FOUNDER_BLURB))).toBe(true);
    expect(isBlurb(shapeOf("Call us today."))).toBe(false);
  });

  it("measures paragraph uniformity only from four paragraphs", () => {
    expect(paragraphUniformity(["a b c", "a b c", "a b c"])).toBeNull();
    expect(paragraphUniformity(["a b c", "a b c", "a b c", "a b c"])).toBe(0);
  });
});
