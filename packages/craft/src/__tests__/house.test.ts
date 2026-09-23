import { describe, expect, it } from "vitest";
import { CATALOGUE } from "../character/check.js";
import { HOUSE, houseRule } from "../character/house.js";

describe("the house copy policy", () => {
  it("names only copy tells that exist", () => {
    const copy = new Set(CATALOGUE.filter((t) => t.surface === "copy").map((t) => t.id));
    for (const id of Object.keys(HOUSE)) expect(copy.has(id), id).toBe(true);
  });

  it("gives every copy tell a tier, so a new tell is placed deliberately", () => {
    for (const t of CATALOGUE.filter((c) => c.surface === "copy")) expect(HOUSE[t.id], t.id).toBeDefined();
  });

  it("treats an unknown tell as review, so a newer craft never breaks a commit", () => {
    expect(houseRule("a-tell-from-the-future").tier).toBe("review");
  });

  it("does not use em dashes in its own labels", () => {
    for (const [id, rule] of Object.entries(HOUSE)) expect(rule.label, id).not.toContain("—");
  });
});
