/**
 * Density tells: what a per-line pass cannot see.
 *
 * Every other copy tell fires on one sentence read in isolation. These fire on
 * a rate. Each instance is ordinary English, and only the count gives it away:
 * a 30-page proposal once passed every per-line rule and still carried "rather
 * than" 54 times, no contractions, and one sentence pasted onto two pages.
 *
 * They read documents only: Markdown, MDX, plain text and HTML. A component or
 * a content module holds strings from many pages, so a rate over it means
 * nothing. A document under 400 words is skipped, because three of anything on
 * a short page is coincidence.
 *
 * Thresholds are allowed uses and scale with length: a floor, plus a rate per
 * 1,000 words. A fixed 5 was right for a page and wrong for a proposal.
 */

import type { CopyBlock, CopyContext, CopyTell, Hit, SourceFile } from "../types.js";

const DOCUMENT = /\.(md|markdown|mdx|txt|html?)$/i;
const MIN_WORDS = 400;

interface Doc {
  path: string;
  blocks: CopyBlock[];
  words: number;
}

const WORD = /[A-Za-z0-9£$€][\w'’£$€%.,-]*/g;
const countWords = (text: string): number => (text.match(WORD) ?? []).length;

/**
 * The prose of each document, from the same extraction every copy tell reads.
 * HTML is read as text between tags, so `class="small"` is not a word and a
 * phrase split by an inline `<strong>` is still one phrase.
 */
function documents(ctx: CopyContext): Doc[] {
  const byPath = new Map<string, CopyBlock[]>();
  for (const block of ctx.blocks) {
    // An attribute value (a meta description, alt text) is not body prose: the
    // page shows it once, however many places the source repeats it.
    if (!DOCUMENT.test(block.path) || block.literal) continue;
    const list = byPath.get(block.path) ?? [];
    list.push(block);
    byPath.set(block.path, list);
  }
  const docs: Doc[] = [];
  for (const [path, blocks] of byPath) {
    const text = blocks.map((b) => withoutHeadings(b.text)).join("\n");
    const words = countWords(text);
    if (words >= MIN_WORDS) docs.push({ path, blocks, words });
  }
  return docs;
}

/** Markdown headings are counted by the heading tells, not as prose. */
const withoutHeadings = (text: string): string => text.replace(/^\s{0,3}#{1,6}\s.*$/gm, "");

const allowed = (doc: Doc, floor: number, per1000: number): number => Math.max(floor, Math.floor((doc.words * per1000) / 1000));

const thousands = (n: number): string => n.toLocaleString("en-GB");

interface Sentence {
  text: string;
  offset: number;
}

/** Sentences with their file offsets. Headings and blank lines are boundaries. */
function sentences(doc: Doc): Sentence[] {
  const out: Sentence[] = [];
  for (const block of doc.blocks) {
    const text = withoutHeadings(block.text);
    for (const para of text.matchAll(/[^\n]+(?:\n(?!\s*\n)[^\n]+)*/g)) {
      const body = para[0];
      const start = para.index ?? 0;
      for (const m of body.matchAll(/[^.!?]+[.!?]+["'’”)]*|[^.!?]+$/g)) {
        const raw = m[0];
        const trimmed = raw.trim();
        if (countWords(trimmed) === 0) continue;
        const lead = raw.length - raw.trimStart().length;
        out.push({ text: trimmed.replace(/\s+/g, " "), offset: block.offset + start + (m.index ?? 0) + lead });
      }
    }
  }
  return out;
}

// ------------------------------------------------------------- phrase rates

/**
 * One move repeated. Each pattern is an allowed rate; above it, the document
 * is leaning on that move. `opener` patterns count only at a sentence start.
 */
interface Rate {
  label: string;
  pattern: RegExp;
  floor: number;
  per1000: number;
  opener?: boolean;
  why: string;
}

export const RATES: Rate[] = [
  { label: "rather than", pattern: /\brather\s+than\b/i, floor: 4, per1000: 0.9, why: "the document's one move" },
  { label: "instead of", pattern: /\binstead\s+of\b/i, floor: 4, per1000: 0.7, why: "the reflex swap once 'rather than' is edited out" },
  { label: "actually", pattern: /\bactually\b/i, floor: 2, per1000: 0.35, why: "filler, the sentence means the same without it" },
  { label: "properly", pattern: /\bproperly\b/i, floor: 3, per1000: 0.4, why: "filler, the sentence means the same without it" },
  { label: "genuinely", pattern: /\bgenuinely\b/i, floor: 1, per1000: 0.2, why: "reaching for sincerity: one is emphasis, two is a tic" },
  {
    label: "the single ...est",
    pattern: /\bthe\s+single\s+(?:\w+est|most|\w+\s+most)\b/i,
    floor: 1,
    per1000: 0.15,
    why: "if three things are the single most important, none is",
  },
  { label: "That is / This is opener", pattern: /^(?:That\s+is|That['’]s|This\s+is)\b/, opener: true, floor: 4, per1000: 0.7, why: "pointing back instead of moving on" },
  { label: "Every opener", pattern: /^Every\b/, opener: true, floor: 4, per1000: 0.6, why: "the same sweeping opener, again" },
  {
    label: "Worth noting opener",
    pattern: /^(?:Worth\s+(?:knowing|noting|saying|mentioning|remembering)|It(?:['’]s|\s+is)\s+worth\s+(?:knowing|noting|saying|mentioning|remembering))\b/,
    opener: true,
    floor: 3,
    per1000: 0.5,
    why: "a hedge that lets a sentence start without committing",
  },
  {
    label: "negation-led opener",
    pattern: /^(?:None\s+of|Not\s+one|Not\s+a\s+single|Nothing|No\s+one|Nobody|Never)\b/,
    opener: true,
    floor: 5,
    per1000: 1,
    why: "each earns its place once or twice; at twenty the document has one move",
  },
  {
    label: "participle triad",
    pattern: /\b[a-z]{3,}ed,\s+[a-z]{3,}ed,?\s+and\s+[a-z]{3,}ed\b/i,
    floor: 3,
    per1000: 0.6,
    why: "'researched, written and referenced' is fine once and a cadence in bulk",
  },
];

function rateHits(ctx: CopyContext): Hit[] {
  const hits: Hit[] = [];
  for (const doc of documents(ctx)) {
    const list = sentences(doc);
    for (const rate of RATES) {
      const found: Sentence[] = [];
      const global = new RegExp(rate.pattern.source, rate.pattern.flags.replace("g", "") + "g");
      for (const s of list) {
        if (rate.opener) {
          if (rate.pattern.test(s.text)) found.push(s);
        } else {
          const n = (s.text.match(global) ?? []).length;
          for (let k = 0; k < n; k += 1) found.push(s);
        }
      }
      const limit = allowed(doc, rate.floor, rate.per1000);
      if (found.length > limit) {
        hits.push({
          path: doc.path,
          offset: found[limit].offset,
          message: `"${rate.label}" ${found.length} times in ${thousands(doc.words)} words (allows ${limit}): ${rate.why}`,
          excerpt: found[limit].text.slice(0, 120),
        });
      }
    }
  }
  return hits;
}

// ------------------------------------------------------------- aphorisms

/**
 * Quotable one-liners: two clipped sentences alone on one line. "All of this
 * already exists. The job is making it findable." Once, it lands. Closing
 * every section, it is a cadence.
 */
function aphorismHits(ctx: CopyContext): Hit[] {
  const hits: Hit[] = [];
  for (const doc of documents(ctx)) {
    const found: Sentence[] = [];
    for (const block of doc.blocks) {
      let at = 0;
      for (const line of withoutHeadings(block.text).split("\n")) {
        const text = line.trim().replace(/^[-*>]\s+/, "");
        const parts = text.match(/[^.!?]+[.!?]+/g) ?? [];
        if (
          parts.length === 2 &&
          parts.join("").length >= text.length - 1 &&
          parts.every((p) => countWords(p) >= 2 && countWords(p) <= 7)
        ) {
          found.push({ text, offset: block.offset + at + line.indexOf(text.charAt(0)) });
        }
        at += line.length + 1;
      }
    }
    const limit = allowed(doc, 5, 1.2);
    if (found.length > limit) {
      hits.push({
        path: doc.path,
        offset: found[limit].offset,
        message: `${found.length} two-line aphorisms in ${thousands(doc.words)} words (allows ${limit}). Keep the one that lands hardest`,
        excerpt: found[limit].text,
      });
    }
  }
  return hits;
}

// ------------------------------------------------------------- contractions

const CONTRACTION = /\b(?:\w+n['’]t|\w+['’](?:re|ve|ll|m|d)|(?:it|that|there|here|what|who|he|she|let|where)['’]s)\b/gi;

function contractionHits(ctx: CopyContext): Hit[] {
  const hits: Hit[] = [];
  for (const doc of documents(ctx)) {
    if (doc.words < 800) continue;
    const text = doc.blocks.map((b) => withoutHeadings(b.text)).join("\n");
    const count = (text.match(CONTRACTION) ?? []).length;
    const rate = (count * 1000) / doc.words;
    if (rate < 1) {
      const first = sentences(doc)[0];
      hits.push({
        path: doc.path,
        offset: first?.offset ?? 0,
        message: `${count} contraction${count === 1 ? "" : "s"} in ${thousands(doc.words)} words. Prose with none reads stiff; formal legal pages are the exception`,
      });
    }
  }
  return hits;
}

// ------------------------------------------------------------- rhythm

/**
 * Sentence length that barely varies. The coefficient of variation (standard
 * deviation over mean) of a person's sentence lengths moves around; a model's
 * sits low and steady.
 */
function rhythmHits(ctx: CopyContext): Hit[] {
  const hits: Hit[] = [];
  for (const doc of documents(ctx)) {
    const list = sentences(doc);
    if (list.length < 40) continue;
    const lengths = list.map((s) => countWords(s.text));
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const sd = Math.sqrt(lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / lengths.length);
    const cv = sd / mean;
    if (cv < 0.42) {
      hits.push({
        path: doc.path,
        offset: list[0].offset,
        message: `${list.length} sentences averaging ${mean.toFixed(1)} words with little variation (spread ${cv.toFixed(2)}, reads metronomic below 0.42)`,
      });
    }
  }
  return hits;
}

// ------------------------------------------------------------- repetition

const normal = (s: string): string[] => s.toLowerCase().replace(/[’]/g, "'").match(/[a-z0-9£$€'%]+/g) ?? [];

/**
 * A sentence of nine words or more that appears twice, or two different
 * sentences sharing a nine-word run. A paste is one of the strongest signals
 * a reader has; the second form catches "the same sentence, lightly edited".
 */
function repeatHits(ctx: CopyContext): Hit[] {
  const hits: Hit[] = [];
  const RUN = 9;
  for (const doc of documents(ctx)) {
    const whole = new Map<string, Sentence>();
    const runs = new Map<string, { sentence: Sentence; key: string }>();
    for (const s of sentences(doc)) {
      const words = normal(s.text);
      // A sentence ends in a full stop. An address or a title repeated in a
      // header and a footer does not, and is not a paste.
      if (words.length < RUN || !/[.!?]["'’”)]*$/.test(s.text)) continue;
      const key = words.join(" ");
      const earlier = whole.get(key);
      if (earlier) {
        hits.push({ path: doc.path, offset: s.offset, message: `the same sentence appears twice (${words.length} words)`, excerpt: s.text.slice(0, 120) });
        continue;
      }
      whole.set(key, s);
      let reported = false;
      for (let i = 0; i + RUN <= words.length && !reported; i += 1) {
        const run = words.slice(i, i + RUN).join(" ");
        const seen = runs.get(run);
        if (seen && seen.key !== key) {
          hits.push({ path: doc.path, offset: s.offset, message: `shares a ${RUN}-word run with an earlier sentence: "${run}"`, excerpt: s.text.slice(0, 120) });
          reported = true;
        } else if (!seen) {
          runs.set(run, { sentence: s, key });
        }
      }
    }
  }
  return hits;
}

// ------------------------------------------------------------- headings

interface Heading {
  text: string;
  offset: number;
  /** Offset just past the heading, where the paragraph under it starts. */
  end: number;
}

function headings(file: SourceFile): Heading[] {
  const out: Heading[] = [];
  for (const m of file.text.matchAll(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    out.push({ text: m[1], offset: (m.index ?? 0) + m[0].indexOf(m[1]), end: (m.index ?? 0) + m[0].length });
  }
  for (const m of file.text.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)) {
    const text = m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (text) out.push({ text, offset: (m.index ?? 0) + m[0].indexOf(m[1]), end: (m.index ?? 0) + m[0].length });
  }
  return out.sort((a, b) => a.offset - b.offset);
}

/** The documents long enough to judge, with their source files for headings. */
function longFiles(ctx: CopyContext): { file: SourceFile; doc: Doc }[] {
  const docs = new Map(documents(ctx).map((d) => [d.path, d]));
  return ctx.files.filter((f) => docs.has(f.path)).map((file) => ({ file, doc: docs.get(file.path)! }));
}

/** "X, and Y" / "X, because Y" / a bare comma list: "Keep, rewrite, consolidate, retire". */
const HEADING_SHAPES: [string, RegExp][] = [
  ["X, and Y", /^[^,]{2,}, and [^,]{2,}$/i],
  ["X, because Y", /^[^,]{2,}, because [^,]{2,}$/i],
  ["comma list", /^[A-Z][\w'’-]*(?:, [\w'’-]+){2,}(?:,? (?:and|or) [\w'’-]+)?\.?$/],
];

function headingShapeHits(ctx: CopyContext): Hit[] {
  const hits: Hit[] = [];
  for (const { file, doc } of longFiles(ctx)) {
    const found: { heading: Heading; shape: string }[] = [];
    for (const heading of headings(file)) {
      const shape = HEADING_SHAPES.find(([, re]) => re.test(heading.text));
      if (shape) found.push({ heading, shape: shape[0] });
    }
    const limit = allowed(doc, 3, 0.5);
    if (found.length > limit) {
      hits.push({
        path: file.path,
        offset: found[limit].heading.offset,
        message: `${found.length} headings share one shape (${[...new Set(found.map((f) => f.shape))].join(", ")}), allows ${limit}`,
        excerpt: found[limit].heading.text,
      });
    }
  }
  return hits;
}

/** A heading of four words or more, repeated as the opening words of the paragraph under it. */
function headingEchoHits(ctx: CopyContext): Hit[] {
  const hits: Hit[] = [];
  for (const { file } of longFiles(ctx)) {
    for (const heading of headings(file)) {
      const words = normal(heading.text);
      if (words.length < 4) continue;
      const after = file.text.slice(heading.end, heading.end + 600).trimStart().replace(/^\s*(?:<\/?(?:p|div|section)\b[^>]*>\s*)*/i, "");
      const opening = normal(after.split(/\n\s*\n/)[0] ?? "").slice(0, words.length);
      if (opening.join(" ") === words.join(" ")) {
        hits.push({ path: file.path, offset: heading.offset, message: `the heading "${heading.text}" is repeated as the first words under it` });
      }
    }
  }
  return hits;
}

// ------------------------------------------------------------- fixtures

/**
 * Plain filler for fixtures: deterministic, varied in length, with the odd
 * contraction, and no tell of its own. Words are drawn so that no nine-word
 * run ever repeats.
 */
const FILLER_WORDS = (
  "boiler van kitchen garden studio market street window roof tile paint brush ladder hedge lawn fence gate " +
  "shop counter oven bread flour kettle chair table shelf lamp cable socket switch meter valve pipe tap sink " +
  "drain gutter brick mortar timber plank screw bolt hinge lock key door frame glass mirror towel basin " +
  "morning evening winter summer spring autumn monday tuesday friday weekend hour minute week month year " +
  "fitted checked cleaned painted mended booked quoted delivered collected measured sanded sealed wired " +
  "local quiet small large early late busy bright warm dry"
).split(" ");

export function filler(words: number, seed = 1, options: { contractions?: boolean; uniform?: number } = {}): string {
  const { contractions = true, uniform } = options;
  const shape = [5, 17, 9, 24, 6, 13, 31, 8, 11, 4, 20, 15];
  let state = seed;
  const next = (n: number): number => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state % n;
  };
  const out: string[] = [];
  let count = 0;
  let i = 0;
  while (count < words) {
    const length = uniform ?? shape[i % shape.length];
    const s: string[] = [];
    for (let w = 0; w < length; w += 1) s.push(FILLER_WORDS[next(FILLER_WORDS.length)]);
    if (contractions && i % 6 === 2) s.splice(1, 0, "we're");
    s[0] = s[0].charAt(0).toUpperCase() + s[0].slice(1);
    out.push(`${s.join(" ")}.`);
    count += s.length;
    i += 1;
  }
  const paragraphs: string[] = [];
  for (let p = 0; p < out.length; p += 4) paragraphs.push(out.slice(p, p + 4).join(" "));
  return paragraphs.join("\n\n");
}

const f = (path: string, text: string) => ({ path, text });
const doc = (extra: string, seed = 1): string => `${filler(520, seed)}\n\n${extra}\n`;
const times = (n: number, sentence: (i: number) => string): string => Array.from({ length: n }, (_, i) => sentence(i)).join(" ");

// --------------------------------------------------------------- tells

export const DENSITY_TELLS: CopyTell[] = [
  {
    id: "phrase-density",
    name: "Leaned-on phrase",
    generation: 2,
    severity: "warn",
    surface: "copy",
    why: "'Rather than', 'actually', 'That is...' openers, participle triads: each is ordinary English once, and a document that uses one far above its rate has one move and repeats it.",
    fix: "Keep the instances that land hardest and vary or cut the rest. Never delete every one: the count is the problem, not the phrase.",
    detect: rateHits,
    fixtures: {
      flag: [
        f("content/proposal.md", doc(times(6, (i) => `We fitted boiler ${i} rather than patching it.`))),
        f("content/proposal.md", doc(times(6, (i) => `We sealed roof ${i} instead of patching it.`))),
        f("content/proposal.md", doc(times(4, (i) => `Room ${i} actually needed a new valve.`))),
        f("content/proposal.md", doc(times(5, (i) => `Gate ${i} was properly hung.`))),
        f("content/proposal.md", doc(times(3, (i) => `Kitchen ${i} was genuinely tidy.`))),
        f("content/proposal.md", doc(times(3, (i) => `Pipe ${i} is the single biggest risk.`))),
        f("content/proposal.md", doc(times(6, (i) => `That is why tap ${i} leaks.`))),
        f("content/proposal.md", doc(times(6, (i) => `Every tap ${i} gets checked.`))),
        f("content/proposal.md", doc(times(5, (i) => `Worth noting: valve ${i} sticks.`))),
        f("content/proposal.md", doc(times(7, (i) => `None of room ${i} needed paint.`))),
        f("content/proposal.md", doc(times(5, (i) => `Wall ${i} was measured, sanded and sealed.`))),
        f("site/index.html", `<html><body><p>${filler(520, 3)}</p><p>${times(6, (i) => `We fitted boiler ${i} rather than patching it.`)}</p></body></html>`),
      ],
      pass: [
        f("content/proposal.md", doc(times(3, (i) => `We fitted boiler ${i} rather than patching it.`))),
        f("content/short.md", times(6, (i) => `We fitted boiler ${i} rather than patching it.`)),
        f("app/page.tsx", `export const copy = [${Array.from({ length: 40 }, (_, i) => `"We fitted boiler ${i} rather than patching it."`).join(", ")}];`),
      ],
    },
  },
  {
    id: "aphorism-density",
    name: "Aphorism cadence",
    generation: 2,
    severity: "warn",
    surface: "copy",
    why: "Two clipped sentences alone on a line ('All of this already exists. The job is making it findable.') land once. Closing every section, they are a cadence a reader learns to hear.",
    fix: "Keep the strongest one. Fold the rest into the paragraph above as plain statements.",
    detect: aphorismHits,
    fixtures: {
      flag: [f("content/proposal.md", doc(Array.from({ length: 7 }, (_, i) => `The site exists. Job ${i} makes it findable.`).join("\n\n")))],
      pass: [f("content/proposal.md", doc(Array.from({ length: 3 }, (_, i) => `The site exists. Job ${i} makes it findable.`).join("\n\n")))],
    },
  },
  {
    id: "contraction-scarcity",
    name: "No contractions",
    generation: 1,
    severity: "warn",
    surface: "copy",
    why: "A long document with almost no contractions reads stiff and machine-made. People write 'we're' and 'don't'.",
    fix: "Contract where you would in speech: 'we are' to 'we're', 'do not' to 'don't'. Formal legal pages are the deliberate exception.",
    detect: contractionHits,
    fixtures: {
      flag: [f("content/proposal.md", filler(900, 5, { contractions: false }))],
      pass: [f("content/proposal.md", filler(900, 5)), f("content/short.md", filler(500, 5, { contractions: false }))],
    },
  },
  {
    id: "sentence-rhythm",
    name: "Metronomic rhythm",
    generation: 2,
    severity: "warn",
    surface: "copy",
    why: "Sentence after sentence of the same length reads generated. A person's sentences run long, then short, then long again.",
    fix: "Break one long sentence in two, join two short ones, and let some sentences be flat and plain.",
    detect: rhythmHits,
    fixtures: {
      flag: [f("content/proposal.md", filler(600, 7, { uniform: 12 }))],
      pass: [f("content/proposal.md", filler(600, 7))],
    },
  },
  {
    id: "repeated-sentence",
    name: "Repeated sentence",
    generation: 1,
    severity: "warn",
    surface: "copy",
    why: "The same sentence on two pages, or the same nine words lightly edited, is one of the strongest signs a document was assembled rather than written.",
    fix: "Say it once, where it matters most, and write the second place fresh.",
    detect: repeatHits,
    fixtures: {
      flag: [
        f("content/proposal.md", doc("We check every valve before the engineer leaves the house.\n\nMore here.\n\nWe check every valve before the engineer leaves the house.")),
        f("content/proposal.md", doc("We check every valve before the engineer leaves the house.\n\nBy then we check every valve before the engineer leaves the site.")),
      ],
      pass: [f("content/proposal.md", doc("We check every valve before the engineer leaves the house.\n\nThe engineer leaves once the customer has signed the sheet."))],
    },
  },
  {
    id: "heading-shape",
    name: "One heading shape",
    generation: 2,
    severity: "warn",
    surface: "copy",
    why: "Headings that all share one shape ('X, and Y', 'X, because Y', 'Keep, rewrite, consolidate, retire') read as a template filled in section by section.",
    fix: "Write each heading for its section. Most should be a plain noun phrase.",
    detect: headingShapeHits,
    fixtures: {
      flag: [
        f("content/proposal.md", ["## Fast, and fairly priced", "## Local, and insured", "## Tidy, and quiet", "## Early, and on time", "", filler(520, 9)].join("\n\n")),
        f("site/index.html", `<h2>Fast, because we care</h2><h2>Tidy, because it matters</h2><h2>Early, because you asked</h2><h2>Quiet, because neighbours</h2><p>${filler(520, 9)}</p>`),
        f("content/proposal.md", ["## Keep, rewrite, retire", "## Fix, paint, seal", "## Book, quote, fit", "## Plan, build, check", "", filler(520, 9)].join("\n\n")),
      ],
      pass: [f("content/proposal.md", ["## Pricing", "## Fast, and fairly priced", "## Who we are", "## Areas we cover", "", filler(520, 9)].join("\n\n"))],
    },
  },
  {
    id: "heading-echo",
    name: "Heading echoed",
    generation: 2,
    severity: "warn",
    surface: "copy",
    why: "A heading repeated word for word as the first line under it spends the reader's attention twice on the same words.",
    fix: "Let the first sentence say something the heading did not.",
    detect: headingEchoHits,
    fixtures: {
      flag: [
        f("content/proposal.md", `## We fix boilers the same day\n\nWe fix boilers the same day across Brackley.\n\n${filler(520, 11)}`),
        f("site/index.html", `<h2>We fix boilers the same day</h2>\n<p>We fix boilers the same day across Brackley.</p><p>${filler(520, 11)}</p>`),
      ],
      pass: [f("content/proposal.md", `## We fix boilers the same day\n\nCall before noon and an engineer is with you by six.\n\n${filler(520, 11)}`)],
    },
  },
];
