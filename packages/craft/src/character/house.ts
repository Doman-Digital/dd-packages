/**
 * The house copy policy: which copy tells fail a commit.
 *
 * craft ships every tell as `warn`, because a tell is a default, not a
 * mistake. The Doman Digital house goes further for copy: the blocking tier of
 * `COPY.md` is not a judgment call, and a single hit fails. This file is where
 * that is written down, next to the tells it names, so the list of what blocks
 * and the rules that say why live in one package.
 *
 * It used to live in claude-kit's `copy_check.py`, a Python wrapper in another
 * repo. Two lists in two repos is how the old checker drifted from the rules
 * in the first place.
 *
 * `craft copy --gate` applies it. `craft tells list --json` publishes it, so
 * the `copy-check` wrapper reads the policy instead of keeping its own copy.
 *
 *   block     a single finding fails the run
 *   review    printed, never fails
 *   explicit  printed only when a person named the file; never fails
 *
 * A copy tell not named here is `review`: a new tell never breaks a commit.
 * Moving one to `block` needs its estate hits read by a person first (see
 * ROADMAP.md), and `COPY.md` updated in the same change.
 */

export type HouseTier = "block" | "review" | "explicit";

export interface HouseRule {
  tier: HouseTier;
  /** What the finding means, in the words the house rules use. */
  label: string;
}

export const HOUSE: Readonly<Record<string, HouseRule>> = {
  "em-dash": { tier: "block", label: "em dash, use a full stop or a comma" },
  emoji: { tier: "block", label: "emoji" },
  "not-just-but": { tier: "block", label: "contrastive negation. The template is the tell, not the sentiment. Say the positive claim" },
  "no-x-no-y": {
    tier: "block",
    label: '"No X, no Y" list. Defining the brand by what it is not, itemised, is the same template as contrastive negation',
  },
  "no-x-badge": { tier: "block", label: 'standalone "No X" badge. Reads as a slapped-on kicker, and worse when reused across pieces' },
  "ai-phrase": { tier: "block", label: "AI tell" },
  "plainer-word": { tier: "block", label: "a plainer word exists. Name the mechanism instead" },
  "plain-english": { tier: "block", label: 'use "properly explained"' },
  buzzword: { tier: "block", label: "forbidden phrase" },
  "negative-reassurance": { tier: "block", label: "negative reassurance, say what they get" },
  // Evidence of a pasted chat reply, not a matter of style. Moved from review
  // on 2026-09-24 after its estate hits were read (ROADMAP.md): 15 of 15 real.
  "chatbot-residue": { tier: "block", label: "chatbot residue. A chat reply was pasted in: remove it, and source or cut the claim it backed" },

  "review-phrase": { tier: "review", label: "review tier" },
  "ai-vocabulary": { tier: "review", label: "AI vocabulary" },
  "stock-phrase": { tier: "review", label: "stock phrase" },
  "hollow-imperative": { tier: "review", label: "hollow imperative" },
  "rhetorical-opener": { tier: "review", label: "rhetorical question opener" },
  "staccato-triplet": { tier: "review", label: "staccato triplet" },
  "where-x-meets-y": { tier: "review", label: "'where X meets Y'" },
  "ing-tail": { tier: "review", label: "empty -ing tail" },
  "vague-attribution": { tier: "review", label: "unnamed source" },
  "closing-summary": { tier: "review", label: "closing summary" },
  "false-range": { tier: "review", label: "false range" },
  "placeholder": { tier: "review", label: "unfilled placeholder" },
  // Every estate hit so far is real (38 in five DD articles, 2026-09-24), but
  // a proposal can honestly say "the attached research". Review until measured there.
  "prompt-context": { tier: "review", label: "prompt context: the model naming its own inputs" },
  "question-reveal": { tier: "review", label: "staged reveal" },
  "inline-label-list": { tier: "review", label: "bold-label bullets" },
  "phrase-density": { tier: "review", label: "density" },
  "aphorism-density": { tier: "review", label: "density" },
  "contraction-scarcity": { tier: "review", label: "density" },
  "sentence-rhythm": { tier: "review", label: "density" },
  "repeated-sentence": { tier: "review", label: "repetition" },
  "heading-shape": { tier: "review", label: "headings" },
  "heading-echo": { tier: "review", label: "headings" },
  // A threshold on a count, not a named pattern: a person decides whether the
  // headline needed a particular. Review until its estate hits are read.
  "generic-hero-claim": { tier: "review", label: "headline that fits any business" },

  // Banned only "when vague", per the rules. Too noisy for a sweep.
  "vague-word": { tier: "explicit", label: "vague" },
};

/** The house rule for a copy tell. Unknown ids are review, so a new tell never blocks. */
export function houseRule(id: string, name = id): HouseRule {
  return HOUSE[id] ?? { tier: "review", label: name };
}

/**
 * What a repo may and may not do to the house gate.
 *
 * A repo can raise a tell's severity in `craft.config.json`, or except a
 * design tell in `art-direction.json`. It cannot lower the blocking tier: a
 * `warn` or `off` there, or an exception naming a blocking tell, would let one
 * line and one sentence switch off a rule COPY.md calls not a judgment call,
 * in every commit that repo makes. `chatbot-residue` is the sharpest case: it
 * is evidence of a paste, and no client reason makes a paste acceptable.
 *
 * A genuine one-off (a style guide quoting an em dash, a testimonial) takes
 * `copy-ok` on its line: local, in the diff a reviewer reads, and listed in
 * every report. A rule that is wrong for everyone is changed here.
 */
export const HOUSE_LOCKED =
  "the house blocking tier cannot be lowered by a repo. A genuine one-off takes copy-ok on its line; a rule that is wrong is changed in craft's house.ts and COPY.md";

export function holdHouseBlocks<E extends { tell: string }, O extends { level: string }>(
  exceptions: E[],
  severity: Record<string, O>,
): { exceptions: E[]; severity: Record<string, O>; refused: E[]; refusedSeverity: string[] } {
  const blocks = (tell: string) => HOUSE[tell]?.tier === "block";
  const refusedSeverity = Object.entries(severity)
    .filter(([tell, o]) => blocks(tell) && o.level !== "block")
    .map(([tell]) => tell);
  return {
    exceptions: exceptions.filter((e) => !blocks(e.tell)),
    refused: exceptions.filter((e) => blocks(e.tell)),
    severity: Object.fromEntries(Object.entries(severity).filter(([tell]) => !refusedSeverity.includes(tell))),
    refusedSeverity,
  };
}
