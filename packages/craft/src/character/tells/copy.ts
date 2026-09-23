/**
 * Tells found in copy.
 *
 * The rule lists live here as data, with fixtures, rather than hardcoded in a
 * checker in another repo where they had already drifted from the written
 * rules. Since 2026.09.2 this is also where the house copy rules live: the
 * blocking tier of claude-kit's `house-style/copy-rules.md` is carried by its
 * own tells here, and `copy-check` is a wrapper that decides which of them
 * fail a commit. craft itself ships every tell as `warn`.
 *
 * Word and phrase tells read sentences (`ctx.blocks`). Tells that key on a
 * shape short enough to sit in a label, an em dash, an emoji, a "No catch."
 * badge, read every visible string (`ctx.strings`).
 */

import type { CopyBlock, CopyContext, CopyTell, Hit } from "../types.js";

const f = (path: string, text: string) => ({ path, text });

const isProsePath = (path: string): boolean => /\.(md|markdown|mdx|txt)$/i.test(path);

/**
 * Sentences for Markdown, every visible string for code. A shape tell needs
 * a whole sentence from a Markdown paragraph, and needs the short strings in
 * code that are too brief to read as a sentence.
 */
function allText(ctx: CopyContext): CopyBlock[] {
  return [...ctx.blocks.filter((b) => isProsePath(b.path)), ...ctx.strings.filter((b) => !isProsePath(b.path))];
}

/**
 * Addresses are not copy: `https://example.com/seamless-booking` or a
 * Markdown link target `(/seamless-booking)` is a slug, like an asset key,
 * and a word inside it says nothing about the prose around it.
 */
const LINK = /\b(?:https?:\/\/|www\.)[^\s<>"'`)\]]+|\]\([^)\s]+\)/gi;

function linkSpans(text: string): [number, number][] {
  return [...text.matchAll(LINK)].map((m) => [m.index ?? 0, (m.index ?? 0) + m[0].length]);
}

const insideLink = (spans: [number, number][], at: number): boolean => spans.some(([a, b]) => at >= a && at < b);

/**
 * Build a detector from patterns. Every match is a hit; `label` names it.
 * Overlapping matches from different patterns are one hit, so a sentence that
 * fits two forms of the same template is reported once.
 */
function phrases(
  patterns: RegExp[],
  label: (match: string) => string,
  source: (ctx: CopyContext) => CopyBlock[] = (ctx) => ctx.blocks,
  skip: (block: CopyBlock, match: string, index: number) => boolean = () => false,
): (ctx: CopyContext) => Hit[] {
  return (ctx) => {
    const hits: Hit[] = [];
    for (const block of source(ctx)) {
      const spans: [number, number, string][] = [];
      const links = linkSpans(block.text);
      for (const pattern of patterns) {
        const global = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
        for (const m of block.text.matchAll(global)) {
          if (skip(block, m[0], m.index ?? 0)) continue;
          if (insideLink(links, m.index ?? 0)) continue;
          spans.push([m.index ?? 0, (m.index ?? 0) + m[0].length, m[0]]);
        }
      }
      spans.sort((a, b) => a[0] - b[0]);
      let end = -1;
      for (const [start, stop, text] of spans) {
        if (start < end) continue;
        end = stop;
        // Point at the first real character, not the whitespace a pattern
        // consumed to find a boundary, so the finding lands on its own line.
        const lead = text.length - text.trimStart().length;
        hits.push({ path: block.path, offset: block.offset + start + lead, message: label(text.trim()) });
      }
    }
    return hits;
  };
}

/**
 * A phrase as a pattern: either apostrophe, and any run of whitespace between
 * words, because a formatter wraps JSX text at the print width and a phrase
 * split across two lines is still the phrase.
 */
const escape = (s: string): string =>
  s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/'/g, "['’]?").replace(/ /g, "\\s+");
const wordList = (words: readonly string[]): RegExp => new RegExp(`\\b(?:${[...words].sort((a, b) => b.length - a.length).map(escape).join("|")})\\b`, "i");
const quoted = (m: string): string => `"${m}"`;

// ---------------------------------------------------------------- lists

/**
 * Words a model reaches for that a person writing about their own business
 * rarely uses. The house-blocking words (seamless, empower, delve, leverage,
 * harness) are not here: they have tells of their own, so a finding says
 * which tier it belongs to.
 */
export const AI_WORDS = [
  "tapestry", "testament", "realm", "embark", "embarking",
  "unleash", "unlocks", "unlocking", "elevate", "elevates", "elevated", "elevating",
  "bustling", "nestled", "meticulous", "meticulously", "paramount",
  "furthermore", "moreover", "navigating", "ever-evolving", "unparalleled",
  // Measured: Kobak et al. 2024 (arXiv 2406.07016) found these 10 to 14 times
  // above their expected rate in post-ChatGPT abstracts. Academic, so warn only.
  "underscore", "underscores", "underscoring", "showcasing", "pivotal",
] as const;

export const STOCK_PHRASES = [
  "in today's digital age",
  "to the next level",
  "one-stop shop",
  "second to none",
  "we pride ourselves",
  "passionate about",
  "your journey",
  "our journey",
  "curated",
  "crafted with care",
  "tailored to your",
  "peace of mind",
  "so here's",
  "in an era where",
  "the future looks bright",
  "only time will tell",
] as const;

/**
 * The phrase list from the blocking tier of copy-rules.md, plus the phrases
 * the old copy-check blocked that the rules had never written down. Each is a
 * phrase generated copy uses far more than people do.
 */
export const AI_PHRASES = [
  "let's dive in", "dive into", "let's unpack", "let's break this down", "let's break it down",
  "here's the thing", "it's important to note", "it's important to remember", "it is worth noting that",
  "at its core", "the key takeaway", "the reality is", "the truth is",
  "increasingly digital", "seamless", "seamlessly", "unlock your", "unlock the power",
  "meaningful impact", "drive meaningful", "foster collaboration", "fosters collaboration", "fostering collaboration",
  "comprehensive guide to", "look no further", "in the event that", "at no additional cost to you",
  "rest assured", "when it comes to", "we have got you covered", "we've got you covered",
] as const;

/** Blocked because a plainer word almost always exists. */
export const PLAINER_WORDS = [
  "empower", "empowers", "empowered", "empowering",
  "harness", "harnesses", "harnessed", "harnessing",
  "delve", "delves", "delved", "delving",
  "leverage", "leverages", "leveraged", "leveraging",
] as const;

/** The corporate buzzwords of the house list. Older than any model; models still reach for them. */
export const BUZZWORDS = [
  "synergy", "synergise", "synergize", "cutting-edge", "cutting edge",
  "best-in-class", "best in class", "best of breed", "game-changer", "game changer",
  "paradigm shift", "world-class", "state of the art", "state-of-the-art",
  "mission-critical", "low-hanging fruit", "move the needle",
  "circle back", "touch base", "reach out", "value-add",
  "robust", "turnkey", "holistic", "disruptive",
] as const;

export const NEGATIVE_REASSURANCE = [
  "no risk", "never locked in", "nothing goes wrong", "no hidden fees",
  "never pay", "without the hassle", "no surprises",
] as const;

/** Banned only when vague. Reported for review, never blocking. */
export const VAGUE_WORDS = ["innovative", "scalable", "end-to-end", "streamline", "solutions"] as const;

/** The review tier of copy-rules.md: normal English once, a tell when stacked. */
export const REVIEW_PHRASES = [
  "great question", "of course!", "absolutely!", "absolutely,", "truly", "genuinely", "deeply",
  "ultimately", "one-size-fits-all", "one size fits all", "let me know if you'd",
  "the single most", "by far the most", "hands down the", "arguably the best", "bar none",
] as const;

// ------------------------------------------------------------ patterns

/**
 * Contrastive negation, every form the house rules name. The template is the
 * tell, not the sentiment: "It's not a website, it's a growth engine".
 */
const NEGATION: RegExp[] = [
  // "It's not just a haircut, it's an experience."
  /\b(?:it['’]?s|it is|this is|this isn['’]t|we['’]re|we are|they['’]re)\s+(?:not|more than)\s+(?:just|only|merely|simply)?\s*[^.!?\n]{1,60}?[,;.—-]\s*(?:it['’]?s|it is|this is|we['’]re|we are|they['’]re)\b/i,
  /\bmore\s+than\s+just\b/i,
  // copular: "It's not a website, it's a growth engine"
  /\b(?:it|that|this|you|we|they|she|he)(?:’s|'s|’re|'re)\s+not\s+[^.;:]{2,50}[,:]\s*(?:it|that|this|you|we|they|she|he)(?:’s|'s|’re|'re)/i,
  // verbal: "I don't teach the treatment you'd choose: I teach the standard"
  /\b(i|we|you|they|she|he)\s+(?:do|does|did|would|will|ca|wo)(?:n’t|n't)\s+(\w+)\b[^.;:]{2,60}[,:]\s*(?:i|we|you|they|she|he)\s+\2\b/i,
  /\bnot\s+(?:just|merely|simply)\b/i,
  // "X isn't a job, it's art"
  /\b(?:is|are|was|were)(?:n’t|n't)\b[^.;]{2,60},\s*(?:it|they|that|this)(?:’s|'s|’re|'re)\b/i,
  /\bless\s+about\b[^.;]{2,50}\bmore\s+about\b/i,
  // parallel participle, no repeated subject: "dispatched from here, not shipped in from Seoul"
  /\b\w{3,}ed\b[^,.;:]{0,40},\s*not\s+\w{3,}ed\b/i,
];

/**
 * Empty-state and error text is functional UI, not a marketing tell. Either
 * signal exempts: a data-absence word in the string, or a signed-in route
 * tree in the path. The 2026-08-04 portfolio sweep found 260 of 1045 blocking
 * hits were these rules firing on "No results found".
 */
const DATA_ABSENCE = /\b(?:yet|found|available|configured|selected|assigned|scheduled|recorded|on file|to show|to display|results|match|matches|matching|data|in this period)\b/i;
const SIGNED_IN = /(?:^|\/)(?:admin|portal|dashboard|embedded)\//;

/** The line of a block a match sits on: the unit the empty-state test reads. */
function lineAround(text: string, index: number): string {
  const start = text.lastIndexOf("\n", index) + 1;
  const end = text.indexOf("\n", index);
  return text.slice(start, end === -1 ? text.length : end);
}

const emptyState = (block: CopyBlock, match: string, index = 0): boolean =>
  SIGNED_IN.test(block.path) || DATA_ABSENCE.test(isProsePath(block.path) ? lineAround(block.text, index) : block.text) || DATA_ABSENCE.test(match);

const NO_X_NO_Y = /\bno\s+[\w'’ ]{2,30},\s*no\s+\w/i;
const NO_X_BADGE = /^no\s+[\w'’\- ]{2,28}[.!]?$/i;

/**
 * Pictographic emoji. Stars, ticks, arrows and middots are typography, not
 * emoji: `★`, `✓`, `→`, `·` pass. The older symbol blocks hold a few that are
 * emoji in every font a visitor has (sparkles, the green tick box, the red
 * cross, the high-voltage sign, the heart), and any symbol a string forces
 * into emoji presentation with U+FE0F is one too.
 */
const EMOJI = /(?:[\u{1F300}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u2728\u2705\u274C\u274E\u2757\u2753\u26A1\u2B50\u2764]|[\u2600-\u27BF]\uFE0F)+/u;

/**
 * A dash alone in a quoted string is a null-value placeholder (`{x ?? "—"}`)
 * or a join separator, not punctuation. A dash alone between two expressions
 * in JSX text (`{start} — {end}`) is on the page, and counts.
 */
const placeholderDash = (block: CopyBlock): boolean => block.literal === true && /^[\s—]*$/.test(block.text);

function badgeHits(ctx: CopyContext): Hit[] {
  const hits: Hit[] = [];
  for (const block of ctx.strings) {
    let text = block.text;
    let lead = text.length - text.trimStart().length;
    if (isProsePath(block.path)) {
      if (/^\s*#{1,6}\s/.test(text) || /[<>{}=;]/.test(text)) continue;
      const bullet = text.trimStart().match(/^[-*]\s+/);
      if (bullet) lead += bullet[0].length;
      text = text.slice(lead);
    }
    const candidate = text.trim();
    if (NO_X_BADGE.test(candidate) && !emptyState(block, candidate)) {
      hits.push({ path: block.path, offset: block.offset + lead, message: quoted(candidate) });
    }
  }
  return hits;
}

// --------------------------------------------------------------- tells

export const COPY_TELLS: CopyTell[] = [
  {
    id: "ai-vocabulary",
    name: "AI vocabulary",
    generation: 1,
    severity: "warn",
    surface: "copy",
    why: "Tapestry, elevate, nestled, unparalleled: words that appear in generated copy far more than in anything a business owner writes.",
    fix: "Say the plain thing. 'Elevate your look' becomes what actually happens: 'Gel that lasts three weeks'.",
    detect: phrases([wordList(AI_WORDS), /\bunlock\b(?!\s+(?:your|the power))/i], quoted),
    fixtures: {
      flag: [f("content/home.md", "Elevate your nails in our bustling studio."), f("content/home.md", "We unlock it for you.")],
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
    detect: phrases([wordList(STOCK_PHRASES), /\b(?:in|on|along)\s+(?:its|their|his|her)\s+journey\b/i], quoted),
    fixtures: {
      flag: [
        f("content/home.md", "Take your plumbing to the next level with peace of mind."),
        f("content/home.md", "We meet each practice where it is in its journey."),
      ],
      pass: [
        f("content/home.md", "Gas Safe registered since 2009. Same-day callouts in Brackley."),
        f("content/home.md", "We mapped the patient journey from booking to aftercare."),
      ],
    },
  },
  {
    id: "ai-phrase",
    name: "AI phrase",
    generation: 1,
    severity: "warn",
    surface: "copy",
    why: "Let's dive in, here's the thing, at its core, seamless, rest assured: the phrase list of the house copy rules. A reader has seen each one in a thousand generated pages.",
    fix: "Cut the phrase and start with the point it was introducing. 'Seamless booking' becomes 'Book in three taps'.",
    detect: phrases(
      [
        wordList(AI_PHRASES),
        /\bin today['’]?s (?:rapidly )?(?:evolving|changing|fast-paced)\b/i,
        /\bwhether you['’]re an? [^.,;]{2,30} or\b/i,
      ],
      quoted,
    ),
    fixtures: {
      flag: [
        f("content/home.md", "Let's dive in to what we do."),
        f("content/home.md", "In today's rapidly evolving market, we help."),
        f("content/home.md", "Whether you're a landlord or a tenant, call us."),
      ],
      pass: [
        f("content/home.md", "Book in three taps. We confirm by text within the hour."),
        f("content/home.md", "Book at https://example.com/seamless-booking today."),
        f("content/home.md", "[Book a slot](/seamless-booking) today."),
      ],
    },
  },
  {
    id: "plainer-word",
    name: "A plainer word exists",
    generation: 1,
    severity: "warn",
    surface: "copy",
    why: "Empower, leverage, harness, delve: each stands in for a plainer verb, and the swap is a reliable sign nobody chose the word.",
    fix: "Name the mechanism instead. 'Empower your team' becomes 'Your team can publish without us'.",
    detect: phrases([wordList(PLAINER_WORDS)], quoted),
    fixtures: {
      flag: [f("content/home.md", "We empower small firms to grow.")],
      pass: [f("content/home.md", "Small firms can publish without waiting for us.")],
    },
  },
  {
    id: "plain-english",
    name: "'Plain English'",
    generation: 2,
    severity: "warn",
    surface: "copy",
    why: "Told to avoid jargon, a model announces that it is avoiding jargon. 'Explained plainly' swaps a synonym and keeps the tell.",
    fix: "Use the house replacement, 'properly explained', or drop the claim and let the copy show it.",
    detect: phrases([/\b(?:plain english|explained plainly|plainly explained)\b/i], quoted),
    fixtures: {
      flag: [f("content/home.md", "Your options, in plain English.")],
      pass: [f("content/home.md", "Your options, properly explained.")],
    },
  },
  {
    id: "buzzword",
    name: "Buzzword",
    generation: 1,
    severity: "warn",
    surface: "copy",
    why: "Cutting-edge, world-class, reach out, turnkey: corporate filler older than any model, and still the first thing a model writes about a business it knows nothing about.",
    fix: "Say what is actually true. 'World-class service' becomes 'We answer the phone until 8pm'. 'Reach out' becomes 'get in touch'.",
    detect: phrases([wordList(BUZZWORDS)], quoted),
    fixtures: {
      flag: [f("content/home.md", "Reach out for world-class plumbing.")],
      pass: [f("content/home.md", "Get in touch. We answer until 8pm.")],
    },
  },
  {
    id: "negative-reassurance",
    name: "Negative reassurance",
    generation: 1,
    severity: "warn",
    surface: "copy",
    why: "'No hidden fees', 'no surprises', 'never locked in' reassure by naming the fear, and plant it in a reader who did not have it.",
    fix: "Say what they get: 'The price on the quote is the price you pay', 'Cancel any month'.",
    detect: phrases([wordList(NEGATIVE_REASSURANCE)], quoted),
    fixtures: {
      flag: [f("content/home.md", "Clear pricing with no hidden fees.")],
      pass: [f("content/home.md", "The price on the quote is the price you pay.")],
    },
  },
  {
    id: "vague-word",
    name: "Vague word",
    generation: 1,
    severity: "warn",
    surface: "copy",
    why: "Innovative, scalable, end-to-end, solutions: each can be true, and each is used where the writer had nothing specific to say.",
    fix: "Replace it with the specific thing. 'Innovative solutions' becomes the actual product and what it does.",
    detect: phrases([wordList(VAGUE_WORDS)], quoted),
    fixtures: {
      flag: [f("content/home.md", "Innovative solutions for every business.")],
      pass: [f("content/home.md", "Rewires, fuse boards and EV chargers across Northamptonshire.")],
    },
  },
  {
    id: "review-phrase",
    name: "Review-tier phrase",
    generation: 1,
    severity: "warn",
    surface: "copy",
    why: "Truly, genuinely, ultimately, 'the single most', 'bar none': normal English once, and a tell when they stack. The house rules keep them for review, never blocking.",
    fix: "Keep the one that lands hardest and cut the rest. 'What is genuinely excellent' reads better as 'what is excellent'.",
    detect: phrases([new RegExp(`(?:^|\\b)(?:${[...REVIEW_PHRASES].sort((a, b) => b.length - a.length).map((p) => escape(p).replace(/^(\w)/, "\\b$1")).join("|")})`, "i")], quoted),
    fixtures: {
      flag: [f("content/home.md", "We are truly proud of it.")],
      pass: [f("content/home.md", "We have fitted 400 boilers since 2009.")],
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
    detect: phrases([/\S{0,20}\s?—\s?\S{0,20}/], quoted, (ctx) => ctx.strings, (block) => placeholderDash(block)),
    fixtures: {
      flag: [
        f("content/home.md", "Walk-ins welcome — just ring first."),
        f("app/hours.tsx", `export const hours = { weekdays: "Mon — Fri" };`),
      ],
      pass: [
        f("content/home.md", "Walk-ins welcome. Ring first. Open 9-5."),
        f("app/row.tsx", `export const Cell = ({ v }) => <td>{v ?? "—"}</td>;`),
        f("app/row.tsx", `export const Empty = () => <td className="muted">—</td>;`),
      ],
    },
  },
  {
    id: "emoji",
    name: "Emoji in copy",
    generation: 1,
    severity: "warn",
    surface: "copy",
    why: "A sparkle or a rocket beside a heading is decoration a model adds to seem friendly. It dates the page and reads as a social post.",
    fix: "Remove it. Typographic marks are fine: a star for a rating, a middot as a separator, an arrow in a link.",
    detect: phrases([new RegExp(EMOJI.source, "u")], (m) => `emoji ${m}`, (ctx) => ctx.strings),
    fixtures: {
      flag: [
        f("content/home.md", "New treatments this month ✨🚀"),
        f("app/cta.tsx", `export const label = "Book 🚀";`),
        f("content/home.md", "New treatments this month ✨"),
        f("content/home.md", "Same-day callouts ✅"),
        f("content/home.md", "Open Sundays ☀️"),
      ],
      pass: [f("content/home.md", "Rated ★★★★★ · Book now →"), f("content/home.md", "✓ Gas Safe registered")],
    },
  },
  {
    id: "not-just-but",
    name: "Contrastive negation",
    generation: 2,
    severity: "warn",
    surface: "copy",
    why: "'It's not just a haircut, it's an experience', 'dispatched from here, not shipped in': the contrast-and-reveal template is the most recognisable construction in generated copy.",
    fix: "Say the positive claim and drop the contrast.",
    detect: phrases(NEGATION, quoted, allText),
    fixtures: {
      flag: [
        f("content/home.md", "It's not just a haircut, it's an experience."),
        f("content/home.md", "It's not a website, it's a growth engine."),
        f("content/home.md", "I don't teach the treatment you'd choose: I teach the standard."),
        f("content/home.md", "Hairdressing isn't a job, it's art."),
        f("content/home.md", "It is less about the tools and more about the eye."),
        f("content/home.md", "Order today and it's dispatched from here, not shipped in from Seoul."),
        f("app/offer.tsx", `export const outcome = "The whole path, not just the ads.";`),
      ],
      pass: [
        f("content/home.md", "A haircut, a hot towel and a straight-razor finish."),
        f("content/home.md", "They are cosmetics, not medicines."),
        f("content/home.md", "The box arrived red, not led astray by a dented corner."),
      ],
    },
  },
  {
    id: "no-x-no-y",
    name: "'No X, no Y' list",
    generation: 2,
    severity: "warn",
    surface: "copy",
    why: "'No obligation, no spam.' Defining the business by what it is not, itemised, is the same template as contrastive negation.",
    fix: "Say what they get: 'We reply within a day and only about your enquiry'.",
    detect: phrases([NO_X_NO_Y], quoted, allText, emptyState),
    fixtures: {
      flag: [
        f("content/home.md", "We reply within a day. No obligation, no spam."),
        f("app/hero.tsx", `export const Hero = () => <p className="mt-4">We reply within a day. No\n  obligation, no spam.</p>;`),
      ],
      pass: [
        f("content/home.md", "We reply within a day, and only about your enquiry."),
        f("app/admin/list.tsx", `export const Empty = () => <p>No clients, no bookings.</p>;`),
        f("app/list.tsx", `export const Empty = () => <p>No orders yet, no invoices found.</p>;`),
      ],
    },
  },
  {
    id: "no-x-badge",
    name: "'No X' badge",
    generation: 2,
    severity: "warn",
    surface: "copy",
    why: "'No catch.', 'NO JARGON GUIDE': a short standalone 'No X' reads as a slapped-on kicker, and worse when the same one is reused across pieces.",
    fix: "Replace it with the positive fact it hints at, or cut it.",
    detect: badgeHits,
    fixtures: {
      flag: [f("app/badge.tsx", `export const kicker = "No catch.";`), f("content/home.md", "Straight answers.\n\nNo jargon guide\n")],
      pass: [
        f("app/list.tsx", `export const empty = "No results found.";`),
        f("app/portal/list.tsx", `export const empty = "No bookings";`),
        f("content/home.md", "### No clarity on ideal client\n"),
      ],
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
    detect: phrases([/(?:\b[A-Z][\w'’-]*(?:\s+[\w'’-]+){0,2}[.!]\s+){2}[A-Z][\w'’-]*(?:\s+[\w'’-]+){0,2}[.!](?=\s|$)/], quoted),
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
    detect: phrases([/\bwhere\s+[\w'’-]+(?:\s+[\w'’-]+)?\s+meets?\s+[\w'’-]+/i], quoted),
    fixtures: {
      flag: [f("content/home.md", "Where luxury meets comfort.")],
      pass: [f("content/home.md", "A two-chair studio above the bakery on Market Place.")],
    },
  },
];

// ------------------------------------------------------------ research tells
//
// Added 2026.09.4 and 2026.09.5 from the Wikipedia "Signs of AI writing"
// guide and a second research pass, checked
// against commercial copy. That guide is written for neutral encyclopaedia
// text and flags persuasion itself, which sales copy needs. So each pattern
// here is narrowed to the empty form, and each carries a pass case that is
// real persuasive copy: persuasion backed by a fact passes.

/**
 * A participle tacked on the end of a sentence that adds significance and no
 * mechanism: "..., ensuring peace of mind". Participles that carry a fact
 * ("..., carrying the parts for most boilers") are not on the list.
 */
const ING_TAIL = /,\s+(?:ensuring|highlighting|underscoring|showcasing|reflecting|demonstrating|emphasi[sz]ing|fostering|cementing|solidifying|reinforcing|symboli[sz]ing|signalling|signaling)\b[^.!?\n]{0,80}/i;

/** A claim credited to nobody. A named source ("A 2023 Which? survey") is not matched. */
const VAGUE_ATTRIBUTION = [
  /\b(?:studies|research|experts|scientists|surveys|statistics|the data)\s+(?:show|shows|suggest|suggests|agree|say|says|confirm|confirms|prove|proves|indicate|indicates)\b/i,
  /\b(?:many|most)\s+(?:experts|people|customers|professionals|homeowners)\s+(?:agree|say|believe)\b/i,
  /\bit\s+is\s+(?:widely|generally|commonly)\s+(?:known|accepted|believed|agreed)\b/i,
];

/**
 * A claim that names its source is not vague: "BrightLocal's research shows",
 * "ONS figures show", or a sentence that ends in a footnote or a link. Found
 * on the DD site's own guides, 2026-09-23, where footnoted claims were flagged.
 */
function sourced(block: CopyBlock, _match: string, index: number): boolean {
  const before = block.text.slice(Math.max(0, index - 40), index);
  if (/(?:\b[A-Z][\w&]*[’']s|\b[A-Z]{2,}[a-z]*)\s+$/.test(before)) return true;
  const rest = block.text.slice(index, index + 400);
  const end = rest.search(/[.!?](?:\s|$)/);
  const sentence = rest.slice(0, end === -1 ? rest.length : end + 16);
  return /\[\^\w+\]|\]\(https?:|\(source|according to [A-Z]|\bper [A-Z]/.test(sentence);
}

/** A paragraph that opens by announcing it is summing up. */
const CLOSING_SUMMARY = /(?:^|[.!?]\s+|\n\s*|>\s*)(?:Overall|In conclusion|In summary|To sum up|All in all|In short|To summari[sz]e),/;

/**
 * A range with no scale: "from first-time buyers to seasoned investors
 * alike". Real ranges ("from 9am to 5pm", "everything from small repairs to
 * full rewires") are left alone; only the "alike" form and "everyone from",
 * a range of people, fire.
 */
const FALSE_RANGE = [
  /\bfrom\s+(?:[\w'’-]+\s+){0,3}[\w'’-]+\s+to\s+(?:[\w'’-]+\s+){0,3}[\w'’-]+\s+alike\b/i,
  /\b(?:everyone|anyone)\s+from\s+(?:[\w'’-]+\s+){0,3}[\w'’-]+\s+to\s+(?:[\w'’-]+\s*){1,4}/i,
];

/**
 * Chatbot residue: text that only exists because a chat assistant's reply was
 * pasted whole. Unlike every other copy tell this is evidence, not style: a
 * person writing their own page never types "Certainly! Here's a revised
 * version". The research treats it as an error on first occurrence.
 */
const RESIDUE = [
  /\bas an AI(?:\s+language)?\s+(?:model|assistant)\b/i,
  /(?:^|\n|>)\s*(?:Certainly|Sure|Absolutely|Of course|Great question)[!,.]\s+(?:Here(?:['’]s| is| are)|Below)\b/i,
  /\bhere(?:['’]s| is)\s+(?:a|an|the|your)\s+(?:revised|rewritten|updated|polished|refined|improved|draft|more concise)\s+(?:version|draft|copy)\b/i,
  /\blet me know if you(?:['’]d| would) like me to\b/i,
  /\b(?:my|the) (?:knowledge|training) cut-?off\b|\bas of my last (?:update|training)\b/i,
  /\bI hope this helps\b/i,
  // Citation tokens a chat tool leaves in copied text.
  // A run of them is one paste: "citeturn11search1turn10view0" is one finding.
  // ChatGPT wraps them in invisible private-use characters (U+E200 to U+E202),
  // which survive a copy and paste into a CMS: found live, 2026-09-23.
  /[\uE200-\uE2FF]*(?:cite)?[\uE200-\uE2FF]*(?:turn\d+(?:search|news|view|fetch|file|image)\d+[\uE200-\uE2FF]*)+/,
  /:?contentReference\[oaicite:\d+\](?:\{index=\d+\})?/,
  // Entity markers from the same paste: entity["company","Bark","services
  // marketplace"] shows on the page where the plain name "Bark" belongs.
  /[\uE200-\uE2FF]*entity[\uE200-\uE2FF]*\["[a-z_]+"\s*,\s*"[^"\n]{1,80}"(?:\s*,\s*"[^"\n]{0,160}")*\][\uE200-\uE2FF]*/,
  /【\d+(?:[:†][^】]{0,40})?】/,
];

/** A link whose tracking says it was copied out of a chat assistant. */
const AI_UTM = /utm_source=(?:chatgpt\.com|chat\.openai\.com|openai|perplexity(?:\.ai)?|claude\.ai|copilot(?:\.microsoft\.com)?|gemini(?:\.google\.com)?)\b/gi;

function residueHits(ctx: CopyContext): Hit[] {
  const hits = phrases(RESIDUE, quoted, allText)(ctx);
  for (const file of ctx.files) {
    for (const m of file.text.matchAll(AI_UTM)) hits.push({ path: file.path, offset: m.index ?? 0, message: `link tracked as copied from a chat assistant: "${m[0]}"` });
  }
  return hits;
}

/** Scaffolding that must never reach a reader: fill-in brackets, lorem ipsum, the house TODO marker. */
const PLACEHOLDER = [
  /\[(?:insert|your|add|company|client|business|customer|name of|placeholder)\b[^\]\n]{0,40}\](?!\()/i,
  /\blorem ipsum\b/i,
  /\bTODO_PLACEHOLDER\b/,
];

/**
 * A placeholder that is the whole of an element, `<p>[Insert testimonial]</p>`,
 * never reaches the prose extraction, which drops a bracketed run as code. It
 * is the commonest shape of all, so markup is also read for it directly.
 */
const PLACEHOLDER_ELEMENT = />\s*(\[(?:insert|your|add|company|client|business|customer|name of|placeholder)\b[^\]\n<]{0,40}\])\s*</gi;

/**
 * Inside quotation marks a placeholder is a template being taught, not a gap:
 * a guide telling the reader to search "plumber [your town]" or to send
 * "Thanks, [Your name]". Counted on the line: an odd number of quote marks
 * before the match means it sits inside a quotation.
 */
function insideQuotes(block: CopyBlock, _match: string, index: number): boolean {
  const lineStart = block.text.lastIndexOf("\n", index - 1) + 1;
  const before = block.text.slice(lineStart, index);
  const straight = (before.match(/"/g) ?? []).length;
  const curly = (before.match(/“/g) ?? []).length - (before.match(/”/g) ?? []).length;
  return straight % 2 === 1 || curly > 0;
}

function placeholderHits(ctx: CopyContext): Hit[] {
  const hits = phrases(PLACEHOLDER, quoted, allText, insideQuotes)(ctx);
  const seen = new Set(hits.map((h) => `${h.path}:${h.offset}`));
  for (const file of ctx.files) {
    if (isProsePath(file.path)) continue;
    for (const m of file.text.matchAll(PLACEHOLDER_ELEMENT)) {
      const offset = (m.index ?? 0) + m[0].indexOf(m[1]);
      if (!seen.has(`${file.path}:${offset}`)) hits.push({ path: file.path, offset, message: quoted(m[1]) });
    }
  }
  return hits;
}

/** "The result? Faster growth." A staged reveal: the writer asks the reader's question, then answers it. */
const QUESTION_REVEAL = [
  /\b(?:The|Our|What['’]s the|Here['’]s the)\s+(?:result|catch|secret|answer|difference|best part|twist|kicker|bottom line|upshot)\?\s+[A-Z0-9]/,
  /\?\s+It means\b/,
];

/** Three or more adjacent "**Label:** text" bullets: a label that repeats what the line says. */
function inlineLabelHits(ctx: CopyContext): Hit[] {
  const hits: Hit[] = [];
  for (const file of ctx.files) {
    if (!isProsePath(file.path)) continue;
    const lines = file.text.split("\n");
    let run: number[] = [];
    let offset = 0;
    const flush = () => {
      if (run.length >= 3) hits.push({ path: file.path, offset: run[0], message: `${run.length} bullets in a row open with a bold label and a colon` });
      run = [];
    };
    for (const line of lines) {
      // A short restatement after the label is the tell. A definition list,
      // "**CQC**: the regulator of health and social care in England", is not.
      const m = /^\s*(?:[-*+]|\d+\.)\s+\*\*[^*]{1,40}:?\*\*:?\s+(\S.*)$/.exec(line);
      if (m && m[1].trim().split(/\s+/).length <= 6) run.push(offset);
      else flush();
      offset += line.length + 1;
    }
    flush();
  }
  return hits;
}

export const RESEARCH_TELLS: CopyTell[] = [
  {
    id: "chatbot-residue",
    name: "Chatbot residue",
    generation: 1,
    severity: "warn",
    surface: "copy",
    why: "'Certainly! Here's a revised version', 'as an AI language model', a citeturn0search0 token, a link tracked utm_source=chatgpt.com: text that exists only because a chat reply was pasted whole. This is evidence, not style.",
    fix: "Delete the residue. Then read the whole passage again, because the rest of it came from the same paste.",
    detect: residueHits,
    fixtures: {
      flag: [
        f("content/home.md", "Certainly! Here's a revised version of your home page."),
        f("content/home.md", "As an AI language model, I cannot visit your salon."),
        f("content/home.md", "Let me know if you'd like me to shorten it."),
        f("content/home.md", "Prices start at £40 citeturn0search3 for a full set."),
        f("content/home.md", "Prices start at £40. citeturn11search1turn10view0turn2view3"),
        f("content/home.md", "Prices start at £40. \uE200cite\uE202turn11search1\uE202turn10view0\uE201"),
        f("content/home.md", "Prices start at £40 :contentReference[oaicite:2]{index=2} for a full set."),
        f("content/home.md", "Prices start at £40【4†source】 for a full set."),
        f("app/guide.tsx", `export const Guide = () => <a href="https://example.com/guide?utm_source=chatgpt.com">Read the guide</a>;`),
        f("content/home.md", "Here's a more concise version for the hero."),
      ],
      pass: [
        f("content/home.md", "Certainly the busiest week of the year: book early."),
        f("content/home.md", "Here's the price list for 2026."),
        f("app/guide.tsx", `export const Guide = () => <a href="https://example.com/guide?utm_source=newsletter">Read the guide</a>;`),
      ],
    },
  },
  {
    id: "placeholder",
    name: "Unfilled placeholder",
    generation: 1,
    severity: "warn",
    surface: "copy",
    why: "'[Insert testimonial]', '[Your Name]', lorem ipsum, TODO_PLACEHOLDER: scaffolding a reader must never see, and the clearest sign a page shipped before anyone read it.",
    fix: "Fill it from the client or the proof source, or remove the element. Never invent the missing fact to close it.",
    detect: placeholderHits,
    fixtures: {
      flag: [
        f("content/home.md", "Rated 5 stars by [Insert client name] and others."),
        f("content/home.md", "Lorem ipsum dolor sit amet."),
        f("content/home.md", "Rated TODO_PLACEHOLDER: google_rating from our reviews."),
        f("app/card.tsx", `export const Quote = () => <blockquote>[Insert testimonial here]</blockquote>;`),
      ],
      pass: [
        f("content/home.md", "Manage bookings in [your account](/account)."),
        f("content/guide.md", 'After 90 days, check your ranking for "[your trade] [your town]" on Google.'),
        f("content/guide.md", "Send a short message: “Thanks for choosing [Business Name]! Leave us a review.”"),
        f("content/home.md", "Rated 4.9 from 212 Google reviews."),
      ],
    },
  },
  {
    id: "question-reveal",
    name: "Staged reveal",
    generation: 2,
    severity: "warn",
    surface: "copy",
    why: "'The result? Faster growth.', 'What does this mean for you? It means...': the writer asks the reader's question for them and answers it. An infomercial hook, and a favourite of generated copy.",
    fix: "State the answer: 'Most customers book again within six weeks.'",
    detect: phrases(QUESTION_REVEAL, quoted),
    fixtures: {
      flag: [f("content/home.md", "We rebuilt the booking flow. The result? Twice the bookings."), f("content/home.md", "What does this mean for you? It means fewer missed calls.")],
      pass: [f("content/faq.md", "How long does a set last? About three weeks with gel."), f("content/home.md", "We rebuilt the booking flow, and bookings doubled in a month.")],
    },
  },
  {
    id: "inline-label-list",
    name: "Bold-label bullets",
    generation: 2,
    severity: "warn",
    surface: "copy",
    why: "'**Speed:** Faster pages' three times in a row: a short label restated in a few words, the list shape generated copy defaults to. A definition list, with a real explanation after each label, is not this.",
    fix: "Drop the labels and write each bullet as the fact: 'Pages load in under a second'. Keep labels only where they help a reader navigate, as in a specification.",
    detect: inlineLabelHits,
    fixtures: {
      flag: [f("content/home.md", "- **Speed:** Faster pages\n- **Security:** Safer data\n- **Support:** Help when you need it\n")],
      pass: [
        f("content/home.md", "- Pages load in under a second\n- Card details never touch our server\n- Support by phone until 8pm\n"),
        f("content/home.md", "- **Speed:** Faster pages\n- **Security:** Safer data\n"),
        f("content/guide.md", "- **GDC**: The statutory regulator for all dental professionals.\n- **GCC**: The statutory regulator for chiropractors in the UK.\n- **CQC**: The independent regulator of health and social care in England.\n"),
      ],
    },
  },
  {
    id: "ing-tail",
    name: "Empty -ing tail",
    generation: 2,
    severity: "warn",
    surface: "copy",
    why: "'..., ensuring peace of mind', '..., highlighting our commitment': a participle tacked on the end that claims significance and names no mechanism. One of the most common shapes in the Wikipedia guide to AI writing.",
    fix: "Cut the tail, or replace it with the mechanism: 'so you can drop the car off before work'.",
    detect: phrases([ING_TAIL], (m) => quoted(m.replace(/^,\s*/, ""))),
    fixtures: {
      flag: [
        f("content/home.md", "Every engineer is Gas Safe registered, ensuring complete peace of mind."),
        f("app/about.tsx", `export const About = () => <p>We have served Brackley since 2009, highlighting our commitment to the town.</p>;`),
      ],
      pass: [
        f("content/home.md", "We open at 7am, so you can drop the car off before work."),
        f("content/home.md", "Engineers arrive by 9, carrying the parts for most boilers."),
      ],
    },
  },
  {
    id: "vague-attribution",
    name: "Unnamed source",
    generation: 1,
    severity: "warn",
    surface: "copy",
    why: "'Studies show', 'experts agree', 'it is widely known': a claim credited to nobody. A reader cannot check it, and the house proof rule forbids a claim nobody can check.",
    fix: "Name the source and the number ('A 2023 Which? survey of 2,000 drivers found...') or cut the claim.",
    detect: phrases(VAGUE_ATTRIBUTION, quoted, (ctx) => ctx.blocks, sourced),
    fixtures: {
      flag: [
        f("content/home.md", "Studies show that regular servicing saves money."),
        f("content/home.md", "Most experts agree a boiler lasts fifteen years."),
        f("content/home.md", "It is widely known that gel damages nails."),
      ],
      pass: [
        f("content/home.md", "A 2023 Which? survey of 2,000 owners found serviced boilers failed half as often."),
        f("content/home.md", "BrightLocal's research shows that reviews drive 20% of local ranking."),
        f("content/home.md", "Research shows 62% of consumers avoid a business with wrong hours.[^7]"),
        f("content/home.md", "Our customers rate us 4.9 from 212 Google reviews."),
      ],
    },
  },
  {
    id: "closing-summary",
    name: "Closing summary",
    generation: 1,
    severity: "warn",
    surface: "copy",
    why: "'Overall,', 'In conclusion,', 'In short,': a paragraph that announces it is summing up, then restates what the reader has just read.",
    fix: "Cut the summary. End on the last new fact, or on the next step: 'Book a survey and we'll quote within two days'.",
    detect: phrases([CLOSING_SUMMARY], (m) => quoted(m.replace(/^[.!?>\s]+/, ""))),
    fixtures: {
      flag: [
        f("content/home.md", "We rewire, test and certify.\n\nOverall, we are the right choice for your home."),
        f("content/home.md", "Prices start at £40. In conclusion, we offer great value."),
      ],
      pass: [f("content/home.md", "We rewire, test and certify.\n\nBook a survey and we'll quote within two days.")],
    },
  },
  {
    id: "false-range",
    name: "False range",
    generation: 1,
    severity: "warn",
    surface: "copy",
    why: "'From first-time buyers to seasoned investors alike' names two ends of no real scale, to sound as if it covers everyone. It describes nobody.",
    fix: "Say who you actually serve, or cut it. A real range is fine: 'from 9am to 5pm', 'from small repairs to full rewires'.",
    detect: phrases(FALSE_RANGE, quoted),
    fixtures: {
      flag: [
        f("content/home.md", "We help clients from first-time buyers to seasoned investors alike."),
        f("content/home.md", "Everyone from students to retirees loves our cakes."),
      ],
      pass: [
        f("content/home.md", "Open from 9am to 5pm, Monday to Saturday."),
        f("content/home.md", "We take on everything from small repairs to full rewires."),
      ],
    },
  },
];
