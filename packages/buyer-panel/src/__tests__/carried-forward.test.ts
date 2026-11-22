import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { carriedForward, pruneHistory } from "../buyer.js";

const shot = { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "x" } } as const;
const userShot = (): Anthropic.MessageParam => ({ role: "user", content: [shot, { type: "text", text: "On screen:\nHome" }] });
const assistant = (n: number): Anthropic.MessageParam => ({
  role: "assistant",
  content: [
    { type: "thinking", thinking: `t${n}`, signature: `s${n}` },
    { type: "text", text: `I'll tap ${n}.` },
  ],
});

describe("pruneHistory and thinking", () => {
  it("drops thinking from every assistant turn but the latest once it rewrites an earlier screen", () => {
    const messages: Anthropic.MessageParam[] = [];
    for (let n = 0; n < 6; n++) messages.push(userShot(), assistant(n));
    pruneHistory(messages, 2, 3);
    const assistants = messages.filter((m) => m.role === "assistant");
    const kinds = assistants.map((m) => (m.content as Anthropic.ContentBlockParam[]).map((b) => b.type));
    expect(kinds.slice(0, -1).every((k) => k.length === 1 && k[0] === "text")).toBe(true);
    expect(kinds.at(-1)).toEqual(["thinking", "text"]);
  });

  it("leaves thinking alone while nothing is pruned", () => {
    const messages: Anthropic.MessageParam[] = [userShot(), assistant(0), userShot(), assistant(1)];
    pruneHistory(messages, 2, 3);
    expect((messages[1]!.content as Anthropic.ContentBlockParam[])[0]!.type).toBe("thinking");
  });
});

describe("carriedForward", () => {
  it("drops thinking from the tool-less first-impression turn so the task call does not resend a block bound to another tools list", () => {
    const content = [
      { type: "thinking", thinking: "Looks like estate planning.", signature: "sig" },
      { type: "redacted_thinking", data: "x" },
      { type: "text", text: "They do inheritance tax planning.", citations: null },
    ] as unknown as Anthropic.ContentBlock[];
    const out = carriedForward(content);
    expect(out.map((b) => b.type)).toEqual(["text"]);
    expect((out[0] as Anthropic.TextBlockParam).text).toBe("They do inheritance tax planning.");
  });

  it("leaves a reply without thinking as it was", () => {
    const content = [{ type: "text", text: "A tax firm.", citations: null }] as unknown as Anthropic.ContentBlock[];
    expect(carriedForward(content)).toEqual(content);
  });
});
