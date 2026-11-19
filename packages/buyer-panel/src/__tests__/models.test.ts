import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { deviceOptions, phoneWidth } from "../browser.js";
import { rejectsSampling, samplingFor, validatePanel, type Panel } from "../config.js";
import { priceFor } from "../pricing.js";

const raw = JSON.parse(readFileSync(fileURLToPath(new URL("../../panels/dd-live-build.json", import.meta.url)), "utf8")) as Panel;
const opus55 = (extra: object = {}) => ({ id: "a", provider: "anthropic" as const, model: "claude-opus-5-5", ...extra });

describe("Opus 5.5 and other models that reject sampling", () => {
  it("knows which models reject temperature", () => {
    for (const m of ["claude-opus-5-5", "claude-opus-5", "claude-opus-4-7", "claude-opus-4-8", "claude-sonnet-5-5", "claude-haiku-5-5", "claude-fable-5-2"]) expect(rejectsSampling(m)).toBe(true);
    for (const m of ["eu.anthropic.claude-haiku-4-5-20251001-v1:0", "eu.anthropic.claude-sonnet-4-6", "claude-opus-4-6", "qwen.qwen3-vl-235b-a22b"]) expect(rejectsSampling(m)).toBe(false);
  });
  it("drops an injected temperature for such a model and keeps it for the rest", () => {
    expect(samplingFor({ model: "claude-opus-5-5", temperature: 0 })).toEqual({});
    expect(samplingFor({ model: "eu.anthropic.claude-sonnet-4-6", temperature: 0 })).toEqual({ temperature: 0 });
    expect(samplingFor({ model: "eu.anthropic.claude-sonnet-4-6" })).toEqual({});
  });
  it("prices Opus 5.5 at the first-party list price, with its 0.05x cache read", () => {
    expect(priceFor("claude-opus-5-5")).toMatchObject({ input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 });
  });
  it("loads an Opus 5.5 panel with no temperature, and refuses one that names a temperature it cannot send", () => {
    const ok = { ...raw, variants: [opus55(), opus55({ id: "b" })], evaluator: { provider: "anthropic" as const, model: "claude-opus-5-5" } };
    expect(validatePanel(ok, "/base", { allowOpus: true }).variants).toHaveLength(2);
    expect(() => validatePanel({ ...ok, variants: [opus55({ temperature: 1 }), opus55({ id: "b" })] }, "/base", { allowOpus: true })).toThrow(/rejects temperature/);
    expect(() => validatePanel({ ...ok, evaluator: { ...ok.evaluator, temperature: 0 } }, "/base", { allowOpus: true })).toThrow(/rejects temperature/);
  });
});

describe("phone viewport", () => {
  it("defaults to the 390 iPhone and takes a panel's own size", () => {
    expect(phoneWidth({})).toBe(390);
    const o = deviceOptions({ phoneViewport: { width: 375, height: 667 } }, "phone");
    expect(o?.viewport).toEqual({ width: 375, height: 667 });
    expect(o?.isMobile).toBe(true);
    expect(o?.hasTouch).toBe(true);
    expect(deviceOptions({ phoneViewport: { width: 375, height: 667 } }, "desktop")?.viewport).toEqual({ width: 1440, height: 900 });
  });
  it("refuses a phone viewport that is not a phone", () => {
    expect(validatePanel({ ...raw, phoneViewport: { width: 375, height: 667 } }, "/base").phoneViewport).toEqual({ width: 375, height: 667 });
    expect(() => validatePanel({ ...raw, phoneViewport: { width: 1024, height: 768 } }, "/base")).toThrow(/phoneViewport/);
  });
});
