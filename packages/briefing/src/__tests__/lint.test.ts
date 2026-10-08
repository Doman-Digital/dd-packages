import { describe, expect, it } from "vitest";
import { buildBriefing } from "../build";
import { assertLintClean, BriefingLintError, headlineIsSpecific, lintBriefing, lintDates, lintText, readableFields } from "../lint";
import type { Briefing } from "../types";
import { fixture } from "./helpers";

const rules = (text: string, allowedTerms?: string[]) => lintText(text, "x", { allowedTerms }).map((f) => f.rule);

/** A clean briefing from the fixture, to plant things in. */
function clean(): Briefing {
  const f = fixture();
  return buildBriefing(f.input, f.config).briefing;
}

describe("banned phrases", () => {
  it.each([
    "Pages open with almost no waiting.",
    "No downtime was logged.", // copy-ok: planted for the gate
    "Nothing changes on the live site yet.",
    "You don't need to do anything.",
    "Your site stayed up the whole fortnight.",
  ])("negative reassurance: %s", (text) => {
    expect(rules(text)).toContain("negative-reassurance");
  });

  it.each([
    "Your remaining balance goes down each month.",
    "This is part of your aftercare.",
    "Website as a service means you never pay up front.", // copy-ok: planted for the gate
    "We ran an audit of your site.",
    "A new add-on for your shop.",
    "Every pound of the difference comes off.",
  ])("DIRECTION.md section 5: %s", (text) => {
    expect(rules(text)).toContain("direction-banned");
  });

  it("jargon fails unless the client's config allows the term", () => {
    expect(rules("This is a security update to the framework.")).toContain("jargon");
    expect(rules("Your emails move to Resend.")).toContain("jargon");
    expect(rules("We will deploy it on Monday.")).toContain("jargon");
    expect(rules("Your emails move to Resend.", ["Resend"])).not.toContain("jargon");
    // Proper names match their case only: "loops" in a sentence is a word.
    expect(rules("The video loops on phones.")).not.toContain("jargon");
  });

  it("em dashes, finished words and hours", () => {
    expect(rules("Your page is live — and fast.")).toContain("em-dash"); // copy-ok: planted for the gate
    expect(rules("Your page is live – and fast.")).toContain("em-dash");
    expect(rules("2026-10-07")).not.toContain("em-dash");
    expect(rules("The gift page is done.")).toContain("finished-word");
    expect(rules("We spent 3 hours on it.")).toContain("hours-or-rates");
    expect(rules("It costs £40.")).toContain("hours-or-rates");
  });

  it("clean copy passes", () => {
    expect(rules("Since Wednesday 7 October, pages open quickly on phones.")).toEqual([]);
  });
});

describe("one event, one date", () => {
  it("two different dates for the launch fail", () => {
    const f = lintDates([["note", "Sales open on 18 November."], ["subhead", "Your launch is on Wednesday 13 January."]]);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ rule: "two-dates", field: "subhead", match: "Wednesday 13 January" });
  });

  it("a date that disagrees with the launch block fails", () => {
    expect(lintDates([["note", "Your launch moves to 20 January."]], "2027-01-13")[0]).toMatchObject({ rule: "two-dates" });
    expect(lintDates([["note", "Your launch is in January."]], "2027-01-13")).toEqual([]);
    expect(lintDates([["note", "Your launch is on 13 January."]], "2027-01-13")).toEqual([]);
  });

  it("dates for different events are not compared", () => {
    expect(lintDates([["subhead", "Your faster site went live on 7 October. Your launch is on 13 January."]], "2027-01-13")).toEqual([]);
  });
});

describe("the briefing as a whole", () => {
  it("the fixture's briefing is clean", () => {
    expect(lintBriefing(clean())).toEqual([]);
  });

  it("a planted banned phrase fails the briefing", () => {
    const b = clean();
    b.changes[0]!.outcome = "Pages open with almost no waiting.";
    expect(() => assertLintClean(b)).toThrow(BriefingLintError);
    expect(lintBriefing(b)).toContainEqual(expect.objectContaining({ rule: "negative-reassurance", field: "changes[0].outcome", match: "no waiting" })); // copy-ok: planted for the gate
  });

  it("a second launch date anywhere fails the briefing", () => {
    const b = clean();
    b.note = `${b.note} The planner goes on sale on 18 November.`;
    expect(lintBriefing(b)).toContainEqual(expect.objectContaining({ rule: "two-dates", field: "note", match: "18 November" }));
  });

  it("every client-readable string is checked, the small print included", () => {
    const b = clean();
    b.health.speed!.smallPrint = "Median of 5 runs — measured on 8 October."; // copy-ok: planted for the gate
    b.health.uptime.smallPrint = "Your site stayed up the whole fortnight.";
    b.launch!.milestones[0]!.label = "Emails done";
    const fields = lintBriefing(b).map((f) => f.field);
    expect(fields).toEqual(expect.arrayContaining(["health.speed.smallPrint", "health.uptime.smallPrint", "launch.milestones[0].label"]));
    expect(readableFields(b).map(([f]) => f)).toEqual(expect.arrayContaining(["approvals[0].why", "approvals[0].secondary.label", "launch.pill", "health.search.sentence"]));
  });

  it('"Nothing needed from you" with approvals waiting fails', () => {
    const b = clean();
    b.subhead = "Nothing needed from you this fortnight.";
    expect(lintBriefing(b)).toContainEqual(expect.objectContaining({ rule: "nothing-needed", field: "subhead" }));
  });

  it("a headline that ignores waiting approvals fails", () => {
    const b = clean();
    b.headline = "Your faster site is live on 7 October.";
    expect(lintBriefing(b).map((f) => f.rule)).toContain("headline-approvals");
  });

  it("a vague headline fails", () => {
    const b = clean();
    b.approvals = [];
    b.headline = "Some updates to your website.";
    expect(lintBriefing(b).map((f) => f.rule)).toContain("headline-specific");
    expect(headlineIsSpecific("Wrapping options are live on your gift page.", ["Your gift page shows wrapping options"])).toBe(true);
    expect(headlineIsSpecific("Lots of improvements this fortnight.", ["Your gift page shows wrapping options"])).toBe(false);
  });

  it("status labels come from the fixed list", () => {
    const b = clean();
    b.launch!.pill = "Almost there";
    (b.launch!.milestones[0] as { status: string }).status = "in progress";
    expect(lintBriefing(b).filter((f) => f.rule === "status-label")).toHaveLength(2);
  });
});
