import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { run } from "../character/cli.js";
import { assessConfidence, viewportOf } from "../direction/confidence.js";
import { researchPrompt } from "../direction/research.js";
import { CONFIDENCE_LENSES, PROOF_DEPTHS, PROOF_KINDS, VIEWPORTS, type ArtDirection } from "../direction/types.js";
import { validateDirection } from "../direction/validate.js";

const CONTEXTS = ["plumber", "clinic", "salon"] as const;
type Context = (typeof CONTEXTS)[number];
const load = (name: Context): ArtDirection => JSON.parse(readFileSync(new URL(`./fixtures/confidence/${name}.json`, import.meta.url), "utf8"));
const errors = (d: unknown) => validateDirection(d).problems.filter((p) => p.severity === "error");
const page = (d: ArtDirection) => d.hierarchy!.home!;
const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

describe("decision confidence across three businesses", () => {
  it.each(CONTEXTS)("%s is a complete, valid direction", (name) => {
    const report = validateDirection(load(name));
    expect(report.problems.filter((p) => p.severity === "error")).toEqual([]);
    expect(report.layers.complete).toBe(true);
  });

  it("does not give the three businesses the same layout, action or evidence", () => {
    const [plumber, clinic, salon] = CONTEXTS.map((c) => page(load(c)));
    const orders = [plumber, clinic, salon].map((p) => p.order.map((o) => o.role).join(">"));
    expect(new Set(orders).size).toBe(3);
    const actions = [plumber, clinic, salon].map((p) => p.primaryAction.value);
    expect(new Set(actions).size).toBe(3);
    const evidence = [plumber, clinic, salon].map((p) => [...new Set(p.confidence!.proof!.map((x) => x.kind))].sort().join(","));
    expect(new Set(evidence).size).toBe(3);
  });

  it("passes without a slideshow, a visible portrait or an immediate telephone call where the business does not need them", () => {
    for (const name of ["clinic", "salon"] as const) {
      const p = page(load(name));
      expect(p.primaryAction.value, name).not.toMatch(/\b(call|phone|ring|telephone)\b/i);
      expect(p.primaryAction.positions, name).not.toContain("hero");
    }
    // The plumber's visitor has a stopped boiler, so ringing at once is the right ask: the job decides it, not a rule.
    expect(page(load("plumber")).primaryAction.value).toMatch(/call/i);
    // No fixture shows a founder portrait or a slideshow, and none is flagged for lacking one.
    for (const name of CONTEXTS) {
      const d = load(name);
      const text = JSON.stringify(d.hierarchy);
      expect(text, name).not.toMatch(/slideshow|carousel|slider/i);
      for (const proof of page(d).confidence!.proof!) {
        if (proof.kind === "people") expect(proof.what, name).not.toMatch(/\bportrait of\b|\bphoto of\b|\bheadshot/i);
      }
      // Craft's own explanations never ask for one of them.
      for (const f of validateDirection(d).confidence ?? []) expect(f.why, name).not.toMatch(/portrait|slideshow|carousel|telephone|phone number/i);
      expect(errors(d), name).toEqual([]);
    }
  });

  it("a page with no evidence block at all validates and reports as before", () => {
    for (const name of CONTEXTS) {
      const d = load(name);
      delete page(d).confidence;
      const report = validateDirection(d);
      expect(report.problems.filter((p) => p.severity === "error"), name).toEqual([]);
      expect(report.confidence, name).toBeUndefined();
    }
  });

  it("no evidence kind is required: an empty list is valid", () => {
    for (const name of CONTEXTS) {
      const d = load(name);
      page(d).confidence = { examined: ["mobile", "tablet", "desktop"], proof: [] };
      expect(errors(d), name).toEqual([]);
    }
  });
});

describe("observed, inferred and unknown", () => {
  const findings = (d: ArtDirection) => validateDirection(d).confidence ?? [];

  it("says a width was not examined instead of carrying a phone finding to the desktop", () => {
    const f = findings(load("plumber")).filter((x) => x.lens === "mobile");
    expect(f.map((x) => x.basis)).toEqual(["unknown", "unknown"]);
    expect(f.map((x) => x.message).join(" ")).toMatch(/not examined at tablet width/);
    expect(f.map((x) => x.message).join(" ")).toMatch(/not examined at desktop width/);
    expect(f.every((x) => x.message.includes("mobile") && !x.message.includes("not examined on a phone"))).toBe(true);
  });

  it("asks for a phone check when only the desktop was looked at", () => {
    const d = load("plumber");
    page(d).confidence!.examined = ["desktop"];
    const f = findings(d).filter((x) => x.lens === "mobile");
    expect(f.some((x) => /not examined on a phone/.test(x.message))).toBe(true);
  });

  it("marks evidence nothing shows exists as unknown, never as a verified fact", () => {
    const f = findings(load("clinic")).filter((x) => x.lens === "evidence" && x.basis === "unknown");
    expect(f).toHaveLength(1);
    expect(f[0].at).toBe("hierarchy.home.confidence.proof[3].evidence");
    expect(f[0].why).toMatch(/Confirm it with the client/);
  });

  it("reads held-back detail as inferred, and calls it a hypothesis", () => {
    const f = findings(load("clinic")).filter((x) => x.lens === "disclosure");
    expect(f).toHaveLength(1);
    expect(f[0].basis).toBe("inferred");
    expect(f[0].why).toMatch(/hypothesis, not a rule/);
  });

  it("observes evidence placed in a section the declared order does not have", () => {
    const d = load("salon");
    page(d).confidence!.proof![0].position = "faq";
    const f = findings(d).filter((x) => x.basis === "observed");
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ lens: "hierarchy", at: "hierarchy.home.confidence.proof[0].position" });
  });

  it("observes an ask whose position is not in the order", () => {
    const d = load("salon");
    page(d).primaryAction.positions = ["header", "pricing"];
    expect(findings(d).some((x) => x.lens === "action" && x.basis === "observed")).toBe(true);
  });

  it("reports an objection no decision on the page names, as unknown", () => {
    const d = load("plumber");
    d.job!.objections!.push("whether the quote includes the parking permit");
    const f = findings(d).filter((x) => x.lens === "relevance");
    expect(f).toHaveLength(1);
    expect(f[0].basis).toBe("unknown");
    expect(f[0].why).toMatch(/can miss an answer that uses other words/);
  });

  it("uses only the vocabulary the guidance names, and makes no score or conversion claim", () => {
    for (const name of CONTEXTS) {
      for (const f of findings(load(name))) {
        expect(CONFIDENCE_LENSES).toContain(f.lens);
        expect(["observed", "inferred", "unknown"]).toContain(f.basis);
        expect(`${f.message} ${f.why}`).not.toMatch(/\bconver(t|sion)|\bscore|\d+ ?%|will (increase|improve|boost)/i);
      }
    }
  });

  it("assesses nothing for pages without a block or a hierarchy at all", () => {
    expect(assessConfidence(undefined, undefined)).toEqual([]);
    expect(assessConfidence({ home: { order: [] } }, undefined)).toEqual([]);
  });

  it("reads a width band from a pixel width", () => {
    expect([320, 767, 768, 1023, 1024, 1920].map(viewportOf)).toEqual(["mobile", "mobile", "tablet", "tablet", "desktop", "desktop"]);
  });
});

describe("the reason rule applies to evidence", () => {
  const bad = (because: string) => {
    const d = load("plumber");
    page(d).confidence!.proof![0].because = because;
    return errors(d).filter((p) => p.at === "hierarchy.home.confidence.proof[0].because");
  };

  it.each([
    "Social proof builds trust with visitors on every website.",
    "Visitors expect to see this before they decide, as best practice.",
    "A strong first impression matters.",
  ])("rejects a default reason: %s", (because) => expect(bad(because)).not.toEqual([]));

  it("accepts a reason that names this visitor's worry", () => {
    expect(bad("The visitor wants to see the actual work before letting a stranger into the house.")).toEqual([]);
  });

  it("rejects an unknown kind, depth, position, width and a vague description", () => {
    const d = load("plumber");
    const c = page(d).confidence!;
    Object.assign(c.proof![0], { kind: "awards", depth: "later", position: "sidebar", what: "proof" });
    (c as { examined: unknown }).examined = ["watch"];
    const at = errors(d).map((p) => p.at);
    for (const want of ["kind", "depth", "position", "what"]) expect(at).toContain(`hierarchy.home.confidence.proof[0].${want}`);
    expect(at).toContain("hierarchy.home.confidence.examined");
  });

  it("ignores unknown page keys and malformed blocks without throwing", () => {
    const d = load("plumber") as unknown as { hierarchy: Record<string, unknown> };
    d.hierarchy.unknownPage = { confidence: 5 };
    expect(() => validateDirection(d)).not.toThrow();
    (d.hierarchy.home as { confidence: unknown }).confidence = "yes";
    expect(errors(d).some((p) => p.at === "hierarchy.home.confidence")).toBe(true);
  });
});

describe("guidance and schema", () => {
  const schema = JSON.parse(readFileSync(new URL("../../art-direction.schema.json", import.meta.url), "utf8"));

  it("the schema names the same kinds, depths and widths as the code", () => {
    expect(schema.$defs.proofItem.properties.kind.enum).toEqual([...PROOF_KINDS]);
    expect(schema.$defs.proofItem.properties.depth.enum).toEqual([...PROOF_DEPTHS]);
    expect(schema.$defs.page.properties.confidence.properties.examined.items.enum).toEqual([...VIEWPORTS]);
  });

  it("the schema does not require a confidence block", () => {
    expect(schema.$defs.page.required ?? []).not.toContain("confidence");
  });

  it("the research prompt asks about context, settling evidence and the next step without assuming any", () => {
    const prompt = researchPrompt({ brief: load("clinic").brief });
    expect(prompt).toMatch(/Where they look/);
    expect(prompt).toMatch(/What would settle it/);
    expect(prompt).toMatch(/do not assume all of them matter/);
    expect(prompt).toMatch(/ring, book, send an enquiry, ask for a quotation, look further first/);
  });

  it("the CLI prints the findings with why they matter, and a count that says it is not a score", async () => {
    const dir = mkdtempSync(join(tmpdir(), "craft-confidence-"));
    dirs.push(dir);
    writeFileSync(join(dir, "d.json"), JSON.stringify(load("clinic")));
    const out: string[] = [];
    expect(await run(["direction", "validate", "--direction", "d.json"], { cwd: dir, out: (s) => out.push(s), err: () => {} })).toBe(0);
    const text = out.join("\n");
    expect(text).toMatch(/unknown\s+evidence/);
    expect(text).toMatch(/inferred\s+disclosure/);
    expect(text).toMatch(/why it matters:/);
    expect(text).toMatch(/Decision confidence: .*none of them a score/);
    const json: string[] = [];
    await run(["direction", "validate", "--direction", "d.json", "--json"], { cwd: dir, out: (s) => json.push(s), err: () => {} });
    expect(JSON.parse(json.at(-1)!).confidence.length).toBeGreaterThan(0);
  });
});
