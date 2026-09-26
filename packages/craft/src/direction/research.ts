/**
 * The research prompt for a new client: job material only.
 *
 * A research model asked "what do good electrician websites look like"
 * returns the category average, because that is what it was trained on. So
 * the prompt craft hands over asks only about the customer (their situation,
 * objections, words, where they look) and forbids describing the category's
 * sites. Visual references, when wanted, come from outside the category.
 *
 * Pure text. Nothing here calls a model.
 */

import { TRADE_NOUNS } from "../character/specificity.js";

export interface ResearchInput {
  brief: string;
  client?: string;
  /** Add prompts for visual references from outside the category. */
  visual?: boolean;
}

/** The trade words in a brief, for naming what not to research. */
export function tradeOf(brief: string): string[] {
  const text = brief.toLowerCase();
  return TRADE_NOUNS.filter((t) => new RegExp(`\\b${t.replace(/ /g, "\\s+")}s?\\b`).test(text));
}

/** Exact category labels also cover trades outside the seed lexicon, such as salons. */
export function categoryMatchesBrief(category: string, brief: string): boolean {
  const known = tradeOf(category);
  if (tradeOf(brief).some((t) => known.includes(t))) return true;
  const label = category.trim().replace(/^(?:(?:a|an|the|local|independent)\s+)+/i, "");
  if (!label) return false;
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`\\b${escaped}s?\\b`, "i").test(brief);
}

export function researchPrompt(input: ResearchInput): string {
  const trade = tradeOf(input.brief);
  const category = trade.length ? trade.join(", ") : "this kind of business";
  const who = input.client ? `${input.client}: ${input.brief}` : input.brief;
  const lines = [
    "# Research brief: the customer's job",
    "",
    `The business: ${who}`,
    "",
    "Find out about the people who hire a business like this, not about the businesses. Answer each question with sources: reviews, forum threads, Q&A sites, complaints, search suggestions. Quote people's own words and link to where they said them.",
    "",
    "1. **The situation.** What has just happened, or is about to, when someone starts looking? What pressure are they under: time, money, safety, someone else waiting on them?",
    "2. **The job.** What are they trying to get done, in one sentence that starts with a verb? What would \"done\" look like to them?",
    "3. **Objections.** What do they worry about before getting in touch? What has gone wrong for them, or people they know, before?",
    "4. **Their words.** The phrases they actually use for the problem and for what they want. Quote them exactly.",
    "5. **Who else is involved.** Who do they have to explain or justify the choice to (a partner, a landlord, a tenant, a manager), and what would make them look good or bad to that person?",
    "6. **Consideration.** Do they decide in minutes, days or months? What do they compare before deciding?",
    "7. **Where they look.** What do they search for, and where do they ask?",
    "",
    "## Do not",
    "",
    `- Do not describe, list, rank or summarise what ${category} websites look like, or how they are laid out.`,
    "- Do not suggest colours, fonts, layouts, sections or visual \"inspiration\" from this category.",
    "- Do not summarise competitors' marketing. Their claims are the category average; the customer's words are the point.",
    "- Do not invent quotes. If you cannot find a source for something, say so.",
  ];
  if (input.visual) {
    lines.push(
      "",
      "# Visual references, from outside the category",
      "",
      `Separately, and only from outside ${category}: find things this business already resembles or shares a world with. Print, signage, packaging, tools, vehicles, uniforms, places, materials, other trades and crafts. For each, say what it is, where it is from, and what about it could carry over.`,
      "",
      `Nothing from a ${category} website, and nothing from a web design gallery.`,
    );
  }
  return `${lines.join("\n")}\n`;
}
