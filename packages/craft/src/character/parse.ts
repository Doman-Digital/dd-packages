/**
 * Reading source the way the browser and Tailwind will, without a parser
 * dependency.
 *
 * The old regex checker only saw `className="..."`. The estate writes classes
 * through `cn()`, `cva()` and template literals, sets colour in raw CSS and in
 * Tailwind v4 `@theme` blocks, and in one case sets its whole accent as a hex
 * value no class-name grep can see. Each of those is a path a tell ships
 * through unseen, so each has a reader here.
 */

import type { ClassUnit, CssDeclaration, ParsedFile, SourceFile } from "./types.js";

const MARKUP = /\.(tsx|jsx|html?|astro|vue|svelte|mdx)$/i;
const SCRIPT = /\.(ts|js|mjs|cjs)$/i;
const CSS = /\.(css|scss|sass|less|pcss)$/i;
const PROSE = /\.(md|markdown|txt)$/i;

export function fileKind(path: string): ParsedFile["kind"] {
  if (MARKUP.test(path)) return "markup";
  if (CSS.test(path)) return "css";
  if (SCRIPT.test(path)) return "script";
  if (PROSE.test(path)) return "prose";
  return "other";
}

/** 1-indexed line of an offset. */
export function lineAt(text: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

/** The trimmed line an offset sits on, cut to a readable length. */
export function excerptAt(text: string, offset: number, max = 140): string {
  const start = text.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
  const endRaw = text.indexOf("\n", offset);
  const line = text.slice(start, endRaw === -1 ? text.length : endRaw).trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

const LITERAL = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g;

/** Every quoted string in a span of script, unquoted, with its offset. */
export function stringLiterals(text: string, base = 0): { value: string; offset: number }[] {
  const out: { value: string; offset: number }[] = [];
  for (const m of text.matchAll(LITERAL)) {
    out.push({ value: m[0].slice(1, -1), offset: base + (m.index ?? 0) });
  }
  return out;
}

/**
 * Index just past the bracket that closes the one at `open`, skipping strings.
 * Returns the text length when unbalanced, so a truncated file degrades to
 * "read to the end" rather than throwing.
 */
export function matchBracket(text: string, open: number): number {
  const pairs: Record<string, string> = { "{": "}", "(": ")", "[": "]" };
  const close = pairs[text[open]];
  const opener = text[open];
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const end = skipString(text, i);
      i = end - 1;
      continue;
    }
    if (ch === opener) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return text.length;
}

function skipString(text: string, start: number): number {
  const quote = text[start];
  for (let i = start + 1; i < text.length; i += 1) {
    if (text[i] === "\\") {
      i += 1;
      continue;
    }
    if (text[i] === quote) return i + 1;
    if (text[i] === "\n" && quote !== "`") return i + 1;
  }
  return text.length;
}

function split(classes: string): string[] {
  return classes.split(/\s+/).filter((c) => c.length > 0 && !c.includes("${"));
}

/**
 * Class lists as they apply to elements.
 *
 * - `class="..."` and `className="..."` are one unit.
 * - `className={cn("a", cond && "b")}` is one unit: every literal inside the
 *   expression applies to the same element, which is what lets a detector see
 *   `rounded-full` and `border` together when they are written apart.
 * - A bare `cn()`, `clsx()`, `twMerge()` or `cx()` call is one unit.
 * - `cva()` and `tv()` literals are separate units: a variant is an
 *   alternative, and joining alternatives invents combinations no element has.
 */
export function classUnits(text: string): ClassUnit[] {
  const units: ClassUnit[] = [];
  const covered: [number, number][] = [];

  const attr = /\b(?:className|class|:class)\s*=\s*/g;
  for (const m of text.matchAll(attr)) {
    const at = (m.index ?? 0) + m[0].length;
    const ch = text[at];
    if (ch === '"' || ch === "'") {
      const end = skipString(text, at);
      units.push({ classes: split(text.slice(at + 1, end - 1)), offset: m.index ?? 0 });
    } else if (ch === "{") {
      const end = matchBracket(text, at);
      const joined = stringLiterals(text.slice(at, end))
        .map((l) => l.value)
        .join(" ");
      units.push({ classes: split(joined), offset: m.index ?? 0 });
      covered.push([at, end]);
    }
  }

  const call = /\b(cn|clsx|twMerge|cx|cva|tv)\s*\(/g;
  for (const m of text.matchAll(call)) {
    const start = m.index ?? 0;
    if (covered.some(([a, b]) => start >= a && start < b)) continue;
    const open = start + m[0].length - 1;
    const end = matchBracket(text, open);
    const literals = stringLiterals(text.slice(open, end), open);
    if (m[1] === "cva" || m[1] === "tv") {
      for (const l of literals) units.push({ classes: split(l.value), offset: l.offset });
    } else {
      units.push({ classes: split(literals.map((l) => l.value).join(" ")), offset: start });
    }
    covered.push([open, end]);
  }

  return units.filter((u) => u.classes.length > 0);
}

/** Blank out comments, keeping offsets and newlines so lines still line up. */
function blankComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
}

/**
 * Every declaration in a stylesheet, with the rule it sits in.
 *
 * Nested at-rules (`@media`, `@layer`, `@theme`, `@supports`) are walked
 * through: a colour set inside a media query is still a colour the site ships.
 * Semicolons and braces inside parentheses and strings are skipped, so a
 * `url(data:...;base64,...)` does not split a declaration in half.
 */
export function cssDeclarations(css: string, base = 0): CssDeclaration[] {
  const src = blankComments(css);
  const out: CssDeclaration[] = [];
  const stack: string[] = [];
  let segStart = 0;
  let parens = 0;

  const flush = (end: number): void => {
    const seg = src.slice(segStart, end);
    const colon = seg.indexOf(":");
    if (stack.length === 0 || colon === -1) return;
    const property = seg.slice(0, colon).trim();
    if (!/^(--)?[a-zA-Z-]+$/.test(property)) return;
    const lead = seg.length - seg.trimStart().length;
    out.push({
      property: property.toLowerCase(),
      value: seg.slice(colon + 1).trim(),
      selector: stack[stack.length - 1],
      offset: base + segStart + lead,
    });
  };

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '"' || ch === "'") {
      i = skipString(src, i) - 1;
      continue;
    }
    if (ch === "(") parens += 1;
    else if (ch === ")") parens = Math.max(0, parens - 1);
    if (parens > 0) continue;
    if (ch === "{") {
      stack.push(src.slice(segStart, i).trim());
      segStart = i + 1;
    } else if (ch === ";") {
      flush(i);
      segStart = i + 1;
    } else if (ch === "}") {
      flush(i);
      stack.pop();
      segStart = i + 1;
    }
  }
  return out;
}

/** `<style>` blocks in markup, as declarations in file offsets. */
function styleBlocks(text: string): CssDeclaration[] {
  const out: CssDeclaration[] = [];
  for (const m of text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    const bodyStart = (m.index ?? 0) + m[0].indexOf(">") + 1;
    out.push(...cssDeclarations(m[1], bodyStart));
  }
  return out;
}

export function parseFile(file: SourceFile): ParsedFile {
  const kind = fileKind(file.path);
  return {
    ...file,
    kind,
    classUnits: kind === "markup" || kind === "script" ? classUnits(file.text) : [],
    declarations:
      kind === "css" ? cssDeclarations(file.text) : kind === "markup" ? styleBlocks(file.text) : [],
  };
}
