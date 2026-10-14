import type Anthropic from "@anthropic-ai/sdk";
import type { ModelClient } from "../model.js";
import { anthropicMessage, blocksOf, hoistToolImages, httpError, systemText, toolResultText } from "./shared.js";

/**
 * Cloudflare Workers AI, through its OpenAI-compatible chat endpoint:
 * POST /accounts/<id>/ai/v1/chat/completions with the model as "@cf/<vendor>/<name>".
 */

type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
export type OpenAIMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string | Part[] }
  | { role: "assistant"; content: string | null; tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens: number;
  temperature?: number;
  tools?: { type: "function"; function: { name: string; description?: string; parameters: unknown } }[];
  tool_choice?: "auto" | "required";
}

/**
 * Anthropic-shaped request → OpenAI chat request. Tools are always offered as tool_choice "required": left on auto,
 * Llama 4 Scout answers in prose ("[Book()]") instead of calling one. The cost is that the model's one-line thought
 * before an action is usually empty, which the report shows as "(nothing said)".
 */
export function toOpenAI(body: Anthropic.MessageCreateParamsNonStreaming, o: { bridge?: string } = {}): OpenAIRequest {
  const messages: OpenAIMessage[] = [];
  const system = systemText(body.system);
  if (system) messages.push({ role: "system", content: system });
  for (const m of hoistToolImages(body.messages)) {
    const blocks = blocksOf(m.content);
    if (m.role === "assistant") {
      const text = blocks.filter((b): b is Anthropic.TextBlockParam => b.type === "text").map((b) => b.text).join("\n");
      const calls = blocks.filter((b): b is Anthropic.ToolUseBlockParam => b.type === "tool_use").map((b) => ({ id: b.id, type: "function" as const, function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) } }));
      messages.push({ role: "assistant", content: text || (calls.length ? null : "(nothing)"), ...(calls.length ? { tool_calls: calls } : {}) });
      continue;
    }
    for (const b of blocks) if (b.type === "tool_result") messages.push({ role: "tool", tool_call_id: b.tool_use_id, content: toolResultText(b) || "Done." });
    const parts: Part[] = [];
    for (const b of blocks) {
      if (b.type === "text" && b.text.trim()) parts.push({ type: "text", text: b.text });
      else if (b.type === "image" && b.source.type === "base64") parts.push({ type: "image_url", image_url: { url: `data:${b.source.media_type};base64,${b.source.data}` } });
    }
    if (parts.length && o.bridge && messages.at(-1)?.role === "tool") messages.push({ role: "assistant", content: o.bridge });
    if (parts.length) messages.push({ role: "user", content: parts.every((p) => p.type === "text") ? parts.map((p) => (p as { text: string }).text).join("\n") : parts });
  }
  return {
    model: body.model,
    messages,
    max_tokens: body.max_tokens,
    ...(body.temperature === undefined ? {} : { temperature: body.temperature }),
    ...(body.tools?.length
      ? {
          tools: body.tools.map((t) => {
            const tool = t as Anthropic.Tool;
            return { type: "function" as const, function: { name: tool.name, description: tool.description, parameters: tool.input_schema } };
          }),
          tool_choice: "required" as const,
        }
      : {}),
  };
}

interface OpenAIReply {
  choices?: { message?: { content?: string | null; tool_calls?: { id?: string; function?: { name?: string; arguments?: string | Record<string, unknown> } }[] }; finish_reason?: string }[];
  /** Workers AI reports the neurons a call used, which is what its free allowance is counted in. */
  usage?: { prompt_tokens?: number; completion_tokens?: number; neurons?: number };
}

const parseArgs = (a: string | Record<string, unknown> | undefined): Record<string, unknown> => {
  if (!a) return {};
  if (typeof a !== "string") return a;
  try {
    const v = JSON.parse(a) as unknown;
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

/** OpenAI chat reply → Anthropic message. */
export function fromOpenAI(model: string, res: OpenAIReply): Anthropic.Message {
  const choice = res.choices?.[0];
  const content: Anthropic.ContentBlock[] = [];
  const text = choice?.message?.content;
  if (typeof text === "string" && text.trim()) content.push({ type: "text", text, citations: null } as Anthropic.ContentBlock);
  (choice?.message?.tool_calls ?? []).forEach((c, i) => content.push({ type: "tool_use", id: c.id || `call_${i}`, name: c.function?.name ?? "", input: parseArgs(c.function?.arguments) } as Anthropic.ContentBlock));
  const stop = content.some((b) => b.type === "tool_use") ? "tool_use" : choice?.finish_reason === "length" ? "max_tokens" : "end_turn";
  const msg = anthropicMessage(model, content, stop, { input: res.usage?.prompt_tokens ?? 0, output: res.usage?.completion_tokens ?? 0 });
  if (res.usage?.neurons !== undefined) (msg.usage as unknown as { neurons: number }).neurons = res.usage.neurons;
  return msg;
}

/**
 * Mistral Small 3.1's chat template refuses a user turn straight after a tool result, and the buyer's screenshot is
 * exactly that. A one-line assistant turn between them satisfies it.
 */
const BRIDGE = /mistral/i;

export function workersAiClient(accountId: string, token: string): ModelClient {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`;
  return {
    messages: {
      async create(body) {
        const r = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(toOpenAI(body, BRIDGE.test(body.model) ? { bridge: "(The screen has changed.)" } : {})) });
        const raw = await r.text();
        if (!r.ok) {
          // 4006 is the daily free-allocation stop: retrying cannot help, so it carries no status for the retry wrapper.
          const daily = /\b4006\b|daily free allocation/i.test(raw);
          throw httpError(`Workers AI ${r.status}: ${raw.slice(0, 300)}`, daily ? undefined : r.status);
        }
        return fromOpenAI(body.model, JSON.parse(raw) as OpenAIReply);
      },
    },
  };
}
