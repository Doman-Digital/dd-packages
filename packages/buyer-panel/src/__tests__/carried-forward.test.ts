import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { carriedForward } from "../buyer.js";

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
