/**
 * The reason rule, one standard for every layer of an art direction.
 *
 * A reason has to be specific enough that whoever reads the file next (a
 * person, Claude, a future tool) cannot drift back to the category default
 * while following it. "Freight Display, because MMM's photography needs to be
 * the hero and the type needs to recede" passes. "Freight Display" does not,
 * and neither does "a familiar structure so visitors feel comfortable".
 *
 * Wording rules catch the common ways a default gets dressed up as a reason.
 * They are lexical, so they can be rephrased around; the tie is the real
 * guard. A token's reason must mention what its evidence shows. A hierarchy
 * reason must use this client's job: pasted onto another client's file, it
 * has to fail.
 *
 * Pure.
 */

import { CUSTOMER_KINDS, type DirectionProblem, type DirectionSource, type JobMap } from "./types.js";

export const PROPOSED = "PROPOSED:";

/**
 * Reasons that are preferences, not evidence. "The client likes it" may be
 * true and still say nothing about why this site should look this way.
 */
export const PREFERENCE = /\b(?:client (?:likes|liked|wants|wanted|asked|chose|prefers?)|(?:we|they|i) (?:like|liked|love|loved|prefer)|on[- ]trend|trendy|popular|brand (?:colou?r|font|guidelines?) (?:is|are|says?))\b/i;

/** Adjectives that describe a mood rather than a source. Two or more and the reason is a mood board. */
export const MOOD = /\b(?:modern|clean|fresh|professional|trustworthy|premium|elegant|sleek|timeless|minimal(?:ist)?|bold|vibrant|friendly|approachable|luxur(?:y|ious)|sophisticated|contemporary|stylish|warm|inviting|high[- ]end)\b/gi;

/**
 * A default stated as a reason. Three families: authority ("best practice"),
 * the crowd ("what competitors do", "most salon sites") and familiarity
 * ("a familiar layout", "what visitors are used to"). Each is the category
 * average speaking, which is what the art direction exists to replace.
 */
export const CONVENTION = new RegExp(
  [
    // authority
    String.raw`industry[- ]standard`,
    String.raw`best[- ]practices?`,
    String.raw`the norm\b`,
    String.raw`standard (?:layout|structure|practice|pattern|format)`,
    String.raw`tried[- ]and[- ]tested`,
    String.raw`proven (?:layout|structure|pattern|format)`,
    // the crowd
    String.raw`(?:most|other|typical|many|all|similar)\s+(?:\w+\s+){0,2}(?:web)?sites\b`,
    String.raw`competitors?(?:'|’)?s?\b`,
    String.raw`(?:like|as) (?:everyone|everybody|all the others|the rest)\b`,
    String.raw`commonly used`,
    String.raw`(?:what|how) (?:everyone|others|the industry) (?:does|do|uses?)`,
    // familiarity
    String.raw`familiar (?:layout|structure|pattern|format|order|shape|design)`,
    String.raw`recogni[sz]able (?:layout|structure|pattern|format|order)`,
    String.raw`conventional(?:ly)?\b`,
    String.raw`(?:visitors|users|people|customers|anyone) (?:are|is) used to`,
    String.raw`feels? (?:at home|comfortable|familiar)(?: with)?(?: the)? (?:layout|site|page|structure|design)?`,
    String.raw`intuitive(?:ly)?\b`,
    String.raw`as usual\b`,
    String.raw`what (?:visitors|users|people) expect\b`,
  ].join("|"),
  "i",
);

/**
 * Words too common to tie a reason to anything: every job has a customer who
 * wants help and has to trust someone. Sharing only these is not a tie.
 */
const GENERIC = new Set(
  "customer customers visitor visitors client clients people person someone business businesses service services website site page pages want wants need needs help first before after know feel time work good right sure make find look looking trust reason reasons thing things just really very able also".split(" "),
);

const STOP = new Set(["with", "that", "this", "from", "their", "they", "have", "been", "were", "which", "what", "when", "where", "there", "about", "into", "onto", "over", "same", "each", "every", "your", "them", "then", "than", "will", "would", "could", "should", "because", "so", "the", "and"]);

/**
 * Words that describe a value rather than a source. "Green because the van is
 * green" names the van; "green because green is calming" only names green.
 */
const VALUE_WORDS = new Set(["green", "blue", "navy", "black", "white", "cream", "grey", "gray", "gold", "yellow", "orange", "purple", "violet", "pink", "brown", "teal", "bottle", "dark", "light", "deep", "pale", "bright", "colour", "color", "font", "face", "serif", "sans", "type", "lettering"]);

/** Content words, lower-case, with a possessive stripped and short words dropped. */
export function contentWords(text: string): Set<string> {
  return new Set(
    (text.toLowerCase().match(/[a-z][a-z'’-]{3,}/g) ?? [])
      .map((w) => w.replace(/['’]s$/, "").replace(/['’]/g, ""))
      .filter((w) => !STOP.has(w) && !VALUE_WORDS.has(w) && !GENERIC.has(w)),
  );
}

/** Crude stemming: enough that "calls" meets "call" and "booking" meets "book". */
const stem = (w: string): string => w.replace(/(?:ing|ers|er|ed|es|s)$/, "");

function shares(a: Set<string>, b: Set<string>): string[] {
  const bs = new Set([...b].map(stem));
  return [...a].filter((w) => bs.has(stem(w)));
}

/** Every word of the job a hierarchy reason may tie to. */
export function jobWords(job: JobMap): Set<string> {
  return contentWords(
    [
      job.statement?.verb,
      job.statement?.object,
      job.statement?.context,
      job.functional?.value,
      job.emotional?.value,
      job.social?.value,
      ...(Array.isArray(job.objections) ? job.objections : []),
      ...(Array.isArray(job.language) ? job.language : []),
    ]
      .filter((x): x is string => typeof x === "string")
      .join(" "),
  );
}

export const isCustomerVoice = (s: DirectionSource | undefined): boolean => Boolean(s && (CUSTOMER_KINDS as readonly string[]).includes(s.kind));

export interface ReasonInput {
  /** Where in the file: "choices.accent", "hierarchy.home.order[2]". Problems land at `${at}.because` and `${at}.evidence`. */
  at: string;
  because: unknown;
  evidence?: unknown;
  sources: DirectionSource[];
  /**
   * What the reason must be about.
   *   source    mentions what its cited evidence shows (tokens)
   *   customer  the same, and every cited source is the customer's own words (the job map)
   *   job       uses this client's job (hierarchy); evidence optional
   */
  tie: "source" | "customer" | "job";
  job?: JobMap;
}

/** Problems with one reason. None means it counts as decided. */
export function checkReason(input: ReasonInput): DirectionProblem[] {
  const problems: DirectionProblem[] = [];
  const err = (field: "because" | "evidence", message: string) => problems.push({ severity: "error", at: `${input.at}.${field}`, message });
  const because = typeof input.because === "string" ? input.because.trim() : "";
  const evidence = Array.isArray(input.evidence) ? (input.evidence as unknown[]).filter((e): e is string => typeof e === "string") : [];
  if (input.evidence !== undefined && (!Array.isArray(input.evidence) || input.evidence.some((e) => typeof e !== "string"))) err("evidence", "evidence must be a list of source ids");
  const ids = new Map(input.sources.filter((s) => s && typeof s.id === "string").map((s) => [s.id, s]));

  if (because.split(/\s+/).filter(Boolean).length < 8) {
    err("because", "a reason is at least a sentence. Without one this is a default, however good it looks.");
    return problems;
  }
  if (because.startsWith(PROPOSED)) {
    err("because", "a proposal, not yet a decision. Check it against the source, then rewrite the reason in your own words.");
    return problems;
  }
  if (PREFERENCE.test(because)) err("because", "that is a preference, not a reason. Say what in the client's world this comes from.");
  const moods = because.match(MOOD) ?? [];
  if (moods.length >= 2) err("because", `"${moods.join(", ")}" describes a mood, not a source. Name the thing it comes from.`);
  const convention = because.match(CONVENTION);
  if (convention) {
    err("because", `"${convention[0]}" is the category's default speaking, not a reason. Say what in this client's job or world it answers.`);
  }

  const needsEvidence = input.tie !== "job";
  if (needsEvidence && evidence.length === 0) err("evidence", "cite at least one source");
  for (const id of evidence) if (!ids.has(id)) err("evidence", `no source called "${id}"`);
  if (input.tie === "customer") {
    for (const id of evidence) {
      if (ids.has(id) && !isCustomerVoice(ids.get(id))) err("evidence", `"${id}" is a ${ids.get(id)!.kind}. The job is evidenced by the customer's own words: ${CUSTOMER_KINDS.join(", ")}.`);
    }
  }
  if (input.tie === "source") {
    for (const id of evidence) {
      if (isCustomerVoice(ids.get(id))) err("evidence", `"${id}" is customer voice. Token decisions need a physical source or an outside-category reference.`);
    }
  }
  if (problems.length) return problems;

  const words = contentWords(because);
  if (input.tie === "job") {
    if (!input.job) {
      err("because", "a structural reason is checked against the job, and the file has no job map yet");
    } else if (shares(words, jobWords(input.job)).length === 0) {
      err("because", "the reason does not use this client's job (its statement, objections or the customer's words). A reason that would fit any client's site is a default.");
    }
  } else {
    const cited = evidence.map((id) => ids.get(id)!);
    const tied = cited.some((s) => words.has(s.id) || shares(words, contentWords(`${s.note} ${s.lettering ?? ""}`)).length > 0);
    if (!tied) err("because", `the reason does not mention what its evidence shows (${evidence.join(", ")}). Say what on it this comes from.`);
  }
  return problems;
}
