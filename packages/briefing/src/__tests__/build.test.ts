import { describe, expect, it } from "vitest";
import { BriefingBuildError, buildBriefing, MAX_APPROVALS } from "../build";
import { BriefingLintError } from "../lint";
import { sha256Hex } from "../hash";
import { SECURITY_FALLBACK } from "../rank";
import type { ClientConfig, RawInput } from "../types";
import { approval, briefingBlock, config, entry, fixture, input, privateFixture } from "./helpers";

describe("hand-written fields", () => {
  it("fails on an empty headline", () => {
    expect(() => buildBriefing(input(), config({ headline: "  " }))).toThrow(BriefingBuildError);
    expect(() => buildBriefing(input(), config({ headline: "" }))).toThrow(/headline is hand-written/);
  });

  it("fails on an empty personal note", () => {
    expect(() => buildBriefing(input(), config({ note: "" }))).toThrow(/note is hand-written/);
  });

  it("uses them as written", () => {
    const { briefing } = buildBriefing(input(), config());
    expect(briefing.headline).toBe(config().headline);
    expect(briefing.note).toBe(config().note);
  });
});

describe("approvals", () => {
  const asks = [
    entry(1, "Sample pages", "Six pages are ready. Please check you are happy with these six pages being shared."),
    entry(2, "Emails", "Your emails carry the new look. Nothing is sent until you have read and approved each one."),
  ];
  const withApprovals = (n: number) =>
    config({
      headline: "Two quick decisions this fortnight: your sample pages and your emails.",
      approvals: [approval("sample-pages", "Approve the six sample pages", ["#1"]), approval("emails", "Read your launch emails", ["#2"]), approval("third", "Choose a photo"), approval("fourth", "Pick a colour")].slice(0, n),
    });

  it("any approval forces attention, and needs you renders straight after the status", () => {
    const { briefing } = buildBriefing(input({ entries: asks }), withApprovals(2));
    expect(briefing.status).toBe("attention");
    expect(briefing.statusLabel).toBe("2 things need you");
    expect(briefing.sections.slice(0, 2)).toEqual(["status", "needs-you"]);
    expect(briefing.preheader.startsWith("2 things need you.")).toBe(true);
  });

  it("the entries an approval stands for become the card, not changes", () => {
    const { briefing, log } = buildBriefing(input({ entries: asks }), withApprovals(2));
    expect(briefing.changes).toEqual([]);
    expect(log.entries.map((e) => e.shownAs)).toEqual(["approval", "approval"]);
  });

  it("each approval carries a content hash, so a link knows what the client saw", () => {
    const { briefing } = buildBriefing(input({ entries: asks }), withApprovals(2));
    expect(briefing.approvals[0]!.version).toBe(sha256Hex("sample-pages content v1"));
  });

  it(`shows at most ${MAX_APPROVALS}; the rest are flagged to go as their own email`, () => {
    const { briefing, flags } = buildBriefing(input({ entries: asks }), withApprovals(4));
    expect(briefing.approvals).toHaveLength(3);
    expect(flags).toContainEqual(expect.objectContaining({ code: "approvals-over-cap", message: expect.stringContaining("fourth") }));
  });

  it("an entry that asks the client with no approval standing for it is held and flagged", () => {
    const { flags, log } = buildBriefing(input({ entries: asks }), withApprovals(1));
    expect(flags).toContainEqual(expect.objectContaining({ code: "unmatched-approval", refs: ["example/site#2"] }));
    expect(log.entries[1]!.shownAs).toBe("held");
  });

  it("no approvals and no failures is all good", () => {
    const { briefing } = buildBriefing(input(), config());
    expect(briefing).toMatchObject({ status: "ok", statusLabel: "All good" });
    expect(briefing.sections).toEqual(["status", "health", "note"]);
  });

  it("a failed check is an issue and is flagged", () => {
    const { briefing, flags } = buildBriefing(input({ uptime: { intervalSeconds: 300, incidents: [{ startedAt: "2026-10-01T10:00:00Z", resolvedAt: "2026-10-01T10:04:00Z" }] } }), config());
    expect(briefing.status).toBe("issue");
    expect(flags).toContainEqual(expect.objectContaining({ code: "failed-checks" }));
  });
});

describe("changes", () => {
  it("collapses maintenance into a count and keeps the overflow in the log", () => {
    const entries = [
      entry(1, "chore: tidy", "none"),
      entry(2, "feat(studio): standalone Studio"),
      entry(3, "perf: home", "Phones open your home page faster."),
      entry(4, "feat: gallery", "Visitors see a gallery of your photographs."),
      entry(5, "feat: form", "Your contact form asks for a phone number."),
      entry(6, "feat: footer", "Your footer shows opening times."),
    ];
    const { briefing, log, flags } = buildBriefing(input({ entries }), config({ headline: "Your new gallery of photographs went live." }));
    expect(briefing.changes).toHaveLength(3);
    expect(briefing).toMatchObject({ maintenanceCount: 2, moreChangesCount: 1, maintenanceLine: "Plus 1 more change and 2 maintenance tasks behind the scenes." });
    expect(log.entries.filter((e) => e.shownAs === "overflow")).toHaveLength(1);
    expect(flags).toContainEqual(expect.objectContaining({ code: "missing-client-line", refs: ["example/site#2"] }));
  });

  it("supersession keeps the latest only", () => {
    const entries = [
      entry(1, "Gift page", "Your gift page opens on 18 November."),
      entry(2, "Gift page", "Your gift page shows wrapping options.", { body: briefingBlock("supersedes: #1\ntitle: Your gift page shows wrapping options") }),
    ];
    const { briefing, log } = buildBriefing(input({ entries }), config({ headline: "Your gift page shows wrapping options." }));
    expect(briefing.changes.map((c) => c.title)).toEqual(["Your gift page shows wrapping options"]);
    expect(log.entries[0]).toMatchObject({ shownAs: "superseded", groupedInto: "example/site#2" });
    expect(log.supersessions).toHaveLength(1);
  });

  it("feature image only when the top change is visible and has one", () => {
    const image = "image: https://img.example/a.png | The gift page on a phone";
    const top = entry(1, "feat: gift page", "Your gift page shows wrapping options.", { body: briefingBlock(`kind: visible\n${image}`) });
    expect(buildBriefing(input({ entries: [top] }), config({ headline: "Your gift page shows wrapping options." })).briefing.featureImage).toEqual({ url: "https://img.example/a.png", alt: "The gift page on a phone" });
    const later = entry(2, "perf: menu", "Phones open your menu faster.");
    expect(buildBriefing(input({ entries: [top, later] }), config({ headline: "Phones open your menu faster." })).briefing.featureImage).toBeUndefined();
  });

  it("a line taken from the did-log, not the author, is flagged for review", () => {
    const e = entry(9, "perf: home");
    const { flags } = buildBriefing(input({ entries: [e], notes: { "example/site#9": "Phones open your home page faster." } }), config({ headline: "Phones open your home page faster." }));
    expect(flags).toContainEqual(expect.objectContaining({ code: "unreviewed-line", refs: ["example/site#9"] }));
  });
});

describe("launch", () => {
  const launchConfig = (state: "proposed" | "confirmed"): ClientConfig =>
    config({
      headline: "Please confirm Wednesday 13 January for your launch.",
      launch: { date: "2027-01-13", state, milestones: [{ label: "Launch emails designed", status: "ready" }] },
    });

  it("proposed: awaiting confirmation, no countdown, flagged", () => {
    const { briefing, flags } = buildBriefing(input(), launchConfig("proposed"));
    expect(briefing.launch).toMatchObject({ pill: "Awaiting your confirmation", line: "The countdown starts once you confirm." });
    expect(briefing.launch!.daysLeft).toBeUndefined();
    expect(flags).toContainEqual(expect.objectContaining({ code: "launch-proposed" }));
  });

  it("confirmed: a countdown from the send date", () => {
    const { briefing, flags } = buildBriefing(input(), launchConfig("confirmed"));
    expect(briefing.launch!.daysLeft).toBe(94);
    expect(flags.map((f) => f.code)).not.toContain("launch-proposed");
  });

  it("flags a config date that disagrees with the entries' latest move", () => {
    const set = entry(1, "Set the launch", "The on-sale date is Wednesday 13 January. Please confirm it.");
    const moved = entry(2, "Move the launch", "The on-sale date moves from 13 January to Wednesday 20 January 2027. Please confirm it.");
    const cfg = { ...launchConfig("proposed"), approvals: [approval("launch-date", "Confirm your on-sale date", ["#1", "#2"])] };
    const { flags } = buildBriefing(input({ entries: [set, moved] }), cfg);
    expect(flags).toContainEqual(expect.objectContaining({ code: "launch-date-mismatch", refs: ["example/site#2"] }));
  });
});

describe("the copy gate fails the build", () => {
  it("on a planted banned phrase, and passes once it is fixed", () => {
    const planted = [entry(1, "perf: home", "Pages open with almost no waiting.")];
    expect(() => buildBriefing(input({ entries: planted }), config({ headline: "Pages open faster on phones." }))).toThrow(BriefingLintError);
    const fixed = [entry(1, "perf: home", "Pages open in about a second on phones.")];
    expect(() => buildBriefing(input({ entries: fixed }), config({ headline: "Pages open faster on phones." }))).not.toThrow();
  });

  it("on two dates for one event, and passes once only the latest is shown", () => {
    const launch = { date: "2027-01-13", state: "proposed" as const, milestones: [] };
    const two = config({ headline: "Please confirm Wednesday 13 January for your launch.", note: "Sales open on 18 November, as planned.", launch });
    try {
      buildBriefing(input(), two);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(BriefingLintError);
      expect((e as BriefingLintError).findings).toContainEqual(expect.objectContaining({ rule: "two-dates", field: "note", match: "18 November" }));
    }
    expect(() => buildBriefing(input(), { ...two, note: "Sales open on 13 January, once you confirm." })).not.toThrow();
  });
});

/** The real fortnight, 27 September to 10 October 2026, redacted. */
describe("the fortnight fixture", () => {
  it("the raw entries alone, with no ## Briefing blocks, build: the security bump takes the house sentence, not the author's jargon", () => {
    const f = fixture();
    for (const e of f.input.entries) delete e.body;
    const { briefing } = buildBriefing(f.input, f.config);
    const security = briefing.changes.find((c) => c.kind === "security");
    expect(security).toMatchObject({ title: SECURITY_FALLBACK.title, outcome: SECURITY_FALLBACK.outcome });
    expect(JSON.stringify(briefing)).not.toMatch(/framework/i);
  });

  it("builds clean, with the founder's flags", () => {
    const f = fixture();
    const { flags } = buildBriefing(f.input, f.config);
    expect(flags.map((x) => x.code).sort()).toEqual(["excluded-query", "launch-proposed", "tracking-check"]);
  });

  it("keeps the latest of each superseded or merged entry, with the chain in the log", () => {
    const f = fixture();
    const { log } = buildBriefing(f.input, f.config);
    const chain = log.supersessions.map((s) => [s.ref.split("#")[1], s.by.split("#")[1], s.reason]);
    expect(chain).toEqual(
      expect.arrayContaining([
        ["44", "63", "named in the ## Briefing block"],
        ["45", "54", "date moved"],
        ["56", "61", expect.stringMatching(/^security/)],
      ]),
    );
    expect(log.entries).toHaveLength(f.input.entries.length);
    expect(log.excludedQueries).toEqual(["domandigital.co.uk"]);
  });

  /**
   * Structural match with the hand-built first briefing (DOM-562, saved
   * 8 October 2026 20:03 UTC). Two known differences, on purpose:
   *  - its behind-the-scenes line counts 19 smaller changes; the package counts
   *    2 more changes and 14 maintenance tasks, and the overflow is in the log;
   *  - its #63 outcome said "almost no waiting" and its uptime small print said
   *    "no downtime was logged", which the copy gate refuses; the fixture's
   *    ## Briefing block says what does happen instead.
   */
  it("matches the hand-built briefing's structure", () => {
    const f = fixture() as ReturnType<typeof fixture> & { expected: Expected };
    const x = f.expected;
    const { briefing: b } = buildBriefing(f.input, f.config);
    expect(b.statusLabel).toBe(x.statusLabel);
    expect(b.sections).toEqual(x.sections);
    expect(b.approvals.map((a) => a.title)).toEqual(x.approvals);
    expect(b.launch).toMatchObject({ state: x.launch.state, dateLong: x.launch.dateLong, pill: x.launch.pill, line: x.launch.line });
    expect(b.launch!.milestones.map((m) => [m.label, m.status])).toEqual(x.launch.milestones);
    expect(b.changes.map((c) => c.title)).toEqual(x.changes);
    expect(b.featureImage ?? null).toEqual(x.featureImage);
    expect(b.health.uptime).toMatchObject(x.uptime);
    expect(b.health.speed).toMatchObject(x.speed);
    expect(b.health.search).toMatchObject(x.search);
    expect(b.health.visits ?? null).toEqual(x.visits);
    expect(b.maintenanceLine).toBe("Plus 2 more changes and 14 maintenance tasks behind the scenes.");
  });

  it("runs on the private, unredacted copy when BRIEFING_PRIVATE_FIXTURE is set", async () => {
    const p = await privateFixture();
    if (!p) return;
    const { briefing, flags } = buildBriefing(p.input as RawInput, p.config as ClientConfig);
    expect(briefing.status).toBe("attention");
    expect(briefing.approvals).toHaveLength(3);
    expect(flags.map((x) => x.code)).toContain("launch-proposed");
  });
});

type Expected = {
  statusLabel: string;
  sections: string[];
  approvals: string[];
  launch: { state: string; dateLong: string; pill: string; line: string; milestones: [string, string][] };
  changes: string[];
  featureImage: null;
  uptime: { passed: number; total: number; summary: string };
  speed: { median: number; bandLine: string };
  search: { state: string; sentence: string };
  visits: null;
};
