import { describe, expect, it } from "vitest";
import { compareFacts, protectedFacts } from "../character/facts.js";

const kinds = (text: string) => protectedFacts(text).map((f) => `${f.kind}:${f.value}`);

describe("protected facts", () => {
  it("finds each kind once, most specific first", () => {
    expect(kinds("Call 01280 700 123 or email hello@lane.co.uk. Visit https://lane.co.uk/book. NN13 7AB.")).toEqual([
      "url:https://lane.co.uk/book",
      "email:hello@lane.co.uk",
      "phone:01280 700 123",
      "postcode:NN13 7AB",
    ]);
    expect(kinds("From £40, or £1,250 for a rewire. Open 9am to 5:30pm since 2009.")).toEqual([
      "money:£40",
      "money:£1,250",
      "date:2009",
      "time:9am",
      "time:5:30pm",
    ]);
    expect(kinds("Rated 4.9 from 212 reviews, 98% on time.")).toEqual(["number:4.9", "number:212", "number:98%"]);
  });

  it("finds names that do not open a sentence, and acronyms anywhere", () => {
    expect(kinds("Every engineer is Gas Safe registered. NICEIC approved in Brackley.")).toEqual([
      "name:Gas Safe",
      "name:NICEIC",
      "name:Brackley",
    ]);
  });

  it("skips Title Case headings, which would make every word a name", () => {
    expect(kinds("## Emergency Electricians Near You\n\nWe cover Uxbridge.")).toEqual(["name:Uxbridge"]);
  });
});

describe("comparing a rewrite", () => {
  it("passes a rewrite that keeps every fact, whatever the formatting", () => {
    const r = compareFacts("World-class service since 2009. Call 01280 700123. From £1,250.", "Since 2009. Ring 01280 700 123. From £1250.");
    expect(r.lost).toEqual([]);
    expect(r.added).toEqual([]);
  });

  it("reports a lost price and an invented number", () => {
    const r = compareFacts("Rewires from £1,250, done in two days by NICEIC engineers.", "Rewires done quickly by NICEIC engineers, rated 4.9 by 300 customers.");
    expect(r.lost.map((f) => f.value)).toEqual(["£1,250"]);
    expect(r.added.map((f) => f.value)).toEqual(["4.9", "300"]);
  });

  it("reports a lost name", () => {
    expect(compareFacts("Registered with Gas Safe.", "Fully registered.").lost.map((f) => f.value)).toEqual(["Gas Safe"]);
  });
});
