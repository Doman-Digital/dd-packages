import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { chromium } from "playwright";
import { BrowserSession, DEVICE_OPTIONS, type Observation } from "./browser.js";
import type { Device, Panel, Profile, Variant } from "./config.js";
import { addUsage, clientFor, emptyUsage, textOf, type Usage } from "./model.js";

export interface Step {
  n: number;
  thought: string;
  action: string;
  input: Record<string, string>;
  result: string;
  url: string;
  title: string;
  scrolledPct: number;
  visible: string;
  screenshot: string;
}

export interface Problem {
  n: number;
  /** The step whose screen the buyer was looking at (0 = the starting screen). */
  step: number;
  kind: string;
  what: string;
  element: string;
  resolved: boolean;
  box?: { x: number; y: number; width: number; height: number };
  url: string;
  screenshot: string;
}

export interface Finish {
  outcome: "done" | "gave_up";
  answer: string;
  next_step: string;
  cost_understanding: string;
  trust: string;
}

export interface SessionRecord {
  id: string;
  profile: string;
  device: Device;
  variant: Variant;
  startedAt: string;
  durationMs: number;
  firstImpression: { question: string; answer: string; screenshot: string };
  start: { url: string; title: string; visible: string; screenshot: string };
  steps: Step[];
  problems: Problem[];
  finish?: Finish;
  endReason: "finished" | "budget" | "turns" | "error";
  error?: string;
  usage: Usage;
}

export const sessionId = (profile: string, device: Device, variant: string): string => `${profile}-${device}-${variant}`;

const SYSTEM = (persona: string, device: Device): string => `${persona.trim()}

You are on a company's website on your ${device === "phone" ? "phone" : "laptop"}, deciding whether they could help you. Act as you would in real life: you have limited time and patience, you only know what the pages in front of you say, and you do not know how this site is organised. Before each action, say in one or two sentences, in your own voice, what you are thinking.

You browse with the tools: click something by its visible text, scroll, go back, or type into a form field. After each action you get a picture of your screen and the text on it.
Whenever something confuses you, puts you off, seems to contradict something you read earlier, or you cannot find what you are looking for, call note_problem at once, quoting the exact text on screen it is about. When you have done what you came to do, or when you would give up in real life, call finish.`;

const str = (description: string) => ({ type: "string" as const, description });

export const BUYER_TOOLS: Anthropic.Tool[] = [
  {
    name: "click",
    description: "Click or tap a link, button, menu or anything else on screen, named by its visible text.",
    input_schema: { type: "object", properties: { target: str("The visible text of what you click, exactly as shown.") }, required: ["target"] },
  },
  {
    name: "scroll",
    description: "Scroll the page by about one screen.",
    input_schema: { type: "object", properties: { direction: { type: "string", enum: ["down", "up"] } }, required: ["direction"] },
  },
  { name: "back", description: "Go back to the previous page.", input_schema: { type: "object", properties: {} } },
  {
    name: "type",
    description: "Type into a form field, named by its label.",
    input_schema: { type: "object", properties: { field: str("The field's label as shown."), text: str("What you type.") }, required: ["field", "text"] },
  },
  {
    name: "note_problem",
    description: "Record something that confused you, put you off, contradicted something else, or that you could not find. Does not use up an action.",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["confused", "cannot_find", "put_off", "contradiction", "broken", "doubt"] },
        what: str("What the problem is, in your own words."),
        element: str("The exact text on screen the problem is about (a heading, link, button, price or sentence). If something is missing, the text of the place where you expected it."),
      },
      required: ["kind", "what", "element"],
    },
  },
  {
    name: "finish",
    description: "Stop browsing: you have done what you came to do, or you would give up now in real life.",
    input_schema: {
      type: "object",
      properties: {
        outcome: { type: "string", enum: ["done", "gave_up"] },
        answer: str("What you found out, in your own words, as you would tell a friend."),
        next_step: str("What you would actually do next, if anything."),
        cost_understanding: str("What you think this would cost you and how you would pay, as you understood it. Say if you could not tell."),
        trust: str("Whether you trust them enough to get in touch, and why or why not."),
      },
      required: ["outcome", "answer", "next_step", "cost_understanding", "trust"],
    },
  },
];

const BROWSING = new Set(["click", "scroll", "back", "type"]);

type Content = Anthropic.ContentBlockParam;

const image = (buf: Buffer): Anthropic.ImageBlockParam => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: buf.toString("base64") } });

const describe = (o: Observation, result?: string): string =>
  [
    result ? `Result: ${result}` : undefined,
    `Page: ${o.title} (${o.url})`,
    `Position: ${o.atBottom ? "at the bottom of the page" : `${o.scrolledPct}% down the page`}`,
    "On screen:",
    o.visible || "(nothing readable)",
  ]
    .filter(Boolean)
    .join("\n");

/**
 * Keeps the conversation affordable: only the latest two screenshots and screen texts stay in full. The buyer's own
 * words stay, so it remembers what it saw the way a person does, by what it thought at the time.
 */
export function pruneHistory(messages: Anthropic.MessageParam[], keep = 2): void {
  let seen = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (m.role !== "user" || !Array.isArray(m.content)) continue;
    const hasShot = m.content.some((b) => b.type === "image" || (b.type === "tool_result" && Array.isArray(b.content) && b.content.some((c) => c.type === "image")));
    if (!hasShot) continue;
    seen++;
    if (seen <= keep) continue;
    m.content = m.content.map((b): Content => {
      if (b.type === "image") return { type: "text", text: "(earlier screenshot)" };
      if (b.type === "tool_result" && Array.isArray(b.content)) {
        return {
          ...b,
          content: b.content.map((c) =>
            c.type === "image" ? { type: "text" as const, text: "(earlier screenshot)" } : c.type === "text" ? { ...c, text: c.text.replace(/On screen:\n[\s\S]*$/, "On screen: (earlier screen)") } : c,
          ),
        };
      }
      if (b.type === "text" && b.text.includes("On screen:\n")) return { ...b, text: b.text.replace(/On screen:\n[\s\S]*$/, "On screen: (earlier screen)") };
      return b;
    });
  }
}

async function foldScreenshot(panel: Panel, cookie: string | undefined): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ ...DEVICE_OPTIONS.phone, locale: "en-GB", timezoneId: "Europe/London" });
    if (cookie) await context.addCookies([{ name: "CF_Authorization", value: cookie, domain: new URL(panel.target.origin).hostname, path: "/", secure: true, httpOnly: true, sameSite: "None" }]);
    const page = await context.newPage();
    await page.goto(new URL(panel.target.start, panel.target.origin).toString(), { waitUntil: "load" });
    await page.waitForTimeout(500);
    return await page.screenshot({ type: "jpeg", quality: 70, scale: "css" });
  } finally {
    await browser.close();
  }
}

export interface RunSessionOptions {
  panel: Panel;
  profile: Profile;
  device: Device;
  variant: Variant;
  dir: string;
  cookie: string | undefined;
  log?: (line: string) => void;
}

export async function runSession(o: RunSessionOptions): Promise<SessionRecord> {
  const { panel, profile, device, variant, dir } = o;
  const log = o.log ?? (() => undefined);
  mkdirSync(dir, { recursive: true });
  const id = sessionId(profile.id, device, variant.id);
  const usage = emptyUsage();
  const t0 = Date.now();
  const rec: SessionRecord = {
    id,
    profile: profile.id,
    device,
    variant,
    startedAt: new Date(t0).toISOString(),
    durationMs: 0,
    firstImpression: { question: panel.firstImpressionQuestion, answer: "", screenshot: "fold-390.jpg" },
    start: { url: "", title: "", visible: "", screenshot: "step-00.jpg" },
    steps: [],
    problems: [],
    endReason: "error",
    usage,
  };
  const save = () => writeFileSync(join(dir, "session.json"), JSON.stringify(rec, null, 1));
  const client = clientFor(variant);
  const call = async (messages: Anthropic.MessageParam[], tools?: Anthropic.Tool[]): Promise<Anthropic.Message> => {
    const res = await client.messages.create({
      model: variant.model,
      max_tokens: 1500,
      ...(variant.temperature === undefined ? {} : { temperature: variant.temperature }),
      system: SYSTEM(profile.persona, device),
      messages,
      ...(tools ? { tools, tool_choice: { type: "auto" as const, disable_parallel_tool_use: true } } : {}),
    });
    addUsage(usage, res);
    return res;
  };

  let session: BrowserSession | undefined;
  try {
    // 1. First impression, from the 390 fold alone, before any scrolling and before the task.
    const fold = await foldScreenshot(panel, o.cookie);
    writeFileSync(join(dir, "fold-390.jpg"), fold);
    const messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: [
          image(fold),
          { type: "text", text: `You have just opened a link to this website on your phone. This is the first screen; you have not scrolled or tapped anything. ${panel.firstImpressionQuestion} Answer in two or three sentences, in your own words.` },
        ],
      },
    ];
    const first = await call(messages);
    rec.firstImpression.answer = textOf(first);
    messages.push({ role: "assistant", content: first.content });
    log(`${id}: first impression recorded`);

    // 2. The task, on the session's own device, from the start page.
    session = await BrowserSession.open(panel, device, o.cookie, true);
    await session.goto(panel.target.start);
    const startObs = await session.observe();
    writeFileSync(join(dir, "step-00.jpg"), startObs.screenshot);
    rec.start = { url: startObs.url, title: startObs.title, visible: startObs.visible, screenshot: "step-00.jpg" };
    messages.push({
      role: "user",
      content: [
        { type: "text", text: `${device === "phone" ? "Still on your phone" : "Later, at your laptop, you open the same website"}. ${profile.task.trim()}` },
        image(startObs.screenshot),
        { type: "text", text: describe(startObs) },
      ],
    });

    let steps = 0;
    let lastObs = startObs;
    const maxTurns = panel.stepBudget * 2 + 6;
    for (let turn = 0; turn < maxTurns; turn++) {
      pruneHistory(messages);
      const res = await call(messages, BUYER_TOOLS);
      messages.push({ role: "assistant", content: res.content });
      const thought = textOf(res);
      const use = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (!use) {
        if (res.stop_reason === "refusal") throw new Error("buyer model refused");
        messages.push({ role: "user", content: "Carry on with a tool: act on the page, note a problem, or finish." });
        continue;
      }
      const input = (use.input ?? {}) as Record<string, string>;

      if (use.name === "finish") {
        rec.finish = input as unknown as Finish;
        rec.endReason = "finished";
        break;
      }

      if (use.name === "note_problem") {
        const n = rec.problems.length + 1;
        const ev = await session.evidence(String(input.element ?? ""));
        const file = `problem-${String(n).padStart(2, "0")}.jpg`;
        writeFileSync(join(dir, file), ev.screenshot);
        rec.problems.push({ n, step: steps, kind: String(input.kind ?? ""), what: String(input.what ?? ""), element: String(input.element ?? ""), resolved: ev.resolved, box: ev.box, url: session.page.url(), screenshot: file });
        log(`${id}: problem ${n} (${input.kind}) ${ev.resolved ? "" : "[element not found]"}`);
        messages.push({
          role: "user",
          content: [{ type: "tool_result", tool_use_id: use.id, content: ev.resolved ? "Noted." : `Noted, but no text on screen matches "${input.element}". Quote the exact text you mean if you note it again.` }],
        });
        save();
        continue;
      }

      if (!BROWSING.has(use.name) || steps >= panel.stepBudget) {
        messages.push({
          role: "user",
          content: [{ type: "tool_result", tool_use_id: use.id, is_error: true, content: steps >= panel.stepBudget ? "You are out of time: you would put this down now. Call finish." : `Unknown action ${use.name}.` }],
        });
        if (steps >= panel.stepBudget) rec.endReason = "budget";
        continue;
      }

      steps++;
      let result: string;
      if (use.name === "click") result = await session.click(String(input.target ?? ""));
      else if (use.name === "scroll") result = await session.scroll(input.direction === "up" ? "up" : "down");
      else if (use.name === "back") result = await session.back();
      else result = await session.type(String(input.field ?? ""), String(input.text ?? ""));
      lastObs = await session.observe();
      const file = `step-${String(steps).padStart(2, "0")}.jpg`;
      writeFileSync(join(dir, file), lastObs.screenshot);
      rec.steps.push({ n: steps, thought, action: use.name, input, result, url: lastObs.url, title: lastObs.title, scrolledPct: lastObs.scrolledPct, visible: lastObs.visible, screenshot: file });
      log(`${id}: step ${steps} ${use.name} ${JSON.stringify(input).slice(0, 80)}`);
      const left = panel.stepBudget - steps;
      const nudge = left === 3 ? "\n(You have time for about three more actions.)" : left === 0 ? "\n(That was your last action: note any problem, then finish.)" : "";
      messages.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: use.id, content: [image(lastObs.screenshot), { type: "text", text: describe(lastObs, result) + nudge }] }],
      });
      save();
    }
    if (!rec.finish && rec.endReason === "error") rec.endReason = steps >= panel.stepBudget ? "budget" : "turns";
  } catch (e) {
    rec.endReason = "error";
    rec.error = (e as Error).message;
    log(`${id}: error ${rec.error}`);
  } finally {
    await session?.close(join(dir, "trace.zip"));
    rec.durationMs = Date.now() - t0;
    save();
  }
  return rec;
}
