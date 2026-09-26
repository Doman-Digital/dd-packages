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

export interface PageHierarchy {
  primaryAction: { value: string; positions: ActionPosition[]; because: string; evidence?: string[] };
  order: { role: SectionRole; because: string }[];
  lead: { value: string; subordinate?: string[]; because: string };
  journey: { stage: string; because: string }[];
}
export const HIERARCHY_FIELDS = ["primaryAction", "order", "lead", "journey"] as const;

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
  /** Each layer on its own. A site is only decided when all three are. */
  layers: {
    job: boolean;
    hierarchy: { page: PageType; decided: number; total: number }[];
    tokens: { decided: number; total: number };
    /** Job decided, at least a home page hierarchy with every field decided, and five of seven tokens. */
    complete: boolean;
  };
}
