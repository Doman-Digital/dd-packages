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
