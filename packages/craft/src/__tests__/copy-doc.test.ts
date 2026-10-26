import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CATALOGUE, applyHouseGate, checkCopy } from "../character/check.js";
import { HOUSE } from "../character/house.js";

/**
 * COPY.md is the standard; the tells and house.ts enforce it. This binds them.
 *
 * The old checker kept its own lists in another repo, and they drifted from
 * the written rules in both directions, silently, for weeks. Now a phrase the
 * blocking tier names must block, and every copy tell must be written up.
 */

const COPY = readFileSync(fileURLToPath(new URL("../../COPY.md", import.meta.url)), "utf8");

const section = (heading: string): string => COPY.split(`## ${heading}`)[1]?.split("\n## ")[0] ?? "";
const backticked = (text: string): string[] => [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
const paragraphAfter = (text: string, lead: string): string => text.split(lead)[1]?.split("\n\n")[0] ?? "";

function blockingPhrases(): string[] {
  const tier = section("Blocking tier");
  return [
    ...backticked(paragraphAfter(tier, "The phrase list:")),
    ...backticked(paragraphAfter(tier, "Also blocking:")),
    ...backticked(paragraphAfter(tier, "**Negative reassurance**:")),
  ];
}

/** A rules-file pattern as a sentence that should trip it. */
const asSentence = (phrase: string): string =>
  `We said ${phrase.replace("…", " markets").replace("(ly)", "").replace("a X or a Y", "a landlord or a tenant")} here.`;

const blocks = (text: string): boolean =>
  applyHouseGate(checkCopy([{ path: "content/x.md", text }])).summary.blocking > 0;

describe("COPY.md is bound to the tells", () => {
  it("finds the blocking phrase lists", () => {
    // A parser that finds nothing would make every assertion below vacuous.
    expect(blockingPhrases().length).toBeGreaterThanOrEqual(35);
  });

  it("blocks every phrase its blocking tier names", () => {
    const missed = blockingPhrases().filter((p) => !blocks(asSentence(p)));
    expect(missed, "COPY.md blocks these, craft does not").toEqual([]);
  });

  it("blocks the shapes its blocking tier describes", () => {
    for (const text of [
      "Walk-ins welcome — ring first.",
      "New treatments this month ✨",
      "It's not just a haircut, it's an experience.",
      "We reply within a day. No obligation, no spam.",
      "Look no further for nails.",
      "Reach out for world-class plumbing.",
      "As an AI language model, I can't confirm the price.",
    ]) {
      expect(blocks(text), text).toBe(true);
    }
  });

  it("catches every contrast a 92EL report passed the gate with, and no plain negation", () => {
    const tells = (text: string): string[] =>
      applyHouseGate(checkCopy([{ path: "content/x.md", text }])).findings.map((f) => `${f.tell}:${f.severity}`);
    const cases: [string, string[]][] = [
      ["These are reported, not assumed to pass.", ["not-just-but:block"]],
      ["The deletion is proposed, not automated.", ["not-just-but:block"]],
      ["For 92EL, that means renting Microsoft's services, not running servers.", ["not-just-but:block"]],
      ["Edge matters for game servers, not registration.", ["trailing-contrast:warn"]],
      ["Age 18 is the league's own threshold, not a legal one.", ["trailing-contrast:warn"]],
      ["Cloud computing means renting computing over the internet instead of owning it.", ["trailing-contrast:warn"]],
      ["Players never open the lists.", []],
      ["It is not tested at national scale.", []],
      ["Do not invent anything.", []],
      ["Nothing is copied by hand.", []],
      ["Results are checked by a person and not yet automated.", []],
    ];
    for (const [text, expected] of cases) {
      expect(tells(text).filter((t) => t.startsWith("not-just-but") || t.startsWith("trailing-contrast")), text).toEqual(expected);
    }
  });

  it("reports the verbless pairs from 92EL deliverables for review, and passes the plain copy beside them", () => {
    const pairs = (text: string): string[] =>
      applyHouseGate(checkCopy([{ path: "content/x.md", text }])).findings
        .filter((f) => f.tell === "parallel-pair")
        .map((f) => f.severity);
    for (const text of [
      "# One form, seven workflows",
      "Same site, same £8,000.",
      "Pay per user, per month",
      "Service account, match-day reminders, analytics.",
    ]) {
      expect(pairs(text), text).toEqual(["warn"]);
    }
    for (const text of [
      "Forms, SharePoint, Outlook and Teams",
      "One form and seven workflows replace 92EL's spreadsheets and email chains.",
      "PulseCloud Technologies, for 92EL senior management",
      "41 of 50 passed, 12 after a fix.",
      "Pay monthly for each user",
    ]) {
      expect(pairs(text), text).toEqual([]);
    }
  });

  it("reports the absolute negation fragments from a 92EL deck for review, and passes plain negation, citations and form answers", () => {
    const absolutes = (path: string, text: string): string[] =>
      applyHouseGate(checkCopy([{ path, text }])).findings
        .filter((f) => f.tell === "absolute-negation")
        .map((f) => `${f.severity}:${f.message}`);
    for (const [text, fragment] of [
      ["A guardian consents by email; never pre-ticked", "never pre-ticked"],
      ["Pay per user per month; no servers", "no servers"],
      ["Microsoft runs it: nothing to buy or run.", "nothing to buy or run"],
      ["Nothing on-site to join", "Nothing on-site to join"],
      ["Each player is checked once, no duplicates.", "no duplicates"],
    ]) {
      expect(absolutes("content/deck.md", text), text).toEqual([`warn:"${fragment}"`]);
    }
    for (const [path, text] of [
      ["content/report.md", "Children's data needs a lawful basis (ICO, no date)."],
      ["content/report.md", "Information Commissioner's Office (ICO), no date. Children and the UK GDPR."],
      ["content/form.md", "Is the player under 18?\n\n- Yes\n- No"],
      ["app/form.tsx", `export const options = ["Yes", "No"];`],
      ["content/report.md", "Players never open the lists."],
      ["content/report.md", "Nothing is copied by hand."],
    ]) {
      expect(absolutes(path, text), text).toEqual([]);
    }
  });

  it("does not block the en dash ranges it says are correct", () => {
    expect(blocks("Open Monday–Saturday, 9am–5pm.")).toBe(false);
  });

  it("writes up every copy tell, so a new one cannot ship undocumented", () => {
    for (const tell of CATALOGUE.filter((t) => t.surface === "copy")) {
      if (HOUSE[tell.id]?.tier === "block") continue; // described in prose in the blocking tier
      expect(COPY, tell.id).toContain(`\`${tell.id}\``);
    }
  });

  it("does not use em dashes in its own prose", () => {
    expect(COPY).not.toContain("—");
  });
});
