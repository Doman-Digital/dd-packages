/**
 * Register features: the measures a writer steers by when choosing a register.
 *
 * The shape and lexical features ask whether copy reads as generated. These
 * ask something simpler: how long are the sentences, how often does the
 * writer say "you", contract a verb or use the passive. Plain writing, a
 * customer email and a literary paragraph differ on exactly these.
 *
 * Pure and zero-dependency, like `shape.ts`, whose sentence splitter and word
 * counter they share. The calibration readers call the same function, so a
 * published band describes the measure that ships.
 *
 * `passiveShare` is a heuristic: a form of "be" (optionally one adverb) then a
 * participle, with common adjectival participles ("tired", "interested")
 * excluded. It misses "get" passives and catches some predicative adjectives.
 * It is measured, not assumed, before anything relies on it.
 */

import { splitSentences, words } from "../character/shape.js";

export interface RegisterFeatures {
  /** Words per sentence. */
  meanSentenceWords: number;
  /** Contracted forms per 100 words: you'll, it's, don't, we're. */
  contractionsPer100: number;
  /** you, your, yours, yourself, yourselves per 100 words. */
  youPer100: number;
  /** I, me, my, mine, we, us, our, ours per 100 words. */
  firstPersonPer100: number;
  /** Share of sentences with a passive construction. */
  passiveShare: number;
  /** Letters per word. */
  meanWordLength: number;
}

export const REGISTER_FEATURES: readonly (keyof RegisterFeatures)[] = [
  "meanSentenceWords",
  "contractionsPer100",
  "youPer100",
  "firstPersonPer100",
  "passiveShare",
  "meanWordLength",
];

const norm = (w: string): string => w.toLowerCase().replace(/’/g, "'");

const YOU = new Set(["you", "your", "yours", "yourself", "yourselves", "you'll", "you're", "you've", "you'd"]);
const FIRST = new Set(["i", "me", "my", "mine", "we", "us", "our", "ours", "i'm", "i'll", "i've", "i'd", "we're", "we'll", "we've", "we'd"]);

/** A contraction, not a possessive: "it's" and "don't" count, "Sam's" does not. */
const CONTRACTION = /^[a-z]+(?:n't|'ll|'re|'ve|'d|'m)$|^(?:it|that|there|here|what|who|where|how|he|she|let)'s$/;

const BE = "(?:am|is|are|was|were|be|been|being|'s|'re|'m)";
const IRREGULAR =
  "(?:made|done|given|taken|seen|known|shown|written|built|sent|paid|held|told|found|kept|left|brought|bought|thought|taught|caught|sold|put|set|run|cut|chosen|driven|eaten|fallen|forgotten|hidden|broken|spoken|stolen|worn|torn|grown|drawn|thrown|flown|begun|sung|won|lost|met|led|read|heard|meant|spent|built|lent|dealt|felt|sought|fed|bred|laid|said|struck|hung|shut|hit|hurt|let|quit|spread|bound|wound|ground|understood|withdrawn|overseen|undertaken)";
const PASSIVE = new RegExp(`\\b${BE}\\s+(?:[a-z]+ly\\s+)?(?:[a-z]+ed|[a-z]+en|${IRREGULAR})\\b`, "i");

/** Participles that are almost always adjectives after "be": "I am tired", "she was interested". */
const ADJECTIVAL = new Set([
  "tired", "interested", "excited", "pleased", "worried", "concerned", "surprised", "bored", "scared",
  "married", "qualified", "experienced", "based", "located", "committed", "dedicated", "delighted",
  "disappointed", "involved", "prepared", "supposed", "used", "open", "often", "even", "seven", "eleven",
  "listen", "happen", "then", "when", "ten", "garden", "kitchen", "children", "women", "men", "red", "bed", "need", "indeed", "shed", "seed", "feed", "speed", "hundred",
]);

function isPassive(sentence: string): boolean {
  const re = new RegExp(PASSIVE.source, "gi");
  for (const m of sentence.matchAll(re)) {
    const last = norm(m[0].trim().split(/\s+/).pop() ?? "");
    // "given" is a real participle, but "given that" is a preposition phrase.
    if (last === "given" && /given\s+that\b/i.test(sentence.slice(m.index ?? 0))) continue;
    if (!ADJECTIVAL.has(last)) return true;
  }
  return false;
}

export function registerOf(text: string): RegisterFeatures {
  const ss = splitSentences(text);
  const ws = words(text).map(norm);
  const n = ws.length;
  const per100 = (k: number): number => (n === 0 ? 0 : (100 * k) / n);
  const letters = ws.reduce((s, w) => s + w.replace(/[^a-z]/g, "").length, 0);
  return {
    meanSentenceWords: ss.length === 0 ? 0 : n / ss.length,
    contractionsPer100: per100(ws.filter((w) => CONTRACTION.test(w)).length),
    youPer100: per100(ws.filter((w) => YOU.has(w)).length),
    firstPersonPer100: per100(ws.filter((w) => FIRST.has(w)).length),
    passiveShare: ss.length === 0 ? 0 : ss.filter(isPassive).length / ss.length,
    meanWordLength: n === 0 ? 0 : letters / n,
  };
}
