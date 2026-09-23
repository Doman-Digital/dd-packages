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

export const DIRECTION_VERSION = 1;

/** Where a reason comes from. Deliberately physical: a mood board is not a source. */
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
}

/** The expressive choices. Layout and navigation are not here: they stay conventional. */
export const CHOICE_KEYS = ["accent", "ground", "display", "body", "shape", "motif", "signature"] as const;
export type ChoiceKey = (typeof CHOICE_KEYS)[number];

export interface DirectionChoice {
  /** A colour as hex for accent and ground, a family name for display and body, words otherwise. */
  value: string;
  because: string;
  /** Source ids this reason rests on. */
  evidence: string[];
}

export interface ArtDirection {
  $schema?: string;
  version: typeof DIRECTION_VERSION;
  client: string;
  /** Who, where, and what they do, in a sentence or two. The brief a model would have been given. */
  brief: string;
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
}
