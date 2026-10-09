import { describe, expect, it } from "vitest";
import {
  computeStatus,
  headlineReferencesApprovals,
  LAUNCH_PROPOSED,
  launchView,
  nothingNeededLine,
  NOTHING_NEEDED,
  preheader,
  statusLabel,
} from "../status";
import type { Approval } from "../types";

const a = (title: string): Approval => ({ id: title, version: "v", title, why: "", review: { label: "Review", url: "https://r.example" } });
const three = [a("Confirm Wednesday 13 January as your on-sale date"), a("Approve the six sample pages"), a("Read your launch emails")];

describe("status", () => {
  it("any approval forces attention", () => {
    expect(computeStatus([a("One")], { failed: 0 })).toBe("attention");
    expect(computeStatus([], { failed: 0 })).toBe("ok");
  });

  it("any failed check is an issue, approvals or not", () => {
    expect(computeStatus([], { failed: 1 })).toBe("issue");
    expect(computeStatus(three, { failed: 2 })).toBe("issue");
  });

  it("labels the pill", () => {
    expect(statusLabel("attention", 3)).toBe("3 things need you");
    expect(statusLabel("attention", 1)).toBe("1 thing needs you");
    expect(statusLabel("ok", 0)).toBe("All good");
    expect(statusLabel("issue", 3)).toBe("Something needs fixing");
  });
});

describe('"Nothing needed from you"', () => {
  it("only with zero approvals", () => {
    expect(nothingNeededLine([])).toBe(NOTHING_NEEDED);
    expect(() => nothingNeededLine(three)).toThrow(/3 approval/);
  });
});

describe("preheader", () => {
  it("leads with the action count when approvals exist", () => {
    expect(preheader("Your faster site is live.", three, "attention")).toBe("3 things need you. Your faster site is live.");
    expect(preheader("Your faster site is live.", [], "ok")).toBe("Your faster site is live.");
  });
});

describe("headline references approvals", () => {
  it.each(["Three quick decisions keep the January launch on track.", "Please confirm your launch date.", "3 things need you this fortnight."])("passes: %s", (h) => {
    expect(headlineReferencesApprovals(h, three)).toBe(true);
  });

  it("fails a headline that ignores waiting approvals", () => {
    expect(headlineReferencesApprovals("Your faster site is live.", three)).toBe(false);
    expect(headlineReferencesApprovals("Your faster site is live.", [])).toBe(true);
  });
});

describe("launch block", () => {
  const milestones = [{ label: "Launch emails designed", status: "ready" as const }];

  it("proposed: date, pill and line, no countdown", () => {
    const l = launchView({ date: "2027-01-13", state: "proposed", milestones }, "2026-10-11T08:00:00Z");
    expect(l).toMatchObject({ dateLong: "Wednesday 13 January", ...LAUNCH_PROPOSED });
    expect(l.daysLeft).toBeUndefined();
  });

  it("confirmed: days left from the send date in London, no pill", () => {
    const l = launchView({ date: "2027-01-13", state: "confirmed", milestones }, "2026-10-11T08:00:00Z");
    expect(l.daysLeft).toBe(94);
    expect(l.pill).toBeUndefined();
    expect(l.line).toBeUndefined();
  });

  it("counts from the London date of the send, not the UTC date", () => {
    // 23:30 UTC on 10 October is 00:30 on 11 October in London (BST).
    expect(launchView({ date: "2026-10-21", state: "confirmed", milestones }, "2026-10-10T23:30:00Z").daysLeft).toBe(10);
    // In winter London is on UTC.
    expect(launchView({ date: "2027-01-13", state: "confirmed", milestones }, "2027-01-03T09:00:00Z").daysLeft).toBe(10);
  });
});
