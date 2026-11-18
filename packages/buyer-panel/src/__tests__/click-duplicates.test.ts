import { chromium, type Browser } from "playwright";
import { afterAll, describe, expect, it } from "vitest";
import { findOnScreen } from "../browser.js";

// Needs Chromium, like visible-text.test.ts: skipped where there is none, run by the Browser workflow.
let browser: Browser | undefined;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.BUYER_PANEL_CHROMIUM || undefined });
} catch {
  browser = undefined;
}
afterAll(async () => {
  await browser?.close();
});

// A client prototype's contact screen: a sticky header button and the form's own button share one label.
const PAGE = `<header style="position:sticky;top:0"><a href="#contact">Request a consultation</a></header>
<div style="height:300px"></div>
<form><label>Name <input></label><a href="#sent">Request a consultation</a></form>
<div style="height:2000px"></div><a href="#far">Request a consultation</a>`;

describe.skipIf(!browser)("findOnScreen with duplicate labels", () => {
  it("lists every on-screen match top to bottom, and keeps the off-screen one as the fallback only", async () => {
    const page = await browser!.newPage({ viewport: { width: 375, height: 667 } });
    try {
      await page.setContent(`<!doctype html><meta charset="utf-8"><body>${PAGE}</body>`);
      const m = await findOnScreen(page, "Request a consultation");
      expect(await Promise.all(m.onScreen.map((l) => l.getAttribute("href")))).toEqual(["#contact", "#sent"]);
      expect(await m.fallback?.getAttribute("href")).toBe("#far");
    } finally {
      await page.close();
    }
  });
  it("returns one match when the label is unique", async () => {
    const page = await browser!.newPage({ viewport: { width: 375, height: 667 } });
    try {
      await page.setContent(`<!doctype html><meta charset="utf-8"><body>${PAGE}<a href="#x">Menu</a></body>`);
      expect((await findOnScreen(page, "Name")).onScreen).toHaveLength(1);
    } finally {
      await page.close();
    }
  });
});
