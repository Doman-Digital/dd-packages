/**
 * Tells found in copy.
 *
 * The rule lists live here as data, with fixtures, rather than hardcoded in a
 * checker in another repo where they had already drifted from the written
 * rules. Each pattern is matched against prose only: text between tags, string
 * literals that read as sentences, and Markdown outside code fences.
 */

import type { CopyContext, CopyTell, Hit } from "../types.js";

const f = (path: string, text: string) => ({ path, text });

/** Build a detector from patterns. Every match is a hit; `label` names it. */
function phrases(patterns: RegExp[], label: (match: string) => string): (ctx: CopyContext) => Hit[] {
  return (ctx) => {
    const hits: Hit[] = [];
    for (const block of ctx.blocks) {
      for (const pattern of patterns) {
        const global = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
        for (const m of block.text.matchAll(global)) {
          hits.push({ path: block.path, offset: block.offset + (m.index ?? 0), message: label(m[0].trim()) });
        }
      }
    }
    return hits;
  };
}

/** Words a model reaches for that a person writing about their own business rarely uses. */
export const AI_WORDS = [
  "delve", "delves", "delving", "tapestry", "testament", "realm", "embark", "embarking",
  "unleash", "unlock", "unlocks", "unlocking", "elevate", "elevates", "elevated", "elevating",
  "seamless", "seamlessly", "empower", "empowers", "empowering", "leverage", "leveraging",
  "bustling", "nestled", "meticulous", "meticulously", "synergy", "holistic", "paramount",
  "furthermore", "moreover", "navigating", "ever-evolving", "unparalleled",
] as const;

export const STOCK_PHRASES = [
  "look no further",
  "in today's fast-paced world",
  "in today's digital age",
  "whether you're",
  "cutting-edge",
  "state-of-the-art",
  "game-changer",
  "game changer",
  "to the next level",
  "one-stop shop",
  "world-class",
  "second to none",
  "we pride ourselves",
  "passionate about",
  "your journey",
  "our journey",
  "curated",
  "crafted with care",
  "tailored to your",
  "peace of mind",
] as const;

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/'/g, "['’]");

export const COPY_TELLS: CopyTell[] = [
  {
    id: "ai-vocabulary",
    name: "AI vocabulary",
    generation: 1,
    severity: "warn",
    surface: "copy",
    why: "Delve, elevate, seamless, unlock: words that appear in generated copy far more than in anything a business owner writes.",
    fix: "Say the plain thing. 'Elevate your look' becomes what actually happens: 'Gel that lasts three weeks'.",
    detect: phrases([new RegExp(`\\b(?:${AI_WORDS.map(escape).join("|")})\\b`, "i")], (m) => `"${m}"`),
    fixtures: {
      flag: [f("content/home.md", "Elevate your nails with our seamless booking.")],
      pass: [f("content/home.md", "Gel nails that last three weeks. Book online in a minute.")],
    },
  },
  {
    id: "stock-phrase",
    name: "Stock phrase",
    generation: 1,
    severity: "warn",
    surface: "copy",
    why: "Phrases every generated services page uses. They fill space where a fact should be.",
    fix: "Replace the phrase with the fact behind it: a number, a name, a place, a time.",
    detect: phrases([new RegExp(`\\b(?:${STOCK_PHRASES.map(escape).join("|")})\\b`, "i")], (m) => `"${m}"`),
    fixtures: {
      flag: [f("content/home.md", "Look no further for world-class plumbing.")],
      pass: [f("content/home.md", "Gas Safe registered since 2009. Same-day callouts in Brackley.")],
    },
  },
  {
    id: "hollow-imperative",
    name: "Hollow imperative",
    generation: 1,
    severity: "warn",
    surface: "copy",
    why: "'Discover', 'Experience', 'Transform your' as the opening verb of a heading or button is a call to action with nothing in it.",
    fix: "Name the action and the outcome: 'Book a 45-minute facial', not 'Experience the difference'.",
    detect: phrases(
      [/(?:^|[.!?]\s+|\n\s*|>\s*)(?:Discover|Experience|Explore|Transform|Indulge in|Embrace|Unlock|Elevate)\s+(?:the|your|our|a|true|real)\b[^.!?\n<]{0,40}/],
      (m) => `"${m.replace(/^[.!?>\s]+/, "")}"`,
    ),
    fixtures: {
      flag: [f("content/home.md", "Experience the difference today.")],
      pass: [f("content/home.md", "Book a 45-minute facial.")],
    },
  },
  {
    id: "rhetorical-opener",
    name: "Rhetorical question opener",
    generation: 1,
    severity: "warn",
    surface: "copy",
    why: "'Looking for...?', 'Tired of...?', 'Ready to...?' opens with the model guessing at the reader instead of telling them something.",
    fix: "Open with the answer.",
    detect: phrases([/(?:^|\n\s*|>\s*)(?:Looking for|Tired of|Ready to|Want to|Struggling with|Need a)\b[^?\n<]{0,80}\?/], (m) => `"${m.replace(/^[>\s]+/, "")}"`),
    fixtures: {
      flag: [f("content/home.md", "Looking for a reliable plumber?")],
      pass: [f("content/home.md", "A plumber in Brackley, on call until 10pm.")],
    },
  },
  {
    id: "em-dash",
    name: "Em dash",
    generation: 2,
    severity: "warn",
    surface: "copy",
    why: "Generated copy leans on the em dash to join clauses. House copy does not use it.",
    fix: "Use a full stop, a comma, or a colon. Two sentences are clearer than one sentence with a dash in it.",
    detect: phrases([/\S{0,20}\s?—\s?\S{0,20}/], (m) => `"${m}"`),
    fixtures: {
      flag: [f("content/home.md", "Walk-ins welcome — just ring first.")],
      pass: [f("content/home.md", "Walk-ins welcome. Ring first. Open 9-5.")],
    },
  },
  {
    id: "not-just-but",
    name: "'Not just X, it's Y'",
    generation: 2,
    severity: "warn",
    surface: "copy",
    why: "The contrast-and-reveal sentence ('It's not just a haircut, it's an experience') is the most recognisable construction in generated copy.",
    fix: "Say the Y and drop the X.",
    detect: phrases(
      [
        /\b(?:it['’]?s|it is|this is|this isn['’]t|we['’]re|we are|they['’]re)\s+(?:not|more than)\s+(?:just|only|merely|simply)?\s*[^.!?\n]{1,60}?[,;.—-]\s*(?:it['’]?s|it is|this is|we['’]re|we are|they['’]re)\b/i,
        /\bmore than just\b/i,
      ],
      (m) => `"${m}"`,
    ),
    fixtures: {
      flag: [f("content/home.md", "It's not just a haircut, it's an experience.")],
      pass: [f("content/home.md", "A haircut, a hot towel and a straight-razor finish.")],
    },
  },
  {
    id: "staccato-triplet",
    name: "Staccato triplet",
    generation: 2,
    severity: "warn",
    surface: "copy",
    why: "Three fragments in a row ('Fast. Friendly. Local.' or 'No fuss. No jargon. Just results.') is the second wave's favourite rhythm.",
    fix: "Write one sentence that says which of the three is true, and how you know.",
    detect: phrases([/(?:\b[A-Z][\w'’-]*(?:\s+[\w'’-]+){0,2}[.!]\s+){2}[A-Z][\w'’-]*(?:\s+[\w'’-]+){0,2}[.!](?=\s|$)/], (m) => `"${m}"`),
    fixtures: {
      flag: [f("content/home.md", "No fuss. No jargon. Just results.")],
      pass: [f("content/home.md", "We fix boilers the same day, and we tell you the price before we start.")],
    },
  },
  {
    id: "where-x-meets-y",
    name: "'Where X meets Y'",
    generation: 2,
    severity: "warn",
    surface: "copy",
    why: "'Where luxury meets comfort' is a tagline shape that fits every business and so describes none.",
    fix: "Say what the place is and where it is.",
    detect: phrases([/\bwhere\s+[\w'’-]+(?:\s+[\w'’-]+)?\s+meets?\s+[\w'’-]+/i], (m) => `"${m}"`),
    fixtures: {
      flag: [f("content/home.md", "Where luxury meets comfort.")],
      pass: [f("content/home.md", "A two-chair studio above the bakery on Market Place.")],
    },
  },
];
