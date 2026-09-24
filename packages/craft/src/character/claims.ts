/**
 * The claims list: every sentence a reader would take as a checkable fact.
 *
 * No tell can say whether "Bark charges £2,000 to £7,000" is true. The worst
 * faults in the DD article that set this off (2026-09-24) were figures like
 * that: a wrong range, an unsourced day rate, a study quoted past what it
 * found. Every one passed the copy check, because the prose was fine.
 *
 * So this does not judge. It lists each sentence holding a price, a figure, a
 * date or a named source, marks whether the sentence names where it came
 * from, and leaves the verdict to a person with the primary source open.
 * "Sourced" means a source is named, not that it says what the sentence
 * claims: that is exactly what the person checks.
 *
 * Pure over text. `craft copy claims <paths...>` is the command.
 */

import { type Fact, protectedFacts } from "./facts.js";
import { extractCopy } from "./prose.js";
import type { SourceFile } from "./types.js";

/** The kinds of fact a reader takes as a claim. Contact details and names are the business's own, not claims. */
const CLAIM_KINDS = new Set(["money", "number", "date"]);

export interface Claim {
  path: string;
  line: number;
  /** The sentence, trimmed to a readable length. */
  sentence: string;
  /** The prices, figures and dates in it. */
  facts: Fact[];
  /** Who the sentence says it comes from: a name, a publication or a link. Empty when nobody is named. */
  sources: string[];
  /**
   * A source named earlier in the same paragraph. A hint for the person, never
   * a pass: the sentence may be the writer's own arithmetic on top of it.
   */
  nearby?: string[];
}

export interface ClaimsReport {
  files: number;
  claims: Claim[];
  unsourced: number;
}

const PROPER = "[A-Z][\\w&.’'-]*(?:\\s+(?:of|and|&|the|for)?\\s*[A-Z][\\w&.’'-]*)*";

/** Words that open a sentence with a capital without naming anyone. */
const NOT_A_SOURCE = /^(?:We|I|It|This|That|These|Those|They|He|She|You|Our|Your|The|A|An|Each|Every|Most|Many|Some|One|Research|Studies|Experts|Data|Analysis|If|When|So|But|And|Or|In|On|At|From|For|By|As|Since|After|Before|Across|Over|Under|Its|Their|External|Source|UK|US|EU|Sometimes|Public|Recent|Industry|Independent|What|How|Why|Who|Where|Businesses|Customers|Clients|Patients|Consumers|People|Users|Online)$/;

/** Nouns that name a publication whoever owns them: "the BrightLocal survey". */
const NOUN = "study|survey|report|research|analysis|benchmark|benchmarks|guidelines|docs|documentation|help centre|help center|pricing page|figures|statistics|case study";
/** Nouns that name a source only when owned: "Bark’s guide", not "Website audit" or "GBP pricing". */
const OWNED_NOUN = "guide|audit|support|pricing|data|site|website|blog";
/**
 * Verbs of attribution. Ambiguous ones ("notes", "quotes", "lists", "charges")
 * are left out on purpose: a missed source only costs a person a look, while a
 * false one marks an unchecked figure sourced.
 */
const VERB = "found|finds|reports?|reported|says|said|states?|stated|estimates?|estimated|recommends?|publishes|published|advertises|advertised|shows|showed|claims";

const ATTRIBUTION: RegExp[] = [
  new RegExp(`\\b[Aa]ccording to\\s+(?:the\\s+)?(${PROPER})`, "g"),
  new RegExp(`\\b(?:${NOUN})\\s+(?:by|from|commissioned by)\\s+(?:the\\s+)?(${PROPER})`, "g"),
  // "Akamai’s 2017 retail study", "the 2020 Deloitte study", "Bark’s UK guide", "Wix’s own developer guidelines".
  new RegExp(`\\b(${PROPER})(?:(?:’s|'s)\\s+(?:own\\s+)?(?:\\d{4}\\s+)?(?:[A-Za-z]+\\s+)?(?:${NOUN}|${OWNED_NOUN})|\\s+(?:\\d{4}\\s+)?(?:[a-z]+\\s+)?(?:${NOUN}))\\b`, "g"),
  // "Google also reported", "Shopify UK currently advertises".
  new RegExp(`\\b(${PROPER})\\s+(?:also\\s+|now\\s+|currently\\s+|still\\s+)?(?:${VERB})\\b`, "g"),
  /\((?:[Ss]ources?:\s*|via\s+(?=[A-Z]))([^)]+)\)/g,
  /^\s*(?:source|sources)\s*:\s*(.+)$/gim,
];

/** A link in Markdown or a bare URL: a pointer to where the figure came from. */
const LINK = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\bhttps?:\/\/[^\s<>"')\]]+/g;

/** "In Portent’s" is Portent; "The Deloitte" is Deloitte; "Bark’s UK" is Bark. */
function cleanName(raw: string): string {
  const words = raw.trim().replace(/[.,;:]+$/, "").split(/\s+/);
  while (words.length && NOT_A_SOURCE.test(words[0])) words.shift();
  return words.join(" ").replace(/(?:’s|'s)(?=\s|$).*$/, "").trim();
}

/** An instruction opens with a verb: "Add JSON-LD data", "Use Google Search Console". The rest is a tool, not a source. */
const IMPERATIVE = /^(?:Add|Use|Check|Make|Get|Set|Include|Create|Update|List|Keep|Ask|Write|Track|Test|Claim|Build|Link|Submit|Verify|Review|Fix|Remove|Upload|Respond|Reply|Choose|Pick|Start|Run|Open|Install|Connect|Enable|Turn|Put|Give|Send|Book|Call|Read|See|Try|Compare|Aim|Target|Avoid|Post|Share|Mark|Tag)$/;

/** Nothing but markup and a label before it: the first word of the sentence. */
const atStart = (sentence: string, index: number): boolean =>
  /^[\s*_"“”’(>#|-]*(?:\d{1,3}[.)]\s*)?[\s*_]*(?:[\w ]+:\**\s*)?$/.test(sentence.slice(0, index)) || /\|\s*\**$/.test(sentence.slice(0, index));

export function namedSources(sentence: string): string[] {
  const found = new Set<string>();
  ATTRIBUTION.forEach((pattern, i) => {
    for (const m of sentence.matchAll(pattern)) {
      const raw = m[1].trim();
      // "Public performance research", "Sometimes the site": one capitalised word
      // opening a sentence is grammar. "Bark’s guide" and "Wix support" mid-sentence are names.
      const word = !/\s/.test(raw) && !/[’']s$/.test(m[0].split(/\s+/)[0]);
      if (i === 2 && word && atStart(sentence, m.index ?? 0)) continue;
      if (IMPERATIVE.test(raw.split(/\s+/)[0]) && atStart(sentence, m.index ?? 0)) continue;
      const name = cleanName(raw);
      // "A/B shows", "Responding shows", "the Landing pages report": a letter or a gerund is not a name.
      if (!name || name.length < 2 || (!/\s/.test(name) && /[a-z]ing$/.test(name))) continue;
      found.add(name);
    }
  });
  for (const m of sentence.matchAll(LINK)) found.add(m[2] ?? m[0]);
  return [...found];
}

/** A footnote reference, `[^2]`, and its definition, `[^2]: BrightLocal, 2023.` */
const FOOTNOTE_REF = /\[\^([\w-]+)\](?!:)/g;
const FOOTNOTE_DEF = /^[ \t]*\[\^([\w-]+)\]:[ \t]*(.+)$/gm;

/** A worked example's premise is the writer's assumption, not a claim about the world. */
const ASSUMPTION = /^(?:\*\*)?(?:assume|suppose|imagine|say|let's say|for example, say|picture)\b/i;

/** List markers, heading hashes and quote marks: their digits are layout, not figures. */
const LEAD = /^\s*(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+[.)]\s+)*/;

/**
 * Sentences, keeping each one's offset. A full stop inside "£7.99" or "v2.1"
 * has no space after it, so it never splits one.
 */
function sentences(text: string): { text: string; offset: number; paragraph: number }[] {
  const out: { text: string; offset: number; paragraph: number }[] = [];
  let start = 0;
  let paragraph = 0;
  const push = (end: number) => {
    const raw = text.slice(start, end);
    const lead = raw.length - raw.trimStart().length;
    if (raw.trim()) out.push({ text: raw.trim(), offset: start + lead, paragraph });
  };
  for (const m of text.matchAll(/(?<!(?:^|\n)[ \t]*\d{1,3})[.!?](?:\[\^[\w-]+\])*(?=["”’)]?[ \t]+["“(*]*[A-Z0-9£$€])|\n+/g)) {
    const end = (m.index ?? 0) + m[0].length;
    push(end);
    start = end;
    // A blank line, a heading or a table row ends the paragraph a named source covers.
    if (/\n\s*\n/.test(m[0]) || /^\s*(?:#|\|)/.test(text.slice(end))) paragraph += 1;
  }
  push(text.length);
  return out;
}

const MAX = 180;
const trim = (s: string): string => (s.length > MAX ? `${s.slice(0, MAX - 1).trimEnd()}…` : s);

export function findClaims(files: SourceFile[]): ClaimsReport {
  const claims: Claim[] = [];
  for (const file of files) {
    for (const block of extractCopy(file)) {
      // A footnote is the writer naming the source: the reference sources the sentence it sits in.
      const notes = new Map([...block.text.matchAll(FOOTNOTE_DEF)].map((m) => [m[1], m[2].trim()]));
      let carried: { paragraph: number; sources: string[] } | undefined;
      for (const s of sentences(block.text)) {
        // Headings and footnote definitions are the article's structure and its sources, not claims.
        if (/^\s*#{1,6}\s/.test(s.text) || /^\s*\[\^[\w-]+\]:/.test(s.text)) continue;
        const refs = [...s.text.matchAll(FOOTNOTE_REF)].map((m) => notes.get(m[1]) ?? `footnote ${m[1]}`);
        const text = s.text.replace(FOOTNOTE_REF, "");
        const body = text.replace(LEAD, "");
        const own = [...namedSources(text), ...refs];
        if (own.length) carried = { paragraph: s.paragraph, sources: own };
        if (ASSUMPTION.test(body)) continue;
        const facts = protectedFacts(body).filter((f) => CLAIM_KINDS.has(f.kind));
        // A sentence crediting a named source is a claim with or without a figure in it.
        if (facts.length === 0 && own.length === 0) continue;
        // "Lead generation was mixed" may still report the study named one sentence
        // before, or may be the writer's sum on top of it. Say where to look; count it unsourced.
        const nearby = own.length === 0 && carried?.paragraph === s.paragraph ? carried.sources : undefined;
        const at = block.offset + s.offset;
        claims.push({
          path: file.path,
          line: file.text.slice(0, at).split("\n").length,
          sentence: trim(text.replace(/\s+/g, " ")),
          facts,
          sources: own,
          ...(nearby ? { nearby } : {}),
        });
      }
    }
  }
  return { files: files.length, claims, unsourced: claims.filter((c) => c.sources.length === 0).length };
}

export function formatClaims(report: ClaimsReport, label = "craft copy claims"): string {
  const { claims, unsourced } = report;
  if (claims.length === 0) return `${label}: no prices, figures, dates or named sources in ${report.files} file${report.files === 1 ? "" : "s"}.`;
  const lines = [
    `${label}: ${claims.length} claim${claims.length === 1 ? "" : "s"} to check, ${unsourced} with no source named.`,
    "  Check each against its primary source before it ships. Sourced means a source is named, not that it agrees.",
  ];
  for (const c of claims) {
    const what = [
      ...c.facts.map((f) => f.value),
      ...c.sources.map((s) => `source: ${s}`),
      ...(c.nearby ? [`${c.nearby.join(", ")} named earlier in the paragraph: does it cover this?`] : []),
    ].join(" · ");
    lines.push("", `  ${c.path}:${c.line}  ${c.sources.length ? "sourced  " : "UNSOURCED"}  ${what}`, `    ${c.sentence}`);
  }
  return lines.join("\n");
}
