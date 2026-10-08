import { describe, expect, it } from "vitest";
import { classifyEntry, parseBriefingBlock, resolveRef } from "../classify";
import { briefingBlock, entry, REPO } from "./helpers";

describe("rules", () => {
  it("a line ending in a question is an approval candidate", () => {
    const c = classifyEntry(entry(1, "Add the gift page", "Would you like the gift page to go live before Christmas?"));
    expect(c).toMatchObject({ bucket: "needs-you", approvalCandidate: true, rule: "asks the client" });
  });

  it.each([
    "Six pages are ready. Please check you are happy with these six pages being shared.",
    "The new date is ready. Please confirm it.",
    "The emails are designed. Please approve each one.",
    "Your emails carry the new look. Nothing is sent until you have read and approved each one.",
    "Sales stay closed until you confirm the date.",
  ])("asks the client: %s", (line) => {
    expect(classifyEntry(entry(2, "Some change", line)).bucket).toBe("needs-you");
  });

  it("a chore(deps) security bump is a security change, not maintenance", () => {
    const c = classifyEntry(entry(3, "chore(deps): pnpm 10.34.5 (security), root and astro/"));
    expect(c).toMatchObject({ bucket: "live", kind: "security", rule: "dependency security update" });
    expect(classifyEntry(entry(4, "chore(deps): update dependency postcss to v8.5.23 [security]")).kind).toBe("security");
  });

  it.each(["chore: adopt the rulebook", "ci: run all checks in one job", "docs: bring the README up to date", "test: cover the form", "build: resolve the package from npm", "chore(guards): take the contrast maths from craft"])(
    "%s is maintenance",
    (title) => {
      const c = classifyEntry(entry(5, title, "A line the client would read."));
      expect(c).toMatchObject({ bucket: "maintenance", kind: "maintenance" });
    },
  );

  it('"not live yet" and "switch over" are ready, not live', () => {
    expect(classifyEntry(entry(6, "Astro port", "Your website has a faster version. It is not live yet.")).bucket).toBe("ready");
    expect(classifyEntry(entry(7, "Port", "We will switch over only when you're happy.")).bucket).toBe("ready");
    expect(classifyEntry(entry(8, "feat(astro): email", "The new version will send emails too. Nothing changes on the live site yet.")).bucket).toBe("ready");
  });

  it("monitoring settings and housekeeping are maintenance even with a client line", () => {
    expect(classifyEntry(entry(9, "fix: point sentry source maps at the org", "We updated your site's error monitoring settings.")).bucket).toBe("maintenance");
    expect(classifyEntry(entry(10, "Ignore env and token files", "A small housekeeping change that stops password files being saved.")).bucket).toBe("maintenance");
  });

  it("kinds: security, then privacy, then visible, then other", () => {
    expect(classifyEntry(entry(11, "fix(deps): update next", "This is a security update to the software.")).kind).toBe("security");
    expect(classifyEntry(entry(12, "Web analytics behind consent", "If a visitor accepts analytics, your site measures page views without cookies.")).kind).toBe("privacy");
    expect(classifyEntry(entry(13, "perf: planner intro desktop-only", "Phones load your home page faster.")).kind).toBe("visible");
    expect(classifyEntry(entry(14, "Daily reminder for orders", "Each morning you'll get one email listing orders waiting to be paid.")).kind).toBe("other");
  });

  it("an entry with no line is maintenance, and flagged as missing unless the author said none", () => {
    expect(classifyEntry(entry(15, "feat(studio): standalone Studio"))).toMatchObject({ bucket: "maintenance", missingLine: true, rule: "no client line" }); // copy-ok: rule name
    expect(classifyEntry(entry(16, "fix(preorder): long names", "none"))).toMatchObject({ bucket: "maintenance", missingLine: false });
  });

  it("falls back to a did-log note when the PR has no line, and records that", () => {
    const e = entry(17, "perf: intro desktop-only");
    const c = classifyEntry(e, { [`${REPO}#17`]: "Phones and tablets now load your home page much faster." });
    expect(c).toMatchObject({ bucket: "live", kind: "visible", textSource: "note" });
    expect(classifyEntry(e, { [`${REPO}#17`]: "none" }).bucket).toBe("maintenance");
  });
});

describe("the ## Briefing block", () => {
  it("parses kind, supersedes, title, outcome and image, and stops at the next heading", () => {
    const block = parseBriefingBlock(
      briefingBlock("kind: visible\nsupersedes: #44, other/repo#9\ntitle: Your site runs on a faster setup\noutcome: Pages open quickly on phones.\nimage: https://img.example/a.png | The home page on a phone"),
    );
    expect(block).toEqual({
      bucket: "live",
      kind: "visible",
      supersedes: ["#44", "other/repo#9"],
      title: "Your site runs on a faster setup",
      outcome: "Pages open quickly on phones.",
      image: { url: "https://img.example/a.png", alt: "The home page on a phone" },
    });
  });

  it("is absent without the heading", () => {
    expect(parseBriefingBlock("## Summary\nkind: visible")).toBeUndefined();
    expect(parseBriefingBlock(undefined)).toBeUndefined();
  });

  it("refuses an unknown kind and an image without alt text", () => {
    expect(() => parseBriefingBlock(briefingBlock("kind: visable"))).toThrow(/Unknown Briefing kind/);
    expect(() => parseBriefingBlock(briefingBlock("image: https://img.example/a.png"))).toThrow(/alt text/);
  });

  it("overrides the rules: a chore that switched the live site becomes a visible change", () => {
    const e = entry(63, "chore(astro): serve production from www", null, { body: briefingBlock("kind: visible\nsupersedes: #44\ntitle: Your site now runs on a faster setup") });
    const c = classifyEntry(e);
    expect(c).toMatchObject({ bucket: "live", kind: "visible", rule: "## Briefing block", title: "Your site now runs on a faster setup", supersedes: [`${REPO}#44`] });
  });

  it("can send something to maintenance or to needs-you", () => {
    expect(classifyEntry(entry(20, "feat: new page", "A new page.", { body: briefingBlock("kind: maintenance") })).bucket).toBe("maintenance");
    expect(classifyEntry(entry(21, "feat: new page", "A new page.", { body: briefingBlock("kind: needs-you") })).bucket).toBe("needs-you");
  });

  it("the block's outcome replaces the PR line as the client text", () => {
    const c = classifyEntry(entry(22, "fix(deps): next", "This is a security update to the framework.", { body: briefingBlock("outcome: We applied a security patch.") }));
    expect(c).toMatchObject({ text: "We applied a security patch.", textSource: "block", kind: "security" });
  });
});

it("resolves short refs against the entry's repo", () => {
  expect(resolveRef("#44", "a/b")).toBe("a/b#44");
  expect(resolveRef("44", "a/b")).toBe("a/b#44");
  expect(resolveRef("c/d#1", "a/b")).toBe("c/d#1");
});
