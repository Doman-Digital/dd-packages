/**
 * Register briefs: how to write in a chosen register, read before drafting.
 *
 * `COPY.md` says what every piece of house copy avoids. A register says what a
 * draft reaches for: plain for a form or a policy, persuasive for a landing
 * page, warm for a customer email, literary for a premium brand. The brief is
 * read before drafting and `craft copy` runs afterwards, the order `COPY.md`
 * sets for its own writing directives.
 *
 * Directives are positive ("do this"), never a list of phrases to avoid:
 * naming a phrase puts it in the writer's head. Each one names its source, and
 * a directive with no public authority behind it says "house judgement".
 *
 * Nothing here measures or grades. `REGISTERS.md` carries the generated text
 * of this file, bound by a test.
 */

export type RegisterId = "plain" | "persuasive" | "warm" | "literary";

export interface RegisterSource {
  name: string;
  url?: string;
  /** What this register takes from it, and anything it does not. */
  note: string;
}

export interface Directive {
  text: string;
  /** Short source key: a `RegisterSource.name`, `COPY.md`, or "house judgement". */
  from: string;
}

export interface Register {
  id: RegisterId;
  name: string;
  useFor: string;
  directives: Directive[];
  example: { before: string; after: string; why: string };
  sources: RegisterSource[];
}

const GOVUK = "GOV.UK writing guidelines";
const MAILCHIMP = "Mailchimp Content Style Guide";
const OGILVY = "Ogilvy, Ogilvy on Advertising (1983)";
const CAPLES = "Caples, Tested Advertising Methods";
const HOUSE = "house judgement";

export const ALWAYS =
  "Every register keeps the COPY.md blocking tier and the proof rule. Draft first, then run `craft copy <file>` on the draft.";

export const REGISTERS: readonly Register[] = [
  {
    id: "plain",
    name: "Plain and trustworthy",
    useFor: "Forms, policies, terms, instructions, and professional services where the reader must act correctly.",
    directives: [
      { text: "Put the most important information first, then taper down to the detail.", from: GOVUK },
      { text: "Split any sentence over 25 words into two.", from: GOVUK },
      { text: "Choose the short, common word: buy, help, about.", from: GOVUK },
      { text: "Write in the active voice, so the reader sees who does what.", from: GOVUK },
      { text: "Address the reader as \"you\", as one person you can actually help.", from: GOVUK },
      { text: "Use positive contractions such as \"you'll\", and write negatives out in full: \"do not\", \"cannot\".", from: GOVUK },
      { text: "Write headings that say what the section tells the reader, starting with a verb where you can.", from: GOVUK },
      { text: "Give each paragraph one job.", from: HOUSE },
    ],
    example: {
      before:
        "Should you wish to apply for a residents' parking permit, an application form must be completed and submitted to the council prior to the commencement of the permit period.",
      after: "Apply for a residents' parking permit before you need it. Fill in the form online. It takes about 10 minutes.",
      why: "The action comes first, the council is no longer the subject, and each sentence does one thing.",
    },
    sources: [
      {
        name: GOVUK,
        url: "https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/",
        note: "Clear language (the 25-word split, short words, active voice, contractions), clear structure (most important first, headings) and right tone (address the user as \"you\"). Checked against the live pages on 2026-09-30.",
      },
    ],
  },
  {
    id: "persuasive",
    name: "Persuasive and concise",
    useFor: "Landing pages, service pages, adverts and sales emails: copy whose job is one action.",
    directives: [
      { text: "Put the promise in the headline: what the reader gets, in words they would use.", from: OGILVY },
      { text: "Back each claim with something the reader can check: a number, a name, a date, a price.", from: "COPY.md" },
      { text: "Write to one reader, as \"you\", about their problem before your service.", from: CAPLES },
      { text: "Name the mechanism: how it works, how long it takes, what it costs.", from: "COPY.md" },
      { text: "Answer the objection the reader already has, with evidence, in the sentence that follows the claim.", from: HOUSE },
      { text: "Let the copy run as long as the facts last, and cut each sentence that carries none.", from: OGILVY },
      { text: "Close with one specific action and what happens straight after it.", from: "COPY.md" },
    ],
    example: {
      before: "Transform your garden with our premium landscaping solutions. Quality you can trust.",
      after:
        "We lay a 40 square metre Indian sandstone patio in three days, for £4,800 fitted. Every job since 2014 is on our reviews page. Book a free site visit and get a fixed quote within 48 hours.",
      why: "Size, material, time and price replace the adjectives, the proof sits next to the claim, and the close says what happens next. Fictional business.",
    },
    sources: [
      {
        name: OGILVY,
        note: "Headlines carry the promise because far more people read the headline than the body; specific, informative copy outsells vague copy. Taken from the widely quoted principles, not checked page by page against the book in this pass.",
      },
      {
        name: CAPLES,
        note: "Headlines that appeal to the reader's self-interest, and copy judged by tested response rather than taste. Not checked page by page against the book in this pass.",
      },
      {
        name: "COPY.md",
        note: "Writing directives (lead with the fact, name the mechanism, persuade with something checkable) and the CTA rule.",
      },
    ],
  },
  {
    id: "warm",
    name: "Warm and conversational",
    useFor: "Customer emails, replies to enquiries, newsletters and small-business updates.",
    directives: [
      { text: "Write the way you would talk to a customer you like: contractions, everyday words.", from: MAILCHIMP },
      { text: "Keep words and sentences simple; being clear matters more than being entertaining.", from: MAILCHIMP },
      { text: "Say what the reader can do, in positive language.", from: MAILCHIMP },
      { text: "Use the active voice.", from: MAILCHIMP },
      { text: "Match the tone to how the reader feels right now: lighter for good news, calm and direct for a problem.", from: MAILCHIMP },
      { text: "Keep humour dry and occasional, and only where it comes naturally.", from: MAILCHIMP },
      { text: "Sign off as a person, with a name.", from: HOUSE },
    ],
    example: {
      before: "Dear Valued Customer, We wish to inform you that your order has been dispatched and will be delivered in due course.",
      after:
        "Hi Sam, your order's on its way. It left our Leicester workshop this morning and should reach you on Thursday. Any questions, just reply to this email. Priya",
      why: "A name at each end, a real day and place instead of \"in due course\", and a next step. Fictional business.",
    },
    sources: [
      {
        name: MAILCHIMP,
        url: "https://styleguide.mailchimp.com/voice-and-tone/",
        note: "Voice and tone (plainspoken, genuine, dry humour; clear before entertaining; adjust tone to the reader's state) and grammar and mechanics (active voice, contractions, positive language). Its allowance for emoji does not apply: emoji block under COPY.md. Checked against the live pages on 2026-09-30.",
      },
    ],
  },
  {
    id: "literary",
    name: "Elegant and literary",
    useFor: "Premium brands, makers, hospitality and anything sold on craft and taste rather than price.",
    directives: [
      { text: "Choose one precise noun over two adjectives.", from: HOUSE },
      { text: "Let sentence length follow the thought: a long sentence to build, a short one to land.", from: "COPY.md" },
      { text: "Carry the detail in concrete facts: material, place, process, time.", from: HOUSE },
      { text: "Trust the reader with one image, state it once, and move on.", from: HOUSE },
      { text: "Keep claims quiet and exact, and let the facts carry the prestige.", from: HOUSE },
      { text: "Draw any metaphor from the maker's own work, and hold it for the whole piece.", from: HOUSE },
      { text: "Read the draft aloud and rework each line that trips the breath.", from: HOUSE },
    ],
    example: {
      before: "Our luxurious, handcrafted candles create an unforgettable ambience of elegance and sophistication.",
      after:
        "Each candle is poured by hand in our Hebden Bridge workshop, forty to a batch. The wax is English rapeseed and the scent is cedar, cut with a little smoke. It burns for sixty hours, and the glass is yours to keep.",
      why: "Place, material, scent and burn time do the work the adjectives claimed. Fictional business.",
    },
    sources: [
      {
        name: HOUSE,
        note: "No public style authority exists for premium-brand prose. These directives are house judgement, to be revised as the estate grows.",
      },
      {
        name: "Register separation, 2026-09-29",
        url: "calibration/copy-shape/report-registers.md",
        note: "Literary prose (Gutenberg) carries about twice the comma density of the other human registers, the one feature that separated it from all four. Longer, jointed sentences are normal here.",
      },
    ],
  },
];

export const REGISTER_IDS: readonly RegisterId[] = REGISTERS.map((r) => r.id);

export function getRegister(id: string): Register | undefined {
  return REGISTERS.find((r) => r.id === id);
}

/** The brief as plain text, for reading before a draft or pasting into a prompt. */
export function registerBrief(id: RegisterId): string {
  const r = getRegister(id);
  if (!r) throw new Error(`unknown register "${id}". Registers: ${REGISTER_IDS.join(", ")}`);
  const lines = [`Register: ${r.name} (${r.id})`, `Use for: ${r.useFor}`, "", "Before you draft:"];
  r.directives.forEach((d, i) => lines.push(`  ${i + 1}. ${d.text} [${d.from}]`));
  lines.push("", "Example (fictional):", `  Before: ${r.example.before}`, `  After:  ${r.example.after}`, `  Why:    ${r.example.why}`);
  lines.push("", "Sources:");
  for (const s of r.sources) lines.push(`  - ${s.name}${s.url ? ` (${s.url})` : ""}: ${s.note}`);
  lines.push("", `Always: ${ALWAYS}`);
  return lines.join("\n");
}

/** The generated block of REGISTERS.md. */
export function registersDoc(): string {
  const out: string[] = [];
  for (const r of REGISTERS) {
    out.push(`## ${r.name} (\`${r.id}\`)`, "", `**Use for:** ${r.useFor}`, "", "**Before you draft:**", "");
    r.directives.forEach((d, i) => out.push(`${i + 1}. ${d.text} *(${d.from})*`));
    out.push("", "**Example (fictional):**", "", `- Before: ${r.example.before}`, `- After: ${r.example.after}`, `- Why: ${r.example.why}`);
    out.push("", "**Sources:**", "");
    for (const s of r.sources) out.push(`- ${s.url ? `[${s.name}](${s.url})` : s.name}: ${s.note}`);
    out.push("");
  }
  out.push(`**Always:** ${ALWAYS}`);
  return out.join("\n");
}
