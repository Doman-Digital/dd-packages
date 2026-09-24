/**
 * Specificity: how much of a page only this business could have written.
 *
 * "Quality you can trust" fits every site in every trade. "Boilers fixed the
 * same day in Brackley, from £85" fits one. The difference is countable: names,
 * places, numbers, prices, dates, and the nouns of the trade. A page built
 * from no brief has almost none, because the model had none to give.
 *
 * Pure over text. Two things keep the count honest:
 *
 * - A Title Case or all-capitals line carries no capital-letter information,
 *   so its capitals are not read as names ("Quality You Can Trust" is not a
 *   proper noun). Its numbers, trade nouns and brief terms still count.
 * - The stock figures every site uses ("24/7", "100%", "5-star", "No. 1") are
 *   masked before counting. They are numbers, not specifics.
 *
 * A brief (from `--brief`, `art-direction.json` or a null model) adds its own
 * terms: the business's name, its town and its trade, recognised wherever
 * they appear, even at the start of a sentence or in a shouted heading.
 */

import { type FactKind, protectedFacts } from "./facts.js";
import type { Snapshot } from "../snapshot/types.js";

export type SpecificKind = FactKind | "trade" | "brief";

export interface Specific {
  kind: SpecificKind;
  /** As written. */
  value: string;
  /** Lower case, for comparing across pages. */
  key: string;
}

export interface Specificity {
  words: number;
  /** Each distinct specific once: repeating a town ten times does not make a page ten times more particular. */
  specifics: Specific[];
  /** Specifics that are not trade nouns: a name, place, number, price, date, contact detail or brief term. */
  hard: number;
  /** Distinct trade nouns. */
  trade: number;
  /** Distinct specifics per 100 words, to one decimal place. */
  perHundred: number;
  /**
   * No hard specific and fewer than two trade nouns. One trade noun alone
   * ("quality plumbing you can trust") is what every competitor in the trade
   * also says.
   */
  generic: boolean;
}

/**
 * Concrete nouns of the work, across the trades and local services the estate
 * builds for. A seed list, grown from what the null models and client sites
 * show. Deliberately absent: "services", "solutions", "projects", "work",
 * "quality", which say nothing about what is done.
 */
export const TRADE_NOUNS: readonly string[] = [
  // heating, plumbing, electrical
  "boiler", "radiator", "combi", "cylinder", "thermostat", "underfloor heating", "heat pump", "solar panel", "plumbing", "plumber",
  "leak", "toilet", "shower", "bathroom", "wet room", "drain", "fuse board", "fuseboard", "consumer unit", "rewire",
  "socket", "ev charger", "electrician", "gas engineer", "power flush", "landlord certificate", "eicr",
  // building and outside
  "extension", "loft conversion", "loft", "kitchen", "roof", "roofer", "gutter", "chimney", "driveway", "patio", "fence", "fencing",
  "decking", "window", "conservatory", "plastering", "plasterer", "render", "brickwork", "bricklayer", "tiling", "tiler", "flooring",
  "carpet", "joinery", "joiner", "carpenter", "staircase", "damp", "scaffolding", "garage conversion", "lawn", "hedge", "tree surgery",
  "stump", "landscaping", "gardener", "gate", "locksmith", "pest control", "wasp", "cleaning", "oven", "end of tenancy",
  // vehicles
  "mot", "tyre", "brake", "clutch", "cambelt", "exhaust", "gearbox", "valeting",
  // personal and health
  "haircut", "skin fade", "beard", "barber", "balayage", "nails", "lashes", "massage", "physio", "physiotherapy", "osteopath",
  "chiropractor", "dentist", "dental", "implant", "brace", "invisalign", "hygienist", "optician", "eye test", "vet", "grooming",
  "dog walking", "personal trainer", "yoga", "pilates",
  // professional
  "accountant", "tax return", "bookkeeping", "payroll", "vat", "self assessment", "solicitor", "conveyancing", "probate", "divorce",
  "lasting power of attorney", "mortgage", "surveyor", "architect", "planning permission", "building regulations",
  // web and digital, for the agency's own pages
  "website", "web design", "seo", "hosting", "google business profile", "online shop", "ecommerce",
  // food and hospitality
  "breakfast", "lunch", "dinner", "coffee", "bakery", "cake", "catering", "wedding", "venue",
];

/**
 * Stock figures: numbers every site in every trade uses, masked before
 * counting so they cannot pass for a fact.
 */
export const STOCK_FIGURES: readonly RegExp[] = [
  /\b24\s?\/\s?7\b/gi,
  /\b24[\s-]hours?\b/gi,
  /\b1[01]0\s?%/g,
  /\b(?:5|five)[\s-]?star\b/gi,
  /#\s?1\b/g,
  /\bno\.?\s?1\b/gi,
  /\b365\s+days\b/gi,
];

/**
 * Capitalised words that name nobody: marketing words a heading or a button
 * capitalises. A capitalised run made only of these is not a proper noun.
 */
const NOT_NAMES = new Set(
  (
    "a an the and of for to in on at by with your you our we us it get free quote quotes call now today book booking contact learn more read " +
    "see view explore discover start started home about services service quality trusted trust expert experts expertise professional " +
    "professionals best solutions solution digital team welcome why choose how works local reliable affordable fast friendly premium " +
    "leading excellence excellent results success growth business businesses customer customers client clients care support help " +
    "new our story mission vision values innovation innovative modern simple easy smart better great amazing perfect ultimate " +
    "transform elevate empower unlock experience experienced dedicated passionate committed tailored bespoke seamless peace mind " +
    "can do all every everything more less here there this that what who where when need needs make difference satisfaction guaranteed"
  ).split(" "),
);

/** Words in a brief that are not its terms. */
const BRIEF_STOP = new Set(
  (
    "a an the and or of for to in on at by with from who that which what their they them its it is are was were be been being " +
    "has have had do does did can will would should could may might must this these those there here as into over under " +
    "business company small local family run based owned services service provides provide offering offers people customers clients " +
    "home homes house houses area areas around near across nearby town city county village uk"
  ).split(" "),
);

const WORD = /[A-Za-z0-9£$€][\w'’£$€%.,-]*/g;
export const countWords = (text: string): number => (text.match(WORD) ?? []).length;

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A trade noun or brief term as a whole word, singular or plural. Lookarounds, not \\b, so "£85" matches too. */
const termPattern = (term: string): RegExp => new RegExp(`(?<![\\w£$€])${term.split(/\s+/).map(escape).join("[\\s-]+")}(?:s|es)?(?![\\w])`, "i");
const TRADE_PATTERNS = TRADE_NOUNS.map((t) => [t, termPattern(t)] as const);

const SMALL_WORDS = new Set(["a", "an", "the", "and", "or", "of", "in", "on", "at", "to", "for", "by", "with", "from"]);

/**
 * A line whose capitals carry no information: shouted ("QUALITY YOU CAN
 * TRUST"), where nothing capitalised is a name, or Title Case ("Boiler Repairs
 * You Can Trust"), where only an acronym still is. A two-word line is neither:
 * "Hinton Heating" is a name. Nor is an ordinary sentence with a name in it:
 * "Call Hinton Heating today".
 */
function caseless(line: string): "shout" | "title" | null {
  const words = line.match(/[A-Za-z][A-Za-z’'-]*/g) ?? [];
  const letters = words.filter((w) => w.length >= 2);
  if (letters.length >= 3 && letters.filter((w) => w === w.toUpperCase()).length / letters.length >= 0.6) return "shout";
  // Small words stay lower case in most Title Case styles ("Boiler Repairs in Brackley").
  const content = letters.filter((w) => !SMALL_WORDS.has(w.toLowerCase()));
  if (content.length >= 3 && content.filter((w) => /^[A-Z]/.test(w)).length / content.length >= 0.8) return "title";
  return null;
}

const maskStock = (text: string): string => STOCK_FIGURES.reduce((t, re) => t.replace(re, (m) => " ".repeat(m.length)), text);

/**
 * The brief's own terms: its names and places (capitalised words, even at the
 * start of a sentence), its numbers, and its trade nouns.
 */
export function briefTerms(brief: string): string[] {
  const terms = new Set<string>();
  for (const w of brief.match(/[A-Za-z][A-Za-z’'&-]*/g) ?? []) {
    const lower = w.toLowerCase();
    if (/^[A-Z]/.test(w) && w.length >= 3 && !BRIEF_STOP.has(lower) && !NOT_NAMES.has(lower)) terms.add(lower);
  }
  for (const [term, re] of TRADE_PATTERNS) if (re.test(brief)) terms.add(term);
  for (const f of protectedFacts(maskStock(brief))) if (f.kind !== "name") terms.add(f.value.toLowerCase());
  return [...terms];
}

/** Every distinct specific in the text. Lines are read one at a time: pass blocks separated by newlines. */
export function specifics(text: string, brief?: string): Specific[] {
  const found = new Map<string, Specific>();
  const add = (kind: SpecificKind, value: string) => {
    const key = value.toLowerCase().replace(/\s+/g, " ").trim();
    if (key && !found.has(key)) found.set(key, { kind, value, key });
  };
  for (const raw of text.split("\n")) {
    const line = maskStock(raw);
    if (!line.trim()) continue;
    const capitals = caseless(line);
    for (const f of protectedFacts(line)) {
      if (f.kind === "name") {
        if (capitals === "shout") continue;
        if (capitals === "title") {
          // Only an acronym inside the run still names something: "NICEIC" in "Fully Certified NICEIC Electricians".
          for (const acronym of f.value.match(/\b[A-Z]{2,}\b/g) ?? []) add("name", acronym);
          continue;
        }
        // Trim the words that name nobody off either end: "Call Hinton Heating" is "Hinton Heating".
        const words = f.value.split(/\s+/);
        const named = (w: string) => !NOT_NAMES.has(w.toLowerCase()) && w !== "&";
        const first = words.findIndex(named);
        if (first === -1) continue;
        const last = words.length - 1 - [...words].reverse().findIndex(named);
        add("name", words.slice(first, last + 1).join(" "));
        continue;
      }
      add(f.kind, f.value);
    }
    for (const [term, re] of TRADE_PATTERNS) {
      const m = re.exec(line);
      if (m) add("trade", term);
    }
  }
  if (brief) {
    for (const term of briefTerms(brief)) {
      // Already counted, alone or inside a longer name ("Hinton" in "Hinton Heating").
      if ([...found.keys()].some((k) => k === term || k.split(" ").includes(term))) continue;
      if (termPattern(term).test(text)) add("brief", term);
    }
  }
  return [...found.values()];
}

/** How particular a text is. Pure. */
export function specificity(text: string, brief?: string): Specificity {
  const list = specifics(text, brief);
  const words = countWords(text);
  const trade = list.filter((s) => s.kind === "trade").length;
  const hard = list.length - trade;
  return {
    words,
    specifics: list,
    hard,
    trade,
    perHundred: words ? Math.round((list.length / words) * 1000) / 10 : 0,
    generic: hard === 0 && trade < 2,
  };
}

// ------------------------------------------------------------------ pages

/** What a page says where it makes its case: the first screen, and the sections that sell the work. */
export interface PageCopy {
  url: string;
  hero: string[];
  services: string[];
  /** Every line of page text: what the other page is checked against. */
  all: string[];
}

const NOT_SERVICE_ROLES = new Set(["testimonials", "team", "faq", "contact", "logos", "stats", "cta-band", "footer-cta", "marquee"]);
const SERVICE_ROLES = new Set(["features", "process", "pricing", "cards"]);
const SERVICE_LABEL = /\bservices?\b|\bwhat we (?:do|fix|offer|make|build)\b|\bhow we\b|\bour work\b|\bwe (?:fix|fit|install|repair|build|offer|make)\b/i;

/** Blocks as sentences, short fragments dropped. */
export function sentencesOf(blocks: string[]): string[] {
  const out: string[] = [];
  for (const block of blocks) {
    for (const m of block.matchAll(/[^.!?]+[.!?]*/g)) {
      const s = m[0].trim();
      if (countWords(s) >= 3) out.push(s);
    }
  }
  return [...new Set(out)];
}

/**
 * The hero and service copy of a snapshot. Null when the snapshot has no page
 * text: one taken before craft recorded it.
 */
export function pageCopy(snapshot: Snapshot): PageCopy | null {
  const withText = snapshot.sections.filter((s) => s.text);
  if (!snapshot.firstScreenText && withText.length === 0) return null;
  const hero = [...(snapshot.firstScreenText ?? []), ...snapshot.sections.filter((s) => s.kind === "hero").flatMap((s) => s.text ?? [])];
  const services = snapshot.sections
    .filter((s) => s.kind !== "hero" && !NOT_SERVICE_ROLES.has(s.role ?? s.kind))
    .filter((s) => SERVICE_ROLES.has(s.role ?? s.kind) || SERVICE_LABEL.test(s.label))
    .flatMap((s) => s.text ?? []);
  const all = [...(snapshot.firstScreenText ?? []), ...withText.flatMap((s) => s.text ?? [])];
  return { url: snapshot.url, hero: sentencesOf(hero), services: sentencesOf(services), all };
}

export interface CopySide {
  url: string;
  /** Hero and service sentences read. */
  sentences: number;
  /** Of those, how many hold nothing the other page does not also say. */
  interchangeable: string[];
  /** interchangeable / sentences, or null with no sentences. */
  share: number | null;
  /** Specificity of the hero and service copy together. */
  perHundred: number;
}

export interface CompetitorComparison {
  ours: CopySide;
  competitor: CopySide;
  /** A brief's terms were recognised on both pages. */
  brief: boolean;
}

function side(page: PageCopy, other: PageCopy, brief?: string): CopySide {
  const otherKeys = new Set(specifics(other.all.join("\n"), brief).map((s) => s.key));
  const sentences = [...new Set([...page.hero, ...page.services])];
  const interchangeable = sentences.filter((s) => !specifics(s, brief).some((x) => !otherKeys.has(x.key)));
  return {
    url: page.url,
    sentences: sentences.length,
    interchangeable,
    share: sentences.length ? Math.round((interchangeable.length / sentences.length) * 1000) / 1000 : null,
    perHundred: specificity(sentences.join("\n"), brief).perHundred,
  };
}

/**
 * Which hero and service sentences either page could swap with the other:
 * each holds no specific the other page lacks. A shared town or trade noun is
 * not unique; the business's own name, its prices and its jobs are. Pure.
 */
export function compareCompetitor(ours: PageCopy, competitor: PageCopy, brief?: string): CompetitorComparison {
  return { ours: side(ours, competitor, brief), competitor: side(competitor, ours, brief), brief: Boolean(brief) };
}

const pctOf = (share: number | null): string => (share === null ? "no sentences" : `${Math.round(share * 100)}%`);

export function formatCompetitor(result: CompetitorComparison): string {
  const row = (label: string, s: CopySide) =>
    `    ${label.padEnd(11)} ${s.interchangeable.length} of ${s.sentences} (${pctOf(s.share)}), ${s.perHundred} specifics per 100 words`;
  const lines = [
    `craft copy compare: ${result.ours.url} against ${result.competitor.url}`,
    "  Hero and service sentences holding nothing the other page does not also say:",
    row("ours", result.ours),
    row("competitor", result.competitor),
  ];
  if (result.brief) lines.push("  The brief's own terms were recognised on both pages.");
  if (result.ours.interchangeable.length) {
    lines.push("", "  Interchangeable on ours: add the job, the place, the price or the name only this business has");
    for (const s of result.ours.interchangeable.slice(0, 12)) lines.push(`    "${s.length > 110 ? `${s.slice(0, 107)}...` : s}"`);
    if (result.ours.interchangeable.length > 12) lines.push(`    and ${result.ours.interchangeable.length - 12} more`);
  } else {
    lines.push("", "  Every hero and service sentence on ours holds something the competitor does not say.");
  }
  return lines.join("\n");
}
