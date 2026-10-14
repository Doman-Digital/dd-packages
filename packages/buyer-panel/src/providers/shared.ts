import type Anthropic from "@anthropic-ai/sdk";

/**
 * The panel speaks Anthropic's message shape internally. The non-Claude providers each have their own, so each has an
 * adapter that translates a request out and a reply back. What the adapters share is here.
 */

export type Blocks = Anthropic.ContentBlockParam[];
export type ToolResult = Anthropic.ToolResultBlockParam;

export const blocksOf = (c: string | Blocks): Blocks => (typeof c === "string" ? [{ type: "text", text: c }] : c);

export const systemText = (s: Anthropic.MessageCreateParams["system"]): string =>
  s === undefined ? "" : typeof s === "string" ? s : s.map((b) => b.text).join("\n\n");

type ResultBlock = Exclude<ToolResult["content"], string | undefined>[number];

export const toolResultBlocks = (r: ToolResult): ResultBlock[] => (r.content === undefined ? [] : typeof r.content === "string" ? [{ type: "text", text: r.content }] : r.content);

/** The text of a tool result, with an error marked as one because neither provider has a flag for it in every model. */
export function toolResultText(r: ToolResult): string {
  const text = toolResultBlocks(r)
    .filter((b): b is Anthropic.TextBlockParam => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return r.is_error ? `Error: ${text}` : text;
}

/**
 * Not every vision model accepts an image inside a tool result. The buyer's screenshot comes back as one, so the images
 * move out of each tool result into the same user turn, after it, with a line saying what they are.
 */
export function hoistToolImages(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  return messages.map((m) => {
    if (m.role !== "user" || typeof m.content === "string") return m;
    const results: Blocks = [];
    const rest: Blocks = [];
    for (const b of m.content) {
      if (b.type !== "tool_result") {
        rest.push(b);
        continue;
      }
      const images = toolResultBlocks(b).filter((c) => c.type === "image");
      results.push(images.length ? { ...b, content: toolResultBlocks(b).filter((c) => c.type !== "image") } : b);
      for (const img of images) rest.push({ type: "text", text: "Your screen after that action:" }, img);
    }
    return { ...m, content: [...results, ...rest] };
  });
}

/** Both providers let a model call two tools at once; the buyer answers one. Keeps the first tool call only. */
export function firstToolUseOnly(content: Anthropic.ContentBlock[]): Anthropic.ContentBlock[] {
  let seen = false;
  return content.filter((b) => {
    if (b.type !== "tool_use") return true;
    if (seen) return false;
    seen = true;
    return true;
  });
}

export function anthropicMessage(model: string, content: Anthropic.ContentBlock[], stop: Anthropic.Message["stop_reason"], usage: { input: number; output: number; cacheRead?: number; cacheWrite?: number }): Anthropic.Message {
  return {
    id: `msg_${Math.random().toString(36).slice(2)}`,
    type: "message",
    role: "assistant",
    model,
    content: firstToolUseOnly(content),
    stop_reason: stop,
    stop_sequence: null,
    usage: { input_tokens: usage.input, output_tokens: usage.output, cache_read_input_tokens: usage.cacheRead ?? 0, cache_creation_input_tokens: usage.cacheWrite ?? 0 },
  } as unknown as Anthropic.Message;
}

export const mediaFormat = (mediaType: string): string => mediaType.replace(/^image\//, "").replace("jpg", "jpeg");

/** An error the retry wrapper in model.ts reads: it retries 429, 503 and 529 and nothing else. */
export const httpError = (message: string, status: number | undefined): Error => Object.assign(new Error(message), status === undefined ? {} : { status });
