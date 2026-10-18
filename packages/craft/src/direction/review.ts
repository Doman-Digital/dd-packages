/**
 * Reviewing a proposed change against the visitor (CHARACTER.md, "Reviewing a
 * proposed change").
 *
 * A stakeholder, an audit or a customer says something about a page. That is
 * four different things, and a review keeps them apart:
 *
 *   the observation   what was said or seen
 *   the problem       what it costs this visitor
 *   the suggestion    what the person proposed
 *   the recommendation  the smallest change that answers the problem
 *
 * A valid observation does not make the suggestion right, and an invalid
 * suggestion does not make the observation wrong. Each is judged on its own.
 *
 * Nothing here scores or predicts. It checks that the reasoning holds up: that
 * "observed" means something was inspected, that a change names the visitor it
 * helps, that a structural step says why every smaller one was not enough, that
 * nothing already on the page is built a second time, that a width nobody
 * looked at stays unknown, and that a fact nobody supplied is not made up. It
 * can, and often should, conclude that no change is needed.
 *
 * Pure. Reads the job from the art direction; the rest is in the review.
 */

import { SECTION_ROLES } from "./hierarchy.js";
import { CONVENTION, checkReason, PREFERENCE } from "./reason.js";
import {
  ADDITIONS,
  CHANGE_CLASSES,
  CHANGE_STEPS,
  CONFIDENCE_LENSES,
  EVIDENCE_KINDS,
  INSPECTED_KINDS,
  PAGE_TYPES,
  REVIEW_BASES,
  VIEWPORTS,
  type ArtDirection,
  type ChangeClass,
  type ChangeStep,
  type DirectionProblem,
  type PageType,
  type ReviewBasis,
  type ReviewEvidence,
  type ReviewNote,
  type ReviewOutcome,
  type ReviewProposal,
  type ReviewReport,
  type ReviewResult,
  type SuggestionStanding,
  type Viewport,
} from "./types.js";

const isObject = (x: unknown): x is Record<string, unknown> => Boolean(x) && typeof x === "object" && !Array.isArray(x);
const wordCount = (x: unknown): number => (typeof x === "string" ? x.trim().split(/\s+/).filter(Boolean).length : 0);
const includes = (list: readonly unknown[], x: unknown): boolean => list.includes(x);

const STEP_RANK = new Map<string, number>(CHANGE_STEPS.map((s, i) => [s, i]));
const CLASS_RANK: Record<ChangeClass, number> = { "no-change": 0, "optional-refinement": 1, "design-hypothesis": 2, "confirmed-correction": 3 };
const RENDERED_KINDS = ["screenshot", "rendered", "measurement"];

/** Structural steps: the ones that rearrange a page or build something new. */
export const isStructural = (step: unknown): boolean => step === "restructure" || step === "new-component";

/** Possible comparable components. Their names alone do not establish duplication. */
const GALLERY = /\b(?:gallery|galleries|carousel|slideshow|slider|swipe(?:able)?|rotating)\b/i;

/** A reason in a review's own words: a sentence, and not a preference or the category's default. */
function plain(at: string, text: unknown): DirectionProblem[] {
  if (wordCount(text) < 8) return [{ severity: "error", at, message: "a sentence at least: say why, in this visitor's terms" }];
  const t = text as string;
  if (PREFERENCE.test(t)) return [{ severity: "error", at, message: "that is a preference, not a reason. Say what it does for this visitor." }];
  const c = t.match(CONVENTION);
  if (c) return [{ severity: "error", at, message: `"${c[0]}" is the category's default speaking, not a reason. Say what in this visitor's job it answers.` }];
  return [];
}

/** Problems with the shape of one proposal. */
function checkProposalShape(at: string, p: unknown, required: boolean): DirectionProblem[] {
  const problems: DirectionProblem[] = [];
  const err = (rest: string, message: string) => problems.push({ severity: "error", at: `${at}${rest}`, message });
  if (!isObject(p)) {
    if (required) err("", "a proposal is an object: change, step, and optionally adds and touches");
    return problems;
  }
  if (wordCount(p.change) < 3) err(".change", "say what changes, in a few words");
  if (!includes(CHANGE_STEPS, p.step)) err(".step", `one of ${CHANGE_STEPS.join(", ")}: the smallest step that does it`);
  if (p.adds !== undefined) {
    if (!Array.isArray(p.adds) || p.adds.some((a) => !includes(ADDITIONS, a))) err(".adds", `a list drawn from ${ADDITIONS.join(", ")}`);
  }
  if (p.comparisons !== undefined) {
    if (!Array.isArray(p.comparisons)) err(".comparisons", "a list comparing each relevant existing component");
    else p.comparisons.forEach((c, i) => {
      if (!isObject(c) || typeof c.existing !== "string" || !c.existing.trim() || typeof c.samePurpose !== "boolean") {
        err(`.comparisons[${i}]`, "existing, samePurpose and because are required");
      } else problems.push(...plain(`${at}.comparisons[${i}].because`, c.because));
    });
  }
  if (p.touches !== undefined && !includes(SECTION_ROLES, p.touches)) err(".touches", `a section role: ${SECTION_ROLES.join(", ")}`);
  return problems;
}

/** Problems with the shape of one evidence entry. */
function checkEvidenceShape(at: string, e: unknown): DirectionProblem[] {
  const problems: DirectionProblem[] = [];
  const err = (rest: string, message: string) => problems.push({ severity: "error", at: `${at}${rest}`, message });
  if (!isObject(e)) return [{ severity: "error", at, message: "evidence is an object: kind, ref, and a viewport for anything rendered" }];
  if (!includes(EVIDENCE_KINDS, e.kind)) err(".kind", `one of ${EVIDENCE_KINDS.join(", ")}`);
  if (typeof e.ref !== "string" || !e.ref.trim()) err(".ref", "where it can be found: a screenshot path, a selector, a quotation, a report");
  if (e.viewport !== undefined && !includes(VIEWPORTS, e.viewport)) err(".viewport", `one of ${VIEWPORTS.join(", ")}`);
  if (includes(RENDERED_KINDS, e.kind) && e.viewport === undefined) err(".viewport", "say which width this was seen at: what is seen at one width is not evidence about another");
  return problems;
}

/** Problems with the shape of a note. A note with any is not assessed. */
function checkNoteShape(i: number, n: Record<string, unknown>): DirectionProblem[] {
  const base = `notes[${i}]`;
  const problems: DirectionProblem[] = [];
  const err = (rest: string, message: string) => problems.push({ severity: "error", at: `${base}${rest}`, message });
  if (typeof n.id !== "string" || !n.id.trim()) err(".id", "a short name for this note");
  if (n.page !== undefined && !includes(PAGE_TYPES, n.page)) err(".page", `one of ${PAGE_TYPES.join(", ")}`);
  if (!includes(CONFIDENCE_LENSES, n.lens)) err(".lens", `one of ${CONFIDENCE_LENSES.join(", ")}`);
  if (wordCount(n.observation) < 3) err(".observation", "what was said or seen, as it was said");
  if (typeof n.raisedBy !== "string" || !n.raisedBy.trim()) err(".raisedBy", "who said it, or what found it");
  if (!includes(REVIEW_BASES, n.basis)) err(".basis", `one of ${REVIEW_BASES.join(", ")}`);
  if (!Array.isArray(n.evidence)) err(".evidence", "a list, possibly empty: what supports the note");
  else n.evidence.forEach((e, j) => problems.push(...checkEvidenceShape(`${base}.evidence[${j}]`, e)));
  if (n.appliesTo !== undefined && (!Array.isArray(n.appliesTo) || n.appliesTo.some((v) => !includes(VIEWPORTS, v)))) err(".appliesTo", `a list drawn from ${VIEWPORTS.join(", ")}`);
  if (n.existing !== undefined && (!Array.isArray(n.existing) || n.existing.some((x) => typeof x !== "string"))) err(".existing", "a list of what the page already has");
  if (n.suggested !== undefined) problems.push(...checkProposalShape(`${base}.suggested`, n.suggested, false));

  const r = n.recommend;
  if (!isObject(r)) {
    err(".recommend", "the recommendation: a class, and for anything but no-change a change, a step and a reason");
    return problems;
  }
  if (!includes(CHANGE_CLASSES, r.class)) {
    err(".recommend.class", `one of ${CHANGE_CLASSES.join(", ")}. no-change is a result, not a failure to answer.`);
    return problems;
  }
  if (r.class === "no-change") {
    if (r.because !== undefined) problems.push(...plain(`${base}.recommend.because`, r.because));
    return problems;
  }
  problems.push(...checkProposalShape(`${base}.recommend`, r, true));
  problems.push(...plain(`${base}.recommend.because`, r.because));
  const bigger = isStructural(r.step) || (Array.isArray(r.adds) && r.adds.length > 0);
  if (bigger) {
    const smaller = Array.isArray(r.smaller) ? r.smaller : [];
    if (smaller.length === 0) err(".recommend.smaller", "a structural change, or one that adds a carousel, script, dependency, animation, testimonial, call to action or repeated content, says which smaller steps were considered and why none was enough");
    const limit = STEP_RANK.get(r.step as string) ?? 0;
    smaller.forEach((s, j) => {
      const ok = isObject(s) && includes(CHANGE_STEPS, s.step) && (limit === 0 || (STEP_RANK.get(s.step as string) ?? 99) < limit);
      if (!ok) err(`.recommend.smaller[${j}].step`, "a step on the ladder below the one recommended");
      if (isObject(s)) problems.push(...plain(`${base}.recommend.smaller[${j}].whyNot`, s.whyNot));
    });
  } else {
    problems.push(...plain(`${base}.recommend.whyEnough`, r.whyEnough));
  }
  if (r.class === "design-hypothesis" && wordCount(r.validation) < 4) err(".recommend.validation", "a hypothesis says how it would be checked: a phone test, five visitors, a read of the enquiries");
  if (r.requires !== undefined) {
    if (!Array.isArray(r.requires) || r.requires.some((q) => !isObject(q) || wordCount(q.what) < 2)) err(".recommend.requires", "a list of {what, source?}: facts or assets the change depends on");
  }
  return problems;
}

interface Context {
  note: ReviewNote;
  /** Effective basis, after the evidence has been weighed. */
  basis: ReviewBasis;
  /** A stated visitor impact that is about this client's job. */
  impact: boolean;
  /** Text of what the page already has. */
  existing: string[];
  /** Section roles the declared order places, each with a reason. */
  placed: Set<string>;
}

/** Why a proposal cannot stand as stated. Empty means nothing in it is unsupported. */
function whyNot(p: ReviewProposal, ctx: Context): string[] {
  const reasons: string[] = [];
  const adds = Array.isArray(p.adds) ? p.adds : [];
  if (adds.includes("carousel")) {
    for (const have of new Set(ctx.existing.filter((e) => GALLERY.test(e)))) {
      const compared = p.comparisons?.filter((c) => c.existing === have) ?? [];
      if (compared.length !== 1) reasons.push(`the page already has "${have}". Compare its purpose, content and placement before adding another carousel; duplication is not established by its name.`);
      else if (compared[0].samePurpose) reasons.push(`the comparison identifies the same purpose as "${have}": ${compared[0].because}. Reuse or adjust that component.`);
    }
  }
  const defensible = (ctx.basis === "observed" || ctx.basis === "inferred") && ctx.impact;
  if ((isStructural(p.step) || adds.length > 0) && !defensible) {
    reasons.push("it is a structural change or adds something that costs, and the problem under it is neither observed nor inferred with a stated visitor impact. A preference does not justify it.");
  }
  if (p.step === "remove-redundancy" && !(ctx.basis === "observed" && ctx.impact)) {
    reasons.push("it removes information, and nothing observed shows it is redundant or what it costs the visitor. Useful detail stays unless it is shown not to be.");
  }
  if (p.touches && ctx.placed.has(p.touches) && ctx.basis !== "observed") {
    reasons.push(`the declared order already places "${p.touches}" with a reason. Only something observed overrides a reasoned decision.`);
  }
  return reasons;
}

function widthsOf(evidence: ReviewEvidence[]): Viewport[] {
  const seen = new Set<Viewport>();
  for (const e of evidence) {
    if (e.viewport) seen.add(e.viewport);
    // What a page says does not change with its width.
    else if (e.kind === "content") VIEWPORTS.forEach((v) => seen.add(v));
  }
  return VIEWPORTS.filter((v) => seen.has(v));
}

/**
 * Weigh a review: for each note, how well the problem is known, whether the
 * suggestion and the recommendation each stand, and what the outcome is.
 */
export function assessReview(input: unknown, direction: Partial<ArtDirection>): ReviewReport {
  const problems: DirectionProblem[] = [];
  const results: ReviewResult[] = [];
  const fail = (at: string, message: string) => problems.push({ severity: "error", at, message });
  const report = (): ReviewReport => {
    const n = (o: ReviewOutcome) => results.filter((r) => r.outcome === o).length;
    const summary = { change: n("change"), hold: n("hold"), noChange: n("no-change"), gatherEvidence: n("gather-evidence"), verdict: "" };
    summary.verdict =
      results.length === 0
        ? "The review has no notes to assess."
        : summary.change + summary.hold + summary.gatherEvidence === 0
          ? "The existing design is already appropriate for what was reviewed. No change is recommended."
          : `${summary.change} change${summary.change === 1 ? "" : "s"} recommended, ${summary.hold} held for something nobody has supplied, ${summary.gatherEvidence} to establish first, ${summary.noChange} needing no change.`;
    return { valid: !problems.some((p) => p.severity === "error"), problems, results, summary };
  };

  if (!isObject(input)) {
    fail("", "a review is an object: version, subject and notes");
    return report();
  }
  if (input.context !== undefined && !["publication", "protected-staging"].includes(input.context as string)) fail("context", "publication or protected-staging");
  if (input.version !== 1) fail("version", "version is 1");
  if (typeof input.subject !== "string" || !input.subject.trim()) fail("subject", "who or what was reviewed");
  if (!Array.isArray(input.notes)) {
    fail("notes", "a list of notes");
    return report();
  }
  const job = direction.job;
  if (!job) {
    fail("", "a review is read against the visitor's job, and the art direction has no job map yet. Record it first (craft direction research).");
    return report();
  }

  const ids = new Set<string>();
  input.notes.forEach((raw, i) => {
    if (!isObject(raw)) return fail(`notes[${i}]`, "a note is an object");
    const shape = checkNoteShape(i, raw);
    if (typeof raw.id === "string") {
      if (ids.has(raw.id)) shape.push({ severity: "error", at: `notes[${i}].id`, message: `"${raw.id}" is used twice` });
      ids.add(raw.id);
    }
    problems.push(...shape);
    if (shape.length > 0) return;

    const note = raw as unknown as ReviewNote;
    const page: PageType = note.page ?? "home";
    const adjustments: string[] = [];
    const hierarchy = direction.hierarchy?.[page];
    const sources = Array.isArray(direction.sources) ? direction.sources : [];

    // How well is the problem known? Declared basis, capped by what supports it.
    const inspected = note.evidence.filter((e) => includes(INSPECTED_KINDS, e.kind));
    let basis: ReviewBasis = note.basis;
    if (basis === "observed" && inspected.length === 0) {
      basis = note.evidence.length > 0 ? "inferred" : "unknown";
      adjustments.push(
        note.evidence.length > 0
          ? "declared observed, but everything cited is reported (an audit, a stakeholder, a customer) and nothing was inspected. Read as inferred until someone looks."
          : "declared observed, but nothing is cited. Read as unknown.",
      );
    } else if (basis === "inferred" && note.evidence.length === 0) {
      basis = "unknown";
      adjustments.push("declared inferred, but nothing supports it. Read as unknown.");
    }

    // What does it cost this visitor? A reason about this client's job, or it is a fact or a taste, not an issue.
    const impactProblems = typeof note.impact === "string" ? checkReason({ at: `notes[${i}].impact`, because: note.impact, sources, tie: "job", job }) : [];
    const impact = typeof note.impact === "string" && impactProblems.length === 0;
    const wantsChange = note.recommend.class !== "no-change";
    if (!impact && (wantsChange || note.suggested)) {
      adjustments.push(
        typeof note.impact === "string"
          ? `no visitor impact tied to this client's job (${impactProblems[0]?.message ?? "none given"}).`
          : "no visitor impact stated. Something that costs the visitor nothing they can name is a fact or a preference, not an issue, and is not read as one.",
      );
      if (basis === "inferred") basis = "preference";
    }

    const ctx: Context = {
      note,
      basis,
      impact,
      existing: [...(note.existing ?? []), ...(hierarchy?.confidence?.proof ?? []).map((p) => p.what).filter((w): w is string => typeof w === "string")],
      placed: new Set((hierarchy?.order ?? []).map((o) => o.role)),
    };

    // The widths: what was looked at, what the note may claim, what stays unknown.
    const examined = widthsOf(note.evidence);
    const wanted = note.appliesTo ?? (examined.length > 0 ? examined : [...VIEWPORTS]);
    const claimed = wanted.filter((v) => examined.includes(v));
    const unknown = VIEWPORTS.filter((v) => wanted.includes(v) && !examined.includes(v));
    if (unknown.length > 0) adjustments.push(`nothing here was looked at on ${unknown.join(" or ")}, so the note says nothing about it. That stays unknown until it is examined there.`);

    // The suggestion and the recommendation, each on its own.
    const rec = note.recommend;
    const recReasons = wantsChange ? whyNot(rec, ctx) : [];
    const sugReasons = note.suggested ? whyNot(note.suggested, ctx) : [];

    const ceiling: ChangeClass =
      basis === "observed" ? (impact ? "confirmed-correction" : "optional-refinement") : basis === "inferred" ? "design-hypothesis" : basis === "preference" ? "optional-refinement" : "no-change";
    let effective: ChangeClass = wantsChange ? rec.class : "no-change";
    if (basis !== "unknown" && CLASS_RANK[effective] > CLASS_RANK[ceiling]) {
      adjustments.push(`declared ${rec.class}, but a problem that is ${basis}${basis === "observed" && !impact ? " with no stated visitor impact" : ""} supports at most ${ceiling}.`);
      effective = ceiling;
    }
    let withdrawn: string[] | undefined;
    if (wantsChange && recReasons.length > 0) {
      withdrawn = recReasons;
      effective = "no-change";
      adjustments.push("the recommended change is withdrawn: " + recReasons.join(" "));
    }

    const missing = (rec.requires ?? []).filter((q) => !q.source || !sources.some((s) => s.id === q.source));
    const outstanding = missing.map((q) => q.what);
    const blocking = missing.filter((q) => !(input.context === "protected-staging" && q.kind === "asset" && q.phase === "publication" && q.placeholder));
    if (missing.length > blocking.length) adjustments.push("Protected staging may reserve the explicitly marked placeholder. Required assets remain outstanding for publication; no fact or photograph has been supplied by this review.");
    let outcome: ReviewOutcome;
    if (basis === "unknown") {
      outcome = "gather-evidence";
      effective = "no-change";
      if (wantsChange) adjustments.push(`nothing is recommended until the problem is established${rec.validation ? `: ${rec.validation}` : ". Ask the client, or look, first."}`);
    } else if (effective === "no-change") outcome = "no-change";
    else if (blocking.length > 0) outcome = "hold";
    else outcome = "change";
    if (outcome === "hold") adjustments.push(`held: it depends on ${blocking.map((o) => `"${o.what}"`).join(", ")}, and no source supplies it. Do not write it in. Ask the client.`);

    let suggested: ReviewResult["suggested"];
    if (note.suggested) {
      const recRank = STEP_RANK.get(rec.step ?? "") ?? -1;
      const sugRank = STEP_RANK.get(note.suggested.step) ?? 0;
      const sugAdds = (note.suggested.adds ?? []).length;
      let standing: SuggestionStanding;
      const reasons = [...sugReasons];
      if (sugReasons.length > 0) standing = "not-supported";
      else if (effective === "no-change") {
        standing = "not-needed";
        reasons.push("the existing design already answers the problem, or nothing is yet established to answer.");
      } else if (sugRank > recRank || (sugAdds > 0 && (rec.adds ?? []).length === 0)) {
        standing = "comparison-needed";
        reasons.push("Compare the proposals before selecting one. A smaller implementation is not evidence of a better visitor experience; compare their adequacy against the stated problem and rendered result.");
      } else standing = "supported";
      suggested = { standing, reasons };
    }

    results.push({
      id: note.id,
      page,
      lens: note.lens,
      basis: { declared: note.basis, effective: basis },
      ...(suggested ? { suggested } : {}),
      recommend: { declared: rec.class, effective, ...(wantsChange ? { step: rec.step } : {}), ...(withdrawn ? { withdrawn } : {}) },
      outcome,
      widths: { examined, claimed, unknown },
      adjustments,
      outstanding,
      publicationReady: outstanding.length === 0,
    });
  });
  return report();
}
