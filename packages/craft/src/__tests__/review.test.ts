import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { run } from "../character/cli.js";
import { assessReview } from "../direction/review.js";
import { ADDITIONS, CHANGE_CLASSES, CHANGE_STEPS, CONFIDENCE_LENSES, EVIDENCE_KINDS, REVIEW_BASES, VIEWPORTS, type ArtDirection, type DesignReview, type ReviewNote, type ReviewReport, type ReviewResult } from "../direction/types.js";
import { validateDirection } from "../direction/validate.js";

const fixture = <T>(name: string): T => JSON.parse(readFileSync(new URL(`./fixtures/confidence/${name}.json`, import.meta.url), "utf8"));
const direction = (name: string) => fixture<ArtDirection>(name);
const calibration = () => assessReview(fixture("calibration-review"), direction("calibration-direction"));
const find = (report: ReviewReport, id: string): ReviewResult => report.results.find((r) => r.id === id)!;
const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

/** A sound note to bend one rule at a time. */
const IMPACT = "A homeowner with a stopped boiler cannot see who is coming into the house until well down the page.";
const note = (over: Partial<ReviewNote> = {}): ReviewNote => ({
  id: "n",
  lens: "identity",
  observation: "The owner appears too far down the page.",
  raisedBy: "Page review",
  basis: "observed",
  evidence: [{ kind: "screenshot", ref: "captures/home-375.png", viewport: "mobile" }],
  impact: IMPACT,
  recommend: {
    class: "confirmed-correction",
    change: "show the owner's name beside the first call button",
    step: "trust-placement",
    because: "The visitor's worry is who is coming into the house, so a name answers it where the call is first offered.",
    whyEnough: "A name beside the call answers the worry, and the rest of the page can stay where it is.",
  },
  ...over,
});
const review = (...notes: ReviewNote[]): DesignReview => ({ version: 1, subject: "test page", notes });
const assess = (...notes: ReviewNote[]) => assessReview(review(...notes), direction("calibration-direction"));
const only = (...notes: ReviewNote[]) => assess(...notes).results[0];
const errorsOf = (report: ReviewReport) => report.problems.filter((p) => p.severity === "error");

describe("the calibration case from a real plumbing review, as a pattern and not a rule", () => {
  it("is valid, and separates what was said from what is recommended", () => {
    const report = calibration();
    expect(errorsOf(report)).toEqual([]);
    expect(report.results.map((r) => r.id)).toEqual(["owner-late", "credibility-late", "hero-slideshow", "captions", "services-order", "personality", "desktop-claim"]);
  });

  it("1. finds the owner met late when the job worries about who is coming, and answers with a name and a line", () => {
    const finding = validateDirection(direction("calibration-direction")).confidence!.find((f) => f.lens === "identity")!;
    expect(finding.basis).toBe("inferred");
    expect(finding.message).toMatch(/who the visitor would deal with.*"team", after 4 other sections/);
    expect(finding.why).toMatch(/not the whole biography moved up/);
    const owner = find(calibration(), "owner-late");
    expect(owner.outcome).toBe("change");
    expect(owner.recommend.effective).toBe("confirmed-correction");
    expect(owner.recommend.step).toBe("trust-placement");
  });

  it("2. does not ask for a biography under every hero", () => {
    // None of the three business fixtures is flagged, and the late-owner finding needs the worry in the job.
    for (const name of ["plumber", "clinic", "salon"]) {
      expect(validateDirection(direction(name)).confidence?.filter((f) => f.lens === "identity") ?? [], name).toEqual([]);
    }
    // A clinic that meets its practitioner late is not told to move them: its job has no such worry.
    const late = direction("clinic");
    const proof = late.hierarchy!.home!.confidence!.proof!;
    const person = proof.find((p) => p.kind === "people");
    if (person) person.position = late.hierarchy!.home!.order.at(-1)!.role;
    expect(validateDirection(late).confidence?.filter((f) => f.lens === "identity") ?? []).toEqual([]);
    // And a person in the hero never raises it, whatever the job.
    const early = direction("calibration-direction");
    early.hierarchy!.home!.confidence!.proof!.find((p) => p.kind === "people")!.position = "hero";
    expect(validateDirection(early).confidence?.filter((f) => f.lens === "identity") ?? []).toEqual([]);
  });

  it("the suggested solution is judged apart from the problem: right problem, larger solution than needed", () => {
    const owner = find(calibration(), "owner-late");
    expect(owner.basis.effective).toBe("observed");
    expect(owner.suggested!.standing).toBe("narrower-change-preferred");
    expect(owner.suggested!.reasons.join(" ")).toMatch(/smaller step/);
  });

  it("3. does not recommend a second carousel when the page already has a gallery", () => {
    const slideshow = find(calibration(), "hero-slideshow");
    expect(slideshow.suggested!.standing).toBe("not-supported");
    expect(slideshow.suggested!.reasons.join(" ")).toMatch(/already has "swipeable gallery of finished jobs/);
    expect(slideshow.outcome).toBe("no-change");
    // The gallery is also found in the direction's own evidence, without the note saying so.
    const bare = only(note({ basis: "inferred", evidence: [{ kind: "audit", ref: "audit", viewport: "mobile" }], suggested: { change: "a hero slideshow", step: "new-component", adds: ["carousel"] }, recommend: { class: "no-change" } as ReviewNote["recommend"] }));
    expect(bare.suggested!.reasons.join(" ")).toMatch(/already has "a swipeable gallery of finished jobs/);
  });

  it("4. does not penalise concise, useful captions", () => {
    const captions = find(calibration(), "captions");
    expect(captions.suggested!.standing).toBe("not-supported");
    expect(captions.suggested!.reasons.join(" ")).toMatch(/Useful detail stays/);
    expect(captions.outcome).toBe("no-change");
    expect(captions.basis.effective).toBe("preference");
  });

  it("a reasoned order is not overridden by a preference", () => {
    const services = find(calibration(), "services-order");
    expect(services.suggested!.standing).toBe("not-supported");
    expect(services.suggested!.reasons.join(" ")).toMatch(/"cards" with a reason/);
    expect(services.outcome).toBe("no-change");
    // The same suggestion supported by something observed is allowed to stand.
    const seen = only(note({ suggested: { change: "move the services below the reviews", step: "relocate", touches: "cards" } }));
    expect(seen.suggested!.standing).not.toBe("not-supported");
  });

  it("brings credibility earlier only as a hypothesis, with a way to check it", () => {
    const credibility = find(calibration(), "credibility-late");
    expect(credibility.basis).toEqual({ declared: "inferred", effective: "inferred" });
    expect(credibility.recommend.effective).toBe("design-hypothesis");
    expect(credibility.outcome).toBe("change");
  });

  it("does not add decoration to manufacture personality, and does not write the owner's voice for him", () => {
    const personality = find(calibration(), "personality");
    expect(personality.suggested!.standing).toBe("narrower-change-preferred");
    expect(personality.recommend.step).toBe("copy");
    expect(personality.outcome).toBe("hold");
    expect(personality.outstanding).toEqual(["the owner's own account of how he works, in his words"]);
  });

  it("9. keeps the desktop unknown when only the phone was looked at", () => {
    const desktop = find(calibration(), "desktop-claim");
    expect(desktop.widths).toEqual({ examined: ["mobile"], claimed: ["mobile"], unknown: ["desktop"] });
    expect(desktop.adjustments.join(" ")).toMatch(/nothing here was looked at on desktop/);
    // The file-level assessment says the same of the other widths.
    const bands = validateDirection(direction("calibration-direction")).confidence!.filter((f) => f.lens === "mobile");
    expect(bands.map((b) => b.basis)).toEqual(["unknown", "unknown"]);
  });
});

describe("evidence, impact and the ceiling on a recommendation", () => {
  it("an audit or a stakeholder alone cannot make a problem observed", () => {
    const r = only(note({ evidence: [{ kind: "audit", ref: "audit", viewport: "mobile" }] }));
    expect(r.basis).toEqual({ declared: "observed", effective: "inferred" });
    expect(r.recommend).toMatchObject({ declared: "confirmed-correction", effective: "design-hypothesis" });
  });

  it("nothing cited reads as unknown, and nothing is recommended until it is established", () => {
    const r = only(note({ evidence: [] }));
    expect(r.basis.effective).toBe("unknown");
    expect(r.outcome).toBe("gather-evidence");
    expect(r.recommend.effective).toBe("no-change");
    expect(only(note({ basis: "unknown", evidence: [], recommend: { class: "no-change" } as ReviewNote["recommend"] })).outcome).toBe("gather-evidence");
  });

  it("a preference supports polish at most, and a taste is not turned into a defect", () => {
    const r = only(note({ basis: "preference", impact: undefined }));
    expect(r.recommend.effective).toBe("optional-refinement");
    expect(r.adjustments.join(" ")).toMatch(/not read as one/);
  });

  it("an observed fact with no visitor impact is polish, not a correction", () => {
    const r = only(note({ impact: undefined }));
    expect(r.basis.effective).toBe("observed");
    expect(r.recommend.effective).toBe("optional-refinement");
  });

  it("a visitor impact that is a preference or says nothing about this job does not count", () => {
    expect(only(note({ impact: "The client wants the owner to appear higher up on the page." })).recommend.effective).toBe("optional-refinement");
    expect(only(note({ impact: "It would look more modern and professional in general." })).recommend.effective).toBe("optional-refinement");
  });

  it("every visitor-facing field a meaningful recommendation needs is present in the result and the note", () => {
    const r = only(note());
    expect(r).toMatchObject({ basis: { effective: "observed" }, recommend: { effective: "confirmed-correction", step: "trust-placement" }, outcome: "change" });
    const n = note();
    expect([n.observation, n.evidence.length, n.impact, n.recommend.change, n.recommend.because, n.recommend.whyEnough].every(Boolean)).toBe(true);
  });
});

describe("minimum effective change", () => {
  it("12. a structural change names the smaller steps and why none was enough", () => {
    const base = note({ recommend: { class: "confirmed-correction", change: "rebuild the page around the owner", step: "restructure", because: "The visitor's worry is who is coming into the house, so the owner leads the page." } });
    const report = assess(base);
    expect(errorsOf(report).map((p) => p.at)).toEqual(["notes[0].recommend.smaller"]);
    const justified = note({
      recommend: {
        ...base.recommend,
        smaller: [{ step: "trust-placement", whyNot: "A name beside the call was tried first, but the owner's account of the work is the evidence this visitor needs." }],
      },
    });
    expect(errorsOf(assess(justified))).toEqual([]);
    expect(only(justified).outcome).toBe("change");
  });

  it("the smaller steps must be on the ladder below the one recommended", () => {
    const wrong = note({
      recommend: {
        class: "confirmed-correction",
        change: "rebuild the page around the owner",
        step: "restructure",
        because: "The visitor's worry is who is coming into the house, so the owner leads the page.",
        smaller: [{ step: "new-component", whyNot: "A new component would add a script that this visitor does not need at all." }],
      },
    });
    expect(errorsOf(assess(wrong)).map((p) => p.at)).toEqual(["notes[0].recommend.smaller[0].step"]);
  });

  it("an addition that costs something needs a reason, even from a small step", () => {
    const adds = note({ recommend: { ...note().recommend, step: "adjust-component", adds: ["animation"], whyEnough: undefined } });
    expect(errorsOf(assess(adds)).map((p) => p.at)).toEqual(["notes[0].recommend.smaller"]);
  });

  it("a small step says why nothing larger is needed", () => {
    const bare = note({ recommend: { ...note().recommend, whyEnough: undefined } });
    expect(errorsOf(assess(bare)).map((p) => p.at)).toEqual(["notes[0].recommend.whyEnough"]);
  });

  it("a structural change resting on a preference is withdrawn, and the existing design stands", () => {
    const r = only(
      note({
        basis: "preference",
        impact: undefined,
        recommend: {
          class: "design-hypothesis",
          change: "rebuild the homepage around a new layout",
          step: "restructure",
          because: "A different layout is possible and the reviewer finds it more engaging for this visitor.",
          validation: "Compare the two layouts with five visitors on a phone.",
          smaller: [{ step: "copy", whyNot: "Rewriting the copy was considered but this reviewer wants a different shape for the page." }],
        },
      }),
    );
    expect(r.recommend.effective).toBe("no-change");
    expect(r.recommend.withdrawn!.join(" ")).toMatch(/A preference does not justify it/);
    expect(r.outcome).toBe("no-change");
  });

  it("a hypothesis says how it would be checked", () => {
    const hypothesis = note({ basis: "inferred", evidence: [{ kind: "audit", ref: "audit", viewport: "mobile" }], recommend: { ...note().recommend, class: "design-hypothesis" } });
    expect(errorsOf(assess(hypothesis)).map((p) => p.at)).toEqual(["notes[0].recommend.validation"]);
  });

  it("a reason that is a preference or the category's default is rejected", () => {
    const bad = note({ recommend: { ...note().recommend, because: "Best practice says the owner should be near the top of the page for everybody." } });
    expect(errorsOf(assess(bad)).map((p) => p.at)).toEqual(["notes[0].recommend.because"]);
  });
});

describe("repetition, similarity and evidence in more than one place", () => {
  it("5. accepts evidence placed in more than one decision context", () => {
    const plumber = direction("plumber");
    const proof = plumber.hierarchy!.home!.confidence!.proof!;
    const before = validateDirection(direction("plumber")).confidence!.length;
    const reviews = proof.find((p) => p.kind === "reviews")!;
    proof.push({ ...reviews, position: "hero", depth: "first-look" });
    const report = validateDirection(plumber);
    expect(report.problems.filter((p) => p.severity === "error")).toEqual([]);
    expect(report.confidence!.length).toBe(before);
  });

  it("6. does not treat repeated content as harmful without an impact, and only removes genuine redundancy", () => {
    const repeated = (over: Partial<ReviewNote>) =>
      note({
        lens: "hierarchy",
        observation: "The same customer quote appears twice on the page.",
        evidence: [{ kind: "content", ref: "two blockquotes with the same text" }],
        recommend: { class: "optional-refinement", change: "remove the second copy of the quote", step: "remove-redundancy", because: "The second copy repeats the first and the visitor reads the same words twice in a row.", whyEnough: "Removing one copy leaves the quote where it first answers the visitor's worry." },
        ...over,
      });
    const harmless = only(repeated({ impact: undefined }));
    expect(harmless.recommend.effective).toBe("no-change");
    expect(harmless.recommend.withdrawn!.join(" ")).toMatch(/nothing observed shows it is redundant/);
    const genuine = only(repeated({ impact: "A homeowner with a stopped boiler scrolling past the same quote twice loses the way to who is coming into the house." }));
    expect(genuine.recommend.effective).toBe("optional-refinement");
    expect(genuine.outcome).toBe("change");
  });

  it("7. does not call visual similarity a defect without a stated cost to the visitor", () => {
    const similar = only(
      note({
        lens: "differentiation",
        observation: "The layout looks like other plumbing sites.",
        evidence: [{ kind: "screenshot", ref: "captures/other-375.png", viewport: "mobile" }],
        impact: undefined,
        recommend: { class: "design-hypothesis", change: "redesign the page so it looks different", step: "restructure", because: "A distinct layout would set this plumber apart from the competition for visitors.", validation: "Show five visitors both pages.", smaller: [{ step: "copy", whyNot: "Copy alone would not change how the page looks next to the others in the category." }] },
      }),
    );
    expect(similar.recommend.effective).toBe("no-change");
    expect(similar.outcome).toBe("no-change");
    expect(similar.recommend.withdrawn!.join(" ")).toMatch(/neither observed nor inferred with a stated visitor impact/);
  });
});

describe("no change is a successful result", () => {
  it("8. concludes the existing design is already appropriate when every note ends in no change", () => {
    const report = assessReview(fixture("salon-review"), direction("salon"));
    expect(errorsOf(report)).toEqual([]);
    expect(report.summary).toMatchObject({ change: 0, hold: 0, gatherEvidence: 0, noChange: 1 });
    expect(report.summary.verdict).toBe("The existing design is already appropriate for what was reviewed. No change is recommended.");
  });

  it("an empty review does not claim the design is appropriate", () => {
    const report = assess();
    expect(errorsOf(report)).toEqual([]);
    expect(report.summary.verdict).toBe("The review has no notes to assess.");
  });

  it("an unestablished concern does not read as the design being fine either", () => {
    const report = assess(note({ evidence: [] }));
    expect(report.summary.verdict).toMatch(/1 to establish first/);
  });
});

describe("three businesses, three different answers", () => {
  const plumber = calibration();
  const clinic = assessReview(fixture("clinic-review"), direction("clinic"));
  const salon = assessReview(fixture("salon-review"), direction("salon"));

  it("10. selects different evidence and different outcomes for each", () => {
    expect(errorsOf(clinic)).toEqual([]);
    const outcomes = [plumber.summary.verdict, clinic.summary.verdict, salon.summary.verdict];
    expect(new Set(outcomes).size).toBe(3);
    expect(find(plumber, "owner-late").recommend.step).toBe("trust-placement");
    expect(find(clinic, "registration-apart").recommend.step).toBe("group");
    // The salon may rightly put booking ahead of a founder biography.
    expect(find(salon, "founder-first").outcome).toBe("no-change");
    expect(find(salon, "founder-first").suggested!.standing).toBe("not-supported");
  });

  it("the clinic's warmer hero is not put ahead of clinical credibility", () => {
    const warm = find(clinic, "warmer-hero");
    expect(warm.outcome).toBe("no-change");
    expect(warm.suggested!.standing).toBe("not-supported");
  });

  it("11. does not manufacture a missing fact: it holds the change and says what is outstanding", () => {
    const registration = find(clinic, "registration-apart");
    expect(registration.basis.effective).toBe("observed");
    expect(registration.outcome).toBe("hold");
    expect(registration.outstanding).toEqual(["each practitioner's register number as published on the public register"]);
    expect(registration.adjustments.join(" ")).toMatch(/Do not write it in/);
    // The same change with a source that supplies the fact goes ahead.
    const sourced = JSON.parse(JSON.stringify(fixture("clinic-review"))) as DesignReview;
    sourced.notes[0].recommend.requires = [{ what: "each practitioner's register number", source: direction("clinic").sources[0].id }];
    expect(assessReview(sourced, direction("clinic")).results[0].outcome).toBe("change");
    // A source id that is not in the file supplies nothing.
    sourced.notes[0].recommend.requires = [{ what: "each practitioner's register number", source: "nowhere" }];
    expect(assessReview(sourced, direction("clinic")).results[0].outcome).toBe("hold");
  });
});

describe("shape, tolerance and the vocabulary", () => {
  it("never throws on malformed input, and names where it is wrong", () => {
    const d = direction("calibration-direction");
    for (const bad of [null, 5, "x", [], {}, { version: 1, subject: "s", notes: "no" }, { version: 1, subject: "s", notes: [null, 3, { id: 4 }, { recommend: 7 }] }]) {
      const report = assessReview(bad, d);
      expect(report.valid).toBe(false);
      expect(report.problems.length).toBeGreaterThan(0);
    }
  });

  it("needs the job map, since impact is judged against it", () => {
    const report = assessReview(review(note()), { client: "x" });
    expect(report.valid).toBe(false);
    expect(report.problems[0].message).toMatch(/no job map/);
  });

  it("asks which width anything rendered was seen at", () => {
    const report = assess(note({ evidence: [{ kind: "screenshot", ref: "x.png" }] }));
    expect(errorsOf(report).map((p) => p.at)).toEqual(["notes[0].evidence[0].viewport"]);
  });

  it("rejects an id used twice", () => {
    expect(errorsOf(assess(note(), note())).map((p) => p.at)).toEqual(["notes[1].id"]);
  });

  it("uses no score, percentage or conversion claim in anything it says", () => {
    const text = JSON.stringify([calibration(), assessReview(fixture("clinic-review"), direction("clinic"))]);
    expect(text).not.toMatch(/\d+\s?%|\bscore\b|conversion|uplift|revenue/i);
  });

  it("a review in the shipped fixtures contains only vocabulary the schema names", () => {
    const schema = JSON.parse(readFileSync(new URL("../../design-review.schema.json", import.meta.url), "utf8"));
    const n = schema.$defs.note.properties;
    expect(n.lens.enum).toEqual([...CONFIDENCE_LENSES]);
    expect(n.basis.enum).toEqual([...REVIEW_BASES]);
    expect(n.evidence.items.properties.kind.enum).toEqual([...EVIDENCE_KINDS]);
    expect(n.evidence.items.properties.viewport.enum).toEqual([...VIEWPORTS]);
    expect(n.recommend.properties.class.enum).toEqual([...CHANGE_CLASSES]);
    expect(n.recommend.properties.step.enum).toEqual([...CHANGE_STEPS]);
    expect(n.recommend.properties.adds.items.enum).toEqual([...ADDITIONS]);
    expect(schema.required).toEqual(["version", "subject", "notes"]);
  });
});

describe("craft direction review", () => {
  const setup = (files: Record<string, unknown>) => {
    const dir = mkdtempSync(join(tmpdir(), "craft-review-"));
    dirs.push(dir);
    for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), JSON.stringify(content));
    return dir;
  };
  const exec = async (dir: string, args: string[]) => {
    const out: string[] = [];
    const err: string[] = [];
    const code = await run(["direction", "review", ...args], { cwd: dir, out: (s) => out.push(s), err: (s) => err.push(s) });
    return { code, out: out.join("\n"), err: err.join("\n") };
  };

  it("prints each note as observation, evidence, impact, recommendation and why, and exits 0", async () => {
    const dir = setup({ "art-direction.json": direction("calibration-direction"), "review.json": fixture("calibration-review") });
    const { code, out } = await exec(dir, ["--notes", "review.json"]);
    expect(code).toBe(0);
    expect(out).toMatch(/owner-late \[home, identity\] observed: change, confirmed correction/);
    expect(out).toMatch(/observation: The owner is introduced too far down the page\./);
    expect(out).toMatch(/visitor impact:/);
    expect(out).toMatch(/suggested: move the full biography directly below the hero -> narrower change preferred/);
    expect(out).toMatch(/recommended \(trust-placement\)/);
    expect(out).toMatch(/why not more:/);
    expect(out).toMatch(/check: Look at the first screen/);
    expect(out).toMatch(/unknown at desktop/);
    expect(out).toMatch(/hero-slideshow .*no-change/);
    expect(out).toMatch(/held: it depends on/);
  });

  it("says plainly when the design needs no change", async () => {
    const dir = setup({ "art-direction.json": direction("salon"), "review.json": fixture("salon-review") });
    const { code, out } = await exec(dir, ["--notes", "review.json"]);
    expect(code).toBe(0);
    expect(out).toMatch(/The existing design is already appropriate for what was reviewed\. No change is recommended\./);
  });

  it("prints JSON, exits 1 for a malformed review, and 2 for a missing file or flag", async () => {
    const dir = setup({ "art-direction.json": direction("salon"), "review.json": fixture("salon-review"), "bad.json": { version: 1, subject: "s", notes: [{ id: "x" }] } });
    expect(JSON.parse((await exec(dir, ["--notes", "review.json", "--json"])).out).summary.noChange).toBe(1);
    expect((await exec(dir, ["--notes", "bad.json"])).code).toBe(1);
    expect((await exec(dir, ["--notes", "missing.json"])).code).toBe(2);
    expect((await exec(dir, [])).code).toBe(2);
  });
});
