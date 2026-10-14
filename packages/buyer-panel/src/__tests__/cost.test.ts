import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { pruneHistory, type SessionRecord } from "../buyer.js";
import { validatePanel, type Panel } from "../config.js";
import { addUsage, emptyUsage, withCaching } from "../model.js";
import { costOf, priceFor, SpendMeter } from "../pricing.js";
import { fromConverse, toConverse } from "../providers/converse.js";
import { hoistToolImages } from "../providers/shared.js";
import { fromOpenAI, toOpenAI } from "../providers/workers-ai.js";
import { renderReport, type RunMeta, type RunReport } from "../report.js";
import { usageWithCost } from "../run.js";

const HAIKU = "eu.anthropic.claude-haiku-4-5-20251001-v1:0";
const img = { type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data: Buffer.from("jpg").toString("base64") } };

/** A buyer conversation: the fold, the task, then n actions each answered with a screenshot. */
const conversation = (n: number): Anthropic.MessageParam[] => {
  const m: Anthropic.MessageParam[] = [
    { role: "user", content: [img, { type: "text", text: "First impression?" }] },
    { role: "assistant", content: [{ type: "text", text: "A salon." }] },
    { role: "user", content: [{ type: "text", text: "Task" }, img, { type: "text", text: "Page: Home\nOn screen:\nHello" }] },
  ];
  for (let i = 1; i <= n; i++) {
    m.push({ role: "assistant", content: [{ type: "text", text: `thought ${i}` }, { type: "tool_use", id: `t${i}`, name: "click", input: { target: "Book" } }] });
    m.push({ role: "user", content: [{ type: "tool_result", tool_use_id: `t${i}`, content: [img, { type: "text", text: `Result\nOn screen:\nscreen ${i}` }] }] });
  }
  return m;
};

describe("price table", () => {
  it("prices Haiku 4.5 at 1 in, 5 out, 0.1x cache reads and 1.25x cache writes per million", () => {
    expect(costOf(HAIKU, { input: 1e6, output: 0, cacheRead: 0, cacheWrite: 0 })).toBeCloseTo(1);
    expect(costOf(HAIKU, { input: 0, output: 1e6, cacheRead: 0, cacheWrite: 0 })).toBeCloseTo(5);
    expect(costOf(HAIKU, { input: 0, output: 0, cacheRead: 1e6, cacheWrite: 0 })).toBeCloseTo(0.1);
    expect(costOf(HAIKU, { input: 0, output: 0, cacheRead: 0, cacheWrite: 1e6 })).toBeCloseTo(1.25);
  });
  it("has a price for each model of the bake-off", () => {
    for (const m of ["eu.anthropic.claude-sonnet-4-6", "qwen.qwen3-vl-235b-a22b", "moonshotai.kimi-k2.5", "@cf/meta/llama-4-scout-17b-16e-instruct", "@cf/mistralai/mistral-small-3.1-24b-instruct"]) {
      expect(priceFor(m).input).toBeGreaterThan(0);
    }
    expect(costOf("@cf/meta/llama-4-scout-17b-16e-instruct", { input: 1e6, output: 1e6, cacheRead: 0, cacheWrite: 0 })).toBeCloseTo(0.27 + 0.85);
  });
  it("refuses a model with no price, so a cap never runs blind", () => {
    expect(() => priceFor("some.new-model")).toThrow(/add it to PRICES/);
  });
  it("makes a panel with an unpriced model invalid", () => {
    const panel = JSON.parse(JSON.stringify(basePanel)) as Panel;
    panel.variants[0]!.model = "some.new-model";
    expect(() => validatePanel(panel)).toThrow(/no price/);
  });
});

describe("usage and the spend meter", () => {
  const reply = (u: Partial<Record<string, number>>) => ({ usage: { input_tokens: 0, output_tokens: 0, ...u } }) as unknown as Anthropic.Message;
  it("adds cache tokens and cost to the usage record and the meter", () => {
    const u = emptyUsage();
    const meter = new SpendMeter(1);
    addUsage(u, reply({ input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 8000, cache_creation_input_tokens: 2000 }), HAIKU, meter);
    expect(u).toMatchObject({ input: 1000, output: 100, cacheRead: 8000, cacheWrite: 2000, calls: 1 });
    expect(u.usd).toBeCloseTo((1000 + 500 + 800 + 2500) / 1e6);
    expect(meter.spent).toBeCloseTo(u.usd!);
  });
  it("is exceeded at the cap, and says it hit only when it cut something", () => {
    const meter = new SpendMeter(0.01);
    expect(meter.exceeded).toBe(false);
    meter.add(0.01);
    expect(meter.exceeded).toBe(true);
    expect(meter.hit).toBe(false);
    meter.cut.push("a-phone-a");
    expect(meter.hit).toBe(true);
  });
});

describe("usageWithCost", () => {
  const rec = (usage: SessionRecord["usage"]) => ({ variant: { id: "a", model: HAIKU }, usage }) as SessionRecord;
  it("prices a record from before costs were kept, and keeps one that has its cost", () => {
    expect(usageWithCost(rec({ input: 1e6, output: 0, cacheRead: 0, cacheWrite: 0, calls: 1 })).usd).toBeCloseTo(1);
    expect(usageWithCost(rec({ input: 1e6, output: 0, cacheRead: 0, cacheWrite: 0, calls: 1, usd: 0.42 })).usd).toBe(0.42);
  });
});

describe("withCaching", () => {
  const cc = (b: unknown) => (b as { cache_control?: unknown }).cache_control;
  it("checkpoints the system prompt and the end of the conversation without touching the original", () => {
    const messages = conversation(1);
    const out = withCaching({ max_tokens: 10, system: "persona", messages });
    expect(Array.isArray(out.system) && cc(out.system[0])).toEqual({ type: "ephemeral" });
    const lastContent = out.messages.at(-1)!.content as Anthropic.ContentBlockParam[];
    expect(cc(lastContent.at(-1))).toEqual({ type: "ephemeral" });
    expect(JSON.stringify(messages)).not.toContain("cache_control");
  });
  it("adds one checkpoint just before the first screenshot still in full, three in all", () => {
    const messages = conversation(4);
    messages[0] = { role: "user", content: [{ type: "text", text: "(earlier screenshot) First impression?" }] };
    const out = withCaching({ max_tokens: 10, system: "persona", messages });
    const marked = out.messages.map((m, i) => (Array.isArray(m.content) && m.content.some((b) => cc(b)) ? i : -1)).filter((i) => i >= 0);
    expect(marked).toEqual([1, out.messages.length - 1]);
    expect(1 + marked.length).toBeLessThanOrEqual(4);
  });
  it("in system mode leaves the conversation alone", () => {
    const messages = conversation(1);
    const out = withCaching({ max_tokens: 10, system: [{ type: "text", text: "grader" }], messages }, "system");
    expect(out.messages).toBe(messages);
    expect(cc((out.system as Anthropic.TextBlockParam[])[0])).toEqual({ type: "ephemeral" });
  });
});

describe("pruneHistory in strides", () => {
  const full = (m: Anthropic.MessageParam[]) => m.filter((x) => JSON.stringify(x).includes('"type":"image"')).length;
  it("keeps the latest two screens when slack is 0", () => {
    const m = conversation(5);
    pruneHistory(m, 2, 0);
    expect(full(m)).toBe(2);
  });
  it("leaves history alone until it passes keep plus slack, then prunes down to keep", () => {
    const m = conversation(2); // fold, start, two steps = 4 screens
    const before = JSON.stringify(m);
    pruneHistory(m, 2, 3);
    expect(JSON.stringify(m)).toBe(before);
    const longer = conversation(4); // 6 screens > 5
    pruneHistory(longer, 2, 3);
    expect(full(longer)).toBe(2);
  });
});

const basePanel = {
  name: "t",
  client: "t",
  target: { origin: "https://x.test", start: "/" },
  archive: "/tmp/x",
  stepBudget: 10,
  devices: ["phone"],
  variants: [
    { id: "a", model: HAIKU },
    { id: "b", model: HAIKU },
  ],
  evaluator: { model: "eu.anthropic.claude-sonnet-4-6" },
  firstImpressionQuestion: "q",
  profiles: [{ id: "p", label: "p", persona: "p", task: "t" }],
  grading: { journeyMap: "j", brandFacts: { path: "b", include: [] }, knownStates: [] },
} as unknown as Panel;

describe("Converse adapter", () => {
  const tool: Anthropic.Tool = { name: "click", description: "Click", input_schema: { type: "object", properties: { target: { type: "string" } }, required: ["target"] } };
  it("translates a buyer conversation: system, images, tool use and results, with tool-result images moved out", () => {
    const req = toConverse({ model: "m", max_tokens: 100, temperature: 0, system: "persona", messages: conversation(1), tools: [tool], tool_choice: { type: "auto" } });
    expect(req.system).toEqual([{ text: "persona" }]);
    expect(req.inferenceConfig).toEqual({ maxTokens: 100, temperature: 0 });
    expect(req.toolConfig?.tools?.[0]?.toolSpec?.name).toBe("click");
    const last = req.messages!.at(-1)!;
    expect(last.role).toBe("user");
    expect(last.content![0]!.toolResult?.toolUseId).toBe("t1");
    expect(last.content![0]!.toolResult?.content?.every((c) => c.text !== undefined)).toBe(true);
    expect(last.content!.some((c) => c.image?.format === "jpeg")).toBe(true);
    expect(req.messages![3]!.content!.find((c) => c.toolUse)?.toolUse?.input).toEqual({ target: "Book" });
  });
  it("turns a reply into an Anthropic message with usage, dropping reasoning and a second tool call", () => {
    const msg = fromConverse("m", {
      output: { message: { role: "assistant", content: [{ reasoningContent: { reasoningText: { text: "hmm" } } }, { text: "Tapping Book." }, { toolUse: { toolUseId: "a", name: "click", input: { target: "Book" } } }, { toolUse: { toolUseId: "b", name: "scroll", input: {} } }] } },
      stopReason: "tool_use",
      usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
    });
    expect(msg.stop_reason).toBe("tool_use");
    expect(msg.content.map((b) => b.type)).toEqual(["text", "tool_use"]);
    expect(msg.usage).toMatchObject({ input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 0 });
  });
  it("reads a content filter as a refusal", () => {
    expect(fromConverse("m", { output: { message: { role: "assistant", content: [] } }, stopReason: "content_filtered", usage: { inputTokens: 1, outputTokens: 0, totalTokens: 1 } }).stop_reason).toBe("refusal");
  });
});

describe("Workers AI adapter", () => {
  it("translates a buyer conversation to OpenAI chat messages", () => {
    const req = toOpenAI({ model: "@cf/x", max_tokens: 50, system: "persona", messages: conversation(1), tools: [{ name: "click", description: "Click", input_schema: { type: "object", properties: {} } }], tool_choice: { type: "auto" } });
    expect(req.messages[0]).toEqual({ role: "system", content: "persona" });
    expect(req.messages[1]!.role).toBe("user");
    expect(Array.isArray(req.messages[1]!.content)).toBe(true);
    const asst = req.messages.find((m) => m.role === "assistant" && "tool_calls" in m);
    expect(asst).toMatchObject({ tool_calls: [{ id: "t1", type: "function", function: { name: "click", arguments: '{"target":"Book"}' } }] });
    const tail = req.messages.slice(-2);
    expect(tail[0]).toMatchObject({ role: "tool", tool_call_id: "t1" });
    expect(tail[1]!.role).toBe("user");
    expect(JSON.stringify(tail[1])).toContain("data:image/jpeg;base64,");
    expect(req.tool_choice).toBe("required");
  });
  it("puts one assistant line between a tool result and the next user turn for a model that needs it", () => {
    const roles = (o: { bridge?: string }) => toOpenAI({ model: "@cf/x", max_tokens: 50, messages: conversation(1) }, o).messages.map((m) => m.role);
    expect(roles({}).slice(-2)).toEqual(["tool", "user"]);
    expect(roles({ bridge: "(The screen has changed.)" }).slice(-3)).toEqual(["tool", "assistant", "user"]);
  });
  it("turns a reply into an Anthropic message, parsing the tool arguments", () => {
    const msg = fromOpenAI("@cf/x", { choices: [{ message: { content: "Looking.", tool_calls: [{ id: "c1", function: { name: "click", arguments: '{"target":"Book"}' } }] }, finish_reason: "tool_calls" }], usage: { prompt_tokens: 900, completion_tokens: 30 } });
    expect(msg.stop_reason).toBe("tool_use");
    expect(msg.content[1]).toMatchObject({ type: "tool_use", id: "c1", name: "click", input: { target: "Book" } });
    expect(msg.usage.input_tokens).toBe(900);
  });
  it("survives arguments that are not JSON", () => {
    const msg = fromOpenAI("@cf/x", { choices: [{ message: { content: null, tool_calls: [{ function: { name: "click", arguments: "{oops" } }] } }] });
    expect(msg.content[0]).toMatchObject({ type: "tool_use", input: {} });
  });
});

describe("hoistToolImages", () => {
  it("moves images out of tool results, after the results", () => {
    const [m] = hoistToolImages([{ role: "user", content: [{ type: "tool_result", tool_use_id: "t", content: [img, { type: "text", text: "ok" }] }] }]);
    const c = m!.content as Anthropic.ContentBlockParam[];
    expect(c.map((b) => b.type)).toEqual(["tool_result", "text", "image"]);
  });
});

describe("the report's cost record and spend cap", () => {
  const usage = (usd: number) => ({ input: 10, output: 5, cacheRead: 700, cacheWrite: 200, calls: 3, usd });
  const meta = (cap?: RunMeta["cap"]): RunMeta => ({
    runId: "r",
    panel: "p",
    client: "c",
    target: "https://x.test/",
    version: "abcdef12",
    label: "",
    ranAt: "2026-10-14T00:00:00Z",
    stepBudget: 10,
    variants: [{ id: "a", model: HAIKU }],
    evaluator: { model: "eu.anthropic.claude-sonnet-4-6" },
    usage: { buyers: usage(0.5), evaluator: usage(0.25) },
    ...(cap ? { cap } : {}),
  });
  const report = (m: RunMeta): RunReport => ({ meta: m, sessions: [{ id: "s-phone-a", profile: "s", device: "phone", variant: "a", endReason: "capped", steps: 3, problems: 0 }], grades: [], clusters: [], findings: [], dropped: [] });
  it("shows cache reads and writes and the estimated cost", () => {
    const md = renderReport(report(meta()), []);
    expect(md).toContain("700 cache-read, 200 cache-write");
    expect(md).toContain("about $0.50");
    expect(md).toContain("Estimated total $0.75");
  });
  it("says the cap was hit and which sessions it cut", () => {
    const md = renderReport(report(meta({ maxUsd: 0.7, hit: true, spentUsd: 0.75, cut: ["s-phone-a"], notStarted: ["t-phone-a"], notGraded: [] })), []);
    expect(md).toContain("Spend cap reached");
    expect(md).toContain("Cut while running: s-phone-a");
    expect(md).toContain("Not started: t-phone-a");
    expect(md).toContain("1 cut by the spend cap");
  });
  it("says nothing about a cap that was not hit", () => {
    expect(renderReport(report(meta({ maxUsd: 3, hit: false, spentUsd: 0.75, cut: [], notStarted: [], notGraded: [] })), [])).not.toContain("Spend cap reached");
  });
});
