import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { run } from "../character/cli.js";
import { checkReason } from "../direction/reason.js";
import { researchPrompt } from "../direction/research.js";
import type { ArtDirection } from "../direction/types.js";
import { validateDirection } from "../direction/validate.js";
import { compareDirections, summariseDirection } from "../estate/direction.js";
import { emptyEstate, estatePairs } from "../estate/index.js";
import { makeSnapshot } from "../snapshot/fixture.js";
import type { SectionRole } from "../snapshot/types.js";

const good = (): ArtDirection => JSON.parse(readFileSync(new URL("./fixtures/direction-v2.json", import.meta.url), "utf8"));
const problems = (d: unknown) => validateDirection(d).problems.filter((p) => p.severity === "error");
const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

describe("direction version 2", () => {
  it("accepts a conventional hierarchy, multiple CTA positions and all three layers", () => {
    const report = validateDirection(good());
    expect(report.problems.filter((p) => p.severity === "error")).toEqual([]);
    expect(report.layers).toMatchObject({ job: true, hierarchy: [{ page: "home", decided: 4, total: 4 }], tokens: { decided: 5 }, complete: true });
  });

  it.each(["electrician website", "a local electrician site"])("rejects category job %s", (object) => {
    const d = good();
    d.job!.statement.object = object;
    expect(problems(d).some((p) => p.at === "job.statement.object")).toBe(true);
  });

  it.each([
    "The layout follows an industry standard because it always works well.",
    "The layout follows a familiar structure so visitors feel comfortable.",
    "Most electrician sites use this order so visitors recognise it immediately.",
    "This structure is intuitive and follows best practice for any business.",
    "Users are used to this order so we keep it as usual.",
    "This is what visitors expect from a conventional electrician website.",
    "The content should be arranged to help people find what they need.",
  ])("rejects default or untied reason: %s", (because) => {
    const d = good();
    d.hierarchy!.home!.lead.because = because;
    expect(problems(d).some((p) => p.at === "hierarchy.home.lead.because")).toBe(true);
  });

  it("requires the action reason to name consideration or an objection", () => {
    const d = good();
    d.hierarchy!.home!.primaryAction.because = "The socket appears in the page text and the action sits below it.";
    expect(problems(d).some((p) => p.at === "hierarchy.home.primaryAction.because")).toBe(true);
  });

  it("a hierarchy reason from this client cannot decide another client's fields", () => {
    const d = good();
    const other = structuredClone(d.job!);
    other.statement = { verb: "choose", object: "a wedding cake for a large reception", context: "six months before the celebration with dietary requirements" };
    other.functional.value = "Compare cake flavours and sizes for guests with dietary requirements.";
    other.emotional.value = "Feel confident the wedding cake arrives before the reception starts.";
    other.social.value = "Include relatives whose dietary requirements rule out ordinary cake recipes.";
    other.objections = ["cake cannot accommodate guests with allergies"];
    other.language = ["Can you make a gluten free cake for eighty guests?"];
    const h = d.hierarchy!.home!;
    for (const [field, because] of [
      ["primaryAction", h.primaryAction.because], ["order", h.order[0].because],
      ["lead", h.lead.because], ["journey", h.journey[0].because],
    ]) {
      expect(checkReason({ at: field, because, sources: d.sources, tie: "job", job: other }), field).not.toEqual([]);
    }
  });

  it("accepts an unrelated trade reference and rejects the client's category", () => {
    const d = good();
    d.sources.push({ id: "reference", kind: "reference", category: "bakery", note: "Copper lettering from a bakery's physical bread packaging." });
    expect(problems(d)).toEqual([]);
    d.sources.at(-1)!.category = "electrician";
    expect(problems(d).some((p) => p.at === "sources[2].category")).toBe(true);
    d.sources.at(-1)!.category = "print";
    d.sources.at(-1)!.note = "The competitor's website provided the source for this decision.";
    expect(problems(d).some((p) => p.at === "sources[2]")).toBe(true);
  });

  it("checks customer quotes against notes or readable source text", () => {
    const d = good();
    d.job!.language = ["Invented customer quote about a fuse board"];
    expect(validateDirection(d).problems.some((p) => p.at === "job.language[0]" && p.severity === "warn")).toBe(true);
    expect(validateDirection(d, { readSource: () => "Invented customer quote about a fuse board" }).problems.some((p) => p.at === "job.language[0]")).toBe(false);
    d.job!.functional.evidence = ["van"];
    expect(problems(d).some((p) => p.at === "job.functional.evidence")).toBe(true);
  });

  it("keeps v1 valid with a warning but requires v2 layers", () => {
    const d = good();
    d.version = 1;
    delete d.job;
    delete d.hierarchy;
    expect(validateDirection(d)).toMatchObject({ valid: true, layers: { complete: false } });
    expect(validateDirection(d).problems.some((p) => p.at === "version" && p.severity === "warn")).toBe(true);
    d.version = 2;
    expect(validateDirection(d).valid).toBe(false);
  });

  it("reports malformed source data instead of throwing", () => {
    const d = good();
    expect(validateDirection({ ...d, sources: [null, { ...d.sources[0], colours: 4 }] }).valid).toBe(false);
    expect(validateDirection({ ...d, brief: 12 }).valid).toBe(false);
    expect(validateDirection({ ...d, hierarchy: { home: { ...d.hierarchy!.home!, order: [null, null] } } }, { estate: [{ id: "other", direction: summariseDirection(d) }] }).valid).toBe(false);
  });

  it("checks the requested page, and strict turns order drift into an error", () => {
    const d = good();
    d.hierarchy!.service = structuredClone(d.hierarchy!.home!);
    const snap = makeSnapshot();
    const roles: SectionRole[] = ["hero", "footer-cta", "pricing"];
    snap.sections = snap.sections.slice(0, 3).map((s, i) => ({ ...s, role: roles[i] }));
    expect(validateDirection(d, { snapshot: snap, page: "service" }).problems).toEqual(expect.arrayContaining([expect.objectContaining({ at: "hierarchy.service.order", severity: "warn" })]));
    expect(validateDirection(d, { snapshot: snap, page: "service", strict: true }).valid).toBe(false);
    delete d.hierarchy!.service;
    expect(validateDirection(d, { snapshot: snap, page: "service", strict: true }).valid).toBe(false);
  });
});

describe("declared estate and CLI", () => {
  it("names shared colours and order, while distinct directions remain separate", () => {
    const a = summariseDirection(good());
    expect(compareDirections(a, a)).toMatchObject({ flagged: true, accentDelta: 0, groundDelta: 0, orderDistance: 0 });
    expect(compareDirections(a, a).shared.join(" ")).toMatch(/accent.*ground.*section order/);
    expect(compareDirections(a, { accent: "#124bcc", ground: "#111111", shape: "pill", order: ["team", "contact"] }).flagged).toBe(false);
    const d = good();
    expect(validateDirection(d, { estate: [{ id: "sibling", direction: a }] }).problems.some((p) => /close to sibling/.test(p.message))).toBe(true);
    expect(validateDirection(d, { estate: [{ id: "self", direction: a }], estateId: "self" }).problems.some((p) => /close to/.test(p.message))).toBe(false);
  });

  it("registers two directions before build, compares them, and later adds a snapshot", async () => {
    const dir = mkdtempSync(join(tmpdir(), "craft-v2-"));
    dirs.push(dir);
    const out: string[] = [], err: string[] = [];
    const io = { cwd: dir, out: (s: string) => out.push(s), err: (s: string) => err.push(s) };
    const d = good();
    writeFileSync(join(dir, "direction.json"), JSON.stringify(d));
    expect(await run(["direction", "validate", "--direction", "direction.json", "--json"], io)).toBe(0);
    expect(JSON.parse(out.at(-1)!).layers.complete).toBe(true);
    for (const id of ["one", "two"]) expect(await run(["estate", "add", "--id", id, "--direction", "direction.json"], io), err.join("\n")).toBe(0);
    const saved = JSON.parse(readFileSync(join(dir, "estate.json"), "utf8"));
    expect(saved.sites[0].fingerprint).toBeUndefined();
    expect(estatePairs(saved)).toEqual([]);
    expect(await run(["estate", "compare", "one"], io)).toBe(2);
    expect(await run(["estate", "compare", "--directions", "--strict"], io)).toBe(0);
    expect(out.join("\n")).toMatch(/one \+ two.*accent.*ground.*section order/);
    writeFileSync(join(dir, "snap.json"), JSON.stringify(makeSnapshot()));
    expect(await run(["estate", "add", "snap.json", "--id", "one"], io)).toBe(0);
    const built = JSON.parse(readFileSync(join(dir, "estate.json"), "utf8"));
    expect(built.sites[0].fingerprint).toBeDefined();
    expect(built.sites[0].direction).toEqual(saved.sites[0].direction);
    expect(await run(["estate", "compare", "--component", "pricing"], io)).toBe(0);
    expect(emptyEstate().sites).toEqual([]);
  });

  it("research prints job questions and an explicit category ban", async () => {
    const brief = good().brief;
    const prompt = researchPrompt({ brief });
    expect(prompt).toMatch(/Do not describe, list, rank or summarise what electrician websites look like/);
    expect(prompt).toMatch(/Consideration/);
    expect(prompt).not.toContain("# Visual references");
    expect(researchPrompt({ brief, visual: true })).toContain("# Visual references, from outside the category");
    const out: string[] = [];
    expect(await run(["direction", "research", "--brief", brief], { cwd: tmpdir(), out: (s) => out.push(s), err: () => {} })).toBe(0);
    expect(out[0]).toContain("Do not suggest colours");
  });
});
