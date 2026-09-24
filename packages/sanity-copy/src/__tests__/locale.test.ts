import { describe, expect, it } from "vitest";
import { checkDocumentCopy, collectCopy, pathToString } from "../core.js";
import { type RuleLike, copyCheckRule, withCopyCheck, withCopyGuard } from "../schema.js";

// Copy that fails the house rules in English, and a French line that the
// English rules have no business reading.
const EN = "We leverage seamless solutions — built to be found";
const FR = "Nous tirons parti de solutions fluides — conçues pour être trouvées";

const paths = (doc: unknown, languages?: string[]) =>
  collectCopy(doc, languages ? { languages } : {}).map((p) => pathToString(p.path));

describe("languages: internationalized arrays", () => {
  it("v5: reads the language from the item's own `language` field, with a random _key", () => {
    const doc = {
      _type: "page",
      title: [
        { _key: "k8f2a", _type: "internationalizedArrayStringValue", language: "en", value: EN },
        { _key: "q1z9c", _type: "internationalizedArrayStringValue", language: "fr", value: FR },
      ],
    };
    expect(paths(doc, ["en"])).toEqual(['title[_key=="k8f2a"].value']);
    expect(paths(doc)).toEqual(['title[_key=="k8f2a"].value', 'title[_key=="q1z9c"].value']);
  });

  it("v4: falls back to a language _key", () => {
    const doc = {
      _type: "page",
      title: [
        { _key: "en", _type: "internationalizedArrayStringValue", value: EN },
        { _key: "fr", _type: "internationalizedArrayStringValue", value: FR },
      ],
    };
    expect(paths(doc, ["en"])).toEqual(['title[_key=="en"].value']);
  });

  it("does not read an ordinary array item's _key as a language", () => {
    const doc = { _type: "page", cards: [{ _key: "abc", _type: "card", title: EN }] };
    expect(paths(doc, ["en"])).toEqual(['cards[_key=="abc"].title']);
  });

  it("`en` also covers en-GB and en_US", () => {
    const doc = {
      _type: "page",
      title: [
        { _key: "a", _type: "internationalizedArrayStringValue", language: "en-GB", value: EN },
        { _key: "b", _type: "internationalizedArrayStringValue", language: "en_US", value: EN },
        { _key: "c", _type: "internationalizedArrayStringValue", language: "nb_NO", value: FR },
      ],
    };
    expect(paths(doc, ["en"])).toEqual(['title[_key=="a"].value', 'title[_key=="b"].value']);
  });

  it("puts findings only on the language asked for", () => {
    const doc = {
      _type: "page",
      title: [
        { _key: "en", _type: "internationalizedArrayStringValue", value: EN },
        { _key: "fr", _type: "internationalizedArrayStringValue", value: FR },
      ],
    };
    const where = new Set(checkDocumentCopy(doc, { languages: ["en"], review: false }).map((f) => pathToString(f.path)));
    expect(where).toEqual(new Set(['title[_key=="en"].value']));
  });
});

describe("languages: field-level translation objects", () => {
  it("skips object keys in other languages", () => {
    const doc = { _type: "page", body: { en: EN, fr: FR } };
    expect(paths(doc, ["en"])).toEqual(["body.en"]);
    expect(paths(doc)).toEqual(["body.en", "body.fr"]);
  });

  it("reads region tags as languages", () => {
    const doc = { _type: "page", body: { en_GB: EN, nb_NO: FR } };
    expect(paths(doc, ["en"])).toEqual(["body.en_GB"]);
  });

  it("never mistakes ordinary short field names for languages", () => {
    const doc = { _type: "page", cta: { label: EN }, hero: { h1: EN, to: EN } };
    expect(paths(doc, ["en"])).toEqual(["cta.label", "hero.h1", "hero.to"]);
  });
});

describe("languages: one document per language", () => {
  it("skips a whole document in another language", () => {
    expect(paths({ _type: "page", language: "fr", title: FR }, ["en"])).toEqual([]);
    expect(checkDocumentCopy({ _type: "page", language: "fr", title: FR }, { languages: ["en"] })).toEqual([]);
  });

  it("checks a document in a listed language, and never reads the language field", () => {
    expect(paths({ _type: "page", language: "en", title: EN }, ["en"])).toEqual(["title"]);
  });
});

describe("skip lists", () => {
  it("never reads language or locale fields, or a mixed-case locale tag", () => {
    expect(paths({ _type: "lesson", language: "nb_NO", locale: "en-GB", title: EN })).toEqual(["title"]);
    expect(paths({ _type: "lesson", fallback: "nb_NO", title: EN })).toEqual(["title"]);
  });

  it("excludes AI Assist instruction documents", () => {
    expect(checkDocumentCopy({ _type: "assist.instruction.context", text: "We leverage seamless synergy — always" })).toEqual([]);
  });
});

describe("hidden fields", () => {
  function fakeRule(): RuleLike & { fn?: (v: unknown) => unknown } {
    const rule: RuleLike & { fn?: (v: unknown) => unknown } = {
      custom(fn) {
        rule.fn = fn as (v: unknown) => unknown;
        return rule;
      },
      warning() {
        return rule;
      },
    };
    return rule;
  }

  const types = [
    {
      name: "page",
      type: "document",
      fields: [
        { name: "title", type: "string" },
        { name: "internalNote", type: "text", hidden: true },
        { name: "seo", type: "seoFields" },
        { name: "inline", type: "object", fields: [{ name: "draftCopy", type: "string", hidden: true }] },
        { name: "conditional", type: "string", hidden: () => true },
      ],
    },
    { name: "seoFields", type: "object", fields: [{ name: "note", type: "string", hidden: true }] },
  ];
  const doc = {
    _type: "page",
    title: "Websites for local businesses",
    internalNote: EN,
    seo: { note: EN },
    inline: { draftCopy: EN },
    conditional: EN,
  };

  it("never reads a statically hidden field, inline or through a named object type", () => {
    const rule = fakeRule();
    ((withCopyCheck(types)[0] as { validation?: unknown }).validation as unknown as (r: RuleLike) => unknown)(rule);
    const messages = rule.fn!(doc) as { path: unknown[] }[];
    const fields = new Set(messages.map((m) => String(m.path[0])));
    expect(fields.has("internalNote")).toBe(false);
    expect(fields.has("seo")).toBe(false);
    expect(fields.has("inline")).toBe(false);
  });

  it("still reads a field whose `hidden` is a function: that is decided per document", () => {
    const rule = fakeRule();
    ((withCopyCheck(types)[0] as { validation?: unknown }).validation as unknown as (r: RuleLike) => unknown)(rule);
    const messages = rule.fn!(doc) as { path: unknown[] }[];
    expect(messages.some((m) => m.path[0] === "conditional")).toBe(true);
  });

  it("survives a named type that contains itself", () => {
    const loop = [
      { name: "page", type: "document", fields: [{ name: "tree", type: "node" }] },
      { name: "node", type: "object", fields: [{ name: "child", type: "node" }, { name: "x", type: "string", hidden: true }] },
    ];
    expect(() => withCopyCheck(loop)).not.toThrow();
  });
});

describe("the validation cache", () => {
  it("does not re-run the check when only a non-copy field changes", () => {
    const rule: RuleLike & { fn?: (v: unknown) => unknown } = {
      custom(fn) {
        rule.fn = fn as (v: unknown) => unknown;
        return rule;
      },
      warning() {
        return rule;
      },
    };
    copyCheckRule(rule);
    const first = rule.fn!({ _type: "page", title: EN, ctaUrl: "https://a.example" });
    const second = rule.fn!({ _type: "page", title: EN, ctaUrl: "https://b.example" });
    expect(Array.isArray(first)).toBe(true);
    expect(second).toBe(first);
    const third = rule.fn!({ _type: "page", title: "Websites for local businesses" });
    expect(third).toBe(true);
  });
});

describe("withCopyGuard", () => {
  type Props = { id: string; type: string; draft: Record<string, unknown> | null; published: Record<string, unknown> | null };
  type Description = { label: string; onHandle?: () => void; disabled?: boolean; title?: string };
  // Mirrors Sanity's DocumentActionComponent: `action` is a union of literals,
  // not `string`, which is why withCopyGuard returns the caller's own type.
  type StudioAction = ((props: Props) => Description | null) & {
    action?: "publish" | "delete" | "duplicate";
    displayName?: string;
  };

  let calls = 0;
  const publish: StudioAction = Object.assign(
    (props: Props): Description => {
      calls++;
      return { label: "Publish", disabled: !props.draft };
    },
    { action: "publish" as const, displayName: "PublishAction" },
  );
  const base = { id: "p", type: "page", published: null };

  it("keeps the Studio's action type, so it fits back into the actions array", () => {
    const prev: StudioAction[] = [publish];
    const next: StudioAction[] = prev.map((a) => (a.action === "publish" ? withCopyGuard(a) : a));
    expect(next[0].action).toBe("publish");
    expect(next[0].displayName).toBe("withCopyGuard(PublishAction)");
  });

  it("disables publishing on a house-rule finding and says why", () => {
    const result = withCopyGuard(publish)({ ...base, draft: { _type: "page", title: EN } });
    expect(result?.disabled).toBe(true);
    expect(result?.label).toBe("Publish");
    expect(result?.title).toMatch(/^House rule/);
  });

  it("leaves the action alone on clean copy, and on review-tier findings", () => {
    const clean = withCopyGuard(publish)({ ...base, draft: { _type: "page", title: "Websites for local businesses" } });
    expect(clean).toEqual({ label: "Publish", disabled: false });
  });

  it("always calls the original action first, once per render", () => {
    const guarded = withCopyGuard(publish);
    calls = 0;
    guarded({ ...base, draft: { _type: "page", title: EN } });
    guarded({ ...base, draft: null });
    expect(calls).toBe(2);
  });

  it("never blocks a person's own words", () => {
    const result = withCopyGuard(publish)({ ...base, draft: { _type: "testimonial", quote: EN } });
    expect(result?.disabled).toBe(false);
  });
});
