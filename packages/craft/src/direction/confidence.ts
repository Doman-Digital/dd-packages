/**
 * Decision confidence: does the page give this visitor what they need to
 * understand the business, trust it and take the next step, in an order that
 * follows how they decide? (CHARACTER.md, "Decision confidence".)
 *
 * It is a reading of the hierarchy layer, not a new layer. Relevance, order,
 * the primary action and the lead are already decided and checked there, from
 * the job. What the hierarchy did not record is what evidence the page offers,
 * how much of it is met first, and at which widths the decisions were looked
 * at. An optional `confidence` block on a page records that, and this module
 * validates it with the same reason rule and reads it.
 *
 * It does not score. Nothing here says a page is more or less confident, and
 * nothing predicts conversion. Each finding says what was found, how well it is
 * known (observed, inferred or unknown) and why it matters to this visitor.
 *
 * Nothing is required. No evidence kind, no founder portrait, no slideshow, no
 * telephone number, no section order and no testimonial above the fold: the
 * job decides which of these a business needs, and a page with none of them
 * passes. A file with no `confidence` block validates and reports as before.
 *
 * Pure. A snapshot, when given, adds the width it was taken at.
 */

import type { Snapshot } from "../snapshot/types.js";
import { POSITIONS } from "./hierarchy.js";
import { checkReason, contentWords, shares } from "./reason.js";
import {
  PAGE_TYPES,
  PROOF_DEPTHS,
  PROOF_KINDS,
  VIEWPORTS,
  type ConfidenceFinding,
  type DirectionProblem,
  type DirectionSource,
  type JobMap,
  type PageConfidence,
  type PageHierarchy,
  type PageType,
  type Viewport,
} from "./types.js";

/** The width bands of STANDARD.md section 10, coarsened: `mobile` is the two phone bands (under 768). */
export function viewportOf(width: number): Viewport {
  return width < 768 ? "mobile" : width < 1024 ? "tablet" : "desktop";
}

const isObject = (x: unknown): x is Record<string, unknown> => Boolean(x) && typeof x === "object" && !Array.isArray(x);

/** Problems with a recorded `confidence` block: its shape, and the reason rule on every item. */
export function validateConfidence(page: PageType, confidence: unknown, job: JobMap | undefined, sources: DirectionSource[]): DirectionProblem[] {
  const problems: DirectionProblem[] = [];
  const base = `hierarchy.${page}.confidence`;
  const err = (at: string, message: string) => problems.push({ severity: "error", at: `${base}${at}`, message });
  if (!isObject(confidence)) {
    err("", "confidence is an object: `examined` (the widths looked at) and `proof` (what the page offers)");
    return problems;
  }

  if (confidence.examined !== undefined) {
    if (!Array.isArray(confidence.examined)) err(".examined", `a list of widths: ${VIEWPORTS.join(", ")}`);
    else for (const v of confidence.examined) if (!(VIEWPORTS as readonly unknown[]).includes(v)) err(".examined", `"${String(v)}" is not a width craft knows. Widths are: ${VIEWPORTS.join(", ")}`);
  }

  if (confidence.proof !== undefined && !Array.isArray(confidence.proof)) err(".proof", "a list of evidence items");
  const proof = Array.isArray(confidence.proof) ? confidence.proof : [];
  proof.forEach((raw, i) => {
    const at = `.proof[${i}]`;
    if (!isObject(raw)) return err(at, "an evidence item is an object: kind, what, position, depth, because");
    if (!(PROOF_KINDS as readonly unknown[]).includes(raw.kind)) err(`${at}.kind`, `one of ${PROOF_KINDS.join(", ")}`);
    if (typeof raw.what !== "string" || contentWords(raw.what).size < 2) err(`${at}.what`, "what it is, in a few words: \"photographs of three finished bathrooms\", not \"proof\"");
    if (typeof raw.position !== "string" || !POSITIONS.has(raw.position)) err(`${at}.position`, "the section it sits in, or \"header\" or \"sticky\"");
    if (!(PROOF_DEPTHS as readonly unknown[]).includes(raw.depth)) err(`${at}.depth`, `${PROOF_DEPTHS.join(" or ")}: met without being sought, or detail a visitor opens`);
    problems.push(...checkReason({ at: `${base}${at}`, because: raw.because, evidence: raw.evidence, sources, tie: "job", job }));
  });
  return problems;
}

const lensOf = (kind: unknown) => (kind === "people" ? ("identity" as const) : ("evidence" as const));

/** Every sentence a page's decisions use, to see whether a worry is named anywhere. */
function decisionText(h: PageHierarchy): string {
  const proof = Array.isArray(h.confidence?.proof) ? h.confidence!.proof! : [];
  return [
    h.primaryAction?.value,
    h.primaryAction?.because,
    h.lead?.value,
    h.lead?.because,
    ...(Array.isArray(h.order) ? h.order.map((o) => o?.because) : []),
    ...(Array.isArray(h.journey) ? h.journey.map((s) => s?.because) : []),
    ...proof.flatMap((p) => (isObject(p) ? [p.what, p.because] : [])),
  ]
    .filter((x): x is string => typeof x === "string")
    .join(" ");
}

export interface ConfidenceContext {
  /** The rendered page, when there is one. Its width counts as examined, and is the only observed width. */
  snapshot?: Snapshot;
  /** Which page the snapshot is. */
  snapshotPage?: PageType;
}

/**
 * What is observed, inferred or unknown about decision confidence on each page
 * that records a `confidence` block. Pages without one are not assessed.
 */
export function assessConfidence(hierarchy: unknown, job: JobMap | undefined, ctx: ConfidenceContext = {}): ConfidenceFinding[] {
  const findings: ConfidenceFinding[] = [];
  if (!isObject(hierarchy)) return findings;

  for (const [key, raw] of Object.entries(hierarchy)) {
    const h = raw as Partial<PageHierarchy> | undefined;
    if (!(PAGE_TYPES as readonly string[]).includes(key) || !isObject(h) || !isObject(h.confidence)) continue;
    const page = key as PageType;
    const at = (rest: string) => `hierarchy.${page}.confidence${rest}`;
    const add = (f: Omit<ConfidenceFinding, "page">) => findings.push({ page, ...f });
    const c = h.confidence as PageConfidence;
    const proof = (Array.isArray(c.proof) ? c.proof : []).filter(isObject) as unknown as NonNullable<PageConfidence["proof"]>;
    const order = new Set((Array.isArray(h.order) ? h.order : []).map((o) => o?.role));

    // Action clarity: the ask has to sit somewhere the page has.
    for (const pos of Array.isArray(h.primaryAction?.positions) ? h.primaryAction!.positions : []) {
      if (POSITIONS.has(pos) && pos !== "header" && pos !== "sticky" && !order.has(pos)) {
        add({
          lens: "action",
          basis: "observed",
          at: `hierarchy.${page}.primaryAction.positions`,
          message: `the ask "${h.primaryAction!.value}" sits in "${pos}", and the declared order has no such section`,
          why: "A visitor can only take the next step where the page offers it. Either the order or the position is out of date.",
        });
      }
    }

    // Evidence: where it sits, and whether anything shows it exists.
    proof.forEach((p, i) => {
      const where = at(`.proof[${i}]`);
      if (POSITIONS.has(p.position) && p.position !== "header" && p.position !== "sticky" && !order.has(p.position)) {
        add({
          lens: "hierarchy",
          basis: "observed",
          at: `${where}.position`,
          message: `${p.kind} evidence "${p.what}" sits in "${p.position}", and the declared order has no such section`,
          why: "Evidence a visitor is meant to meet has to be on the page, in a section the order names.",
        });
      }
      const cited = Array.isArray(p.evidence) ? p.evidence : [];
      if (cited.length === 0) {
        add({
          lens: lensOf(p.kind),
          basis: "unknown",
          at: `${where}.evidence`,
          message: `no source in the file shows that "${p.what}" exists`,
          why: "Confidence built on evidence that is only planned or imagined is the opposite of confidence. Confirm it with the client, and cite what shows it, before the page claims it.",
        });
      }
    });

    // Progressive disclosure: detail kept back needs something met first that says it is there.
    const firstLook = new Set(proof.filter((p) => p.depth === "first-look").map((p) => p.kind));
    proof.forEach((p, i) => {
      if (p.depth === "on-request" && !firstLook.has(p.kind)) {
        add({
          lens: "disclosure",
          basis: "inferred",
          at: at(`.proof[${i}].depth`),
          message: `${p.kind} evidence "${p.what}" is held back for visitors who seek it, and nothing of the same kind is met first`,
          why: "Detail can wait only if the visitor can tell it is there. Nothing at first look means the evidence may never be found. A line in the header or a short sample in the hero would do; this is a hypothesis, not a rule.",
        });
      }
    });

    // Relevance: the worries the job names, and whether any decision on this page names them.
    if (job && Array.isArray(job.objections)) {
      const said = contentWords(decisionText(h as PageHierarchy));
      job.objections.forEach((o, i) => {
        if (typeof o !== "string") return;
        if (shares(contentWords(o), said).length === 0) {
          add({
            lens: "relevance",
            basis: "unknown",
            at: `job.objections[${i}]`,
            message: `no decision recorded for this page names the worry "${o}"`,
            why: "A visitor who arrives with this worry needs something that meets it. Either a decision here does, and its reason should say so, or this page does not have to answer it. This reads wording only: it can miss an answer that uses other words.",
          });
        }
      });
    }

    // Mobile: which widths this was looked at, and the ones it was not.
    const bands = new Set<Viewport>((Array.isArray(c.examined) ? c.examined : []).filter((v): v is Viewport => (VIEWPORTS as readonly unknown[]).includes(v)));
    if (ctx.snapshot && (ctx.snapshotPage ?? "home") === page) bands.add(viewportOf(ctx.snapshot.viewport.width));
    if (bands.size === 0) {
      add({
        lens: "mobile",
        basis: "unknown",
        at: at(".examined"),
        message: "no width recorded: say which widths these decisions were examined at",
        why: "The phone is the base layout (STANDARD.md section 10). What was seen at one width says nothing about another until it has been looked at there.",
      });
    } else {
      for (const band of VIEWPORTS) {
        if (bands.has(band)) continue;
        add({
          lens: "mobile",
          basis: "unknown",
          at: at(".examined"),
          message: band === "mobile" ? "not examined on a phone" : `not examined at ${band} width; what was seen at ${[...bands].join(" and ")} is not carried to it`,
          why:
            band === "mobile"
              ? "The phone is the base layout every wider one is derived from (STANDARD.md section 10). A page not looked at there has not been looked at where it is designed first."
              : "Order, prominence and what fits can differ at another width, and nothing recorded shows they do not. Examine it there before treating the finding as true of it.",
        });
      }
    }
  }
  return findings;
}
