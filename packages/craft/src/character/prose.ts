/**
 * The prose in a file: what a visitor reads, not the code around it.
 *
 * Offsets are kept so a finding lands on the real line. Code is excluded
 * rather than guessed at: a class list or an import path is never copy.
 */

import { fileKind, stringLiterals } from "./parse.js";
import type { CopyBlock, SourceFile } from "./types.js";

/** A string literal that reads as a sentence rather than an identifier or class list. */
function readsAsProse(value: string): boolean {
  if (value.length < 12 || !/\s/.test(value)) return false;
  if (/^[\w-]+(?:\s+[\w:/[\].#%-]+)*$/.test(value) && /(?:^|\s)[a-z]+-[\w[]/.test(value)) return false; // class list
  if (/^(?:\.{0,2}\/|@\/|https?:|mailto:|tel:)/.test(value)) return false;
  if (/[{};=<>]/.test(value)) return false;
  return /[a-zA-Z]{3,}\s+[a-zA-Z]{2,}/.test(value);
}

function markupBlocks(file: SourceFile): CopyBlock[] {
  const text = file.text;
  const blocks: CopyBlock[] = [];
  // Mask code that is never visible: script/style bodies, imports, comments.
  const masked = text
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, (m) => m.replace(/[^\n]/g, " "))
    .replace(/^\s*import\b[^\n]*$/gm, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\{\/\*[\s\S]*?\*\/\}|<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "));
  // Text between tags. Blanked once read, so an apostrophe in it is not
  // mistaken for the start of a string literal below.
  let rest = masked;
  for (const m of masked.matchAll(/>([^<>{}]+)</g)) {
    const body = m[1];
    // `=>` and `->` are code, not the end of a tag.
    if (/[=-]/.test(masked[(m.index ?? 0) - 1] ?? "")) continue;
    if ((/[a-zA-Z]{2,}/.test(body) && /\s/.test(body.trim())) || /[a-zA-Z]{4,}[.!?]/.test(body)) {
      const at = (m.index ?? 0) + 1;
      blocks.push({ path: file.path, text: body, offset: at });
      rest = rest.slice(0, at) + body.replace(/[^\n]/g, " ") + rest.slice(at + body.length);
    }
  }
  // Sentences held in data: const services = [{ title: "...", body: "..." }].
  for (const lit of stringLiterals(rest)) {
    if (readsAsProse(lit.value)) blocks.push({ path: file.path, text: lit.value, offset: lit.offset + 1 });
  }
  return blocks;
}

function proseBlocks(file: SourceFile): CopyBlock[] {
  const masked = file.text
    .replace(/^(```|~~~)[\s\S]*?^\1/gm, (m) => m.replace(/[^\n]/g, " "))
    .replace(/`[^`\n]*`/g, (m) => " ".repeat(m.length))
    .replace(/^---\n[\s\S]*?\n---\n/, (m) => m.replace(/[^\n]/g, " "));
  return [{ path: file.path, text: masked, offset: 0 }];
}

export function extractCopy(file: SourceFile): CopyBlock[] {
  const kind = fileKind(file.path);
  if (kind === "prose") return proseBlocks(file);
  if (file.path.endsWith(".mdx")) return proseBlocks(file);
  if (kind === "markup") return markupBlocks(file);
  if (kind === "script" || /\.json$/i.test(file.path)) {
    return stringLiterals(file.text)
      .filter((l) => readsAsProse(l.value))
      .map((l) => ({ path: file.path, text: l.value, offset: l.offset + 1 }));
  }
  return [];
}
