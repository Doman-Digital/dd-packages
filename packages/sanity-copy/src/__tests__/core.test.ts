import { describe, expect, it } from "vitest";
import { checkDocumentCopy, collectCopy, describeFinding, pathToString } from "../core.js";
import { type RuleLike, withCopyCheck } from "../schema.js";

const homepage = {
  _id: "homepage",
  _type: "homepage",
  slug: { _type: "slug", current: "seamless-home" },
  heroTitle: "Websites for local businesses — built to be found",
  heroImage: { _type: "image", asset: { _ref: "image-abc" }, alt: "A studio desk" },
  ctaUrl: "https://example.com/seamless-booking",
  variant: "dark-seamless",
  painPointCards: [
    { _key: "pp-1", _type: "card", title: "No proof", body: "Visitors cannot see who you have worked for." },
    { _key: "pp-2", _type: "card", title: "Slow pages", body: "Most people leave a page that takes more than three seconds." },
  ],
  body: [
    { _key: "b1", _type: "block", style: "h2", children: [{ _type: "span", text: "How we work" }] },
    { _key: "b2", _type: "block", style: "normal", children: [{ _type: "span", text: "It's not just a website, " }, { _type: "span", text: "it's a growth engine." }] },
  ],
};

describe("collecting copy", () => {
  it("reads strings, Portable Text and alt text, and skips slugs, links, enums and asset references", () => {
    const paths = collectCopy(homepage).map((p) => pathToString(p.path));
    expect(paths).toContain("heroTitle");
    expect(paths).toContain('painPointCards[_key=="pp-1"].title');
    expect(paths).toContain('body[_key=="b2"]');
    expect(paths).toContain("heroImage.alt");
    for (const skipped of ["slug", "ctaUrl", "variant", "heroImage.asset"]) expect(paths.some((p) => p.startsWith(skipped))).toBe(false);
  });

  it("joins the spans of a block, so a template split across spans is one sentence", () => {
    const block = collectCopy(homepage).find((p) => pathToString(p.path) === 'body[_key=="b2"]');
    expect(block?.text).toBe("It's not just a website, it's a growth engine.");
  });

  it("writes a heading block as Markdown, so heading tells can see it", () => {
    expect(collectCopy(homepage).find((p) => pathToString(p.path) === 'body[_key=="b1"]')?.text).toBe("## How we work");
  });
});

describe("checking a document", () => {
  const findings = checkDocumentCopy(homepage);
  const at = (path: string) => findings.filter((f) => pathToString(f.path) === path).map((f) => f.tell);

  it("puts each finding on the field that caused it", () => {
    expect(at("heroTitle")).toContain("em-dash");
    expect(at('painPointCards[_key=="pp-1"].title')).toContain("no-x-badge");
    expect(at('body[_key=="b2"]')).toContain("not-just-but");
  });

  it("marks the blocking tier as a house rule", () => {
    const dash = findings.find((f) => f.tell === "em-dash")!;
    expect(dash.tier).toBe("block");
    expect(describeFinding(dash)).toMatch(/^House rule \(Em dash\)/);
  });

  it("never reads a word inside a slug, a link or an enum", () => {
    expect(findings.some((f) => f.message.toLowerCase().includes("seamless"))).toBe(false);
  });

  it("stays quiet on clean copy", () => {
    expect(checkDocumentCopy({ _type: "service", title: "Gel nails that last three weeks", body: "Book online in a minute." })).toEqual([]);
  });

  it("never checks a person's own words", () => {
    expect(checkDocumentCopy({ _type: "testimonial", quote: "Genuinely seamless — loved it ✨" })).toEqual([]);
  });

  it("finds a ChatGPT citation run pasted into a field, invisible characters and all", () => {
    const doc = { _type: "resourceArticle", bodyMarkdown: "Fees vary by plan. citeturn11search1turn10view0\n" };
    expect(checkDocumentCopy(doc).filter((f) => f.tell === "chatbot-residue")).toHaveLength(1);
  });

  it("can report the blocking tier alone", () => {
    const blockOnly = checkDocumentCopy({ _type: "page", title: "Elevate your look — today" }, { review: false });
    expect(blockOnly.map((f) => f.tell)).toEqual(["em-dash"]);
  });
});

describe("withCopyCheck", () => {
  /** A stand-in for Sanity's Rule: records what was asked of it. */
  function fakeRule(): RuleLike & { fn?: (v: unknown) => unknown; level?: string } {
    const rule: RuleLike & { fn?: (v: unknown) => unknown; level?: string } = {
      custom(fn) {
        rule.fn = fn as (v: unknown) => unknown;
        return rule;
      },
      warning() {
        rule.level = "warning";
        return rule;
      },
    };
    return rule;
  }

  const types = [
    { name: "homepage", type: "document", validation: () => "existing" },
    { name: "testimonial", type: "document" },
    { name: "card", type: "object" },
  ];
  const wrapped = withCopyCheck(types);

  it("adds the check to document types as a warning, keeping their own validation", () => {
    const rule = fakeRule();
    const result = (wrapped[0].validation as unknown as (r: RuleLike) => unknown[])(rule);
    expect(result[0]).toBe("existing");
    expect(rule.level).toBe("warning");
    const messages = rule.fn!(homepage) as { message: string; path: unknown[] }[];
    expect(messages.find((m) => m.path[0] === "heroTitle")?.message).toMatch(/Em dash/);
  });

  it("returns true for clean copy, so the Studio shows nothing", () => {
    const rule = fakeRule();
    (wrapped[0].validation as unknown as (r: RuleLike) => unknown)(rule);
    expect(rule.fn!({ _type: "homepage", heroTitle: "Websites for local businesses" })).toBe(true);
  });

  it("leaves excluded document types and object types alone", () => {
    expect(wrapped[1]).toBe(types[1]);
    expect(wrapped[2]).toBe(types[2]);
  });
});
