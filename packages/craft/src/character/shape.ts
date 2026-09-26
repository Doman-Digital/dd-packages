/**
 * Shape features: how a short block of copy is built, not which words it uses.
 *
 * A three-sentence blurb can pass every vocabulary tell and still read as
 * generated, because the tell is the construction: a parallel triad, a
 * conditional stacked between commas, a close that hedges. The density tier
 * cannot see this; it skips anything under 400 words.
 *
 * Pure and zero-dependency. The calibration scripts under `scripts/shape/`
 * and any future calibrated tells call the same functions, so a published
 * effect size describes the detector that ships.
 *
 * Several features stand in for part-of-speech measures (phrasal
 * coordination, template skeletons) with word lists. They are approximate by
 * design, and measured, not assumed, before anything ships on them.
 */

// ------------------------------------------------------------- text basics

const ABBREVIATIONS = /\b(?:e\.g|i\.e|etc|vs|Mr|Mrs|Ms|Dr|St|No|approx|incl|Ltd|Co|Inc|Jr|Sr)\./g;
const DOT = "\u0000";

/** Sentences in a block. Abbreviations and decimals do not end one. */
export function splitSentences(text: string): string[] {
  const guarded = text
    .replace(/\s+/g, " ")
    .replace(ABBREVIATIONS, (m) => m.replace(/\./g, DOT))
    .replace(/(\d)\.(\d)/g, `$1${DOT}$2`);
  return guarded
    .split(/(?<=[.!?]["'’”)]*)\s+(?=["'‘“(]?[A-Z0-9£$€])/)
    .map((s) => s.split(DOT).join(".").trim())
    .filter((s) => words(s).length > 0);
}

const WORD = /[A-Za-z0-9£$€][A-Za-z0-9£$€%'’-]*/g;

export function words(text: string): string[] {
  return text.match(WORD) ?? [];
}

const lower = (w: string): string => w.toLowerCase().replace(/’/g, "'");

/** Words that carry grammar rather than content. Also the skeleton's kept set. */
export const FUNCTION_WORDS = new Set(
  (
    "a an the this that these those my your our their his her its we you they i he she it me us them " +
    "and or but nor so yet for if when while where whereas because although though unless once since until as than " +
    "of to in on at by with from into onto over under about after before between through during without within across " +
    "is are was were be been being am do does did done have has had will would can could may might must shall should " +
    "not no every each all any some more most many much few such own same other only just also very too " +
    "there here what which who whom whose how why then which's it's you'll we'll you're we're they're don't won't can't isn't aren't"
  ).split(" "),
);

// ------------------------------------------------------------- features

/**
 * "A, B and C" with short items. `parallel` when the items share their first
 * word ("your business, your website and your systems"), the construction a
 * model reaches for to sound complete.
 */
export interface Tricolon {
  text: string;
  parallel: boolean;
}

const ITEM = "[A-Za-z0-9£$€'’-]+(?: [A-Za-z0-9£$€'’-]+){0,5}";
const TRICOLON = new RegExp(`(${ITEM}), (${ITEM}),? (and|or) (${ITEM})(?=[,.;:!?)]|$)`, "g");

export function tricolons(sentence: string): Tricolon[] {
  const s = sentence.replace(/\s+/g, " ");
  const out: Tricolon[] = [];
  for (const m of s.matchAll(TRICOLON)) {
    const [, aSpan, b, , c] = m;
    const bWords = words(b);
    const cWords = words(c);
    // The third item runs to the clause end: past six words it is a clause, not an item.
    if (bWords.length === 0 || cWords.length === 0 || cWords.length > 6) continue;
    const aWords = words(aSpan);
    const a = aWords.slice(-Math.max(1, bWords.length));
    const lead = lower(bWords[0]);
    // Two of the three items opening on the same word is enough: "your business, your website and the systems".
    const parallel = bWords.length >= 2 && FUNCTION_WORDS.has(lead) && (lower(cWords[0]) === lead || lower(a[0]) === lead);
    out.push({ text: m[0], parallel });
  }
  return out;
}

/** "X, and if Y, Z": a condition parked between commas after a coordinator. */
const STACKED = /,\s+(?:and|but|so|or)\s+(?:if|when|where|once|unless|provided)\b[^,.;!?]{1,60},/i;

export function stackedConditional(sentence: string): boolean {
  return STACKED.test(sentence);
}

const SUBORDINATOR = /\b(?:if|when|which|because|so|while|where)\b/gi;

/** Commas plus subordinators: how many clauses a sentence stacks. */
export function clauseDepth(sentence: string): number {
  return (sentence.match(/,/g) ?? []).length + (sentence.match(SUBORDINATOR) ?? []).length;
}

/** Qualifiers that cover every base. Multi-word entries first so they win. */
const HEDGES = [
  "if it's a fit",
  "if it is a fit",
  "where needed",
  "if needed",
  "as needed",
  "where appropriate",
  "if appropriate",
  "as appropriate",
  "as required",
  "where required",
  "if required",
  "where possible",
  "if possible",
  "where relevant",
  "if relevant",
  "depending on",
  "can help",
  "tend to",
  "tends to",
  "may",
  "might",
  "could",
  "typically",
  "usually",
  "generally",
  "often",
  "potentially",
  "likely",
];
const HEDGE = new RegExp(`\\b(?:${HEDGES.map((h) => h.replace(/'/g, "['’]").replace(/ /g, "\\s+")).join("|")})\\b`, "gi");
const CONDITIONAL_CLOSE = /\b(?:if|unless|where|provided|depending)\b/i;

export function hedgeCount(text: string): number {
  return (text.match(HEDGE) ?? []).length;
}

/** The last sentence ends the block on a qualifier or a condition. */
export function hedgedClose(sentences: string[]): boolean {
  const last = sentences[sentences.length - 1];
  if (!last) return false;
  HEDGE.lastIndex = 0;
  return HEDGE.test(last) || CONDITIONAL_CLOSE.test(last);
}

const NOMINAL = /^[a-z]{3,}(?:tion|sion|ment|ness|ity|ance|ence)s?$/;
const NOT_NOMINAL = new Set(
  [
    "nation station ration lotion potion portion question moment cement comment element garment segment fragment apartment document ointment",
    "city pity entity quality sentence science audience silence balance finance distance instance entrance substance romance province",
  ]
    .join(" ")
    .split(" ")
    .flatMap((w) => [w, `${w}s`]),
);

export function nominalisations(text: string): number {
  return words(text).filter((w) => {
    const l = lower(w);
    return NOMINAL.test(l) && !NOT_NOMINAL.has(l);
  }).length;
}

const PRONOUN_OPENER = /^["'‘“(]?(?:you|your|we|our)\b/i;
const TRANSITION_OPENER = /^["'‘“(]?(?:however|moreover|additionally|furthermore|thus|therefore|consequently|in addition|as a result|ultimately|overall|importantly|notably)\b/i;
const IMPERSONAL_OPENER = /^["'‘“(]?(?:it is|it's|it’s|there is|there are|there's|there’s)\b/i;

/** Words ending -ing that are not participles. */
const NOT_PARTICIPLE = new Set(
  "thing nothing something anything everything bring string spring sting swing king ring sing wing during morning evening ceiling building meeting wedding pudding clothing lightning including".split(" "),
);

/**
 * Present participial clauses: ", making it easy to..." after a comma, or a
 * sentence that opens on a participle ("Building on this, ..."). Reported at
 * 5.3 times the human rate in GPT-4o text (PMC11874169). `ing-tail` is a narrow
 * form of this.
 */
export function participialClauses(sentence: string): number {
  let n = 0;
  for (const m of sentence.matchAll(/,\s+([A-Za-z]{2,}ing)\b/g)) if (!NOT_PARTICIPLE.has(lower(m[1]))) n += 1;
  const open = sentence.match(/^["'‘“(]?([A-Z][a-z]{2,}ing)\b[^,]{0,60},/);
  if (open && !NOT_PARTICIPLE.has(lower(open[1]))) n += 1;
  return n;
}

/**
 * "X and Y" where both sides are single content words ("enquiries and admin",
 * "clear and simple"). A word-list stand-in for phrasal coordination, reported
 * at 1.9 times the human rate (PMC11874169). Not preceded by a comma, so a
 * tricolon's last item is not counted twice.
 */
export function phrasalCoordinations(sentence: string): number {
  let n = 0;
  for (const m of sentence.matchAll(/(^|[^,]\s)([A-Za-z][a-z'’-]{2,}) (?:and|or) ([A-Za-z][a-z'’-]{2,})\b/g)) {
    const a = lower(m[2]);
    const b = lower(m[3]);
    if (FUNCTION_WORDS.has(a) || FUNCTION_WORDS.has(b) || a.endsWith("ly") || b.endsWith("ly")) continue;
    n += 1;
  }
  return n;
}

/**
 * A sentence reduced to its function words, with one `_` for each run of
 * content words. Experimental: a stand-in for part-of-speech templates
 * (Shaib et al., EMNLP 2024), which need a tagger craft does not carry.
 */
export function skeleton(sentence: string): string[] {
  const out: string[] = [];
  for (const w of words(sentence)) {
    const l = lower(w);
    const token = FUNCTION_WORDS.has(l) ? l : "_";
    if (token === "_" && out[out.length - 1] === "_") continue;
    out.push(token);
  }
  return out;
}

/** Share of the block's skeleton 4-grams that occur more than once. */
export function skeletonRepeat(sentences: string[]): number {
  const grams = new Map<string, number>();
  let total = 0;
  for (const s of sentences) {
    const sk = skeleton(s);
    for (let i = 0; i + 4 <= sk.length; i += 1) {
      const g = sk.slice(i, i + 4).join(" ");
      grams.set(g, (grams.get(g) ?? 0) + 1);
      total += 1;
    }
  }
  if (total === 0) return 0;
  let repeated = 0;
  for (const count of grams.values()) if (count > 1) repeated += count;
  return repeated / total;
}

const mean = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;
const sd = (xs: number[]): number => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
};

/** Coefficient of variation; null below `min` items, where it means nothing. */
export function cv(xs: number[], min: number): number | null {
  if (xs.length < min) return null;
  const m = mean(xs);
  return m === 0 ? null : sd(xs) / m;
}

// ------------------------------------------------------------- one block

export interface ShapeFeatures {
  sentences: number;
  words: number;
  tricolons: number;
  parallelTriads: number;
  stackedConditionals: number;
  /** Mean clauses per sentence. */
  clauseDepth: number;
  /** Sentence-length CV; null under three sentences. */
  sentenceCv: number | null;
  /** Hedges per 100 words. */
  hedgeRate: number;
  hedgedClose: boolean;
  /** Nominalisations per 100 words. */
  nominalisationRate: number;
  pronounOpenerShare: number;
  transitionOpenerShare: number;
  impersonalOpenerShare: number;
  commasPerSentence: number;
  commasPer100: number;
  /** Participial clauses per sentence. */
  participialRate: number;
  /** Phrasal coordinations per 100 words. */
  coordinationRate: number;
  /** Experimental. */
  skeletonRepeat: number;
}

/** Every feature for one block of copy: a paragraph, a blurb, an email body. */
export function shapeOf(text: string): ShapeFeatures {
  const ss = splitSentences(text);
  const wordCount = words(text).length;
  const per100 = (n: number): number => (wordCount === 0 ? 0 : (100 * n) / wordCount);
  const share = (re: RegExp): number => (ss.length === 0 ? 0 : ss.filter((s) => re.test(s)).length / ss.length);
  const tri = ss.flatMap(tricolons);
  const commas = (text.match(/,/g) ?? []).length;
  return {
    sentences: ss.length,
    words: wordCount,
    tricolons: tri.length,
    parallelTriads: tri.filter((t) => t.parallel).length,
    stackedConditionals: ss.filter(stackedConditional).length,
    clauseDepth: ss.length === 0 ? 0 : mean(ss.map(clauseDepth)),
    sentenceCv: cv(ss.map((s) => words(s).length), 3),
    hedgeRate: per100(hedgeCount(text)),
    hedgedClose: hedgedClose(ss),
    nominalisationRate: per100(nominalisations(text)),
    pronounOpenerShare: share(PRONOUN_OPENER),
    transitionOpenerShare: share(TRANSITION_OPENER),
    impersonalOpenerShare: share(IMPERSONAL_OPENER),
    commasPerSentence: ss.length === 0 ? 0 : commas / ss.length,
    commasPer100: per100(commas),
    participialRate: ss.length === 0 ? 0 : ss.reduce((s, x) => s + participialClauses(x), 0) / ss.length,
    coordinationRate: per100(ss.reduce((s, x) => s + phrasalCoordinations(x), 0)),
    skeletonRepeat: skeletonRepeat(ss),
  };
}

/** How many distinct shape moves a block makes. What a reader reacts to is the stack. */
export function shapeMoves(f: ShapeFeatures): string[] {
  const out: string[] = [];
  if (f.parallelTriads > 0) out.push("parallel triad");
  else if (f.tricolons > 0) out.push("tricolon");
  if (f.stackedConditionals > 0) out.push("stacked conditional");
  if (f.hedgedClose) out.push("hedged close");
  if (f.participialRate > 0) out.push("participial clause");
  return out;
}

/** Paragraph-length CV for a document of four or more paragraphs; null below. */
export function paragraphUniformity(paragraphs: string[]): number | null {
  return cv(
    paragraphs.map((p) => words(p).length).filter((n) => n > 0),
    4,
  );
}

/** A block the size of a blurb: 2 to 8 sentences, 20 to 160 words. */
export function isBlurb(f: Pick<ShapeFeatures, "sentences" | "words">): boolean {
  return f.sentences >= 2 && f.sentences <= 8 && f.words >= 20 && f.words <= 160;
}
