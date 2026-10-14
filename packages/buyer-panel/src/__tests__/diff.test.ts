import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Panel } from "../config.js";
import { acceptMatches, diffRuns, parseMatches, type ProposedMatch } from "../diff.js";
import type { Cluster } from "../evaluate.js";
import type { RunReport } from "../report.js";

// The matcher's answer is scripted: what the model proposes is the input, the diff's rules are under test.
const proposal = vi.hoisted(() => ({ pairs: [] as unknown[] }));
vi.mock("../model.js", async (orig) => ({
  ...(await orig<typeof import("../model.js")>()),
  callForTool: async (_c: unknown, _b: unknown, _t: unknown, _u: unknown, validate: (input: unknown) => unknown) => validate(proposal),
}));

// Cluster keys from the MMM live run (20261014-2026-10-14T0808) and the redesign run (a5312e7d-2026-10-14T0819).
const before = ["opening-hours-buried-in-footer", "deposit-payment-terms-not-shown-before-checkout", "cancellation-policy-not-mentioned", "gift-card-square-page-loses-salon-context", "removal-add-on-vs-combined-service-inconsistency", "builder-gel-price-missing-from-qualifier", "hero-headline-no-service-names"];
const after = ["opening-hours-not-surfaced-in-journey", "deposit-requirement-not-surfaced-early", "about-page-address-hours-below-fold-mobile", "prices-page-no-inline-prices", "removal-newset-price-format-inconsistency", "mobile-nav-menu-links-unclickable"];

const m = (b: string, a: string, confidence: ProposedMatch["confidence"], reason = "same defect"): ProposedMatch => ({ before: b, after: a, confidence, reason });

/** What Sonnet 4.6 proposed on 14 October 2026, plus the confidence the new prompt asks for. */
const sonnet14Oct: ProposedMatch[] = [
  m("opening-hours-buried-in-footer", "opening-hours-not-surfaced-in-journey", "high"),
  m("deposit-payment-terms-not-shown-before-checkout", "deposit-requirement-not-surfaced-early", "high"),
  m("cancellation-policy-not-mentioned", "about-page-address-hours-below-fold-mobile", "low", "Both concern information buyers look for before booking."),
  m("gift-card-square-page-loses-salon-context", "prices-page-no-inline-prices", "low", "Both are pages where context is missing."),
  m("removal-add-on-vs-combined-service-inconsistency", "removal-newset-price-format-inconsistency", "medium"),
  m("builder-gel-price-missing-from-qualifier", "removal-newset-price-format-inconsistency", "medium"),
];

describe("acceptMatches", () => {
  const keysA = new Set(before);
  const keysB = new Set(after);

  it("drops the unrelated pairs of 14 October when the matcher marks them low", () => {
    const { accepted, rejected } = acceptMatches(sonnet14Oct, keysA, keysB);
    const pairs = accepted.map((x) => `${x.before} -> ${x.after}`);
    expect(pairs).toContain("opening-hours-buried-in-footer -> opening-hours-not-surfaced-in-journey");
    expect(pairs).toContain("deposit-payment-terms-not-shown-before-checkout -> deposit-requirement-not-surfaced-early");
    expect(pairs).not.toContain("cancellation-policy-not-mentioned -> about-page-address-hours-below-fold-mobile");
    expect(pairs).not.toContain("gift-card-square-page-loses-salon-context -> prices-page-no-inline-prices");
    expect(rejected.filter((r) => r.why === "low confidence").map((r) => r.before)).toEqual(["cancellation-policy-not-mentioned", "gift-card-square-page-loses-salon-context"]);
  });

  it("never matches a later key twice: a tie keeps neither", () => {
    const { accepted, rejected } = acceptMatches(sonnet14Oct, keysA, keysB);
    expect(accepted.filter((x) => x.after === "removal-newset-price-format-inconsistency")).toHaveLength(0);
    expect(rejected.filter((r) => r.after === "removal-newset-price-format-inconsistency").map((r) => r.why)).toEqual([
      "removal-newset-price-format-inconsistency was matched 2 times with equal confidence",
      "removal-newset-price-format-inconsistency was matched 2 times with equal confidence",
    ]);
    expect(accepted).toHaveLength(2);
  });

  it("keeps the most confident pair when a key is matched twice", () => {
    const { accepted, rejected } = acceptMatches(
      [m("removal-add-on-vs-combined-service-inconsistency", "removal-newset-price-format-inconsistency", "high"), m("builder-gel-price-missing-from-qualifier", "removal-newset-price-format-inconsistency", "medium")],
      keysA,
      keysB,
    );
    expect(accepted.map((x) => x.before)).toEqual(["removal-add-on-vs-combined-service-inconsistency"]);
    expect(rejected[0]!.why).toMatch(/matched more confidently elsewhere/);
  });

  it("is one to one on the earlier side too", () => {
    const { accepted } = acceptMatches([m("hero-headline-no-service-names", "opening-hours-not-surfaced-in-journey", "medium"), m("hero-headline-no-service-names", "mobile-nav-menu-links-unclickable", "medium")], keysA, keysB);
    expect(accepted).toHaveLength(0);
  });

  it("rejects keys that are in neither run, and counts a repeated identical pair once", () => {
    const { accepted, rejected } = acceptMatches([m("made-up", "prices-page-no-inline-prices", "high"), m("hero-headline-no-service-names", "made-up", "high"), m("opening-hours-buried-in-footer", "opening-hours-not-surfaced-in-journey", "high"), m("opening-hours-buried-in-footer", "opening-hours-not-surfaced-in-journey", "high")], keysA, keysB);
    expect(accepted).toHaveLength(1);
    expect(rejected.map((r) => r.why)).toEqual(["no cluster made-up in the earlier run", "no cluster made-up in the later run"]);
  });
});

describe("parseMatches", () => {
  it("needs a reason and a confidence for every pair", () => {
    expect(() => parseMatches({ pairs: [{ before: "a", after: "b" }] })).toThrow(/reason/);
    expect(() => parseMatches({ pairs: [{ before: "a", after: "b", reason: "x", confidence: "sure" }] })).toThrow(/confidence/);
    expect(parseMatches({ pairs: [{ before: "a", after: "b", reason: " x ", confidence: "medium" }] })).toEqual([{ before: "a", after: "b", reason: "x", confidence: "medium" }]);
  });
});

describe("diffRuns", () => {
  const cluster = (key: string): Cluster => ({ key, title: key.replace(/-/g, " "), summary: "", category: "other", severity: "medium", members: ["s#1"], reproduces: true, why: "" });
  const report = (runId: string, version: string, keys: string[], model: string): RunReport =>
    ({ meta: { runId, version, evaluator: { model, temperature: 0 } }, sessions: [], grades: [], clusters: keys.map(cluster), findings: [], dropped: [] }) as unknown as RunReport;

  it("reports the 14 October pairs as gone and new, not persisting, and lists why", async () => {
    const root = mkdtempSync(join(tmpdir(), "buyer-panel-diff-"));
    const dirA = join(root, "a");
    const dirB = join(root, "b");
    for (const [d, r] of [
      [dirA, report("20261014-2026-10-14T0808", "20261014", before, "eu.anthropic.claude-sonnet-4-6")],
      [dirB, report("a5312e7d-2026-10-14T0819", "a5312e7d-442c", after, "eu.anthropic.claude-sonnet-4-6")],
    ] as const) {
      mkdirSync(d);
      writeFileSync(join(d, "report.json"), JSON.stringify(r));
    }
    proposal.pairs = sonnet14Oct;
    const panel = { evaluator: { provider: "bedrock", model: "eu.anthropic.claude-sonnet-4-6", temperature: 0 } } as Panel;
    const d = await diffRuns(panel, dirA, dirB);
    expect(d.persisting.map((p) => p.after)).toEqual(["opening-hours-not-surfaced-in-journey", "deposit-requirement-not-surfaced-early"]);
    expect(d.gone.map((c) => c.key)).toContain("cancellation-policy-not-mentioned");
    expect(d.added.map((c) => c.key)).toEqual(["about-page-address-hours-below-fold-mobile", "prices-page-no-inline-prices", "removal-newset-price-format-inconsistency", "mobile-nav-menu-links-unclickable"]);
    expect(d.rejected).toHaveLength(4);
    const md = readFileSync(join(dirB, "diff-20261014-2026-10-14T0808.md"), "utf8");
    expect(md).toContain("## Persisting (2)");
    expect(md).toContain("Matched by eu.anthropic.claude-sonnet-4-6 at temperature 0");
    expect(md).toContain("## Matches not accepted (4)");
  });
});
