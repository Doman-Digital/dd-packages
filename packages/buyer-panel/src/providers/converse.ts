import type Anthropic from "@anthropic-ai/sdk";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import type { ContentBlock, ConverseCommandInput, ConverseCommandOutput, Message, ToolResultContentBlock } from "@aws-sdk/client-bedrock-runtime";
import type { ModelClient } from "../model.js";
import { anthropicMessage, blocksOf, hoistToolImages, httpError, mediaFormat, systemText, toolResultBlocks, toolResultText } from "./shared.js";

/** Bedrock's Converse API, for the models that are not Claude (Qwen3-VL, Kimi K2.5): images and tool use in one shape. */

const toBlock = (b: Anthropic.ContentBlockParam): ContentBlock[] => {
  switch (b.type) {
    case "text":
      return b.text.trim() ? [{ text: b.text }] : [];
    case "image":
      if (b.source.type !== "base64") throw new Error("converse: only base64 images are supported");
      return [{ image: { format: mediaFormat(b.source.media_type) as "jpeg", source: { bytes: Buffer.from(b.source.data, "base64") } } }];
    case "tool_use":
      return [{ toolUse: { toolUseId: b.id, name: b.name, input: b.input as Record<string, never> } }];
    case "tool_result": {
      const content: ToolResultContentBlock[] = toolResultBlocks(b).flatMap((c): ToolResultContentBlock[] => {
        if (c.type === "text") return c.text.trim() ? [{ text: c.text }] : [];
        if (c.type === "image" && c.source.type === "base64") return [{ image: { format: mediaFormat(c.source.media_type) as "jpeg", source: { bytes: Buffer.from(c.source.data, "base64") } } }];
        return [];
      });
      if (b.is_error) return [{ toolResult: { toolUseId: b.tool_use_id, status: "error", content: content.length ? content : [{ text: toolResultText(b) || "Error" }] } }];
      return [{ toolResult: { toolUseId: b.tool_use_id, content: content.length ? content : [{ text: "Done." }] } }];
    }
    default:
      return [];
  }
};

/** Anthropic-shaped request → Converse input (without modelId). */
export function toConverse(body: Anthropic.MessageCreateParamsNonStreaming): Omit<ConverseCommandInput, "modelId"> {
  const system = systemText(body.system);
  const messages: Message[] = hoistToolImages(body.messages).map((m) => {
    const content = blocksOf(m.content).flatMap(toBlock);
    return { role: m.role, content: content.length ? content : [{ text: "(nothing)" }] };
  });
  const hasToolBlocks = messages.some((m) => m.content?.some((c) => c.toolUse || c.toolResult));
  return {
    ...(system ? { system: [{ text: system }] } : {}),
    messages,
    inferenceConfig: { maxTokens: body.max_tokens, ...(body.temperature === undefined ? {} : { temperature: body.temperature }) },
    ...(body.tools?.length || hasToolBlocks
      ? {
          toolConfig: {
            tools: (body.tools ?? []).map((t) => {
              const tool = t as Anthropic.Tool;
              return { toolSpec: { name: tool.name, description: tool.description, inputSchema: { json: tool.input_schema as unknown as Record<string, never> } } };
            }),
            toolChoice: body.tool_choice?.type === "any" ? { any: {} } : { auto: {} },
          },
        }
      : {}),
  };
}

const STOP: Record<string, Anthropic.Message["stop_reason"]> = {
  end_turn: "end_turn",
  tool_use: "tool_use",
  max_tokens: "max_tokens",
  stop_sequence: "stop_sequence",
  content_filtered: "refusal",
  guardrail_intervened: "refusal",
};

/** Converse output → Anthropic message. Reasoning blocks are dropped: they are the model's own, not part of the buyer's turn. */
export function fromConverse(model: string, res: Pick<ConverseCommandOutput, "output" | "stopReason" | "usage">): Anthropic.Message {
  const content: Anthropic.ContentBlock[] = [];
  for (const b of res.output?.message?.content ?? []) {
    if (b.text !== undefined) content.push({ type: "text", text: b.text, citations: null } as Anthropic.ContentBlock);
    else if (b.toolUse) content.push({ type: "tool_use", id: b.toolUse.toolUseId ?? `toolu_${content.length}`, name: b.toolUse.name ?? "", input: (b.toolUse.input ?? {}) as Record<string, unknown> } as Anthropic.ContentBlock);
  }
  return anthropicMessage(model, content, STOP[res.stopReason ?? "end_turn"] ?? "end_turn", {
    input: res.usage?.inputTokens ?? 0,
    output: res.usage?.outputTokens ?? 0,
    cacheRead: res.usage?.cacheReadInputTokens ?? 0,
    cacheWrite: res.usage?.cacheWriteInputTokens ?? 0,
  });
}

export function converseClient(region: string): ModelClient {
  const client = new BedrockRuntimeClient({ region, maxAttempts: 4 });
  return {
    messages: {
      async create(body) {
        try {
          const res = await client.send(new ConverseCommand({ modelId: body.model, ...toConverse(body) }));
          return fromConverse(body.model, res);
        } catch (e) {
          const err = e as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
          throw httpError(`${err.name ?? "Error"}: ${err.message ?? ""}`, err.name === "ThrottlingException" ? 429 : err.$metadata?.httpStatusCode);
        }
      },
    },
  };
}
