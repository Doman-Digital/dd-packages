import Anthropic from "@anthropic-ai/sdk";
import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk";
import type { ModelChoice, Provider } from "./config.js";

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
 * bedrock: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_BEDROCK_REGION (dd-work-box/prd on the box).
 * anthropic: ANTHROPIC_API_KEY.
 */
export function clientFor(choice: ModelChoice): ModelClient {
  const provider = choice.provider ?? "bedrock";
  let c = clients.get(provider);
  if (!c) {
    c = patient(
      provider === "bedrock"
        ? (new AnthropicBedrock({ awsRegion: process.env.AWS_BEDROCK_REGION || "eu-west-2", maxRetries: 4 }) as unknown as ModelClient)
        : (new Anthropic({ maxRetries: 4 }) as unknown as ModelClient),
    );
    clients.set(provider, c);
  }
  return c;
}

export interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  calls: number;
}

export const emptyUsage = (): Usage => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0 });

export function addUsage(u: Usage, m: Anthropic.Message): void {
  u.input += m.usage.input_tokens;
  u.output += m.usage.output_tokens;
  u.cacheRead += m.usage.cache_read_input_tokens ?? 0;
  u.cacheWrite += m.usage.cache_creation_input_tokens ?? 0;
  u.calls += 1;
}

export function mergeUsage(into: Usage, from: Usage): void {
  into.input += from.input;
  into.output += from.output;
  into.cacheRead += from.cacheRead;
  into.cacheWrite += from.cacheWrite;
  into.calls += from.calls;
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
): Promise<T> {
  const client = clientFor(choice);
  let messages = body.messages;
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await client.messages.create({
      ...body,
      messages,
      model: choice.model,
      ...(choice.temperature === undefined ? {} : { temperature: choice.temperature }),
      tools: [tool],
      tool_choice: { type: "auto" },
    });
    addUsage(usage, res);
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
