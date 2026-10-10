import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { pruneHistory, type SessionRecord } from "../buyer.js";
import { validatePanel, type Panel } from "../config.js";
import { checkEvidence, reproduction, type SessionRef } from "../evaluate.js";
import { htmlToText } from "../grading-context.js";
import { pool, runIdFor } from "../run.js";

const ref = (profile: string, device: string, variant: string): SessionRef => ({ id: `${profile}-${device}-${variant}`, profile, device, variant });

describe("reproduction", () => {
  it("reproduces when two profiles show the finding", () => {
    expect(reproduction([ref("clinic", "phone", "a"), ref("salon", "desktop", "b")], ["a", "b"]).reproduces).toBe(true);
  });
  it("reproduces when both runs of one profile show it, on any device", () => {
    expect(reproduction([ref("clinic", "phone", "a"), ref("clinic", "desktop", "b")], ["a", "b"]).reproduces).toBe(true);
  });
  it("does not reproduce from one run of one profile, even on both devices", () => {
    const r = reproduction([ref("clinic", "phone", "a"), ref("clinic", "desktop", "a")], ["a", "b"]);
    expect(r.reproduces).toBe(false);
    expect(r.why).toContain("clinic run a");
  });
  it("does not reproduce from a single session", () => {
    expect(reproduction([ref("sceptic", "phone", "b")], ["a", "b"]).reproduces).toBe(false);
  });
});

const record = (): SessionRecord => ({
  id: "clinic-phone-a",
  profile: "clinic",
  device: "phone",
  variant: { id: "a", model: "m" },
  startedAt: "",
  durationMs: 0,
  firstImpression: { question: "", answer: "", screenshot: "fold-390.jpg" },
  start: { url: "https://x.test/", title: "Home", visible: "[heading 1] Websites we build and keep running\n[link] Pricing", screenshot: "step-00.jpg" },
  steps: [{ n: 1, thought: "", action: "click", input: { target: "Pricing" }, result: "", url: "https://x.test/pricing", title: "Pricing", scrolledPct: 0, visible: "[heading 1] Two ways to pay\n[text] From £1,500 one-off", screenshot: "step-01.jpg" }],
  problems: [
    { n: 1, step: 1, kind: "confused", what: "", element: "Two ways to pay", resolved: true, url: "https://x.test/pricing", screenshot: "problem-01.jpg" },
    { n: 2, step: 1, kind: "cannot_find", what: "", element: "monthly price", resolved: false, url: "https://x.test/pricing", screenshot: "problem-02.jpg" },
  ],
  endReason: "finished",
  usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0 },
});

describe("checkEvidence", () => {
  it("keeps a finding whose element is on the cited screen, with that screen's screenshot", () => {
    expect(checkEvidence(record(), "S1", "“Two ways to pay”")).toEqual({ ok: true, url: "https://x.test/pricing", screenshot: "step-01.jpg" });
    expect(checkEvidence(record(), "s0", "Websites we build")).toMatchObject({ ok: true, screenshot: "step-00.jpg" });
  });
  it("drops a finding whose element is not on the cited screen", () => {
    expect(checkEvidence(record(), "S0", "Two ways to pay")).toMatchObject({ ok: false });
  });
  it("keeps a buyer problem only when its element was found on the page", () => {
    expect(checkEvidence(record(), "P1", "Two ways to pay")).toMatchObject({ ok: true, screenshot: "problem-01.jpg" });
    expect(checkEvidence(record(), "P2", "monthly price")).toMatchObject({ ok: false });
  });
  it("drops a finding without a usable reference or element", () => {
    expect(checkEvidence(record(), "step 1", "Pricing")).toMatchObject({ ok: false });
    expect(checkEvidence(record(), "S9", "Pricing")).toMatchObject({ ok: false });
    expect(checkEvidence(record(), "S1", "")).toMatchObject({ ok: false });
  });
});

describe("pruneHistory", () => {
  it("keeps the latest two screenshots and screen texts, and blanks the older ones", () => {
    const img: Anthropic.ImageBlockParam = { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "x" } };
    const result = (i: number): Anthropic.MessageParam => ({ role: "user", content: [{ type: "tool_result", tool_use_id: `t${i}`, content: [img, { type: "text", text: `Result: ok\nOn screen:\nscreen ${i}` }] }] });
    const messages: Anthropic.MessageParam[] = [result(1), { role: "assistant", content: "a" }, result(2), { role: "assistant", content: "b" }, result(3)];
    pruneHistory(messages);
    const texts = messages.map((m) => JSON.stringify(m.content));
    expect(texts[0]).toContain("(earlier screenshot)");
    expect(texts[0]).not.toContain("screen 1");
    expect(texts[2]).toContain("screen 2");
    expect(texts[4]).toContain("screen 3");
  });
});

describe("config", () => {
  const panelFile = fileURLToPath(new URL("../../panels/dd-redesign.json", import.meta.url));
  const raw = JSON.parse(readFileSync(panelFile, "utf8")) as Panel;
  it("accepts the DD redesign panel: five profiles, two variants, both devices", () => {
    const p = validatePanel(raw, "/base");
    expect(p.profiles).toHaveLength(5);
    expect(p.variants).toHaveLength(2);
    expect(p.devices).toEqual(["desktop", "phone"]);
    expect(p.archive).toMatch(/dd-client-capsule$/);
  });
  it("refuses a panel with one variant, since nothing could reproduce within a profile", () => {
    expect(() => validatePanel({ ...raw, variants: [raw.variants[0]!] })).toThrow(/two variants/);
  });
  it("keeps the buyer's persona free of the business's own facts", () => {
    for (const p of raw.profiles) expect(`${p.persona} ${p.task}`).not.toMatch(/Doman|managed plan|Build|Run\b/);
  });
});

describe("helpers", () => {
  it("names a run by version and minute", () => {
    expect(runIdFor("ec2e8424-120b-442c-b568-52d0657809a7", new Date("2026-10-10T09:05:00Z"))).toBe("ec2e8424-2026-10-10T0905");
  });
  it("turns the journey map's HTML into text", () => {
    expect(htmlToText("<style>x{}</style><h2>Door 1 &middot; I need a website</h2><p>Form first,&nbsp;booking optional.</p>")).toBe("Door 1 · I need a website\nForm first, booking optional.");
  });
  it("runs a pool in order with a limit", async () => {
    let live = 0;
    let peak = 0;
    const out = await pool([1, 2, 3, 4, 5], 2, async (n) => {
      live++;
      peak = Math.max(peak, live);
      await new Promise((r) => setTimeout(r, 5));
      live--;
      return n * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10]);
    expect(peak).toBe(2);
  });
});
