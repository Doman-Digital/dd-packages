/**
 * `art-direction.json`: what a site decided about how it looks, and why.
 *
 * CHARACTER.md's reason rule lives here. Every expressive choice records a
 * `because` drawn from the client's real world (the shopfront, the van, the
 * trade's own lettering, the place, the materials) and points at a source
 * that shows it. A choice with no reason is a default, however good it looks.
 *
 * The file also carries the tell exceptions craft has read since phase A, in
 * the same shape, so an existing file stays valid.
 */

import type { TellException } from "../character/types.js";
import type { SectionRole } from "../snapshot/types.js";

/** What `craft direction init` writes. Version 1 files still validate, with a warning. */
export const DIRECTION_VERSION = 2;
export const DIRECTION_VERSIONS = [1, 2] as const;

/** The customer's own words: evidence for the job map, never for a token. */
export const CUSTOMER_KINDS = ["review", "enquiry", "conversation", "search"] as const;
export type CustomerKind = (typeof CUSTOMER_KINDS)[number];

/**
 * Where a reason comes from. Deliberately physical: a mood board is not a
 * source. Customer-voice kinds back the job map. A `reference` is visual
 * inspiration from outside the client's category, and says where it is from.
 */
export const SOURCE_KINDS = [
  "livery",
  "shopfront",
  "signage",
  "packaging",
  "product",
  "uniform",
  "interior",
  "place",
  "material",
  "trade",
  "print",
  "photo",
  "founder",
  ...CUSTOMER_KINDS,
  "reference",
] as const;

export type SourceKind = (typeof SOURCE_KINDS)[number];

export interface DirectionSource {
  /** Short id a choice refers to: "van", "fascia", "price-list". */
  id: string;
  kind: SourceKind;
  /** What it is and where, in a sentence. */
  note: string;
  /** A photo or file in the repo, or a URL. */
  path?: string;
  /** Colours read off it by a person or by `craft direction propose`, as hex. */
  colours?: string[];
  /** Lettering seen on it: "hand-painted sign-writing", "stencilled capitals". */
  lettering?: string;
  /** Where a `reference` comes from: "letterpress print", "a railway station", "a bakery". Never the client's own trade. */
  category?: string;
}

/** The expressive choices. Structure is the hierarchy layer, decided from the job. */
export const CHOICE_KEYS = ["accent", "ground", "display", "body", "shape", "motif", "signature"] as const;
export type ChoiceKey = (typeof CHOICE_KEYS)[number];

export interface DirectionChoice {
  /** A colour as hex for accent and ground, a family name for display and body, words otherwise. */
  value: string;
  because: string;
  /** Source ids this reason rests on. */
  evidence: string[];
}

/** One part of the job: what it is, and the customer's words that show it. */
export interface JobPart {
  value: string;
  evidence: string[];
}

export const CONSIDERATION = ["low", "considered", "high"] as const;
export type Consideration = (typeof CONSIDERATION)[number];

/**
 * What the visitor is trying to get done, from their side. Every hierarchy
 * reason is checked against it, so it replaces "what do other sites in the
 * trade do" as the starting point.
 */
export interface JobMap {
  /** Verb + object + context: "find" / "an electrician they can trust with a dangerous fault" / "today, without being overcharged". */
  statement: { verb: string; object: string; context: string };
  functional: JobPart;
  emotional: JobPart;
  social: JobPart;
  /** How long and how carefully they decide: an emergency call-out is low, a retained plan is high. */
  consideration: { value: Consideration; because: string; evidence: string[] };
  objections: string[];
  /** Their own words, quoted from a cited source. */
  language: string[];
  /** The customer-voice sources the language is quoted from. */
  evidence: string[];
}

/** Page types a hierarchy is declared for. Each page has its own job on the site. */
export const PAGE_TYPES = ["home", "service", "about", "pricing", "booking", "contact", "article", "landing"] as const;
export type PageType = (typeof PAGE_TYPES)[number];

/** Where a call to action can sit: a section role, or the header, or pinned while scrolling. */
export type ActionPosition = SectionRole | "header" | "sticky";

/**
 * What a visitor can be shown to establish confidence. A menu, not a checklist:
 * the job decides which kinds matter for this business, and none is required.
 */
export const PROOF_KINDS = ["work", "people", "credentials", "reviews", "experience", "outcomes"] as const;
export type ProofKind = (typeof PROOF_KINDS)[number];

/** `first-look` is met without being sought; `on-request` is detail a visitor opens, expands or follows a link to. */
export const PROOF_DEPTHS = ["first-look", "on-request"] as const;
export type ProofDepth = (typeof PROOF_DEPTHS)[number];

/** Coarse bands of STANDARD.md section 10: `mobile` covers the two phone bands. */
export const VIEWPORTS = ["mobile", "tablet", "desktop"] as const;
export type Viewport = (typeof VIEWPORTS)[number];

/** One piece of evidence the page offers, where it sits, and why this visitor needs it there. */
export interface ProofItem {
  kind: ProofKind;
  /** What it is: "photographs of three finished bathrooms", "the GDC register number". */
  what: string;
  /** The section it sits in, or the header or a pinned bar. Must be in the page's order. */
  position: ActionPosition;
  depth: ProofDepth;
  because: string;
  /** Source ids that show this exists. With none, it is a claim the client has yet to confirm. */
  evidence?: string[];
}

/**
 * Decision confidence for one page (CHARACTER.md). Optional: a file without
 * it validates and reports exactly as before.
 */
export interface PageConfidence {
  /** The widths the evidence behind these decisions was looked at. Findings from one band are not carried to another. */
  examined?: Viewport[];
  proof?: ProofItem[];
}

export interface PageHierarchy {
  primaryAction: { value: string; positions: ActionPosition[]; because: string; evidence?: string[] };
  order: { role: SectionRole; because: string }[];
  lead: { value: string; subordinate?: string[]; because: string };
  journey: { stage: string; because: string }[];
  /** Optional. Where the page's evidence sits and what is held back; the assessment reads it. */
  confidence?: PageConfidence;
}
export const HIERARCHY_FIELDS = ["primaryAction", "order", "lead", "journey"] as const;

/**
 * The lenses of decision confidence. `evidence` covers both decision
 * confidence and the supporting evidence; `identity` is human accountability.
 * `personality` and `differentiation` are decided in the token layer and are
 * not raised by the file assessment, but a review note can be about either.
 */
export const CONFIDENCE_LENSES = ["relevance", "hierarchy", "evidence", "identity", "action", "disclosure", "personality", "differentiation", "mobile"] as const;
export type ConfidenceLens = (typeof CONFIDENCE_LENSES)[number];

/**
 * How well a finding is known.
 *   observed  the file or the snapshot says so directly. A contradiction.
 *   inferred  a reasonable reading, not checked. A hypothesis.
 *   unknown   needs the client, or a test with visitors. A question.
 * A finding craft raises is never a preference.
 */
export type ConfidenceBasis = "observed" | "inferred" | "unknown";

export interface ConfidenceFinding {
  lens: ConfidenceLens;
  page: PageType;
  basis: ConfidenceBasis;
  /** Where in the file: "hierarchy.home.confidence.proof[1]". */
  at: string;
  message: string;
  /** Why it matters for this visitor. Never a conversion claim. */
  why: string;
}

export interface ArtDirection {
  $schema?: string;
  version: (typeof DIRECTION_VERSIONS)[number];
  client: string;
  /** Who, where, and what they do, in a sentence or two. The brief a model would have been given. */
  brief: string;
  /** Version 2. */
  job?: JobMap;
  /** Version 2. Keyed by page type. */
  hierarchy?: Partial<Record<PageType, PageHierarchy>>;
  sources: DirectionSource[];
  choices: Partial<Record<ChoiceKey, DirectionChoice>>;
  exceptions?: TellException[];
}

export type DirectionSeverity = "error" | "warn";

export interface DirectionProblem {
  severity: DirectionSeverity;
  /** Where in the file: "choices.accent.because", "sources[2].kind". */
  at: string;
  message: string;
}

export interface DirectionReport {
  valid: boolean;
  problems: DirectionProblem[];
  /** How many of the seven choices carry an accepted reason. */
  decided: number;
  /** Decision confidence findings, from every page that records a `confidence` block. Absent when none does. Never affects `valid` or `complete`. */
  confidence?: ConfidenceFinding[];
  /** Each layer on its own. A site is only decided when all three are. */
  layers: {
    job: boolean;
    hierarchy: { page: PageType; decided: number; total: number }[];
    tokens: { decided: number; total: number };
    /** Job decided, at least a home page hierarchy with every field decided, and five of seven tokens. */
    complete: boolean;
  };
}

// ---------------------------------------------------------------------------
// Reviewing a proposed change (CHARACTER.md, "Reviewing a proposed change")
// ---------------------------------------------------------------------------

/**
 * How well the underlying problem is known.
 *   observed    directly supported by something inspected: a screenshot, rendered behaviour, source, a measurement, the page's content
 *   inferred    plausible, supported by something reported (an audit, a stakeholder, a customer) but not inspected
 *   preference  taste or a stakeholder's wish with no stated visitor impact
 *   unknown     cannot be established from what is available
 */
export const REVIEW_BASES = ["observed", "inferred", "preference", "unknown"] as const;
export type ReviewBasis = (typeof REVIEW_BASES)[number];

/** Evidence craft's reviewer looked at, as against evidence somebody reported. Only the first group can make a problem observed. */
export const INSPECTED_KINDS = ["screenshot", "rendered", "source", "measurement", "content"] as const;
export const REPORTED_KINDS = ["audit", "stakeholder", "customer"] as const;
export const EVIDENCE_KINDS = [...INSPECTED_KINDS, ...REPORTED_KINDS] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

/**
 * What a recommendation is worth.
 *   confirmed-correction  fixes a defect someone observed, with a stated visitor impact
 *   design-hypothesis     could improve the visitor's decision, and needs judgement or a check to know
 *   optional-refinement   polish; no important visitor problem is addressed
 *   no-change             the existing design already does the job
 */
export const CHANGE_CLASSES = ["confirmed-correction", "design-hypothesis", "optional-refinement", "no-change"] as const;
export type ChangeClass = (typeof CHANGE_CLASSES)[number];

/**
 * The ladder of minimum effective change, smallest first. The last two are
 * structural and have to say why every smaller step was not enough.
 */
export const CHANGE_STEPS = ["copy", "relocate", "group", "imagery", "trust-placement", "adjust-component", "remove-redundancy", "restructure", "new-component"] as const;
export type ChangeStep = (typeof CHANGE_STEPS)[number];

/** Things a change can add that cost something: each needs a reason, whatever step it comes with. */
export const ADDITIONS = ["carousel", "javascript", "dependency", "animation", "testimonial", "cta", "duplicate-content"] as const;
export type Addition = (typeof ADDITIONS)[number];

export interface ReviewEvidence {
  kind: EvidenceKind;
  /** Where it can be found: a screenshot path, a selector, a quotation, a report. */
  ref: string;
  /** Required for what was rendered or seen: screenshot, rendered, measurement. */
  viewport?: Viewport;
  note?: string;
}

export interface ReviewProposal {
  change: string;
  step: ChangeStep;
  adds?: Addition[];
  /** The section role it moves, removes or replaces. */
  touches?: SectionRole;
}

export interface ReviewNote {
  id: string;
  page?: PageType;
  lens: ConfidenceLens;
  /** What was said or seen, as it was said. */
  observation: string;
  raisedBy: string;
  /** The visitor's problem underneath it, in the visitor's terms. Left out when there is not one. */
  problem?: string;
  basis: ReviewBasis;
  evidence: ReviewEvidence[];
  /** What the problem costs this visitor. A reason, about this client's job. */
  impact?: string;
  /** The widths the note claims to be true of. Default: the widths it was seen at. */
  appliesTo?: Viewport[];
  /** What the person proposed. Judged apart from the problem. */
  suggested?: ReviewProposal;
  /** What the page already has that bears on this: "swipeable project gallery". */
  existing?: string[];
  recommend: ReviewProposal & {
    class: ChangeClass;
    because: string;
    /** Why this step is enough and nothing larger is needed. For a small step with no additions. */
    whyEnough?: string;
    /** For a structural step or any addition: each smaller step and why it would not do. */
    smaller?: { step: ChangeStep; whyNot: string }[];
    /** How a design hypothesis would be checked. */
    validation?: string;
    /** Facts or assets the change depends on. With no source, nobody has supplied them. */
    requires?: { what: string; source?: string }[];
  };
}

export interface DesignReview {
  $schema?: string;
  version: 1;
  /** Who or what was reviewed, and at which width. */
  subject: string;
  notes: ReviewNote[];
}

export type ReviewOutcome = "change" | "hold" | "no-change" | "gather-evidence";
export type SuggestionStanding = "supported" | "narrower-change-preferred" | "not-supported" | "not-needed";

export interface ReviewResult {
  id: string;
  page: PageType;
  lens: ConfidenceLens;
  basis: { declared: ReviewBasis; effective: ReviewBasis };
  suggested?: { standing: SuggestionStanding; reasons: string[] };
  recommend: { declared: ChangeClass; effective: ChangeClass; step?: ChangeStep; withdrawn?: string[] };
  outcome: ReviewOutcome;
  /** Widths the evidence was looked at, the widths the note says anything about, and the ones it says nothing about. */
  widths: { examined: Viewport[]; claimed: Viewport[]; unknown: Viewport[] };
  /** What craft changed about the note's own claims, and why. */
  adjustments: string[];
  /** Facts or assets the change needs and nobody has supplied. */
  outstanding: string[];
}

export interface ReviewReport {
  valid: boolean;
  problems: DirectionProblem[];
  results: ReviewResult[];
  summary: { change: number; hold: number; noChange: number; gatherEvidence: number; verdict: string };
}
