/**
 * What a model costs per million tokens, and a live spend meter built on it. This table is the one place to update
 * when a price changes: the `--max-usd` cap and the cost record in every report read it.
 */

/** When these list prices were last checked (London / eu-west-2 on Bedrock, the account's own price on Workers AI). */
export const PRICES_CHECKED = "2026-10-14";

export interface Price {
  /** Matches the model id the panel file names, e.g. "eu.anthropic.claude-haiku-4-5-20251001-v1:0". */
  match: RegExp;
  label: string;
  /** USD per million tokens. */
  input: number;
  output: number;
  /** Cache read and 5-minute cache write, where the provider caches (Claude only). */
  cacheRead?: number;
  cacheWrite?: number;
}

/** Claude's cache prices follow the input price: a read is 0.1x, a 5-minute write 1.25x. */
const claude = (match: RegExp, label: string, input: number, output: number): Price => ({ match, label, input, output, cacheRead: input * 0.1, cacheWrite: input * 1.25 });

export const PRICES: Price[] = [
  claude(/claude-haiku-4-5/, "Claude Haiku 4.5", 1, 5),
  claude(/claude-sonnet-4-6/, "Claude Sonnet 4.6", 3, 15),
  claude(/claude-opus-4-6/, "Claude Opus 4.6", 5, 25),
  { match: /qwen\.qwen3-vl-235b/, label: "Qwen3-VL 235B", input: 0.82, output: 4.12 },
  { match: /moonshotai\.kimi-k2/, label: "Kimi K2.5", input: 0.93, output: 4.65 },
  { match: /@cf\/meta\/llama-4-scout/, label: "Llama 4 Scout 17B", input: 0.27, output: 0.85 },
  { match: /@cf\/mistralai\/mistral-small-3\.1/, label: "Mistral Small 3.1 24B", input: 0.351, output: 0.555 },
];

export function priceFor(model: string): Price {
  const p = PRICES.find((x) => x.match.test(model));
  if (!p) throw new Error(`no price for model "${model}": add it to PRICES in src/pricing.ts, so the spend cap can count it`);
  return p;
}

export interface TokenCounts {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

/** USD for one call or a total. A provider with no cache price bills cached tokens as plain input. */
export function costOf(model: string, t: TokenCounts): number {
  const p = priceFor(model);
  return (t.input * p.input + t.output * p.output + t.cacheRead * (p.cacheRead ?? p.input) + t.cacheWrite * (p.cacheWrite ?? p.input)) / 1e6;
}

/** What a run has spent so far, across every session and grading call it runs at once. */
export class SpendMeter {
  spent = 0;
  /** Sessions the cap cut short while they ran. */
  readonly cut: string[] = [];
  /** Sessions the cap stopped from starting. */
  readonly notStarted: string[] = [];
  /** Sessions that were browsed but not graded, because the cap was already passed. */
  readonly notGraded: string[] = [];
  constructor(readonly maxUsd: number) {}
  add(usd: number): void {
    this.spent += usd;
  }
  get exceeded(): boolean {
    return this.spent >= this.maxUsd;
  }
  get hit(): boolean {
    return this.cut.length + this.notStarted.length + this.notGraded.length > 0;
  }
}

export const usd = (n: number): string => `$${n.toFixed(n < 0.1 ? 4 : 2)}`;
