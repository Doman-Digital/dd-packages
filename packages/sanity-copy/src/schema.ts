/**
 * The house copy check in Sanity Studio, as validation warnings.
 *
 *   import { withCopyCheck } from "@domandigital/sanity-copy";
 *   export default defineConfig({ schema: { types: withCopyCheck(schemaTypes) } });
 *
 * Why a wrapper and not a plugin: a plugin's `schema.types` function runs
 * before the Studio's own types are added, so it never sees them. Wrapping the
 * array the Studio passes in is explicit and always sees every type.
 *
 * Warnings, never errors. Copy the owner types is advised on, never
 * overridden: a warning shows the editor what the check found, on the field
 * that caused it, and publishing still works.
 *
 * No Sanity import. The shapes below are the parts of Sanity's schema and
 * rule API this uses, so the package works across Studio versions without a
 * peer dependency to keep in step.
 */

import {
  type CopyCheckOptions,
  type CopyFinding,
  DEFAULT_EXCLUDED_TYPES,
  type Path,
  checkDocumentCopy,
  collectCopy,
  describeFinding,
} from "./core.js";

/** The part of Sanity's `Rule` this uses. Each call returns a new rule. */
export interface RuleLike {
  custom(fn: (value: unknown) => true | { message: string; path: Path }[]): RuleLike;
  warning(message?: string): RuleLike;
}

type Validation = (rule: RuleLike, context?: unknown) => unknown;

/**
 * The part of a Sanity schema type definition this reads. No index signature:
 * Sanity declares its definitions as interfaces, which have none, so one here
 * would reject every real Studio's types.
 */
export interface SchemaTypeLike {
  name: string;
  type: string;
  validation?: unknown;
}

/**
 * The custom rule, on its own, for a Studio that composes validation itself:
 * `validation: (rule) => [copyCheckRule(rule), ...]`.
 */
export function copyCheckRule(rule: RuleLike, options: CopyCheckOptions = {}): RuleLike {
  let lastInput: string | undefined;
  let lastResult: true | { message: string; path: Path }[] = true;
  return rule
    .custom((doc) => {
      // Validation runs on every keystroke. The same copy gives the same
      // answer, so the last one is kept. Keyed on the copy itself, not the
      // whole document: a change to a slug, a link or an image reference
      // re-runs nothing.
      const type = doc !== null && typeof doc === "object" ? (doc as { _type?: unknown })._type : undefined;
      const input = JSON.stringify([type, collectCopy(doc, options)]);
      if (input === lastInput) return lastResult;
      lastInput = input;
      const findings = checkDocumentCopy(doc, options);
      lastResult = findings.length === 0 ? true : findings.map((f) => ({ message: describeFinding(f), path: f.path }));
      return lastResult;
    })
    .warning();
}

interface FieldLike {
  name?: unknown;
  type?: unknown;
  hidden?: unknown;
  fields?: unknown;
}

/**
 * Dot paths of every field with a static `hidden: true` under a type,
 * following inline `fields` and named object types. A `hidden` function is
 * not evaluated: it decides per document and per editor, and this check runs
 * over the whole document, where the answer for a nested field is not known.
 */
function staticHiddenPaths(type: FieldLike, byName: Map<string, FieldLike>, prefix = "", seen = new Set<string>()): string[] {
  const own = Array.isArray(type.fields) ? type.fields : undefined;
  const named = typeof type.type === "string" ? byName.get(type.type) : undefined;
  const fields = (own ?? (named && Array.isArray(named.fields) ? named.fields : [])) as FieldLike[];
  if (!own && named && typeof type.type === "string") {
    if (seen.has(type.type)) return [];
    seen = new Set(seen).add(type.type);
  }
  const paths: string[] = [];
  for (const field of fields) {
    if (typeof field?.name !== "string") continue;
    const path = prefix ? `${prefix}.${field.name}` : field.name;
    if (field.hidden === true) paths.push(path);
    else paths.push(...staticHiddenPaths(field, byName, path, seen));
  }
  return paths;
}

const asArray = (v: unknown): unknown[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);

/** Every document type gains the copy check as a warning, beside the validation it already has. */
export function withCopyCheck<T extends SchemaTypeLike>(types: T[], options: CopyCheckOptions = {}): T[] {
  const excluded = new Set(options.excludeTypes ?? DEFAULT_EXCLUDED_TYPES);
  const byName = new Map(types.map((t) => [t.name, t as FieldLike]));
  return types.map((t) => {
    if (t.type !== "document" || excluded.has(t.name)) return t;
    const hiddenPaths = [...(options.hiddenPaths ?? []), ...staticHiddenPaths({ fields: (t as FieldLike).fields }, byName)];
    const typeOptions = hiddenPaths.length > 0 ? { ...options, hiddenPaths } : options;
    const existing = t.validation;
    const validation: Validation = (rule, context) => [
      ...asArray(typeof existing === "function" ? (existing as Validation)(rule, context) : existing),
      copyCheckRule(rule, typeOptions),
    ];
    // The Studio's own rule type, not RuleLike, is what reaches `validation`
    // at runtime, so the wrapped type keeps the caller's declared shape.
    return { ...t, validation } as T;
  });
}

/** The part of a Studio document action's props this reads. */
export interface DocumentActionPropsLike {
  draft?: unknown;
  published?: unknown;
}

/** The part of a document action's result this changes. */
export interface DocumentActionResultLike {
  disabled?: boolean;
  title?: unknown;
}

/**
 * A document action: a function from props to a description, with an
 * optional `action` tag (`"publish"` on the built-in one). The props
 * parameter is `never` so Sanity's own, narrower props type fits.
 */
export type DocumentActionLike = ((props: never) => DocumentActionResultLike | null | undefined) & {
  action?: string;
  displayName?: string;
};

/**
 * Opt-in: the publish action, disabled while the document has a house-rule
 * (blocking tier) finding. The review tier never blocks.
 *
 *   document: {
 *     actions: (prev) => prev.map((a) => (a.action === "publish" ? withCopyGuard(a) : a)),
 *   }
 *
 * The original action is always called first, with the same props, so any
 * hooks it uses run in the same order on every render. Its result is
 * returned as it is, except for `disabled` and the `title` tooltip naming
 * the first finding. Everything else in the package warns and never blocks;
 * this is the one place that can, and only where a Studio adds it.
 *
 * Returns the caller's own action type, so the Studio's `actions` array
 * keeps its type.
 */
export function withCopyGuard<A extends DocumentActionLike>(action: A, options: CopyCheckOptions = {}): A {
  let lastDoc: unknown;
  let lastBlocking: CopyFinding[] = [];
  const call = action as unknown as (props: DocumentActionPropsLike) => DocumentActionResultLike | null | undefined;
  const guarded = (props: DocumentActionPropsLike) => {
    const result = call(props);
    if (!result) return result;
    const doc = props.draft ?? props.published;
    // Studio documents are immutable snapshots: the same object is the same copy.
    if (doc !== lastDoc) {
      lastDoc = doc;
      lastBlocking = checkDocumentCopy(doc, { ...options, review: false }).filter((f) => f.tier === "block");
    }
    if (lastBlocking.length === 0) return result;
    const more = lastBlocking.length > 1 ? ` (and ${lastBlocking.length - 1} more)` : "";
    return { ...result, disabled: true, title: `${describeFinding(lastBlocking[0])}${more}` };
  };
  const tagged = guarded as unknown as A;
  if (action.action !== undefined) tagged.action = action.action;
  tagged.displayName = `withCopyGuard(${action.displayName ?? "action"})`;
  return tagged;
}
