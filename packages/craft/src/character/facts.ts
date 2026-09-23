/**
 * Protected facts: what a rewrite must never lose or invent.
 *
 * A rewrite that removes every tell and drops the price, or changes "since
 * 2009" to "for over a decade", or adds a review count nobody supplied, is
 * worse than the draft it replaced. The research on de-AI tooling puts this
 * gate first: compare the facts before and after, and block any change nobody
 * explained.
 *
 * Pure over text. `craft copy compare <before> <after>` is the command.
 */

import { extractCopy, extractStrings } from "./prose.js";
import type { SourceFile } from "./types.js";

export type FactKind = "url" | "email" | "phone" | "postcode" | "money" | "date" | "time" | "number" | "name";

export interface Fact {
  kind: FactKind;
  /** As written, for the report. */
  value: string;
  /** How it is compared: spacing and thousands separators do not make a new fact. */
  key: string;
}

const MONTH = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";

/** Most specific first: each match is masked, so a phone number is not also three numbers. */
const PATTERNS: [FactKind, RegExp][] = [
  ["url", /\bhttps?:\/\/[^\s<>"'`)\]]+|\bwww\.[^\s<>"'`)\]]+/gi],
  ["email", /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g],
  ["phone", /(?:\+44\s?\(?0?\)?\s?|\b0)\d(?:[\s-]?\d){8,9}\b/g],
  ["postcode", /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/g],
  ["money", /[£$€]\s?\d[\d,]*(?:\.\d{1,2})?(?:\s?(?:k|m|bn)\b)?|\b\d[\d,]*(?:\.\d{1,2})?\s?(?:pounds|GBP)\b/gi],
  ["date", new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTH}\\b(?:\\s+\\d{4})?|\\b${MONTH}\\s+\\d{1,2}(?:st|nd|rd|th)?\\b(?:,?\\s+\\d{4})?|\\b${MONTH}\\s+\\d{4}\\b|\\b\\d{1,2}\\/\\d{1,2}\\/\\d{2,4}\\b|\\b(?:19|20)\\d{2}\\b`, "g")],
  ["time", /\b\d{1,2}(?:[:.]\d{2})?\s?(?:am|pm)\b|\b\d{1,2}:\d{2}\b/gi],
  ["number", /\b\d[\d,]*(?:\.\d+)?%?|\b\d+(?:\.\d+)?\s?(?:per ?cent)\b/gi],
];

/**
 * A proper noun: a capitalised word that does not open a sentence, or an
 * acronym. "Gas Safe", "NICEIC", "Brackley", "Google". Markdown headings are
 * left out, because a Title Case heading would make every word a name.
 */
const NAME = /[A-Z][a-zA-Z’'&-]*[a-zA-Z](?:\s+(?:of|and|&|the)?\s*[A-Z][a-zA-Z’'&-]*[a-zA-Z])*/g;

const normalise = (kind: FactKind, value: string): string => {
  const v = value.trim();
  if (kind === "phone") return v.replace(/[^\d+]/g, "").replace(/^\+44\(?0?\)?/, "0").replace(/^\+44/, "0");
  if (kind === "money" || kind === "number") return v.replace(/[\s,]/g, "").toLowerCase();
  if (kind === "postcode") return v.replace(/\s/g, "").toUpperCase();
  if (kind === "url") return v.replace(/[.,;:]+$/, "").toLowerCase();
  return v.replace(/\s+/g, " ").toLowerCase();
};

/** The reader-visible text of a file: prose for documents, visible strings for code. */
export function visibleText(file: SourceFile): string {
  const prose = /\.(md|markdown|mdx|txt)$/i.test(file.path);
  return (prose ? extractCopy(file) : extractStrings(file)).map((b) => b.text).join("\n");
}

export function protectedFacts(text: string): Fact[] {
  const facts: Fact[] = [];
  let rest = text;
  const mask = (start: number, length: number) => {
    rest = rest.slice(0, start) + " ".repeat(length) + rest.slice(start + length);
  };
  for (const [kind, pattern] of PATTERNS) {
    for (const m of [...rest.matchAll(pattern)]) {
      const value = m[0].replace(/[.,;:]+$/, "");
      facts.push({ kind, value, key: `${kind}:${normalise(kind, value)}` });
      mask(m.index ?? 0, m[0].length);
    }
  }
  const lines = rest.split("\n");
  for (const line of lines) {
    if (/^\s{0,3}#{1,6}\s/.test(line)) continue;
    for (const m of line.matchAll(NAME)) {
      const at = m.index ?? 0;
      const before = line.slice(0, at).trimEnd();
      // A capital that opens a sentence, a line or a list item is grammar, not a name.
      const opensSentence = before === "" || /[.!?:"“(>*-]$/.test(before) || /^\s*(?:[-*+]|\d+\.)$/.test(before);
      const word = m[0];
      const acronym = /^[A-Z]{2,}$/.test(word);
      if (opensSentence && !acronym && !/\s/.test(word)) continue;
      if (word === "I") continue;
      facts.push({ kind: "name", value: word, key: `name:${normalise("name", word)}` });
    }
  }
  return facts;
}

export interface FactComparison {
  before: number;
  after: number;
  /** In the original, missing from the rewrite. */
  lost: Fact[];
  /** In the rewrite, not in the original: each one needs a source. */
  added: Fact[];
}

const unique = (facts: Fact[]): Fact[] => [...new Map(facts.map((f) => [f.key, f])).values()];

export function compareFacts(before: string, after: string): FactComparison {
  const a = unique(protectedFacts(before));
  const b = unique(protectedFacts(after));
  const inA = new Set(a.map((f) => f.key));
  const inB = new Set(b.map((f) => f.key));
  return {
    before: a.length,
    after: b.length,
    lost: a.filter((f) => !inB.has(f.key)),
    added: b.filter((f) => !inA.has(f.key)),
  };
}

export function formatComparison(result: FactComparison, beforePath: string, afterPath: string): string {
  const lines = [`craft copy compare: ${beforePath} -> ${afterPath}`, `  ${result.before} protected facts before, ${result.after} after`];
  if (result.lost.length) {
    lines.push("", `  Lost (${result.lost.length}): restore each, or say why it went`);
    for (const f of result.lost) lines.push(`    ${f.kind.padEnd(9)} ${f.value}`);
  }
  if (result.added.length) {
    lines.push("", `  Added (${result.added.length}): each needs a source, or it is invented`);
    for (const f of result.added) lines.push(`    ${f.kind.padEnd(9)} ${f.value}`);
  }
  if (!result.lost.length && !result.added.length) lines.push("", "  Every fact kept, nothing added.");
  return lines.join("\n");
}
