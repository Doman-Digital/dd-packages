import { describe, expect, it } from "vitest";
import { findClaims, formatClaims, namedSources } from "../character/claims.js";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../character/cli.js";

const claimsIn = (text: string) => findClaims([{ path: "content/a.md", text }]).claims;

describe("the claims list", () => {
  it("lists a price with no source as unsourced, on its own line", () => {
    const report = findClaims([{ path: "content/a.md", text: "# Pricing\n\nA freelancer charges £300 to £1,000 for a small site.\n" }]);
    expect(report.claims).toHaveLength(1);
    expect(report.claims[0]).toMatchObject({ line: 3, sources: [] });
    expect(report.claims[0].facts.map((f) => f.value)).toEqual(["£300", "£1,000"]);
    expect(report.unsourced).toBe(1);
  });

  it("finds the named source however the sentence credits it", () => {
    expect(namedSources("According to Bark, a small site costs £300.")).toEqual(["Bark"]);
    expect(namedSources("Akamai’s 2017 retail study found a 21.8% drop.")).toContain("Akamai");
    expect(namedSources("In a 2020 study by Deloitte, speed lifted sales.")).toContain("Deloitte");
    expect(namedSources("Google also reported that 53% of visits are abandoned.")).toEqual(["Google"]);
    expect(namedSources("Shopify UK currently advertises Basic at £19.")).toEqual(["Shopify UK"]);
    expect(namedSources("The fee is 2% ([Shopify pricing](https://www.shopify.com/uk/pricing)).")).toContain("https://www.shopify.com/uk/pricing");
    expect(namedSources("Payments cost 2.1% + 20p (source: Wix Help Centre).")).toEqual(["Wix Help Centre"]);
    expect(namedSources("Bark’s UK guide puts a small site at £2,000.")).toContain("Bark");
    expect(namedSources("In a 2020 Deloitte study, speed lifted sales.")).toContain("Deloitte");
    expect(namedSources("Wix’s own developer guidelines leave pricing to each app.")).toContain("Wix");
  });

  it("does not take a pronoun or an opening word for a source", () => {
    expect(namedSources("We found 40% of enquiries came by phone.")).toEqual([]);
    expect(namedSources("Public performance research backs the principle.")).toEqual([]);
    expect(namedSources("Sometimes the site is the bottleneck.")).toEqual([]);
    expect(namedSources("Research shows 70% of buyers compare three quotes.")).toEqual([]);
    // Not in any stoplist: caught only because it opens the sentence with no possessive.
    expect(namedSources("Local search data puts mobile at 60% of visits.")).toEqual([]);
    expect(namedSources("Mobile research suggests the same.")).toEqual([]);
    expect(namedSources("Add JSON-LD data to every location page.")).toEqual([]);
    expect(namedSources("2. **Enter your website URL** and click Analyse.")).toEqual([]);
    expect(namedSources("| Website audit | Review every page | Practice owner |")).toEqual([]);
    expect(namedSources("Publish your menu with clear GBP pricing.")).toEqual([]);
    expect(namedSources("When someone in Manchester visits your site, a UK server answers.")).toEqual([]);
    expect(namedSources("Businesses with consistent NAP data are 40% more likely to rank.")).toEqual([]);
    expect(namedSources("Test variations; A/B shows emojis lift replies by 15%.")).toEqual([]);
    expect(namedSources("Responding shows Google your profile is managed.")).toEqual([]);
    expect(namedSources("Keep a way to verify again (via video verification).")).toEqual([]);
    expect(namedSources("USP: Fixed-price quotes, 24/7 call-outs.")).toEqual([]);
    expect(namedSources("**Action:** Use Google Search Console data to find gaps.")).toEqual([]);
  });

  it("keeps a decimal price in one sentence", () => {
    const [claim] = claimsIn("GoDaddy UK advertises plans from £7.99 a month. The domain is free.");
    expect(claim.sentence).toBe("GoDaddy UK advertises plans from £7.99 a month.");
    expect(claim.sources).toEqual(["GoDaddy UK"]);
  });

  it("lists a named source with no figure: an attributed claim still needs checking", () => {
    const [claim] = claimsIn("Wix states that Premium plans do not include a business email account.");
    expect(claim).toMatchObject({ sources: ["Wix"], facts: [] });
  });

  it("marks a source named earlier in the paragraph as a hint, and still counts the claim unsourced", () => {
    const report = findClaims([
      { path: "a.md", text: "A Deloitte study found retail sales rose 8.4%. Lead generation fell by almost 2%.\n\nA site costs £500.\n" },
    ]);
    const [first, second, third] = report.claims;
    expect(first.sources).toEqual(["Deloitte"]);
    expect(second).toMatchObject({ sources: [], nearby: ["Deloitte"] });
    expect(third.nearby).toBeUndefined();
    expect(report.unsourced).toBe(2);
  });

  it("reads a footnote as the source, and never lists a heading or a footnote definition", () => {
    const report = findClaims([
      {
        path: "a.md",
        text: "## 10 things to fix in 2026\n\n98% of consumers read reviews.[^1] 42% click the map pack.\n\n[^1]: BrightLocal, Local Consumer Review Survey, 2023.\n",
      },
    ]);
    expect(report.claims.map((c) => c.sentence)).toEqual(["98% of consumers read reviews.", "42% click the map pack."]);
    expect(report.claims[0].sources).toEqual(["BrightLocal, Local Consumer Review Survey, 2023."]);
    expect(report.claims[0].facts.map((f) => f.value)).toEqual(["98%"]);
    expect(report.claims[1]).toMatchObject({ sources: [], nearby: ["BrightLocal, Local Consumer Review Survey, 2023."] });
  });

  it("skips a worked example's premise, list numbering and plain prose", () => {
    expect(claimsIn("Assume a business gets 400 visits a month.")).toEqual([]);
    expect(claimsIn("1. Book a call\n2. Get a plan\n")).toEqual([]);
    expect(claimsIn("We build websites for local trades.")).toEqual([]);
  });

  it("says plainly when there is nothing to check", () => {
    expect(formatClaims(findClaims([{ path: "a.md", text: "We build websites.\n" }]))).toMatch(/no prices, figures, dates or named sources/);
  });
});

describe("craft copy claims", () => {
  it("prints the list and always exits 0: a checklist, not a verdict", () => {
    const dir = mkdtempSync(join(tmpdir(), "claims-"));
    try {
      writeFileSync(join(dir, "a.md"), "A small site costs £300 to £1,000.\n");
      const out: string[] = [];
      const code = run(["copy", "claims", "a.md"], { cwd: dir, out: (t) => out.push(t), err: () => {} });
      expect(code).toBe(0);
      expect(out.join("\n")).toMatch(/1 claim to check, 1 with no source named/);
      expect(out.join("\n")).toMatch(/a\.md:1 +UNSOURCED +£300 · £1,000/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
