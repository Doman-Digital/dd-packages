import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { run } from "../character/cli.js";
import { checkExceptions, judgeMeasured, judgeStatic, normaliseElement, scanPhoneFirst, writeBaseline, type Baseline, type MeasuredRoute } from "../phone/judge.js";
import { measurePhone, PHONE, routeFile } from "../phone/index.js";

const file = (path: string, text: string) => ({ path, text });
const none: Baseline = { static: [], measured: [] };

describe("scanPhoneFirst", () => {
  it("finds max-width queries in every spelling, and max-* variants", () => {
    const { findings } = scanPhoneFirst([
      file("a.css", "@media (max-width: 767px) { .a { display: block } }\n@media (width < 40rem) {}\n@media (600px > width) {}\n@custom-media --narrow (max-width: 30em);"),
      file("B.tsx", `<div className="flex max-md:flex-col max-[40rem]:hidden" />`),
    ]);
    expect(findings.map((f) => `${f.file}:${f.line} ${f.what}`)).toEqual([
      "a.css:1 @media (max-width: 767px)",
      "a.css:2 @media (width < 40rem)",
      "a.css:3 @media (600px > width)",
      "a.css:4 @custom-media --narrow (max-width: 30em)",
      "B.tsx:1 max-md:",
      "B.tsx:1 max-[40rem]:",
    ]);
  });

  it("leaves min-width, max-width as a property and max-* utilities alone", () => {
    const { findings } = scanPhoneFirst([
      file("a.css", "@media (min-width: 768px) { .a { max-width: 40rem } }\n.b { max-height: 2rem }"),
      file("B.tsx", `<p className="max-w-prose max-h-40 sm:max-w-md md:grid">x</p>`),
    ]);
    expect(findings).toEqual([]);
  });

  it("excuses a rule with a reason, on its line or the line above, and a file with one", () => {
    const { findings, excused } = scanPhoneFirst(
      [
        file("a.css", "/* mobile-first-ok: print sheet keeps the desktop table */\n@media (max-width: 600px) {}\n@media (max-width: 500px) {} /* mobile-first-ok: */"),
        file("b.css", "@media (max-width: 600px) {}"),
      ],
      [{ file: "b.css", reason: "third-party widget skin, replaced in DOM-720" }],
    );
    expect(excused).toBe(1);
    expect(findings).toEqual([{ file: "a.css", line: 3, what: "@media (max-width: 500px) (mobile-first-ok with no reason)" }]);
  });

  it("names each faulty exception: the file or the reason left out, or a file that is gone", () => {
    expect(checkExceptions([{ reason: "x" }, { file: "a.css" }, { file: "gone.css", reason: "x" }, { file: "a.css", reason: "x" }], (f) => f === "a.css")).toEqual([
      "exceptions[0]: names no file",
      "exceptions[1] (a.css): no reason. Say why this file needs a max-width query, or remove the exception.",
      "exceptions[2]: gone.css is not there. Remove the exception.",
    ]);
  });
});

describe("the baseline", () => {
  const two = [
    { file: "a.css", line: 1, what: "@media (max-width: 600px)" },
    { file: "a.css", line: 9, what: "@media (max-width: 900px)" },
  ];

  it("lets known breaches through and counts them", () => {
    expect(judgeStatic(two, { static: [{ file: "a.css", count: 2 }], measured: [] })).toEqual({ fresh: [], stale: [], known: 2 });
  });

  it("fails a new breach, in a new file or above a file's count", () => {
    expect(judgeStatic(two, none).fresh).toHaveLength(1);
    const over = judgeStatic(two, { static: [{ file: "a.css", count: 1 }], measured: [] });
    expect(over.fresh[0]).toMatch(/2 desktop-first rules, the baseline allows 1/);
    expect(over.known).toBe(1);
  });

  it("fails a count higher than what is there, so it only shrinks", () => {
    const { stale } = judgeStatic(two.slice(0, 1), { static: [{ file: "a.css", count: 2 }, { file: "gone.css", count: 1 }], measured: [] });
    expect(stale).toEqual(["a.css: the baseline allows 2, there is 1 now. Lower it to 1.", "gone.css: the baseline allows 1, there are 0 now. Lower it to 0 (remove the line)."]);
  });

  const routes: MeasuredRoute[] = [
    {
      route: "/portal",
      findings: [
        { check: "target", element: `<a> "Invoice 1042"`, detail: "80x20px, under 44x44" },
        { check: "target", element: `<a> "Invoice 1043"`, detail: "80x20px, under 44x44" },
        { check: "scroll", element: "<html>", detail: "the page is 412px wide at 375px" },
      ],
    },
  ];

  it("keys measured breaches on route, check and element, with digits folded", () => {
    expect(normaliseElement(`<a> "Invoice 1042, £1,200.00"`)).toBe(`<a> "Invoice #, £#,#.#"`);
    const baseline = writeBaseline([], routes);
    expect(baseline.measured).toEqual([
      { route: "/portal", check: "scroll", element: "<html>", count: 1 },
      { route: "/portal", check: "target", element: `<a> "Invoice #"`, count: 2 },
    ]);
    expect(judgeMeasured(routes, baseline)).toEqual({ fresh: [], stale: [], known: 3 });
  });

  it("fails a new measured breach and an extra one of a known kind", () => {
    const baseline: Baseline = { static: [], measured: [{ route: "/portal", check: "target", element: `<a> "Invoice #"`, count: 1 }] };
    const { fresh, known } = judgeMeasured(routes, baseline);
    expect(fresh).toEqual([`/portal: small target <a> "Invoice 1042": 80x20px, under 44x44 (the baseline allows 1)`, "/portal: scrolls sideways <html>: the page is 412px wide at 375px"]);
    expect(known).toBe(1);
  });

  it("fails a route the baseline names that was not measured, once", () => {
    const baseline: Baseline = {
      static: [],
      measured: [
        { route: "/admin", check: "text", element: `<span> "Draft"`, count: 1 },
        { route: "/admin", check: "field", element: "<input>", count: 1 },
      ],
    };
    expect(judgeMeasured(routes, baseline).stale).toEqual(["/admin: in the baseline but not measured this run. Measure it, or remove its lines."]);
  });
});

describe("craft phone-first", () => {
  let dir: string;
  let out: string[];
  let err: string[];
  const io = () => ({ cwd: dir, out: (t: string) => out.push(t), err: (t: string) => err.push(t) });
  const write = (path: string, text: string): void => {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), text);
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "craft-phone-"));
    out = [];
    err = [];
    write("phone-first.json", JSON.stringify({ source: ["app"], ignore: ["app/emails/**"] }));
    write("app/page.tsx", `<main className="p-4 md:p-8">x</main>`);
    write("app/emails/receipt.tsx", `<style>{"@media (max-width: 600px) {}"}</style>`);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("passes a phone-first source and skips ignored folders", async () => {
    expect(await run(["phone-first"], io())).toBe(0);
    expect(out.join("\n")).toMatch(/pass\. 1 files/);
  });

  it("fails a max-width rule, then passes once it is in the baseline, then asks for the baseline to shrink", async () => {
    write("app/old.css", "@media (max-width: 767px) { .t { display: block } }");
    expect(await run(["phone-first"], io())).toBe(1);
    expect(err.join("\n")).toMatch(/app\/old\.css:\n {4}line 1: @media \(max-width: 767px\)/);
    expect(await run(["phone-first", "--update-baseline"], io())).toBe(0);
    expect(JSON.parse(readFileSync(join(dir, "phone-first.baseline.json"), "utf8")).static).toEqual([{ file: "app/old.css", count: 1, found: ["@media (max-width: 767px)"] }]);
    expect(await run(["phone-first"], io())).toBe(0);
    expect(out.at(-1)).toMatch(/1 known breach in phone-first\.baseline\.json/);
    write("app/old.css", "@media (min-width: 768px) { .t { display: table } }");
    err = [];
    expect(await run(["phone-first"], io())).toBe(1);
    expect(err.join("\n")).toMatch(/Lower it to 0/);
  });

  it("judges measured routes against the baseline", async () => {
    const measured: MeasuredRoute = { route: "/portal", findings: [{ check: "field", element: "<input>", detail: "set at 14px, under 16px" }] };
    write(`phone-first/measured/${routeFile("/portal")}`, JSON.stringify(measured));
    expect(await run(["phone-first", "--measured", "phone-first/measured"], io())).toBe(1);
    expect(err.join("\n")).toMatch(/Measured at 375px:\n {2}\/portal: small field <input>: set at 14px/);
    expect(await run(["phone-first", "--measured", "phone-first/measured", "--update-baseline"], io())).toBe(0);
    expect(await run(["phone-first", "--measured", "phone-first/measured"], io())).toBe(0);
    // The static run alone keeps the measured lines it did not judge.
    expect(await run(["phone-first", "--update-baseline"], io())).toBe(0);
    expect(JSON.parse(readFileSync(join(dir, "phone-first.baseline.json"), "utf8")).measured).toHaveLength(1);
  });

  it("refuses a missing config, a missing measured folder and an exception with no reason", async () => {
    rmSync(join(dir, "phone-first.json"));
    expect(await run(["phone-first"], io())).toBe(2);
    write("phone-first.json", JSON.stringify({ source: ["app"], exceptions: [{ file: "app/page.tsx" }] }));
    expect(await run(["phone-first", "--measured", "nowhere"], io())).toBe(2);
    expect(await run(["phone-first"], io())).toBe(1);
    expect(err.join("\n")).toMatch(/no reason/);
  });
});

describe("routeFile", () => {
  it("names a route's file", () => {
    expect(routeFile("/")).toBe("home.json");
    expect(routeFile("/portal/invoices")).toBe("portal-invoices.json");
    expect(routeFile("/qa/portal-snapshots/[scenario]?x=1")).toBe("qa-portal-snapshots-scenario-x-1.json");
  });
});

/**
 * The in-page half in a real Chromium at PHONE. Skipped, visibly, where no
 * browser exists; the Browser workflow requires these by name.
 */
const chromium = process.env.CRAFT_CHROMIUM ?? (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);

describe.skipIf(!chromium)("craft phone-first in a real browser", () => {
  const PAGE = `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{margin:0;font:16px/1.5 sans-serif} .ok{display:inline-block;min-width:44px;min-height:44px} input{font-size:14px} .wide{width:500px} h1{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:200px}</style>
<h1>A page title far too long for the phone it is shown on</h1>
<main><p>Read the <a href="/terms">terms</a> before you pay.</p>
<a class="ok" href="/a">Pay</a> <a href="/b" style="font-size:16px">Invoice 1042</a>
<label for="q" style="display:block;min-height:44px">Search</label><input id="q" style="min-height:44px">
<small style="font-size:10px">VAT included</small><span class="sr-only" style="position:absolute;width:1px;height:1px;overflow:hidden;font-size:8px">skip</span>
<div class="wide">table</div></main>`;

  it("measures scroll, targets, fields, text and a cut-off title, and writes the route", async () => {
    const { chromium: browserType } = await import("playwright");
    const browser = await browserType.launch({ executablePath: chromium });
    const outDir = mkdtempSync(join(tmpdir(), "craft-phone-measured-"));
    try {
      const context = await browser.newContext(PHONE);
      const page = await context.newPage();
      await page.setContent(PAGE);
      const result = await measurePhone(page, { route: "/fixture", out: outDir });
      const got = result.findings.map((f) => `${f.check} ${f.element}`);
      expect(got).toContain("scroll <html>");
      expect(got).toContain(`target <a> "Invoice 1042"`);
      expect(got).toContain("field <input>");
      expect(got).toContain(`text <small> "VAT included"`);
      expect(got.some((g) => g.startsWith("title <h1>"))).toBe(true);
      // The sentence link, the 44px link, the labelled field's target and the visually hidden text all pass.
      expect(got.filter((g) => g.includes(`"terms"`) || g.includes(`"Pay"`) || g.includes("skip"))).toEqual([]);
      expect(got.filter((g) => g.startsWith("target <input>"))).toEqual([]);
      expect(result.viewport).toEqual({ width: 375, height: 812 });
      expect(JSON.parse(readFileSync(join(outDir, "fixture.json"), "utf8")).route).toBe("/fixture");
    } finally {
      await browser.close();
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});
