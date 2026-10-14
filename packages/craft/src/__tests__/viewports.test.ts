import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { run } from "../character/cli.js";
import { judgeMeasured, writeBaseline, type Baseline, type MeasuredRoute } from "../phone/judge.js";
import {
  BANDS,
  bandOf,
  DEFAULT_SWEEP,
  formatWidths,
  LADDER,
  mainActionFor,
  mergeViewportFindings,
  measureSite,
  measureViewports,
  PHONE,
  sweepWidths,
  type RawPhoneFinding,
  type SiteBrowser,
} from "../phone/index.js";
import { plan } from "../phone/run.js";

const fixture = (name: string): string => readFileSync(join(import.meta.dirname, "fixtures/viewports", name), "utf8");
const f = (check: RawPhoneFinding["check"], element: string, detail = "d"): RawPhoneFinding => ({ check, element, detail });

describe("the ladder and the bands", () => {
  it("lists the ten viewports, phone first", () => {
    expect(LADDER.map((v) => v.name)).toEqual(["320", "375", "390", "430", "844x390", "768", "1024", "1280", "1440", "1920"]);
    expect(LADDER.filter((v) => v.phone).map((v) => v.name)).toEqual(["320", "375", "390", "430", "844x390"]);
    expect(LADDER.find((v) => v.landscape)).toMatchObject({ width: 844, height: 390 });
    // The house phone stays 375 x 812, so a baseline made at 375 means the same thing here.
    expect(LADDER.find((v) => v.name === "375")).toMatchObject({ width: PHONE.viewport.width, height: PHONE.viewport.height });
  });

  it("puts every width in one of five bands", () => {
    expect(BANDS.map((b) => b.band)).toEqual(["phone", "large-phone", "tablet", "laptop", "wide"]);
    const at = (w: number) => bandOf(w);
    expect([320, 479, 480, 767, 768, 1023, 1024, 1439, 1440, 1920].map(at)).toEqual(["phone", "phone", "large-phone", "large-phone", "tablet", "tablet", "laptop", "laptop", "wide", "wide"]);
  });

  it("sweeps 320 to 1920: 16px steps below 1024, 32px from there", () => {
    const widths = sweepWidths();
    expect(widths.slice(0, 4)).toEqual([320, 336, 352, 368]);
    expect(widths).toContain(1008);
    expect(widths).toContain(1024);
    expect(widths.slice(widths.indexOf(1024), widths.indexOf(1024) + 3)).toEqual([1024, 1056, 1088]);
    expect(widths.at(-1)).toBe(1920);
    expect(widths.length).toBe(45 + 28);
    expect(sweepWidths({ ...DEFAULT_SWEEP, from: 320, to: 400, step: 40 })).toEqual([320, 360, 400]);
  });
});

describe("the plan", () => {
  it("measures the phone first: ladder, the short phone, landscape, then every other width in order", () => {
    const names = plan({}).map((s) => s.name);
    expect(names.slice(0, 6)).toEqual(["320", "375", "390", "430", "375x667", "844x390"]);
    const rest = names.slice(6).map(Number);
    expect([...rest].sort((a, b) => a - b)).toEqual(rest);
    for (const w of [768, 1024, 1280, 1440, 1920]) expect(rest).toContain(w);
    expect(new Set(names).size).toBe(names.length);
  });

  it("runs the optimise checks only on the short phone, landscape only on 844 x 390 and the wide checks at 1440 and 1920", () => {
    const stops = plan({});
    const where = (group: string) => stops.filter((s) => s.groups.includes(group as never)).map((s) => s.name);
    expect(where("optimise")).toEqual(["375x667"]);
    expect(where("landscape")).toEqual(["844x390"]);
    expect(where("wide")).toEqual(["1440", "1920"]);
    // Targets and fields are judged where a thumb is, and nowhere else.
    expect(stops.filter((s) => s.touch).map((s) => s.name)).toEqual(["320", "375", "390", "430", "844x390"]);
  });

  it("splits into a phone half and a wide half, and can leave the sweep out", () => {
    const phone = plan({ scope: "phone" }).map((s) => s.width);
    const wide = plan({ scope: "wide" }).map((s) => s.width);
    expect(Math.max(...phone.filter((w) => w !== 844))).toBeLessThan(768);
    expect(Math.min(...wide)).toBeGreaterThanOrEqual(768);
    expect(plan({ sweep: false }).map((s) => s.name)).toEqual(["320", "375", "390", "430", "375x667", "844x390", "768", "1024", "1280", "1440", "1920"]);
  });
});

describe("reading the widths", () => {
  const tested = ["320", "375", "390", "430", "375x667", "844x390", "336", "352", "368", "384", "400", "768", "1440"];
  it("joins consecutive tested widths that fail into a range", () => {
    expect(formatWidths(["320", "336", "352", "368", "375"], tested)).toBe("320-375");
    expect(formatWidths(["320", "352"], tested)).toBe("320, 352");
    expect(formatWidths(["1440", "375x667", "320"], tested)).toBe("320, 1440, 375x667");
  });

  it("merges one finding per element across viewports, counting the most seen at one, and says where", () => {
    const merged = mergeViewportFindings(
      [
        { viewport: "320", findings: [f("target", `<a> "Invoice 1042"`), f("target", `<a> "Invoice 1043"`)] },
        { viewport: "375", findings: [f("target", `<a> "Invoice 1042"`)] },
        { viewport: "390", findings: [f("scroll", "<html>")] },
      ],
      ["320", "375", "390"],
    );
    expect(merged.map((m) => `${m.check} ${m.element} ${m.detail}`)).toEqual([`target <a> "Invoice 1042" d (at 320-375)`, `target <a> "Invoice 1042" d (at 320-375)`, "scroll <html> d (at 390)"]);
  });

  it("names the widths it fails at, even when that is all of them", () => {
    const merged = mergeViewportFindings([{ viewport: "320", findings: [f("title", "<h1>")] }, { viewport: "375", findings: [f("title", "<h1>")] }], ["320", "375"]);
    expect(merged[0].detail).toBe("d (at 320-375)");
  });

  it("finds the main action for a route: one for all, or per route with a fallback", () => {
    expect(mainActionFor(".cta", "/x")).toBe(".cta");
    expect(mainActionFor({ "/": ".hero a", "*": "a.book" }, "/")).toBe(".hero a");
    expect(mainActionFor({ "/": ".hero a", "*": "a.book" }, "/contact")).toBe("a.book");
    expect(mainActionFor({ "/": ".hero a" }, "/contact")).toBeUndefined();
    expect(mainActionFor(undefined, "/")).toBeUndefined();
  });
});

describe("the new checks in the baseline", () => {
  const routes: MeasuredRoute[] = [
    {
      route: "/",
      viewports: ["320", "375"],
      findings: [f("overlap", `<p> "Call back request" / <p> "Opening times today"`, "overlaps (at 320-416)"), f("tel", `<p> "020 7946 0958"`), f("image", `<img> "Van" upscaled`), f("linelength", `<p> "Plumbing is the work"`)],
    },
  ];

  it("lists existing failures and fails new ones, like the phone floors", () => {
    const baseline = writeBaseline([], routes);
    expect(baseline.measured.map((m) => m.check)).toEqual(["image", "linelength", "overlap", "tel"]);
    expect(judgeMeasured(routes, baseline)).toEqual({ fresh: [], stale: [], known: 4 });
    const worse: MeasuredRoute[] = [{ ...routes[0], findings: [...routes[0].findings, f("layers", "fixed and sticky layers", "cover 40%")] }];
    expect(judgeMeasured(worse, baseline).fresh).toEqual(["/: fixed layers cover too much fixed and sticky layers: cover 40%"]);
  });

  it("ignores the widths in the detail, so a fail at one more width is not a new failure", () => {
    const baseline = writeBaseline([], routes);
    const wider: MeasuredRoute[] = [{ ...routes[0], findings: routes[0].findings.map((x) => (x.check === "overlap" ? { ...x, detail: "overlaps (at 320-592)" } : x)) }];
    expect(judgeMeasured(wider, baseline).fresh).toEqual([]);
  });

  it("asks for the baseline to shrink when a failure is fixed", () => {
    const baseline = writeBaseline([], routes);
    const fixed: MeasuredRoute[] = [{ ...routes[0], findings: routes[0].findings.filter((x) => x.check !== "tel") }];
    expect(judgeMeasured(fixed, baseline).stale).toEqual([`/: phone number is not a link <p> "# # #": the baseline allows 1, 0 found. Lower it to 0 (remove the line).`]);
  });

  it("keeps an old baseline, with no new checks in it, working: the phone floors alone still pass", () => {
    const old: Baseline = { static: [], measured: [{ route: "/", check: "target", element: `<a> "Pay"`, count: 1 }] };
    const now: MeasuredRoute[] = [{ route: "/", findings: [f("target", `<a> "Pay"`)] }];
    expect(judgeMeasured(now, old)).toEqual({ fresh: [], stale: [], known: 1 });
  });
});

/**
 * The in-page checks in a real Chromium. Skipped, visibly, where no browser
 * exists; the Browser workflow requires these by name.
 */
const chromium = process.env.CRAFT_CHROMIUM ?? (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const FAST = { step: 64, wideStep: 128 };

describe.skipIf(!chromium)("craft viewports in a real browser", () => {
  async function withBrowser<T>(fn: (browser: Awaited<ReturnType<typeof import("playwright").chromium.launch>>) => Promise<T>): Promise<T> {
    const { chromium: browserType } = await import("playwright");
    const browser = await browserType.launch({ executablePath: chromium });
    try {
      return await fn(browser);
    } finally {
      await browser.close();
    }
  }

  it("finds every fault on a page built to have them, and says where", async () => {
    await withBrowser(async (browser) => {
      const page = await (await browser.newContext(PHONE)).newPage();
      await page.setContent(fixture("bad.html"));
      const result = await measureViewports(page, { route: "/bad", out: false, mainAction: ".cta" });
      const got = Object.fromEntries(result.findings.map((x) => [`${x.check} ${x.element}`, x.detail]));
      const has = (key: string) => Object.keys(got).find((k) => k.startsWith(key));

      // The sweep: a 600px block scrolls sideways below 600, and text meets text only on the narrowest phones. Both name the widths.
      expect(got["scroll <html>"]).toMatch(/\(at 320-592\)$/);
      expect(got[has("overlap")!]).toMatch(/\(at 320-416\)$/);
      expect(has("overlap")).toContain(`"Opening times today"`);
      // The short phone: the button is a screen and a half down; the header takes a third of the screen.
      expect(got[has("action")!]).toMatch(/starts 1333px down a 667px screen/);
      expect(got["layers fixed and sticky layers"]).toMatch(/cover 33% of a 667px screen, over the 25% allowed: <header> "Acme Plumbing" \(at 375x667\)/);
      // Landscape: the same header is more than half of 390px.
      expect(got["landscape header and fixed layers"]).toMatch(/cover 56% of a 390px landscape screen.*\(at 844x390\)$/);
      // Images against their files.
      expect(got[`image <img> "Shopfront" oversized`]).toMatch(/1200px wide, shown at 100px \(12\.0x/);
      expect(got[`image <img> "Van" upscaled`]).toMatch(/60px wide, stretched to 375px.*\(at 1440, 1920, 375x667\)$/);
      // Fields: the keyboard, then autocomplete. The right ones pass, and so do the search box and the message.
      expect(got[`input <input> "Phone"`]).toContain('Use type="tel"');
      expect(got[`input <input> "Email address"`]).toContain('Use type="email"');
      expect(got[`input <input> "Quantity"`]).toContain('inputmode="numeric"');
      expect(got[`autocomplete <input> "Phone"`]).toContain("autocomplete attribute is missing");
      expect(got[`autocomplete <input> "First name"`]).toContain("autocomplete attribute is missing");
      expect(Object.keys(got).filter((k) => /Mobile|Search|How can we help/.test(k))).toEqual([]);
      expect(got[`input <input> "Email address"`]).not.toContain("autocomplete");
      expect(has(`autocomplete <input> "Email address"`)).toBeUndefined();
      // The number in the text is not a link; the linked one and the reference number are fine.
      expect(Object.keys(got).filter((k) => k.startsWith("tel "))).toEqual([`tel <p> "020 7946 0958"`]);
      expect(got[`tel <p> "020 7946 0958"`]).toContain('<a href="tel:+442079460958">');
      // The wide checks.
      expect(got[has("linelength")!]).toMatch(/lines run 155 characters at 1440px, over the 80 allowed.*\(at 1440, 1920\)$/);
      expect(Object.keys(got).filter((k) => k.startsWith("linelength"))).toHaveLength(1);
      expect(result.viewports.slice(0, 6)).toEqual(["320", "375", "390", "430", "375x667", "844x390"]);
    });
  }, 180_000);

  it("passes a page that is built for the phone and for every width", async () => {
    await withBrowser(async (browser) => {
      const page = await (await browser.newContext(PHONE)).newPage();
      await page.setContent(fixture("clean.html"));
      const result = await measureViewports(page, { route: "/clean", out: false, mainAction: ".cta", sweep: FAST });
      expect(result.findings).toEqual([]);
    });
  }, 120_000);

  it("accepts a main action that is pinned, and fails one that matches nothing", async () => {
    await withBrowser(async (browser) => {
      const page = await (await browser.newContext(PHONE)).newPage();
      const html = fixture("clean.html").replace('<a class="cta" href="/book">Book now</a>', '<div style="height:900px"></div><a class="cta" href="/book" style="position:fixed;bottom:0;right:0">Book now</a>');
      await page.setContent(html);
      const pinned = await measureViewports(page, { route: "/", out: false, mainAction: ".cta", sweep: false, ladder: LADDER.slice(0, 2) });
      expect(pinned.findings).toEqual([]);
      const missing = await measureViewports(page, { route: "/", out: false, mainAction: ".buy", sweep: false, ladder: LADDER.slice(0, 2) });
      expect(missing.findings.map((x) => `${x.check} ${x.element}`)).toEqual(["action .buy"]);
      // Nothing configured: nothing judged.
      const none = await measureViewports(page, { route: "/", out: false, sweep: false, ladder: LADDER.slice(0, 2) });
      expect(none.findings).toEqual([]);
    });
  }, 120_000);

  it("finds a title cut by ellipsis and by a box around it, with the widths it is cut at", async () => {
    await withBrowser(async (browser) => {
      const page = await (await browser.newContext(PHONE)).newPage();
      await page.setContent(fixture("title.html"));
      const result = await measureViewports(page, { route: "/title", out: false, sweep: FAST });
      const titles = result.findings.filter((x) => x.check === "title");
      expect(titles.map((x) => x.element)).toEqual([`<h1> "Emergency plumbers across the whole of t"`, `<div> "A second title that a box around it cuts"`]);
      // 60vw holds the 938px title once the page is about 1560px wide: it is cut at every narrower width tested.
      expect(titles[0].detail).toBe("the page title is cut off (at 320-1536, 844x390)");
      expect(titles[1].detail).toBe("the page title is cut off (at 320-1920, 844x390)");
    });
  }, 120_000);

  it("fails a page with no width=device-width viewport meta at the phone widths", async () => {
    await withBrowser(async (browser) => {
      const page = await (await browser.newContext(PHONE)).newPage();
      await page.setContent(fixture("clean.html").replace(/<meta name="viewport"[^>]*>/, ""));
      const result = await measureViewports(page, { route: "/", out: false, sweep: false, scope: "phone" });
      expect(result.findings.find((x) => x.check === "scroll")).toMatchObject({ element: "<meta name=viewport>" });
    });
  }, 120_000);

  it("runs the touch floors at every phone width, and the text floor at every width", async () => {
    await withBrowser(async (browser) => {
      const page = await (await browser.newContext(PHONE)).newPage();
      const html = fixture("clean.html").replace("</style>", " small{font-size:10px} a.t{display:inline-block;width:30px;height:30px}</style>").replace("<p>Plumbing", '<small>VAT included</small><a class="t" href="/x">x</a><p>Plumbing');
      await page.setContent(html);
      const result = await measureViewports(page, { route: "/", out: false, sweep: false });
      const byCheck = (c: string) => result.findings.filter((x) => x.check === c);
      expect(byCheck("text")[0].detail).toMatch(/^10px, under 12px \(at 320-1920, 375x667, 844x390\)$/);
      expect(byCheck("target")[0].detail).toMatch(/30x30px, under 44x44 \(at 320-430, 844x390\)$/);
    });
  }, 120_000);

  it("writes the merged route for craft phone-first --measured", async () => {
    await withBrowser(async (browser) => {
      const dir = mkdtempSync(join(tmpdir(), "craft-viewports-"));
      try {
        const page = await (await browser.newContext(PHONE)).newPage();
        await page.setContent(fixture("clean.html"));
        await measureViewports(page, { route: "/clean", out: dir, mainAction: ".cta", sweep: false });
        const written = JSON.parse(readFileSync(join(dir, "clean.json"), "utf8"));
        expect(written).toMatchObject({ route: "/clean", findings: [] });
        expect(written.viewports[0]).toBe("320");
        expect(written.perViewport).toBeUndefined();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }, 120_000);

  describe("on a running site", () => {
    let server: Server;
    let base: string;
    beforeAll(async () => {
      server = createServer((req, res) => {
        const page = req.url === "/bad" ? "bad.html" : req.url === "/" ? "clean.html" : null;
        res.writeHead(page ? 200 : 404, { "content-type": "text/html" });
        res.end(page ? fixture(page) : "Not found");
      });
      await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
      base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    });
    afterAll(() => server.close());

    it("opens each route in a phone context and a desktop one and merges them, reporting a route that does not answer", async () => {
      await withBrowser(async (browser) => {
        const captured: string[] = [];
        const result = await measureSite(browser as unknown as SiteBrowser, {
          base,
          routes: ["/", "/missing"],
          out: false,
          mainAction: ".cta",
          sweep: FAST,
          onViewport: async (_page, viewport, route) => void captured.push(`${route} ${viewport.name}`),
        });
        expect(result.errors).toEqual([{ route: "/missing", error: "HTTP 404" }]);
        expect(result.routes.map((r) => r.route)).toEqual(["/"]);
        expect(result.routes[0].findings).toEqual([]);
        expect(result.routes[0].viewports.slice(0, 6)).toEqual(["320", "375", "390", "430", "375x667", "844x390"]);
        expect(result.routes[0].viewports).toContain("1920");
        expect(captured.slice(0, 3)).toEqual(["/ 320", "/ 375", "/ 390"]);
        expect(captured).toContain("/ 1920");
      });
    }, 180_000);

    it("craft viewports judges against the baseline: fails a new breach, passes once listed, asks to shrink when fixed", async () => {
      const dir = mkdtempSync(join(tmpdir(), "craft-viewports-cli-"));
      const out: string[] = [];
      const err: string[] = [];
      const io = { cwd: dir, out: (t: string) => out.push(t), err: (t: string) => err.push(t) };
      const args = (route: string) => ["viewports", "--url", base, "--route", route, "--no-sweep"];
      try {
        process.env.CRAFT_CHROMIUM = chromium;
        writeFileSync(join(dir, "viewports.json"), JSON.stringify({ mainAction: ".cta" }));
        expect(await run(args("/"), io)).toBe(0);
        expect(out.at(-1)).toMatch(/pass\. 1 route at 11 viewports/);
        expect(existsSync(join(dir, "phone-first/measured/home.json"))).toBe(true);

        expect(await run(args("/bad"), io)).toBe(1);
        expect(err.join("\n")).toMatch(/Measured across the viewports, phone first:\n {2}\/bad: /);
        expect(await run([...args("/bad"), "--update-baseline"], io)).toBe(0);
        const baseline = JSON.parse(readFileSync(join(dir, "phone-first.baseline.json"), "utf8"));
        expect(baseline.measured.some((m: { route: string; check: string }) => m.route === "/bad" && m.check === "tel")).toBe(true);
        expect(await run(args("/bad"), io)).toBe(0);
        expect(out.at(-1)).toMatch(/known breaches in the baseline/);

        // A route the baseline names that this run did not measure is left alone.
        expect(await run(args("/"), io)).toBe(0);
        // A breach that is gone: lower the baseline.
        writeFileSync(join(dir, "phone-first.baseline.json"), JSON.stringify({ ...baseline, measured: [...baseline.measured, { route: "/", check: "tel", element: `<p> "#"`, count: 1 }] }));
        expect(await run(args("/"), io)).toBe(1);
        expect(err.join("\n")).toMatch(/the baseline allows 1, 0 found\. Lower it to 0/);
      } finally {
        delete process.env.CRAFT_CHROMIUM;
        rmSync(dir, { recursive: true, force: true });
      }
    }, 240_000);
  });
});

describe("craft viewports usage", () => {
  const io = () => {
    const out: string[] = [];
    const err: string[] = [];
    return { out, err, io: { cwd: tmpdir(), out: (t: string) => out.push(t), err: (t: string) => err.push(t) } };
  };
  it("asks for a site to open, and refuses a route that is not a path and an unknown flag", async () => {
    const a = io();
    expect(await run(["viewports"], a.io)).toBe(2);
    expect(a.err.join("\n")).toMatch(/no site to open/);
    const b = io();
    expect(await run(["viewports", "--url", "http://x.test", "--route", "contact"], b.io)).toBe(2);
    expect(b.err.join("\n")).toMatch(/route "contact" should start with \//);
    const c = io();
    expect(await run(["viewports", "--nope"], c.io)).toBe(2);
    expect(c.err.join("\n")).toMatch(/unknown argument --nope/);
  });
});
