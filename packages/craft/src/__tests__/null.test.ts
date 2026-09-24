import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { run } from "../character/cli.js";
import { FINGERPRINT_VERSION, type Fingerprint } from "../fingerprint/index.js";
import { extractHtml, harvest, MIN_RUNS, nullPrompt, typicality, type NullModel, type NullRun } from "../null/index.js";
import { makeSnapshot } from "../snapshot/fixture.js";
import { fileURLToPath } from "node:url";

/**
 * Signal 2. The null model is built from real `claude -p` pages in
 * calibration/; here it is built from fingerprints written by hand, so each
 * property is proved against a difference that was put there on purpose.
 */

const fp = (patch: Partial<Fingerprint> = {}): Fingerprint => ({
  version: 1,
  accent: { l: 0.55, c: 0.2, h: 262 },
  ground: { l: 1, c: 0, h: 0 },
  display: { family: "Inter", class: "sans" },
  body: { family: "Inter", class: "sans" },
  roundness: 0.5,
  motion: 0.8,
  effects: ["hero-eyebrow-chip"],
  layout: ["hero", "logos", "cards", "stats", "cards", "text"],
  ...patch,
});

/** Twenty pages a model built: nearly the same page, varied a little. */
const NULL_RUNS: NullRun[] = Array.from({ length: 20 }, (_, i) => ({
  id: String(i + 1).padStart(2, "0"),
  fingerprint: fp({
    accent: { l: 0.5 + (i % 5) * 0.03, c: 0.18 + (i % 3) * 0.02, h: 250 + (i % 7) * 4 },
    display: i % 4 === 0 ? { family: "Poppins", class: "sans" } : { family: "Inter", class: "sans" },
    roundness: i % 3 === 0 ? 0.3 : 0.5,
    motion: 0.6 + (i % 4) * 0.1,
    layout: i % 2 ? ["hero", "logos", "cards", "stats", "cards", "text"] : ["hero", "stats", "cards", "cards", "text"],
  }),
  tells: ["reflex-font", "pill-everything"],
  copy: ["Book your appointment today", "Trusted by local families"],
}));

/** A page someone decided: a sign-writer's serif, the van's green, square corners, still. */
const DECIDED = fp({
  accent: { l: 0.42, c: 0.09, h: 150 },
  ground: { l: 0.96, c: 0.01, h: 100 },
  display: { family: "Alfa Slab One", class: "serif" },
  body: { family: "Source Serif 4", class: "serif" },
  roundness: 0.05,
  motion: 0,
  effects: [],
  layout: ["hero", "text", "cards", "text"],
});

describe("the null prompt", () => {
  it("carries the brief and nothing about how the page should look", () => {
    const p = nullPrompt("  Tidewell Plumbing, a heating engineer in Norwich.  ");
    expect(p).toContain("Build the home page for this business: Tidewell Plumbing, a heating engineer in Norwich.");
    // Fonts are mentioned only as something it may load, not as a choice.
    expect(p).not.toMatch(/colou?r|modern|clean|minimal|style|design|brand|look|feel/i);
  });
});

describe("reading the page out of a reply", () => {
  const page = `<!DOCTYPE html>\n<html lang="en-GB"><head><title>A</title></head><body>${"<p>Real copy here.</p>".repeat(20)}</body></html>`;

  it("strips code fences and commentary either side", () => {
    expect(extractHtml("```html\n" + page + "\n```")).toBe(page);
    expect(extractHtml(`Here is your page:\n\n${page}\n\nLet me know if you want changes.`)).toBe(page);
  });

  it("keeps a page cut off before its closing tag", () => {
    const cut = page.replace("</body></html>", "");
    expect(extractHtml("```html\n" + cut + "\n```")).toBe(cut);
  });

  it("returns null when there is no page", () => {
    expect(extractHtml("I can't do that.")).toBeNull();
    expect(extractHtml("<html></html>")).toBeNull();
  });
});

describe("typicality", () => {
  it("scores a page the model would have built as typical", () => {
    const t = typicality(fp(), NULL_RUNS);
    expect(t.typical).toBe(true);
    expect(t.score).toBeGreaterThan(0.5);
    expect(t.shared.map((s) => `${s.part} ${s.value}`)).toEqual(expect.arrayContaining(["display Inter", "accent blue", "shape pill"]));
  });

  it("scores a decided page as not typical, further out than every null page", () => {
    const t = typicality(DECIDED, NULL_RUNS);
    expect(t.typical).toBe(false);
    expect(t.score).toBe(0);
    expect(t.distance).toBeGreaterThan(t.baseline * 2);
    expect(t.shared).toEqual([]);
  });

  it("flags about nine in ten of the null's own pages, by construction", () => {
    const flagged = NULL_RUNS.filter((r, i) => typicality(r.fingerprint, NULL_RUNS.filter((_, j) => j !== i)).typical).length;
    expect(flagged / NULL_RUNS.length).toBeGreaterThanOrEqual(0.85);
  });

  it("moves when one choice moves: the accent alone takes a page part of the way out", () => {
    const own = typicality(fp({ accent: DECIDED.accent }), NULL_RUNS);
    expect(own.distance).toBeGreaterThan(typicality(fp(), NULL_RUNS).distance);
    expect(own.distance).toBeLessThan(typicality(DECIDED, NULL_RUNS).distance);
  });

  it("refuses to judge against too few pages", () => {
    expect(() => typicality(fp(), NULL_RUNS.slice(0, MIN_RUNS - 1))).toThrow(/at least 5 runs/);
  });
});

describe("the harvest", () => {
  const model = (brief: string, runs: NullRun[]): Pick<NullModel, "brief" | "runs"> => ({ brief, runs });

  it("separates choices the catalogue knows from ones it does not", () => {
    const runs = NULL_RUNS.map((r, i) => ({ ...r, fingerprint: { ...r.fingerprint, display: i < 12 ? { family: "Bricolage Grotesque", class: "sans" as const } : r.fingerprint.display } }));
    const found = harvest([model("Tidewell Plumbing, a heating engineer in Norwich.", runs)]);
    const face = (name: string) => found.find((c) => c.kind === "face" && c.value === name);
    expect(face("Bricolage Grotesque")).toMatchObject({ runs: 12, of: 20, known: null });
    expect(face("Inter")).toMatchObject({ known: "reflex-font" });
    expect(found.find((c) => c.kind === "tell" && c.value === "pill-everything")).toMatchObject({ runs: 20, known: "pill-everything" });
    expect(found.find((c) => c.kind === "accent")).toMatchObject({ value: "blue", known: null });
  });

  it("leaves out a choice fewer pages make than the share asked for", () => {
    const runs = NULL_RUNS.map((r, i) => ({ ...r, fingerprint: { ...r.fingerprint, display: i < 3 ? { family: "Bricolage Grotesque", class: "sans" as const } : r.fingerprint.display } }));
    expect(harvest([model("Tidewell Plumbing, a heating engineer in Norwich.", runs)]).some((c) => c.value === "Bricolage Grotesque")).toBe(false);
    expect(harvest([model("Tidewell Plumbing, a heating engineer in Norwich.", runs)], { minShare: 0.1 }).some((c) => c.value === "Bricolage Grotesque")).toBe(true);
  });

  it("finds a phrase the model repeats across briefs, and not the business's own name", () => {
    const withCopy = (copy: string[]) => NULL_RUNS.slice(0, 10).map((r) => ({ ...r, copy }));
    const found = harvest([
      model("Tidewell Plumbing, a heating engineer in Norwich.", withCopy(["Tidewell Plumbing keeps Norwich warm", "Peace of mind, every single visit"])),
      model("Wild Stem, a florist in York.", withCopy(["Wild Stem flowers for York", "Peace of mind, every single order"])),
    ]);
    const phrases = found.filter((c) => c.kind === "phrase").map((c) => c.value);
    expect(phrases).toContain("peace of mind");
    expect(phrases.some((p) => /tidewell|norwich|wild stem|york/.test(p))).toBe(false);
  });

  it("ignores the footer and the navigation, which every page carries", () => {
    const footer = ["© 2026 Company Ltd. Registered in England and Wales", "Email hello@company.co.uk or call between 8am and 6pm weekdays", "Privacy policy", "How it works"];
    const withCopy = NULL_RUNS.slice(0, 10).map((r) => ({ ...r, copy: footer }));
    const found = harvest([model("Tidewell Plumbing, a heating engineer in Norwich.", withCopy), model("Wild Stem, a florist in York.", withCopy)]);
    const phrases = found.filter((c) => c.kind === "phrase").map((c) => c.value);
    expect(phrases.filter((p) => /registered|england|wales|company|co uk|hello|\b(?:am|pm)\b|privacy|how it works/.test(p))).toEqual([]);
    // What is left of the same strings is still read.
    expect(phrases).toContain("call between");
  });

  it("needs a phrase in more than one brief when it is given more than one", () => {
    const found = harvest([
      model("Tidewell Plumbing, a heating engineer in Norwich.", NULL_RUNS.slice(0, 10).map((r) => ({ ...r, copy: ["Boiler servicing and repairs"] }))),
      model("Wild Stem, a florist in York.", NULL_RUNS.slice(0, 10).map((r) => ({ ...r, copy: ["Hand-tied bouquets"] }))),
    ]);
    expect(found.filter((c) => c.kind === "phrase")).toEqual([]);
  });

  it("asks the catalogue which phrases it already catches", () => {
    const found = harvest([model("Tidewell Plumbing, a heating engineer in Norwich.", NULL_RUNS.map((r) => ({ ...r, copy: ["We elevate your home comfort"] })))], {
      copyTell: (p) => (p.includes("elevate") ? "ai-vocabulary" : null),
    });
    expect(found.find((c) => c.value === "elevate your home comfort")).toMatchObject({ known: "ai-vocabulary" });
  });
});

describe("the commands", () => {
  let dir: string;
  let out: string[];
  let err: string[];
  const io = () => ({ cwd: dir, out: (t: string) => out.push(t), err: (t: string) => err.push(t) });
  const nullModel = (brief: string, runs: NullRun[]): NullModel => ({ version: 1, brief, prompt: nullPrompt(brief), model: "default", catalogueVersion: "test", builtAt: "2026-09-23T00:00:00.000Z", runs });

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "craft-null-"));
    out = [];
    err = [];
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("measures a page's text as a reader sees it, not its script's strings", async () => {
    const { measureRun } = await import("../null/cli.js");
    // Seen on five of seven null pages: the class list harvested as a phrase.
    const html = `<html><body><p>Done properly, every time.</p><a href="#book" class="btn btn-primary">Book a chair</a></body></html>`;
    const r = measureRun("01", html, makeSnapshot());
    expect(r.copy).toEqual(expect.arrayContaining(["Done properly, every time.", "Book a chair"]));
    expect(r.copy.join(" ")).not.toMatch(/btn/);
    expect(r.fingerprint.version).toBe(FINGERPRINT_VERSION);
  });

  it("craft tells harvest reads a directory of null models", async () => {
    for (const [slug, brief] of [
      ["plumber", "Tidewell Plumbing, a heating engineer in Norwich."],
      ["florist", "Wild Stem, a florist in York."],
    ]) {
      mkdirSync(join(dir, "null", slug), { recursive: true });
      writeFileSync(join(dir, "null", slug, "null.json"), JSON.stringify(nullModel(brief, NULL_RUNS.slice(0, 10).map((r) => ({ ...r, copy: ["We elevate every single visit"] })))));
    }
    expect(await run(["tells", "harvest", "null"], io())).toBe(0);
    const text = out.join("\n");
    expect(text).toMatch(/20 null pages from 2 briefs/);
    expect(text).toMatch(/Not on the catalogue[\s\S]*accent\s+blue \(#[0-9a-f]{6}\)/);
    // The real copy tells run on each phrase: "elevate" is on the list.
    expect(text).toMatch(/Already caught[\s\S]*phrase\s+elevate every single visit[\s\S]*caught by ai-vocabulary/);
  });

  it("craft tells harvest says what it needs", async () => {
    expect(await run(["tells", "harvest"], io())).toBe(2);
    expect(err.join("\n")).toMatch(/usage: craft tells harvest/);
    expect(await run(["tells", "harvest", "nowhere"], io())).toBe(2);
    expect(err.join("\n")).toMatch(/no null model at nowhere/);
  });

  it("craft audit --null scores a saved snapshot", async () => {
    writeFileSync(join(dir, "null.json"), JSON.stringify(nullModel("Tidewell Plumbing, a heating engineer in Norwich.", NULL_RUNS)));
    writeFileSync(join(dir, "home.json"), JSON.stringify(makeSnapshot()));
    expect(await run(["audit", "home.json", "--null", "null.json"], io())).toBe(0);
    expect(out.join("\n")).toMatch(/Typicality against 20 null pages from 1 brief\n\s+score\s+0\.00: not typical/);
    out = [];
    expect(await run(["audit", "home.json", "--null", "null.json", "--json"], io())).toBe(0);
    expect(JSON.parse(out.join("\n")).typicality).toMatchObject({ typical: false, score: 0 });
  });

  it("craft null build refuses without a brief or somewhere to write", async () => {
    expect(await run(["null", "build", "--out", "x"], io())).toBe(2);
    expect(err.join("\n")).toMatch(/--brief/);
    expect(await run(["null", "build", "--brief", "Tidewell Plumbing, a heating engineer in Norwich."], io())).toBe(2);
    expect(err.join("\n")).toMatch(/--out <dir>/);
    expect(await run(["null", "build", "--brief", "Tidewell Plumbing, a heating engineer in Norwich.", "--out", "x", "--runs", "3"], io())).toBe(2);
    expect(err.join("\n")).toMatch(/5 or more/);
  });

  it("craft null build keeps a reply with no page for a person to read, and says what is missing", async () => {
    // A fake claude that answers in words, not HTML. Nothing reaches a browser.
    const fake = join(dir, "fake-claude.mjs");
    writeFileSync(fake, `#!/usr/bin/env node\nprocess.stdout.write("I would need to know more about the business first.");\n`, { mode: 0o755 });
    const before = process.env.CRAFT_CLAUDE;
    process.env.CRAFT_CLAUDE = fake;
    try {
      expect(await run(["null", "build", "--brief", "Tidewell Plumbing, a heating engineer in Norwich.", "--out", "n", "--runs", "5"], io())).toBe(1);
    } finally {
      if (before === undefined) delete process.env.CRAFT_CLAUDE;
      else process.env.CRAFT_CLAUDE = before;
    }
    expect(existsSync(join(dir, "n", "pages", "01.reply.txt"))).toBe(true);
    expect(err.join("\n")).toMatch(/01: the reply held no HTML page[\s\S]*5 missing\. Run the same command again/);
    const saved = JSON.parse(readFileSync(join(dir, "n", "null.json"), "utf8")) as NullModel;
    expect(saved).toMatchObject({ version: 1, model: "default", runs: [] });
    expect(saved.prompt).toContain("Tidewell Plumbing");
  });

  it("craft null prompt prints what to give another builder", async () => {
    expect(await run(["null", "prompt", "--brief", "Tidewell Plumbing, a heating engineer in Norwich."], io())).toBe(0);
    expect(out.join("\n")).toBe(nullPrompt("Tidewell Plumbing, a heating engineer in Norwich."));
    expect(await run(["null", "prompt"], io())).toBe(2);
    expect(err.join("\n")).toMatch(/usage: craft null prompt/);
  });

  it("craft null import finds pages as files and as built folders", async () => {
    const { findImportPages } = await import("../null/cli.js");
    mkdirSync(join(dir, "v0", "03", "assets"), { recursive: true });
    writeFileSync(join(dir, "v0", "01.html"), "<html></html>");
    writeFileSync(join(dir, "v0", "02.htm"), "<html></html>");
    writeFileSync(join(dir, "v0", "03", "index.html"), "<html></html>");
    writeFileSync(join(dir, "v0", "notes.txt"), "not a page");
    mkdirSync(join(dir, "v0", "snapshots"));
    expect(findImportPages(join(dir, "v0"))).toEqual([
      { id: "01", root: join(dir, "v0"), entry: "01.html" },
      { id: "02", root: join(dir, "v0"), entry: "02.htm" },
      { id: "03", root: join(dir, "v0", "03"), entry: "index.html" },
    ]);
    mkdirSync(join(dir, "v0", "01"));
    writeFileSync(join(dir, "v0", "01", "index.html"), "<html></html>");
    expect(() => findImportPages(join(dir, "v0"))).toThrow(/"01" is both a file and a folder/);
  });

  it("serves a built app from its own root, and nothing outside it", async () => {
    const { serveDir } = await import("../null/cli.js");
    mkdirSync(join(dir, "site", "assets"), { recursive: true });
    writeFileSync(join(dir, "site", "index.html"), "<html>home</html>");
    writeFileSync(join(dir, "site", "assets", "app.css"), "body{}");
    writeFileSync(join(dir, "secret.txt"), "outside");
    const server = await serveDir(join(dir, "site"));
    try {
      const home = await fetch(`${server.base}/`);
      expect(await home.text()).toBe("<html>home</html>");
      const css = await fetch(`${server.base}/assets/app.css`);
      expect(css.headers.get("content-type")).toBe("text/css");
      expect((await fetch(`${server.base}/missing.js`)).status).toBe(404);
      // The URL parser folds "%2e%2e/" away, so that one looks inside the root and finds nothing.
      expect((await fetch(`${server.base}/%2e%2e/secret.txt`)).status).toBe(404);
      // An encoded slash survives parsing and decodes to "../": the containment check refuses it.
      expect((await fetch(`${server.base}/..%2fsecret.txt`)).status).toBe(403);
      expect((await fetch(`${server.base}/assets%2f..%2f..%2fsecret.txt`)).status).toBe(403);
    } finally {
      await server.close();
    }
  });

  it("craft null import refuses without a builder, a brief, or enough pages", async () => {
    const brief = "Tidewell Plumbing, a heating engineer in Norwich.";
    expect(await run(["null", "import", "v0", "--brief", brief], io())).toBe(2);
    expect(err.join("\n")).toMatch(/usage: craft null import <dir> --builder/);
    expect(await run(["null", "import", "v0", "--builder", "v0"], io())).toBe(2);
    expect(await run(["null", "import", "nowhere", "--builder", "v0", "--brief", brief], io())).toBe(2);
    expect(err.join("\n")).toMatch(/no directory at nowhere/);
    mkdirSync(join(dir, "v0"));
    writeFileSync(join(dir, "v0", "01.html"), "<html></html>");
    expect(await run(["null", "import", "v0", "--builder", "v0", "--brief", brief], io())).toBe(2);
    expect(err.join("\n")).toMatch(/v0 holds 1 page; a null model needs at least 5/);
  });

  it("measureRun reads a built app's text off the page when its HTML is a shell", async () => {
    const { measureRun } = await import("../null/cli.js");
    const shell = `<html><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>`;
    const snapshot = makeSnapshot({ sections: [{ top: 0, height: 800, kind: "hero", label: "Boilers", cards: 0, iconCards: 0, hiddenAtLoad: false, text: ["Boilers  fixed the same day", "Call Tidewell"] }] });
    const styles = [{ path: "03/assets/app.css", text: `body{font-family:"Inter",sans-serif}` }];
    const r = measureRun("03", shell, snapshot, styles);
    expect(r.copy).toEqual(["Boilers fixed the same day", "Call Tidewell"]);
    expect(r.tells).toContain("reflex-font");
    expect(measureRun("03", shell, snapshot).tells).not.toContain("reflex-font");
  });
});

const chromium = process.env.CRAFT_CHROMIUM ?? (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);

describe.skipIf(!chromium)("craft null import in a real browser", () => {
  let dir: string;
  let before: string | undefined;
  // The command finds its browser the way a user's does: CRAFT_CHROMIUM.
  beforeEach(() => {
    before = process.env.CRAFT_CHROMIUM;
    process.env.CRAFT_CHROMIUM = chromium;
  });
  afterEach(() => {
    if (before === undefined) delete process.env.CRAFT_CHROMIUM;
    else process.env.CRAFT_CHROMIUM = before;
    rmSync(dir, { recursive: true, force: true });
  });

  it("snapshots files and a built app served from its own root, and writes a null model", async () => {
    dir = mkdtempSync(join(tmpdir(), "craft-import-"));
    const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`./pages/${name}`, import.meta.url)), "utf8");
    mkdirSync(join(dir, "v0"));
    for (const id of ["01", "02", "03", "04"]) writeFileSync(join(dir, "v0", `${id}.html`), fixture(id === "04" ? "decided.html" : "generated.html"));
    // A built app: its stylesheet is root-relative, which a file:// URL would not resolve.
    mkdirSync(join(dir, "v0", "05", "assets"), { recursive: true });
    writeFileSync(join(dir, "v0", "05", "index.html"), `<!doctype html><html><head><link rel="stylesheet" href="/assets/app.css"></head><body><main><section><h1>Boilers fixed the same day in Brackley</h1><p>Call Tidewell on 01280 000000.</p></section></main></body></html>`);
    writeFileSync(join(dir, "v0", "05", "assets", "app.css"), `body{margin:0;background:rgb(20,24,40);color:#fff;font-family:"Poppins",sans-serif}`);
    const out: string[] = [];
    const err: string[] = [];
    const io = { cwd: dir, out: (t: string) => out.push(t), err: (t: string) => err.push(t) };
    const code = await run(["null", "import", "v0", "--builder", "v0", "--brief", "Tidewell Plumbing, a heating engineer in Brackley."], io);
    expect(err).toEqual([]);
    expect(code).toBe(0);
    expect(out.join("\n")).toMatch(/5 of 5 pages from v0 in v0\/null\.json/);
    const model = JSON.parse(readFileSync(join(dir, "v0", "null.json"), "utf8")) as NullModel;
    expect(model).toMatchObject({ version: 1, builder: "v0", model: "unknown", prompt: nullPrompt("Tidewell Plumbing, a heating engineer in Brackley.") });
    expect(model.runs.map((r) => r.id)).toEqual(["01", "02", "03", "04", "05"]);
    // The stylesheet reached the page: the dark ground is measured, and its face is scanned.
    const app = model.runs[4];
    expect(app.fingerprint.ground.l).toBeLessThan(0.3);
    expect(app.tells).toContain("reflex-font");
    const shot = JSON.parse(readFileSync(join(dir, "v0", "snapshots", "05.json"), "utf8"));
    expect(shot.url).toBe("05/index.html");
    // Resumable: a second run takes no snapshot again.
    out.length = 0;
    expect(await run(["null", "import", "v0", "--builder", "v0", "--brief", "Tidewell Plumbing, a heating engineer in Brackley."], io)).toBe(0);
    expect(out.join("\n")).not.toMatch(/snapshotting/);
  }, 120_000);
});

