import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BrowserSession, textPattern, VISIBLE_SCRIPT } from "../browser.js";

// Taps and scrolls run in a real page, so these tests need Chromium. The main CI job has none: they skip there,
// by name, and the Browser workflow runs them.
let browser: Browser | undefined;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.BUYER_PANEL_CHROMIUM || undefined });
} catch {
  browser = undefined;
}

type Ctor = new (browser: Browser, context: BrowserContext, page: Page, origin: string) => BrowserSession;

async function session(html: string): Promise<BrowserSession> {
  const context = await browser!.newContext({ viewport: { width: 390, height: 700 } });
  const page = await context.newPage();
  await page.setContent(`<!doctype html><meta charset="utf-8"><body style="margin:0">${html}</body>`);
  return new (BrowserSession as unknown as Ctor)(browser!, context, page, "http://localhost");
}

describe("textPattern", () => {
  it("treats curly and straight quotes, whitespace and case alike", () => {
    expect(textPattern("What's  included", true).test("what’s included")).toBe(true);
    expect(textPattern('Back to "Fees"', true).test("‹ Back to “Fees”")).toBe(true);
    expect(textPattern("Fees (from £40)", true).test("Fees (from £40) →")).toBe(true);
  });

  it("keeps exact patterns exact", () => {
    expect(textPattern("Fees", true).test("Fees and funding")).toBe(false);
    expect(textPattern("Fees", false).test("Fees and funding")).toBe(true);
  });
});

afterAll(async () => {
  await browser?.close();
});

describe.skipIf(!browser)("taps and scrolls in a real browser", () => {
  beforeAll(() => {
    expect(browser).toBeDefined();
  });

  it("taps a button whose name has a curly apostrophe when the buyer types a straight one", async () => {
    const s = await session(`<button onclick="document.title='tapped'">What’s  included</button>`);
    try {
      expect(await s.click("What's included →")).toBe(`Clicked "What's included →".`);
      expect(await s.page.title()).toBe("tapped");
    } finally {
      await s.context.close();
    }
  });

  it("taps a link with curly quotes and a back chevron in the buyer's text", async () => {
    const s = await session(`<a href="#" onclick="document.title='tapped';return false">‹ Back to “Fees”</a>`);
    try {
      expect(await s.resolve(`Back to "Fees" ←`)).toBeDefined();
    } finally {
      await s.context.close();
    }
  });

  it("types into a field whose label has a curly apostrophe when the buyer types a straight one", async () => {
    const s = await session(`<label for="age">Your child’s age</label><input id="age">`);
    try {
      expect(await s.type("Your child's age", "6")).toBe(`Typed into "Your child's age".`);
      expect(await s.page.inputValue("#age")).toBe("6");
    } finally {
      await s.context.close();
    }
  });

  it("picks an option of a native select by its label instead of tapping a link with the same text", async () => {
    const s = await session(
      `<label for="interest">Interested in</label><select id="interest"><option value="notsure">Not sure yet</option><option value="ass">Assessments</option></select>` +
        `<footer><a href="#" onclick="document.title='footer';return false">Assessments</a></footer>`,
    );
    try {
      expect(await s.click("Assessments")).toBe(`Chose "Assessments" in "Interested in".`);
      expect(await s.page.inputValue("#interest")).toBe("ass");
      expect(await s.page.title()).toBe("");
    } finally {
      await s.context.close();
    }
  });

  it("scrolls the inner scroller when the window itself cannot scroll", async () => {
    const rows = Array.from({ length: 60 }, (_, i) => `<p style="height:40px;margin:0">Row ${i}</p>`).join("");
    const s = await session(`<div id="vp" style="height:100vh;overflow-y:auto">${rows}</div>`);
    try {
      const before = (await s.page.evaluate(VISIBLE_SCRIPT)) as { scrolledPct: number; atBottom: boolean };
      expect(before.atBottom).toBe(false);
      await s.scroll("down");
      expect(await s.page.$eval("#vp", (el) => el.scrollTop)).toBeGreaterThan(0);
      const after = (await s.page.evaluate(VISIBLE_SCRIPT)) as { scrolledPct: number };
      expect(after.scrolledPct).toBeGreaterThan(0);
    } finally {
      await s.context.close();
    }
  });

  it("still scrolls the window on an ordinary page", async () => {
    const rows = Array.from({ length: 60 }, (_, i) => `<p style="height:40px;margin:0">Row ${i}</p>`).join("");
    const s = await session(rows);
    try {
      await s.scroll("down");
      expect(await s.page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    } finally {
      await s.context.close();
    }
  });
});
