/**
 * The house copy check over a Sanity document.
 *
 * Pure: a document in, findings with Studio paths out. No Sanity import, so it
 * runs in the Studio, in a Node script over an export, and in a test, and gives
 * the same answer in all three. The rules are craft's: this file only decides
 * which strings in a document are copy, and where each finding belongs.
 */

import { applyHouseGate, checkCopy } from "@domandigital/craft";

/** A Studio path: field names, array indices, or `{ _key }` for keyed array items. */
export type PathSegment = string | number | { _key: string };
export type Path = PathSegment[];

export type Tier = "block" | "review" | "explicit";

export interface CopyFinding {
  /** Where it is: the field, the array item, the Portable Text block. `[]` is the document. */
  path: Path;
  tell: string;
  name: string;
  tier: Tier;
  /** What was found, as craft reports it. */
  message: string;
  /** What to do instead. */
  fix: string;
}

export interface CopyCheckOptions {
  /**
   * Document types never checked. A person's own words (reviews,
   * testimonials, quotes) are exempt from every house rule: editing them to
   * pass a check falsifies a quotation.
   */
  excludeTypes?: string[];
  /** Field names never read, at any depth. Slugs, links, keys and ids are not copy. */
  skipFields?: string[];
  /**
   * Report the review tier as well as the blocking tier. On by default: the
   * Studio shows every finding as a warning and blocks nothing either way.
   */
  review?: boolean;
  /**
   * Check only these languages, e.g. `["en"]`. The rules are English, so on
   * a French field they are noise. `"en"` also matches `en-GB` and `en_US`.
   * When set, copy is skipped when it sits:
   *
   * - in an array item whose `language` field is another language
   *   (sanity-plugin-internationalized-array v5), or whose `_key` is
   *   (v4 and earlier: an `internationalizedArray*` item, or one with a
   *   `value` field);
   * - under an object key that is another language, in an object whose keys
   *   are all two-letter language tags (field-level translation, e.g.
   *   `{ en, fr }` or `{ en_GB, nb_NO }`);
   * - in a document whose own `language` field is another language
   *   (@sanity/document-internationalization).
   *
   * Unset: every language is checked, as before.
   */
  languages?: string[];
  /**
   * Dot paths of fields an editor never sees (`hidden: true` in the schema),
   * e.g. `["seo.internalNotes"]`. Never read. `withCopyCheck` fills this in
   * from the schema; pass it yourself only when calling the check directly.
   */
  hiddenPaths?: string[];
}

export const DEFAULT_EXCLUDED_TYPES = ["testimonial", "review", "proofQuote", "quote", "assist.instruction.context"];

export const DEFAULT_SKIP_FIELDS = [
  "slug", "url", "href", "link", "email", "phone", "telephone", "tel",
  "icon", "id", "key", "anchor", "variant", "theme", "style", "colour", "color",
  "code", "embed", "script", "schema", "jsonLd", "canonical", "language", "locale",
];

/** Object types that hold no copy of their own. */
const NOT_COPY_TYPES = new Set(["slug", "reference", "geopoint", "color", "sanity.imageAsset", "sanity.fileAsset", "code"]);

/** An image or file holds copy only in its alt text and caption: a screen reader reads both. */
const MEDIA_TYPES = new Set(["image", "file"]);
const MEDIA_COPY = new Set(["alt", "caption", "title", "description"]);

/** The density tier reads a whole document; every other copy tell reads one field at a time. */
const DENSITY_TELLS = ["phrase-density", "aphorism-density", "contraction-scarcity", "sentence-rhythm", "repeated-sentence", "heading-shape", "heading-echo"];

interface Piece {
  path: Path;
  text: string;
}

/** `en`, `nb_NO`, `en-GB`, `zh-Hant`: a language tag, as a value. */
const LANGUAGE_TAG = /^[a-z]{2,3}(?:[_-][A-Za-z]{2,4})?$/;
/** Object keys taken as languages: two letters, optional region. Three would take `cta` and `faq`. */
const LANGUAGE_KEY = /^[a-z]{2}(?:[_-][A-Za-z]{2,4})?$/;

/** Whether a language tag is one of `wanted`: `en` covers `en-GB` and `en_US`. */
function languageWanted(tag: string, wanted: string[]): boolean {
  const t = tag.toLowerCase().replace(/_/g, "-");
  return wanted.some((w) => {
    const base = w.toLowerCase().replace(/_/g, "-");
    return t === base || t.startsWith(`${base}-`);
  });
}

/** The language an internationalized-array item holds, if it is one. */
function itemLanguage(item: Record<string, unknown>): string | undefined {
  if (typeof item.language === "string") return item.language;
  const keyed =
    (typeof item._type === "string" && item._type.startsWith("internationalizedArray")) || "value" in item;
  if (keyed && typeof item._key === "string" && LANGUAGE_TAG.test(item._key)) return item._key;
  return undefined;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** An enum value, an identifier, an address: a string that is not copy. */
function notCopy(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/^[a-z0-9_-]+$/.test(t)) return true;
  if (LANGUAGE_TAG.test(t)) return true;
  if (/^(?:https?:\/\/|www\.|mailto:|tel:|\/)\S*$/i.test(t)) return true;
  if (/^[\w.+-]+@[\w-]+(?:\.[\w-]+)+$/.test(t)) return true;
  if (/^#[0-9a-f]{3,8}$/i.test(t)) return true;
  return false;
}

/** A Portable Text block as Markdown, so heading and list tells see what an editor sees. */
function blockText(block: Record<string, unknown>): string {
  const children = Array.isArray(block.children) ? block.children : [];
  const text = children.map((c) => (isRecord(c) && typeof c.text === "string" ? c.text : "")).join("");
  const style = typeof block.style === "string" ? block.style : "normal";
  const heading = /^h([1-6])$/.exec(style);
  if (heading) return `${"#".repeat(Number(heading[1]))} ${text}`;
  if (block.listItem) return `${block.listItem === "number" ? "1." : "-"} ${text}`;
  if (style === "blockquote") return `> ${text}`;
  return text;
}

const segment = (item: unknown, index: number): PathSegment =>
  isRecord(item) && typeof item._key === "string" ? { _key: item._key } : index;

/** Every piece of copy in a document, with the path an editor would click. */
export function collectCopy(doc: unknown, options: CopyCheckOptions = {}): Piece[] {
  const skip = new Set(options.skipFields ?? DEFAULT_SKIP_FIELDS);
  const hidden = new Set(options.hiddenPaths ?? []);
  const languages = options.languages;
  const pieces: Piece[] = [];
  if (languages && isRecord(doc) && typeof doc.language === "string" && !languageWanted(doc.language, languages)) {
    return pieces;
  }
  /** A field's dot path, while the path so far is field names only. */
  const fieldPath = (path: Path): string | undefined =>
    path.every((s) => typeof s === "string") ? path.join(".") : undefined;
  const walk = (value: unknown, path: Path): void => {
    if (typeof value === "string") {
      if (!notCopy(value)) pieces.push({ path, text: value });
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (languages && isRecord(item)) {
          const language = itemLanguage(item);
          if (language && !languageWanted(language, languages)) return;
        }
        if (isRecord(item) && item._type === "block" && Array.isArray(item.children)) {
          const text = blockText(item);
          if (text.trim()) pieces.push({ path: [...path, segment(item, i)], text });
        } else {
          walk(item, [...path, segment(item, i)]);
        }
      });
      return;
    }
    if (!isRecord(value)) return;
    if (typeof value._type === "string" && NOT_COPY_TYPES.has(value._type)) return;
    const media = typeof value._type === "string" && MEDIA_TYPES.has(value._type);
    const fields = Object.keys(value).filter((k) => !k.startsWith("_"));
    const localeMap =
      languages !== undefined &&
      fields.length > 0 &&
      fields.every((k) => LANGUAGE_KEY.test(k)) &&
      fields.some((k) => languageWanted(k, languages));
    for (const [key, child] of Object.entries(value)) {
      if (key.startsWith("_") || skip.has(key) || (media && !MEDIA_COPY.has(key))) continue;
      if (localeMap && !languageWanted(key, languages)) continue;
      const childPath = [...path, key];
      const dotted = fieldPath(childPath);
      if (dotted !== undefined && hidden.has(dotted)) continue;
      walk(child, childPath);
    }
  };
  walk(doc, []);
  return pieces;
}

/** A stable file name per path, so a finding maps back to its field. */
const fileFor = (index: number): string => `field-${index}.md`;

/** Check one document. Returns nothing for an excluded type. */
export function checkDocumentCopy(doc: unknown, options: CopyCheckOptions = {}): CopyFinding[] {
  if (!isRecord(doc)) return [];
  const excluded = new Set(options.excludeTypes ?? DEFAULT_EXCLUDED_TYPES);
  if (typeof doc._type === "string" && excluded.has(doc._type)) return [];

  const pieces = collectCopy(doc, options);
  if (pieces.length === 0) return [];
  const review = options.review ?? true;
  const keep = (tier: Tier | undefined): tier is Tier => tier === "block" || (review && tier === "review");

  const findings: CopyFinding[] = [];

  // One field at a time: each finding lands on the field that caused it.
  const files = pieces.map((p, i) => ({ path: fileFor(i), text: p.text }));
  const perField = applyHouseGate(checkCopy(files, {}));
  for (const f of perField.findings) {
    if (DENSITY_TELLS.includes(f.tell) || !keep(f.house)) continue;
    const index = Number(/^field-(\d+)\.md$/.exec(f.path)?.[1]);
    const piece = pieces[index];
    if (!piece) continue;
    findings.push({ path: piece.path, tell: f.tell, name: f.name, tier: f.house, message: f.message, fix: f.fix });
  }

  // The density tier reads the document as one piece of writing.
  if (review) {
    const whole = [{ path: "document.md", text: pieces.map((p) => p.text).join("\n\n") }];
    for (const f of checkCopy(whole, { only: DENSITY_TELLS }).findings) {
      findings.push({ path: [], tell: f.tell, name: f.name, tier: "review", message: f.message, fix: f.fix });
    }
  }
  return findings;
}

/** One line an editor can act on. */
export function describeFinding(f: CopyFinding): string {
  const lead = f.tier === "block" ? "House rule" : "Worth a look";
  return `${lead} (${f.name}): ${f.message}. ${f.fix}`;
}

/** A path as text, for a report: `hero.title`, `body[_key=="a1"]`. */
export function pathToString(path: Path): string {
  return path
    .map((s, i) => (typeof s === "string" ? `${i ? "." : ""}${s}` : typeof s === "number" ? `[${s}]` : `[_key=="${s._key}"]`))
    .join("");
}
