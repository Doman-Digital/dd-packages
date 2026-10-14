import Anthropic from "@anthropic-ai/sdk";
import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk";
import type { ModelChoice, Provider } from "./config.js";
import { costOf, type SpendMeter } from "./pricing.js";
import { converseClient } from "./providers/converse.js";
import { workersAiClient } from "./providers/workers-ai.js";

/** The one surface the panel uses: messages.create, the same on the first-party API and on Bedrock. */
export interface ModelClient {
  messages: { create(body: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> };
}

const clients = new Map<Provider, ModelClient>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Bedrock's per-account quota throttles a panel running several sessions at once, past what the SDK's own short
 * retries absorb. A throttled call waits longer and tries again, so one busy minute does not end a session.
 */
function patient(inner: ModelClient): ModelClient {
  return {
    messages: {
      async create(body) {
        for (let attempt = 0; ; attempt++) {
          try {
            return await inner.messages.create(body);
          } catch (e) {
            const status = (e as { status?: number }).status;
            if ((status !== 429 && status !== 503 && status !== 529) || attempt >= 8) throw e;
            await sleep(Math.min(120_000, 15_000 * 2 ** Math.min(attempt, 3)) + Math.random() * 5000);
          }
        }
      },
    },
  };
}

/**
 * A plain API client: never a Claude Code session, so the buyer sees nothing but its system prompt
 * (the persona) and what the browser shows it.
 *
 * bedrock and bedrock-converse: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_BEDROCK_REGION (dd-work-box/prd_buyer_panel on the box).
 * anthropic: ANTHROPIC_API_KEY.
 * workers-ai: CLOUDFLARE_AI_TOKEN and CLOUDFLARE_ACCOUNT_ID.
 */
export function clientFor(choice: ModelChoice): ModelClient {
  const provider = choice.provider ?? "bedrock";
  let c = clients.get(provider);
  if (!c) {
    const region = process.env.AWS_BEDROCK_REGION || "eu-west-2";
    c = patient(
      provider === "bedrock"
        ? (new AnthropicBedrock({ awsRegion: region, maxRetries: 4 }) as unknown as ModelClient)
        : provider === "bedrock-converse"
          ? converseClient(region)
          : provider === "workers-ai"
            ? workersAiClient(need("CLOUDFLARE_ACCOUNT_ID"), need("CLOUDFLARE_AI_TOKEN"))
            : (new Anthropic({ maxRetries: 4 }) as unknown as ModelClient),
    );
    clients.set(provider, c);
  }
  return c;
}

const need = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set: run under doppler run -p dd-work-box -c prd_buyer_panel`);
  return v;
};

/** Providers that read Anthropic's cache_control. The others ignore it, so a prompt for them is never cached. */
export const cachesPrompts = (choice: ModelChoice): boolean => (choice.provider ?? "bedrock") === "bedrock" || choice.provider === "anthropic";

const EPHEMERAL = { type: "ephemeral" } as const;

type Block = Anthropic.ContentBlockParam & { cache_control?: Anthropic.CacheControlEphemeral | null };

/** A copy of the blocks with a cache checkpoint on the last one. The caller's messages are never touched: a checkpoint left on an old turn would pile up past Bedrock's four. */
const checkpointed = (content: string | Anthropic.ContentBlockParam[]): Anthropic.ContentBlockParam[] => {
  const blocks: Block[] = typeof content === "string" ? [{ type: "text", text: content }] : [...content];
  const last = blocks.length - 1;
  if (last >= 0 && blocks[last]!.type !== "thinking" && blocks[last]!.type !== "redacted_thinking") blocks[last] = { ...blocks[last]!, cache_control: EPHEMERAL } as Block;
  return blocks;
};

/**
 * Prompt caching for Claude. Each buyer step resends the whole conversation; with a checkpoint on the system prompt
 * and on the end of the conversation, the next step reads everything before its new turn from cache at a tenth of the
 * input price. A second checkpoint sits just before the oldest screenshot still in full, the point where the history
 * is next rewritten by pruneHistory, so a prune re-reads the stable part instead of re-writing it. Three checkpoints
 * of the four allowed. A checkpoint under the model's minimum (4,096 tokens for Haiku 4.5) is ignored by the API, so
 * the first steps simply run uncached.
 *
 * mode "system": only the system prompt, for a call whose conversation is not sent again (the evaluator's).
 */
export function withCaching<B extends Omit<Anthropic.MessageCreateParamsNonStreaming, "model">>(body: B, mode: "system" | "conversation" = "conversation"): B {
  const out: B = { ...body };
  if (body.system) out.system = checkpointed(body.system) as Anthropic.TextBlockParam[];
  if (mode === "system" || !body.messages.length) return out;
  const messages = body.messages.slice();
  const last = messages.length - 1;
  const firstImage = messages.findIndex((m) => Array.isArray(m.content) && m.content.some((b) => b.type === "image" || (b.type === "tool_result" && Array.isArray(b.content) && b.content.some((c) => c.type === "image"))));
  if (firstImage >= 1 && firstImage - 1 < last) messages[firstImage - 1] = { ...messages[firstImage - 1]!, content: checkpointed(messages[firstImage - 1]!.content) };
  messages[last] = { ...messages[last]!, content: checkpointed(messages[last]!.content) };
  out.messages = messages;
  return out;
}

export interface Usage {
  /** Input tokens the API billed at the full input price: not read from or written to the cache. */
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  calls: number;
  /** Estimated cost in USD from the price table in pricing.ts. Absent in records from before the table existed. */
  usd?: number;
  /** Workers AI only: neurons used, the unit of its daily free allowance (10,000 a day on the Free plan). */
  neurons?: number;
}

export const emptyUsage = (): Usage => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0, usd: 0 });

/** Adds one reply's tokens and cost to a usage record, and to the run's spend meter when there is one. */
export function addUsage(u: Usage, m: Anthropic.Message, model: string, meter?: SpendMeter): void {
  const t = { input: m.usage.input_tokens, output: m.usage.output_tokens, cacheRead: m.usage.cache_read_input_tokens ?? 0, cacheWrite: m.usage.cache_creation_input_tokens ?? 0 };
  const cost = costOf(model, t);
  u.input += t.input;
  u.output += t.output;
  u.cacheRead += t.cacheRead;
  u.cacheWrite += t.cacheWrite;
  u.calls += 1;
  u.usd = (u.usd ?? 0) + cost;
  const neurons = (m.usage as unknown as { neurons?: number }).neurons;
  if (neurons !== undefined) u.neurons = (u.neurons ?? 0) + neurons;
  meter?.add(cost);
}

export function mergeUsage(into: Usage, from: Usage): void {
  into.input += from.input;
  into.output += from.output;
  into.cacheRead += from.cacheRead;
  into.cacheWrite += from.cacheWrite;
  into.calls += from.calls;
  into.usd = (into.usd ?? 0) + (from.usd ?? 0);
  if (from.neurons !== undefined) into.neurons = (into.neurons ?? 0) + from.neurons;
}

export const textOf = (m: Anthropic.Message): string =>
  m.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

/**
 * Asks for one tool call and returns its input. Uses tool_choice auto with an instruction rather than a
 * forced tool, which the current model generation rejects; asks once more if the model answers in prose.
 */
export async function callForTool<T>(
  choice: ModelChoice,
  body: Omit<Anthropic.MessageCreateParamsNonStreaming, "model" | "tools" | "tool_choice">,
  tool: Anthropic.Tool,
  usage: Usage,
  validate: (input: unknown) => T,
  meter?: SpendMeter,
): Promise<T> {
  const client = clientFor(choice);
  let messages = body.messages;
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await client.messages.create({
      ...(cachesPrompts(choice) ? withCaching(body, "system") : body),
      messages,
      model: choice.model,
      ...(choice.temperature === undefined ? {} : { temperature: choice.temperature }),
      tools: [tool],
      tool_choice: { type: "auto" },
    });
    addUsage(usage, res, choice.model, meter);
    const call = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === tool.name);
    if (call) {
      try {
        return validate(call.input);
      } catch (e) {
        lastError = (e as Error).message;
        messages = [
          ...messages,
          { role: "assistant", content: res.content },
          { role: "user", content: [{ type: "tool_result", tool_use_id: call.id, is_error: true, content: `Invalid: ${lastError}. Call ${tool.name} again with the corrected input.` }] },
        ];
        continue;
      }
    }
    lastError = `no ${tool.name} call (stop_reason ${res.stop_reason})`;
    if (res.stop_reason === "refusal") break;
    messages = [...messages, { role: "assistant", content: res.content }, { role: "user", content: `Answer by calling ${tool.name}.` }];
  }
  throw new Error(`${tool.name}: ${lastError}`);
}
