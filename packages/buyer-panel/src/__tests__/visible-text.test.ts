import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { VISIBLE_SCRIPT } from "../browser.js";

// The screen text is read in a real page, so these tests need Chromium. The main CI job has none: they skip there,
// by name, and the Browser workflow runs them.
let browser: Browser | undefined;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.BUYER_PANEL_CHROMIUM || undefined });
} catch {
  browser = undefined;
}

async function visible(html: string): Promise<string[]> {
  const page = await browser!.newPage({ viewport: { width: 1000, height: 800 } });
  try {
    await page.setContent(`<!doctype html><meta charset="utf-8"><body>${html}</body>`);
    return ((await page.evaluate(VISIBLE_SCRIPT)) as { lines: string[] }).lines;
  } finally {
    await page.close();
  }
}

// The shape of the MMM prototype's /prices page: a name link, then the price and the blurb in plain divs.
const ROW = (name: string, price: string, blurb: string, tag = "") =>
  `<div class="row"><div class="n"><a href="#/t/x">${name}</a>${tag}</div><div class="pd">${price}</div><div class="d">${blurb}</div></div>`;

afterAll(async () => {
  await browser?.close();
});

describe.skipIf(!browser)("screen text in a real browser", () => {
  beforeAll(() => {
    expect(browser).toBeDefined();
  });

  it("lists the price and blurb that sit beside a treatment link", async () => {
    const lines = await visible(
      `<h2>Nails</h2>${ROW("Gel Toe Paint", "£30 · 30 min", "A gel colour for toes.")}${ROW("Gel Polish Manicure", "from £32 · 60 min", "Gel polish with a glossy finish.")}`,
    );
    expect(lines).toEqual([
      "[heading 2] Nails",
      "[link] Gel Toe Paint",
      "[text] £30 · 30 min",
      "[text] A gel colour for toes.",
      "[link] Gel Polish Manicure",
      "[text] from £32 · 60 min",
      "[text] Gel polish with a glossy finish.",
    ]);
  });

  it("keeps two rows that share a price and a tag", async () => {
    const tag = `<span class="tag">Add-on</span>`;
    const lines = await visible(ROW("Chrome Finish", "+£7 · +5 min", "", tag) + ROW("Cat Eye Finish", "+£7 · +5 min", "", tag));
    expect(lines.filter((l) => l === "[text] +£7 · +5 min")).toHaveLength(2);
    expect(lines.filter((l) => l === "[text] Add-on")).toHaveLength(2);
  });

  it("lists a box's own words once, and the blocks inside it separately", async () => {
    const lines = await visible(`<div>Call us on <a href="tel:1">01280 000000</a> today<div>Open until <b>5pm</b></div></div>`);
    expect(lines).toEqual(["[text] Call us on today", "[link] 01280 000000", "[text] Open until 5pm"]);
  });

  it("does not repeat text inside an element that is already listed", async () => {
    const lines = await visible(`<ul><li><span>Deposit</span> <span>30%</span></li></ul><p>Patch test <span>24 hours</span> before</p><button><span>Book</span> now</button>`);
    expect(lines).toEqual(["[text] Deposit 30%", "[text] Patch test 24 hours before", "[button] Book now"]);
  });

  it("leaves out text a person cannot see", async () => {
    const lines = await visible(
      `<div>£10 shown</div><div style="display:none">hidden price £99</div><span style="visibility:hidden">invisible £98</span><div style="opacity:0">clear £97</div><div style="margin-top:2000px">below the fold £96</div>`,
    );
    expect(lines).toEqual(["[text] £10 shown"]);
  });

  it("still lists fields with their label and value, and images with alt text", async () => {
    const lines = await visible(`<label for="d">Date</label><input id="d" value="2026-10-14"><img alt="Salon front" width="50" height="50" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">`);
    expect(lines).toContain('[field text] Date = "2026-10-14"');
    expect(lines).toContain("[image] Salon front");
    expect(lines).toContain("[text] Date");
  });
});
