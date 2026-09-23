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

import { type CopyCheckOptions, type Path, checkDocumentCopy, describeFinding } from "./core.js";

/** The part of Sanity's `Rule` this uses. Each call returns a new rule. */
export interface RuleLike {
  custom(fn: (value: unknown) => true | { message: string; path: Path }[]): RuleLike;
  warning(message?: string): RuleLike;
}

type Validation = (rule: RuleLike, context?: unknown) => unknown;

/** The part of a Sanity schema type definition this reads. */
export interface SchemaTypeLike {
  name: string;
  type: string;
  validation?: unknown;
  [key: string]: unknown;
}

/**
 * The custom rule, on its own, for a Studio that composes validation itself:
 * `validation: (rule) => [copyCheckRule(rule), ...]`.
 */
export function copyCheckRule(rule: RuleLike, options: CopyCheckOptions = {}): RuleLike {
  let lastInput = "";
  let lastResult: true | { message: string; path: Path }[] = true;
  return rule
    .custom((doc) => {
      // Validation runs on every keystroke. The same document gives the same
      // answer, so the last one is kept.
      const input = JSON.stringify(doc ?? null);
      if (input === lastInput) return lastResult;
      lastInput = input;
      const findings = checkDocumentCopy(doc, options);
      lastResult = findings.length === 0 ? true : findings.map((f) => ({ message: describeFinding(f), path: f.path }));
      return lastResult;
    })
    .warning();
}

const asArray = (v: unknown): unknown[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);

/** Every document type gains the copy check as a warning, beside the validation it already has. */
export function withCopyCheck<T extends SchemaTypeLike>(types: T[], options: CopyCheckOptions = {}): T[] {
  const excluded = new Set(options.excludeTypes ?? ["testimonial", "review", "proofQuote", "quote"]);
  return types.map((t) => {
    if (t.type !== "document" || excluded.has(t.name)) return t;
    const existing = t.validation;
    const validation: Validation = (rule, context) => [
      ...asArray(typeof existing === "function" ? (existing as Validation)(rule, context) : existing),
      copyCheckRule(rule, options),
    ];
    return { ...t, validation };
  });
}
