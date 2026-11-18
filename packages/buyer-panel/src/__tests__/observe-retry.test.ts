import { describe, expect, it } from "vitest";
import { BrowserSession } from "../browser.js";

// A stand-in page: its first screen reads fail the way Playwright fails when a late navigation replaces the page
// mid-read, then the new page reads normally.
function sessionWith(failures: number, message = "page.evaluate: Execution context was destroyed, most likely because of a navigation") {
  let reads = 0;
  const page = {
    evaluate: async () => {
      reads++;
      if (reads <= failures) throw new Error(message);
      return { lines: ["[heading 1] The new page"], scrolledPct: 0, atBottom: true };
    },
    waitForLoadState: async () => undefined,
    waitForTimeout: async () => undefined,
    url: () => "http://127.0.0.1:1/next",
    title: async () => "Next",
    screenshot: async () => Buffer.from(""),
  };
  const s = Object.create(BrowserSession.prototype) as BrowserSession;
  Object.assign(s, { page, accessProblems: undefined });
  return { s, reads: () => reads };
}

describe("screen read during a late navigation", () => {
  it("waits for the new page and reads it, instead of ending the session", async () => {
    const { s, reads } = sessionWith(2);
    const obs = await s.observe();
    expect(obs.visible).toBe("[heading 1] The new page");
    expect(reads()).toBe(3);
  });
  it("gives up after four reads, so a page that never settles still ends the session", async () => {
    const { s } = sessionWith(10);
    await expect(s.observe()).rejects.toThrow(/Execution context was destroyed/);
  });
  it("does not retry other errors", async () => {
    const { s, reads } = sessionWith(1, "page.evaluate: Target closed");
    await expect(s.observe()).rejects.toThrow(/Target closed/);
    expect(reads()).toBe(1);
  });
});
