import type { SynthMode } from "./canonical";

/**
 * What a verified synthetic request becomes. Downstream code reads this and
 * nothing else: a `synthetic=true` field in a body or query string is never
 * consulted anywhere in this package, and `isSynthContext` rejects any object
 * that did not come out of `verify`.
 */
export interface SynthContext {
  readonly v: 1;
  readonly runId: string;
  readonly mode: SynthMode;
  readonly client: string;
  readonly form: string;
  readonly kid: string;
  /** Unix seconds from the signed timestamp header. */
  readonly ts: number;
}

// Module-private. Only `mintContext` adds to it, and only `verify` calls that.
const minted = new WeakSet<object>();

/** @internal Used by verify(). Not exported from the package entry. */
export function mintContext(fields: Omit<SynthContext, "v">): SynthContext {
  const ctx: SynthContext = Object.freeze({ v: 1 as const, ...fields });
  minted.add(ctx);
  return ctx;
}

/** True only for a context produced by a successful `verify`. A forged look-alike is false. */
export function isSynthContext(value: unknown): value is SynthContext {
  return typeof value === "object" && value !== null && minted.has(value);
}
