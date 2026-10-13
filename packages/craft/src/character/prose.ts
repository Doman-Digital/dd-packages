/**
 * The prose in a file: what a visitor reads, not the code around it.
 *
 * Offsets are kept so a finding lands on the real line. Code is excluded
 * rather than guessed at: a class list or an import path is never copy.
 *
 * Two views of the same file:
 *
 * - `extractCopy` gives the sentences: text between tags, Markdown outside
 *   code, and string literals that read as prose. Word and phrase tells read
 *   these.
 * - `extractStrings` gives every piece of visible text, short or long. A
 *   badge ("No catch."), an em dash in "Mon — Fri" or an emoji alone in a
 *   label is too short to read as a sentence, and would never be seen if the
 *   character-level tells read sentences only.
 *
 * Comments are never copy. A code comment in this estate is often long,
 * careful prose full of em dashes, and an apostrophe in one ("it's") would
 * otherwise open a phantom string literal that swallows the next line.
 *
 * Front matter is metadata, except `title` and `description`. Those scalars
 * are the line a reader, or a skill picker, sees, so they stay where they
 * were written.
 */

import { fileKind, stringLiterals } from "./parse.js";
import type { CopyBlock, SourceFile } from "./types.js";

const blank = (s: string): string => s.replace(/[^\n]/g, " ");

/** A string literal that reads as a sentence rather than an identifier or class list. */
function readsAsProse(value: string): boolean {
  if (value.length < 12 || !/\s/.test(value)) return false;
  if (looksLikeClasses(value) || looksLikeAddress(value)) return false;
  // HTML held in a string is copy with tags round it; a template's `${}` is
  // a gap in a sentence. What is left must not look like code.
  const words = withoutMarkup(value);
  if (looksLikeCode(words) || /[<>]/.test(words)) return false;
  return /[a-zA-Z]{3,}\s+[a-zA-Z]{2,}/.test(words);
}

function withoutMarkup(value: string): string {
  return value
    .replace(/<\/?[a-zA-Z][^<>]*>/g, " ")
    .replace(/\$\{[^}]*\}/g, " ")
    .replace(/\{\{[^}]*\}\}/g, " ")
    .replace(/&(?:#\d+|#x[0-9a-f]+|[a-z]+);/gi, "'");
}

/** Braces, a statement end, an assignment or an arrow: not a sentence. */
function looksLikeCode(words: string): boolean {
  return /[{}]|;\s*(?:\n|$)|\s=\s|===?|=>|\b(?:const|let|var|function|import|export)\s/.test(words);
}

const UTILITY = /^(?:flex|grid|block|inline|hidden|contents|relative|absolute|fixed|sticky|static|rounded|border|shadow|underline|italic|uppercase|lowercase|capitalize|truncate|container|group|peer|transition|antialiased|prose|sr-only|outline|ring|grow|shrink|isolate|invisible|visible|collapse)$/;

/**
 * A Tailwind class list, however it is written: `bg-[var(--x)]`,
 * `md:hover:shadow-lg`, `[&>svg]:size-4`. Most tokens carry a hyphen, a colon
 * or a bracket; prose almost never does.
 */
function looksLikeClasses(value: string): boolean {
  const tokens = value.trim().split(/\s+/);
  if (tokens.length === 0 || !tokens.every((t) => /^[!\w@:/[\]().#%,>&*+=~-]+$/.test(t))) return false;
  const classy = tokens.filter((t) => /[-:[\]/]/.test(t) || UTILITY.test(t)).length;
  return classy / tokens.length >= 0.6 && /[a-z]-|:|\[/.test(value);
}

function looksLikeAddress(value: string): boolean {
  return /^(?:\.{0,2}\/|@\/|https?:|mailto:|tel:)/.test(value);
}

/** Visible, but not necessarily a sentence: anything with a letter, a dash or a symbol in it. */
function readsAsText(value: string): boolean {
  if (value.trim().length === 0) return false;
  if (looksLikeAddress(value) || looksLikeClasses(value)) return false;
  return /[^\s\w]|[a-zA-Z]/.test(value);
}

/** A quoted string that is visible text: a GraphQL query or a CSS block in a template literal is code. */
function literalIsText(value: string): boolean {
  return readsAsText(value) && !looksLikeCode(withoutMarkup(value));
}

/**
 * Blank comments in plain script. Strings are skipped, so `"https://x"` is not
 * read as the start of a line comment.
 */
function maskScriptComments(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const start = i;
      i += 1;
      while (i < text.length) {
        if (text[i] === "\\") {
          i += 2;
          continue;
        }
        if (text[i] === ch) {
          i += 1;
          break;
        }
        if (text[i] === "\n" && ch !== "`") break;
        i += 1;
      }
      out += text.slice(start, i);
      continue;
    }
    if (ch === "/" && text[i + 1] === "/") {
      const end = text.indexOf("\n", i);
      const stop = end === -1 ? text.length : end;
      out += " ".repeat(stop - i);
      i = stop;
      continue;
    }
    if (ch === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      const stop = end === -1 ? text.length : end + 2;
      out += blank(text.slice(i, stop));
      i = stop;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/**
 * Blank comments in JSX and templates. Text between tags is not quoted, so an
 * apostrophe in it would derail a string-aware scan; comments are found by
 * where they start instead: at the start of a line, or after code and a space.
 */
function maskMarkupComments(text: string): string {
  return text
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, blank)
    .replace(/\{\/\*[\s\S]*?\*\/\}|<!--[\s\S]*?-->/g, blank)
    .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, blank)
    .replace(/^[ \t]*\/\/[^\n]*/gm, blank)
    .replace(/([;,{}()[\]])([ \t]+)\/\/[^\n]*/g, (m, p: string, s: string) => p + s + " ".repeat(m.length - p.length - s.length))
    .replace(/^\s*import\b[^\n]*$/gm, blank);
}

interface MarkupParts {
  textNodes: CopyBlock[];
  literals: { value: string; offset: number }[];
}

function markupParts(file: SourceFile): MarkupParts {
  const masked = maskMarkupComments(file.text);
  const textNodes: CopyBlock[] = [];
  // Text between tags. Blanked once read, so an apostrophe in it is not
  // mistaken for the start of a string literal below.
  let rest = masked;
  // A run of JSX text ends at a tag or at an expression: `Ready — {count}`
  // and `{start} — {end}` are text too.
  for (const m of masked.matchAll(/([>}])([^<>{}]+)(?=[<{])/g)) {
    const body = m[2];
    const before = masked[(m.index ?? 0) - 1] ?? "";
    const after = masked[(m.index ?? 0) + m[0].length];
    // `=>` and `->` are code, not the end of a tag.
    if (m[1] === ">" && /[=-]/.test(before)) continue;
    // Between two braces it is text only if it cannot be code.
    if (m[1] === "}" && (/^\s*(?:[)\],;:]|(?:else|catch|finally|return|from|as|if|const|let|export|function)\b)/.test(body) || /;\s*$/.test(body))) continue;
    if (m[1] === "}" && after === "{" && (/[=()`'"]/.test(body) || !/[a-zA-Z]{2,}|[^\s\w,|&?:]/.test(body))) continue;
    if (body.trim().length === 0) continue;
    // A lone dash in a cell, `<td>—</td>`, is a null-value placeholder.
    if (m[1] === ">" && after === "<" && /^[\s—–-]*$/.test(body)) continue;
    const at = (m.index ?? 0) + 1;
    textNodes.push({ path: file.path, text: body, offset: at });
    rest = rest.slice(0, at) + blank(body) + rest.slice(at + body.length);
  }
  return { textNodes, literals: splitHtml(stringLiterals(rest)) };
}

/** A text node that reads as words rather than a stray `>` in an expression. */
function textNodeIsProse(body: string): boolean {
  return (/[a-zA-Z]{2,}/.test(body) && /\s/.test(body.trim())) || /[a-zA-Z]{4,}[.!?]/.test(body);
}

/**
 * Keys whose scalar value is prose. `name`, `tools`, `model` and
 * `allowed-tools` name a thing; they are not a sentence a reader sees.
 */
const FRONT_MATTER_PROSE = new Set(["title", "description"]);

const KEY_LINE = /^(\s*)(?:-\s+)?([A-Za-z][\w-]*)[ \t]*:[ \t]*/;
const BLOCK_SCALAR = /^(?:[|>][+-]?\d*|[|>]\d+[+-]?)$/;

interface FrontKey {
  indent: number;
  name: string;
  /** Index of the first value character on this line. */
  valueAt: number;
  value: string;
}

function readFrontKey(line: string): FrontKey | null {
  const m = KEY_LINE.exec(line);
  if (!m) return null;
  return { indent: m[1].length, name: m[2], valueAt: m[0].length, value: line.slice(m[0].length) };
}

function indentOf(line: string): number {
  let i = 0;
  while (i < line.length && (line[i] === " " || line[i] === "\t")) i += 1;
  return i;
}

/** Index of a trailing YAML comment, or -1. A `#` inside a word is not one. */
function commentAt(value: string): number {
  if (value.startsWith("#")) return 0;
  const found = /[ \t]+#/.exec(value);
  return found ? found.index : -1;
}

/** Keep one span of a line and blank the rest, so the line stays the same length. */
function keepSpan(line: string, from: number, to: number): string {
  const start = Math.max(0, Math.min(from, line.length));
  const end = Math.max(start, Math.min(to, line.length));
  return " ".repeat(start) + line.slice(start, end) + " ".repeat(line.length - end);
}

/** Closing quote index, reading escapes, or -1 when the scalar runs on. */
function quoteEnd(line: string, from: number, quote: '"' | "'"): number {
  for (let i = from; i < line.length; i += 1) {
    if (quote === '"' && line[i] === "\\") {
      i += 1;
      continue;
    }
    if (quote === "'" && line[i] === "'" && line[i + 1] === "'") {
      i += 1;
      continue;
    }
    if (line[i] === quote) return i;
  }
  return -1;
}

/**
 * Blank a front matter block except `title` and `description` scalars.
 * Characters stay where they are, so a hit and a `copy-ok` on the line above
 * still refer to the file's own lines. A length mismatch blanks the block:
 * a shifted offset would report every later line wrong.
 */
function maskFrontMatter(block: string): string {
  const lines = block.split("\n");
  const out = lines.map((line) => blank(line));
  for (let i = 1; i < lines.length; ) {
    const line = lines[i];
    if (line === "---" || line === "...") break;
    const key = readFrontKey(line);
    if (!key || !FRONT_MATTER_PROSE.has(key.name.toLowerCase())) {
      i += 1;
      continue;
    }
    const quote = key.value.startsWith('"') ? '"' : key.value.startsWith("'") ? "'" : "";
    if (quote) {
      let cursor = key.valueAt + 1;
      while (i < lines.length && lines[i] !== "---" && lines[i] !== "...") {
        const current = lines[i];
        const end = quoteEnd(current, cursor, quote);
        out[i] = keepSpan(current, cursor, end === -1 ? current.length : end);
        i += 1;
        cursor = 0;
        if (end !== -1) break;
      }
      continue;
    }
    const hash = commentAt(key.value);
    const body = (hash === -1 ? key.value : key.value.slice(0, hash)).trim();
    if (BLOCK_SCALAR.test(body)) {
      i += 1;
      while (i < lines.length && lines[i] !== "---" && lines[i] !== "...") {
        const current = lines[i];
        if (current.trim() !== "" && indentOf(current) <= key.indent) break;
        if (current.trim()) out[i] = current;
        i += 1;
      }
      continue;
    }
    // An empty value, a null, or a flow collection is not a prose scalar.
    if (body === "" || body === "~" || /^null$/i.test(body) || body.startsWith("[") || body.startsWith("{")) {
      i += 1;
      continue;
    }
    out[i] = keepSpan(line, key.valueAt, hash === -1 ? line.length : key.valueAt + hash);
    i += 1;
    while (i < lines.length && lines[i] !== "---" && lines[i] !== "...") {
      const current = lines[i];
      if (current.trim() === "" || indentOf(current) <= key.indent) break;
      if (!/^\s*#/.test(current)) {
        const cut = commentAt(current);
        out[i] = cut === -1 ? current : keepSpan(current, 0, cut);
      }
      i += 1;
    }
  }
  const masked = out.join("\n");
  return masked.length === block.length ? masked : blank(block);
}

function proseBlocks(file: SourceFile): CopyBlock[] {
  const masked = file.text
    .replace(/^(```|~~~)[\s\S]*?^\1/gm, blank)
    .replace(/`[^`\n]*`/g, (m) => " ".repeat(m.length))
    .replace(/^---\n[\s\S]*?\n---\n/, (block) => maskFrontMatter(block))
    .replace(/<!--[\s\S]*?-->/g, blank);
  return [{ path: file.path, text: masked, offset: 0 }];
}

function isData(path: string): boolean {
  return /\.jsonl?$/i.test(path);
}

function scriptLiterals(file: SourceFile): { value: string; offset: number }[] {
  return splitHtml(stringLiterals(isData(file.path) ? file.text : maskScriptComments(file.text)));
}

type Literal = { value: string; offset: number };

/**
 * A literal holding HTML, an email template or seeded CMS content, is split
 * into the text between its tags, each piece at its own offset. Read whole,
 * its style attributes and `${}` holes make it look like code, which is how a
 * contrastive negation in a live welcome email went unread.
 */
function splitHtml(literals: Literal[]): Literal[] {
  const out: Literal[] = [];
  for (const l of literals) {
    if (!/<[a-zA-Z][^<>]*>/.test(l.value)) {
      out.push(l);
      continue;
    }
    for (const m of l.value.matchAll(/(?:^|>)([^<>]+)(?=<|$)/g)) {
      const body = m[1];
      if (!body.trim()) continue;
      const lead = m[0].length - body.length;
      out.push({ value: body, offset: l.offset + (m.index ?? 0) + lead });
    }
  }
  return out;
}

export function extractCopy(file: SourceFile): CopyBlock[] {
  const kind = fileKind(file.path);
  if (kind === "prose" || file.path.endsWith(".mdx")) return proseBlocks(file);
  if (kind === "markup") {
    const { textNodes, literals } = markupParts(file);
    // Sentences held in data: const services = [{ title: "...", body: "..." }].
    return [
      ...textNodes.filter((b) => textNodeIsProse(b.text)),
      ...literals.filter((l) => readsAsProse(l.value)).map((l) => ({ path: file.path, text: l.value, offset: l.offset + 1, literal: true })),
    ];
  }
  if (kind === "script" || isData(file.path)) {
    return scriptLiterals(file)
      .filter((l) => readsAsProse(l.value))
      .map((l) => ({ path: file.path, text: l.value, offset: l.offset + 1, literal: true }));
  }
  return [];
}

/**
 * Every piece of visible text, each on its own, however short. Markdown is
 * split into lines so a whole-string rule sees one line at a time.
 */
export function extractStrings(file: SourceFile): CopyBlock[] {
  const kind = fileKind(file.path);
  if (kind === "prose" || file.path.endsWith(".mdx")) {
    const [block] = proseBlocks(file);
    const out: CopyBlock[] = [];
    let offset = 0;
    for (const line of block.text.split("\n")) {
      if (line.trim()) out.push({ path: file.path, text: line, offset });
      offset += line.length + 1;
    }
    return out;
  }
  if (kind === "markup") {
    const { textNodes, literals } = markupParts(file);
    return [
      ...textNodes.filter((b) => readsAsText(b.text)),
      ...literals.filter((l) => literalIsText(l.value)).map((l) => ({ path: file.path, text: l.value, offset: l.offset + 1, literal: true })),
    ];
  }
  if (kind === "script" || isData(file.path)) {
    return scriptLiterals(file)
      .filter((l) => literalIsText(l.value))
      .map((l) => ({ path: file.path, text: l.value, offset: l.offset + 1, literal: true }));
  }
  return [];
}
