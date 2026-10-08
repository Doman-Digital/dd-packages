import { describe, expect, it } from "vitest";
import { classifyEntries } from "../classify";
import { dedupe, similarity } from "../dedupe";
import { briefingBlock, entry, REPO } from "./helpers";

const run = (...entries: Parameters<typeof classifyEntries>[0]) => dedupe(classifyEntries(entries));

describe("duplicate merge", () => {
  it("two security updates in one period become one item", () => {
    const { groups, supersessions } = run(
      entry(56, "fix(deps): update next to 15.5.27", "This is a security update to the software the site runs on."),
      entry(61, "chore(deps): pnpm 10.34.5 (security)"),
    );
    const live = groups.filter((g) => g.bucket === "live");
    expect(live).toHaveLength(1);
    expect(live[0]!.members.map((m) => m.entry.number)).toEqual([56, 61]);
    // The later entry leads; its missing line is filled from the earlier one.
    expect(live[0]!.id).toBe(`${REPO}#61`);
    expect(live[0]!.text).toBe("This is a security update to the software the site runs on.");
    expect(supersessions).toContainEqual(expect.objectContaining({ reason: "security updates in one period are one item" }));
  });

  it("the same change described twice merges", () => {
    const { groups } = run(
      entry(1, "Gift page", "Your gift page now shows wrapping options at checkout."),
      entry(2, "Gift page copy", "Your gift page now shows wrapping options at checkout, with prices."),
    );
    expect(groups).toHaveLength(1);
  });

  it("different changes stay apart", () => {
    const { groups } = run(entry(1, "Gift page", "Your gift page shows wrapping options."), entry(2, "Contact form", "Your contact form asks for a phone number."));
    expect(groups).toHaveLength(2);
    expect(similarity("Your gift page shows wrapping options.", "Your contact form asks for a phone number.")).toBeLessThan(0.5);
  });
});

describe("supersession keeps the latest only", () => {
  it("a moved date replaces the earlier one, and the chain is kept for the log", () => {
    const { groups, supersessions, unresolved } = run(
      entry(45, "Launch worker: move the sales floor", "The date the planner can go on sale has moved to Wednesday 18 November. Sales stay closed until you confirm the date."),
      entry(50, "Move email", "Your emails now carry your look."),
      entry(54, "Move the launch", "The planner's on-sale date moves from 18 November to Wednesday 13 January 2027. Your launch emails now carry the new date."),
    );
    const launch = groups.find((g) => g.members.some((m) => m.entry.number === 45))!;
    expect(launch.members.map((m) => m.entry.number)).toEqual([45, 54]);
    expect(launch.id).toBe(`${REPO}#54`);
    expect(launch.text).toContain("13 January 2027");
    expect(launch.approvalCandidate).toBe(true);
    expect(supersessions).toContainEqual({ ref: `${REPO}#45`, by: `${REPO}#54`, reason: "date moved", from: "18 November", to: "Wednesday 13 January 2027" });
    expect(unresolved).toEqual([]);
  });

  it("an explicit supersedes in a ## Briefing block replaces the earlier entry", () => {
    const { groups, supersessions } = run(
      entry(44, "Astro port", "Your website has a faster version. It is not live yet."),
      entry(63, "chore(astro): serve production", null, { body: briefingBlock("kind: visible\nsupersedes: #44\ntitle: Your site now runs on a faster setup") }),
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ id: `${REPO}#63`, bucket: "live", kind: "visible", title: "Your site now runs on a faster setup" });
    expect(supersessions).toContainEqual({ ref: `${REPO}#44`, by: `${REPO}#63`, reason: "named in the ## Briefing block" });
  });

  it("supersedes naming an entry outside the period is unresolved", () => {
    const { unresolved, groups } = run(entry(70, "Launch", "Launch moved.", { body: briefingBlock("supersedes: #12") }));
    expect(unresolved[0]!.refs).toEqual([`${REPO}#70`, `${REPO}#12`]);
    expect(groups[0]!.supersedesOutside).toEqual([`${REPO}#12`]);
  });

  it("two dates in one group with no move between them are unresolved", () => {
    const { unresolved } = run(
      entry(1, "Gift page", "Your gift page opens on 18 November with wrapping options at checkout."),
      entry(2, "Gift page", "Your gift page opens on 2 December with wrapping options at checkout."),
    );
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0]!.message).toMatch(/none says which replaced which/);
  });
});
