/**
 * Lexical and specificity features for a short block of copy.
 *
 * The sentence-shape features (shape.ts) did not separate model copy from
 * people's at blurb length. These measure what a block says and which words it
 * reaches for: how many of the tell words and phrases craft already lists, how
 * many words with published excess-use evidence, and how particular the block
 * is (names, places, figures, the nouns of the trade).
 *
 * Pure and zero-dependency, and used both by the calibration scripts and by
 * any tell that ships on the result.
 *
 * Every word in STUDY_WORDS carries its source. Models change what they
 * over-use between generations (Juzek and Ward found "boasts" gone and
 * "underscore" up sharply from GPT-3.5 to GPT-4o-mini), so a listed word is a
 * measurement with a date, not a fact about models.
 */

import { AI_PHRASES, AI_WORDS, BUZZWORDS, PLAINER_WORDS, STOCK_PHRASES } from "./tells/copy.js";
import { countWords, specificity } from "./specificity.js";

export interface StudyWord {
  word: string;
  source: string;
}

const JUZEK = "Juzek and Ward, arXiv:2412.11385, Appendix A (PubMed abstracts, 2020 to 2024)";

/**
 * Words with published excess-use evidence. Academic register, so a word here
 * is a candidate to measure in marketing copy, not a tell.
 */
export const STUDY_WORDS: readonly StudyWord[] = [
  "delves", "delved", "delving", "delve",
  "showcasing", "boasts", "underscores", "underscoring",
  "comprehending", "intricacies", "surpassing", "intricate",
].map((word) => ({ word, source: JUZEK }));

/** Every word or phrase the features look for, with where it came from. */
export function vocabulary(): { word: string; source: string }[] {
  const seen = new Set<string>();
  const out: { word: string; source: string }[] = [];
  const add = (word: string, source: string) => {
    const w = word.toLowerCase();
    if (seen.has(w)) return;
    seen.add(w);
    out.push({ word: w, source });
  };
  for (const s of STUDY_WORDS) add(s.word, s.source);
  for (const w of AI_WORDS) add(w, "AI_WORDS");
  for (const w of PLAINER_WORDS) add(w, "PLAINER_WORDS");
  for (const w of AI_PHRASES) add(w, "AI_PHRASES");
  for (const w of STOCK_PHRASES) add(w, "STOCK_PHRASES");
  for (const w of BUZZWORDS) add(w, "BUZZWORDS");
  return out;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pattern = (w: string) => new RegExp(`(?<![\\w-])${escape(w).replace(/\s+/g, "\\s+")}(?![\\w-])`, "gi");

let compiled: { word: string; source: string; re: RegExp }[] | null = null;
const patterns = () => (compiled ??= vocabulary().map((v) => ({ ...v, re: pattern(v.word) })));

const plain = (text: string) => text.replace(/[’‘]/g, "'").replace(/\s+/g, " ");

/** Occurrences per vocabulary word in the text. */
export function vocabularyCounts(text: string): Map<string, number> {
  const t = plain(text);
  const out = new Map<string, number>();
  for (const { word, re } of patterns()) {
    const n = (t.match(re) ?? []).length;
    if (n) out.set(word, n);
  }
  return out;
}

export interface LexicalFeatures {
  /** Hits from craft's own tell lists, per 100 words. */
  listRate: number;
  /** Hits from the published excess-use words, per 100 words. */
  studyRate: number;
  /** Distinct specifics (names, places, figures, dates, contact details, brief terms) per 100 words. */
  hardPer100: number;
  /** Distinct trade nouns per 100 words. */
  tradePer100: number;
  /** All specifics per 100 words. */
  specificsPer100: number;
  /** 1 when there is no hard specific and fewer than two trade nouns. */
  generic: number;
  /** Distinct money, date, time and number specifics. */
  figures: number;
  /** Distinct names and brief terms. */
  names: number;
}

export const LEXICAL_FEATURES: readonly (keyof LexicalFeatures)[] = [
  "listRate",
  "studyRate",
  "hardPer100",
  "tradePer100",
  "specificsPer100",
  "generic",
  "figures",
  "names",
];

const STUDY = new Set(STUDY_WORDS.map((s) => s.word));
/** craft's own lists. A word can be in both this and STUDY: it counts once in each rate. */
const LISTED = new Set([...AI_WORDS, ...PLAINER_WORDS, ...AI_PHRASES, ...STOCK_PHRASES, ...BUZZWORDS].map((w) => w.toLowerCase()));

const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function lexicalOf(text: string, brief?: string): LexicalFeatures {
  const words = Math.max(1, countWords(text));
  const counts = vocabularyCounts(text);
  let list = 0;
  let study = 0;
  for (const [w, n] of counts) {
    if (STUDY.has(w)) study += n;
    if (LISTED.has(w)) list += n;
  }
  const s = specificity(text, brief);
  const kind = (...k: string[]) => s.specifics.filter((x) => k.includes(x.kind)).length;
  return {
    listRate: r3((list / words) * 100),
    studyRate: r3((study / words) * 100),
    hardPer100: r3((s.hard / words) * 100),
    tradePer100: r3((s.trade / words) * 100),
    specificsPer100: r3(s.perHundred),
    generic: s.generic ? 1 : 0,
    figures: kind("money", "date", "time", "number"),
    names: kind("name", "brief"),
  };
}
