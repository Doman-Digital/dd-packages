/**
 * Specificity tells: a page that could belong to anyone.
 *
 * A model given no brief writes the claim every site makes, because it has
 * nothing particular to say: "Quality you can trust", "Your vision, our
 * expertise". And it asserts standing ("trusted", "fully qualified",
 * "award-winning") with nothing next to the assertion to back it, because it
 * has no reviews and no registration number to put there.
 *
 * Both are read from what the page says, not how it looks: `specificity.ts`
 * counts the particulars.
 */

import { makeSnapshot } from "../../snapshot/fixture.js";
import type { Snapshot, SnapshotSection } from "../../snapshot/types.js";
import { fileKind } from "../parse.js";
import { sentencesOf, specificity } from "../specificity.js";
import type { CopyContext, CopyTell, Hit, RenderedTell } from "../types.js";

const count = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
const snapHit = (s: Snapshot, message: string, excerpt?: string): Hit => ({ path: s.url, offset: 0, message, excerpt: excerpt ?? message });

// ------------------------------------------------------------------ generic hero claim

const ENTITIES: Record<string, string> = { amp: "&", nbsp: " ", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", quot: '"', apos: "'", "#39": "'", pound: "£" };

/**
 * The words of an element as written in source, or null when an expression
 * supplies them: `{title}` is data this check cannot read.
 */
function literalText(inner: string): string | null {
  const t = inner
    .replace(/\{\s*(["'`])\s*\1\s*\}/g, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  if (/[{}]/.test(t)) return null;
  return t.replace(/&(#?\w+);/g, (m, e: string) => ENTITIES[e] ?? m).replace(/\s+/g, " ").trim();
}

/**
 * The home page's source, where the first claim is made: a root route file
 * (`app/page.tsx`, `pages/index.tsx`, `src/pages/index.astro`, SvelteKit's
 * root `+page.svelte`), a top-level `index.html`, or a hero or home component.
 * Every other page's headline is a label ("Privacy policy", "Boiler
 * repairs"), not a claim, and is not judged.
 */
export const HOME_FILE =
  /(?:^|\/)app\/(?:\([^/]+\)\/)*page\.(?:tsx|jsx|mdx)$|(?:^|\/)pages\/index\.(?:tsx|jsx|astro|vue|mdx)$|(?:^|\/)routes\/(?:\([^/]+\)\/)*\+page\.svelte$|^(?:(?:public|src|site|www)\/)?index\.html?$|(?:^|\/)[\w-]*(?:hero|home)[\w-]*\.(?:tsx|jsx|astro|vue|svelte|html?)$/i;

/** A home page URL: the site root, `index.html`, or a locale root such as `/en-gb/`. */
export const HOME_URL = /^https?:\/\/[^/?#]+(?:\/(?:[a-z]{2}(?:-[a-z]{2})?\/?)?(?:index\.html?)?)?(?:[?#].*)?$/i;

const H1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/gi;
const NEXT_P = /<p\b[^>]*>([\s\S]*?)<\/p>/i;

/** Each literal headline in markup, with the paragraph under it when it follows within a few lines. */
function headlines(ctx: CopyContext): { path: string; offset: number; h1: string; text: string }[] {
  const out: { path: string; offset: number; h1: string; text: string }[] = [];
  for (const file of ctx.files) {
    if (fileKind(file.path) !== "markup" || !HOME_FILE.test(file.path)) continue;
    for (const m of file.text.matchAll(H1)) {
      const h1 = literalText(m[1]);
      if (!h1) continue;
      const after = file.text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 1200);
      const p = NEXT_P.exec(after);
      const sub = p ? literalText(p[1]) : null;
      out.push({ path: file.path, offset: m.index ?? 0, h1, text: [h1, sub].filter(Boolean).join("\n") });
    }
  }
  return out;
}

const GENERIC_MESSAGE = "the headline and the line under it name nothing particular: no place, name, number, price or job";

// ------------------------------------------------------------------ proof in context

/**
 * A claim of standing: what a visitor has to take on trust unless something
 * next to it backs it. Numbers of years are left out: those are checkable
 * facts, and `craft copy claims` lists them.
 */
export const STANDING_CLAIM =
  /(?<![\w#])(?:trusted|reliable|reputable|award[- ]winning|top[- ]rated|best[- ]rated|highly (?:rated|recommended|experienced|skilled|qualified)|fully (?:qualified|certified|accredited|licensed|insured)|(?:qualified|certified|accredited|approved|registered|experienced|expert) (?:engineers?|electricians?|plumbers?|builders?|technicians?|installers?|team|tradesmen|professionals?|staff)|(?:years|decades) of experience|(?:5|five)[- ]star (?:service|rated|reviews?)|(?:happy|satisfied) (?:customers|clients)|(?:customers|clients) (?:love|trust|recommend)|number one|no\.? ?1|#1)(?![\w])/i;

/** Accreditation bodies, trade registers and review platforms, by the names they trade under. */
export const PROOF_NAMES: readonly string[] = [
  "Gas Safe", "NICEIC", "NAPIT", "ELECSA", "Stroma", "TrustMark", "Which? Trusted Trader", "Checkatrade", "TrustATrader",
  "Rated People", "MyBuilder", "Federation of Master Builders", "FMB", "Guild of Master Craftsmen", "OFTEC", "HETAS", "CIPHE",
  "APHC", "CHAS", "SafeContractor", "Constructionline", "FENSA", "CERTASS", "MCS", "RECC", "BPEC", "City & Guilds", "NVQ", "CSCS",
  "Worcester Bosch", "Vaillant", "Viessmann", "BAFE", "NSI", "SSAIB", "BPCA", "RICS", "CIOB", "RIBA", "ICAEW", "ACCA", "CIMA",
  "SRA", "Law Society", "GDC", "GMC", "HCPC", "CQC", "Ofsted", "ISO 9001", "ISO 27001", "Cyber Essentials", "Companies House",
  "FCA", "Trustpilot", "Feefo", "Reviews.io", "Yell", "Houzz",
];

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Case-sensitive: the names are proper nouns, and "chas" or "mcs" in running text is not the register. */
const PROOF_NAME = new RegExp(`(?<![\\w])(?:${PROOF_NAMES.map(escape).join("|")})(?![\\w])`);
const PROOF_NAME_ANY_CASE = new RegExp(PROOF_NAME.source, "i");
const PROOF_PATTERNS: RegExp[] = [
  PROOF_NAME,
  /\bGoogle (?:reviews?|rating)\b|\breviews? on Google\b/i,
  // A rating or a count of reviews: "4.9 out of 5", "rated 5", "212 reviews".
  /\b[1-5](?:\.\d)?\s?(?:\/\s?5|out of 5)\b|\brated\s+[1-5](?:\.\d)?\b|★{3,}|\b\d[\d,]*\+?\s+(?:verified\s+)?(?:reviews|ratings)\b/i,
  // A registration or licence number.
  /\b(?:reg(?:istration|istered)?|licen[cs]e|membership|company)\s*(?:no\.?|number|#)\s*:?\s*[A-Z0-9-]{4,}/i,
];

/** A quoted review, or the attribution line under one. */
const isQuote = (block: string): boolean => (/^["“]/.test(block) && block.split(/\s+/).length >= 8) || /^[—–-]\s*[A-Z]/.test(block);

function sectionHasProof(s: Snapshot, section: SnapshotSection, index: number): boolean {
  if ((section.role ?? section.kind) === "testimonials") return true;
  const text = section.text ?? [];
  if (text.some((b) => isQuote(b) || PROOF_PATTERNS.some((re) => re.test(b)))) return true;
  // An accreditation logo is proof in a picture: read its alt text and file name.
  return (s.images ?? []).some((i) => i.section === index && i.role === "logo" && PROOF_NAME_ANY_CASE.test(`${i.alt ?? ""} ${i.src}`));
}

/** Every claim of standing with no review or accreditation in its section or the one either side. */
export function unprovenClaims(s: Snapshot): { claim: string; sentence: string; section: string }[] {
  const proof = s.sections.map((section, i) => sectionHasProof(s, section, i));
  const out: { claim: string; sentence: string; section: string }[] = [];
  s.sections.forEach((section, i) => {
    if (!section.text || proof[i] || proof[i - 1] || proof[i + 1]) return;
    for (const sentence of sentencesOf(section.text)) {
      const m = STANDING_CLAIM.exec(sentence);
      if (m) out.push({ claim: m[0], sentence, section: section.label });
    }
  });
  return out;
}

// ------------------------------------------------------------------ fixtures

const withText = (texts: string[][], patch: (i: number) => Partial<SnapshotSection> = () => ({})): Snapshot => {
  const base = makeSnapshot();
  return { ...base, sections: base.sections.map((sec, i) => ({ ...sec, text: texts[i] ?? [], ...patch(i) })) };
};

const CLAIM_TEXT = ["What we fix", "Our fully qualified engineers are trusted by homeowners across the county."];

export const SPECIFICITY_COPY_TELLS: CopyTell[] = [
  {
    id: "generic-hero-claim",
    name: "Headline that fits any business",
    generation: 1,
    severity: "warn",
    surface: "copy",
    why: "The first thing a visitor reads on the home page names no place, no person, no price and no job, so it would fit every competitor's site unchanged. A model writes it when it has nothing particular to say.",
    fix: "Put what only this business can say on the first screen: the job, the town, a price, the name. \"Boilers fixed the same day in Brackley\" beats \"Quality you can trust\".",
    detect: (ctx) =>
      headlines(ctx)
        .filter((h) => specificity(h.text).generic)
        .map((h) => ({ path: h.path, offset: h.offset, message: GENERIC_MESSAGE, excerpt: h.h1 })),
    fixtures: {
      flag: [
        { path: "app/page.tsx", text: '<section>\n  <h1 className="text-6xl">Quality you can trust</h1>\n  <p>We deliver reliable solutions tailored to your needs.</p>\n</section>' },
        // Shouted and Title Case: its capitals are not names, and its figures are stock.
        { path: "index.html", text: "<h1>YOUR VISION, OUR EXPERTISE</h1>\n<p>24/7 Support And 100% Satisfaction Guaranteed For Every Customer</p>" },
      ],
      pass: [
        { path: "app/page.tsx", text: '<h1 className="text-6xl">Boilers fixed the same day in Brackley</h1>' },
        // A stock headline rescued by the line under it.
        { path: "index.html", text: "<h1>Quality you can trust</h1>\n<p>Gas Safe registered engineers in Northampton since 2009.</p>" },
        // Two trade nouns say what the business does.
        { path: "index.html", text: "<h1>Plumbing and boiler repairs</h1>" },
        // The words come from data: nothing to read.
        { path: "app/page.tsx", text: "<h1 className=\"text-6xl\">{site.headline}</h1>" },
        // Another page's headline is a label, not the site's claim.
        { path: "app/privacy/page.tsx", text: "<h1>Privacy policy</h1>\n<p>This policy explains how we use your data.</p>" },
      ],
    },
    rendered: {
      detect: (s) => {
        if (!s.firstScreenText || !HOME_URL.test(s.url)) return [];
        const text = s.firstScreenText.join("\n");
        if (!text.trim() || !specificity(text).generic) return [];
        const h1 = s.headings.find((h) => h.level === 1 && h.top < s.viewport.height);
        return [snapHit(s, `the first screen names nothing particular: no place, name, number, price or job`, h1?.text ?? s.firstScreenText[0])];
      },
      fixtures: {
        flag: [
          makeSnapshot({ firstScreenText: ["Quality you can trust", "We deliver reliable solutions tailored to your needs."], headings: [{ ...makeSnapshot().headings[0], text: "Quality you can trust" }] }),
          makeSnapshot({ firstScreenText: ["YOUR VISION, OUR EXPERTISE", "24/7 support. 100% satisfaction. 5-star service."] }),
        ],
        pass: [
          makeSnapshot(),
          makeSnapshot({ firstScreenText: ["Boilers fixed the same day in Brackley", "From £85, with the part on the van."] }),
          makeSnapshot({ firstScreenText: ["Quality plumbing you can trust", "Boilers, radiators and underfloor heating."] }),
          // A first screen that is a picture and nothing else is not judged on its words.
          makeSnapshot({ firstScreenText: [] }),
          // Nor is any page but the home page.
          makeSnapshot({ url: "https://example.test/privacy", firstScreenText: ["Privacy policy", "This policy explains how we use your data."] }),
        ],
      },
    },
  },
];

export const SPECIFICITY_RENDERED_TELLS: RenderedTell[] = [
  {
    id: "unproven-claim",
    name: "Claim with no proof next to it",
    generation: 1,
    severity: "warn",
    surface: "rendered",
    why: "\"Trusted\", \"fully qualified\" and \"award-winning\" ask the visitor to take the business's word for it. A page built with no reviews and no registration number makes the claim anyway, with nothing beside it.",
    fix: "Put the proof where the claim is: the Gas Safe or NICEIC number, the named review with its town, the rating and where it was left. Or cut the claim.",
    rendered: {
      detect: (s) => {
        if (!s.sections.some((x) => x.text)) return [];
        const found = unprovenClaims(s);
        if (found.length === 0) return [];
        const first = found[0];
        const where = first.section ? `"${first.section}"` : "an unnamed section";
        return [snapHit(s, `${count(found.length, "claim")} with no review or accreditation within one section: "${first.claim}" in ${where}`, first.sentence)];
      },
      fixtures: {
        flag: [
          withText([["Boilers fixed the same day in Brackley"], CLAIM_TEXT]),
          // Proof two sections away is not next to the claim.
          withText([["Boilers fixed the same day in Brackley"], CLAIM_TEXT, ["Recent jobs"], ["“They turned up on time and fixed the boiler in an hour.”", "Sam, Brackley"]], (i) => (i === 3 ? { role: "testimonials" } : {})),
        ],
        pass: [
          makeSnapshot(),
          withText([["Boilers fixed the same day in Brackley"], ["Our fully qualified engineers are Gas Safe registered, number 123456."]]),
          withText([["Boilers fixed the same day in Brackley"], CLAIM_TEXT, ["What customers said"]], (i) => (i === 2 ? { role: "testimonials" } : {})),
          withText([["Rated 4.9 out of 5 from 212 reviews on Google"], CLAIM_TEXT]),
          {
            ...withText([["Boilers fixed the same day in Brackley"], CLAIM_TEXT]),
            images: [{ src: "https://example.test/img/gas-safe-register.svg", host: "example.test", width: 96, height: 96, top: 1200, role: "logo", alt: "Gas Safe Register", decorative: false, section: 1, background: false }],
          },
        ],
      },
    },
  },
];
