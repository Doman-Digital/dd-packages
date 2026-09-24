import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { calibrate, designTells, formatCalibration, isFlagged, type MeasuredPage } from "../calibrate/index.js";
import { parseLabels } from "../calibrate/cli.js";
import { run } from "../character/cli.js";
import { makeSnapshot } from "../snapshot/fixture.js";

/**
 * Calibration measures the catalogue against pages a person labelled. Each
 * number here is worked out by hand from pages built for it, so a change to
 * how precision, recall or a target is counted shows up as a changed number.
 */

// Three design tells (source and rendered), and one copy tell that must not count towards tell-heavy.
const HEAVY = ["reflex-font", "pill-everything", "glass-panel"];
const page = (id: string, label: MeasuredPage["label"], tells: string[], extra: Partial<MeasuredPage> = {}): MeasuredPage => ({ id, label, tells, blocking: 0, ...extra });

describe("the verdict", () => {
  it("counts design tells only towards tell-heavy", () => {
    expect(designTells(["reflex-font", "ai-vocabulary", "not-a-tell"])).toEqual(["reflex-font"]);
    expect(isFlagged(page("a", "ai", HEAVY))).toBe(true);
    // Two design tells and a copy tell: still two.
    expect(isFlagged(page("b", "ai", ["reflex-font", "pill-everything", "ai-vocabulary"]))).toBe(false);
  });

  it("flags a typical page with no tells at all", () => {
    expect(isFlagged(page("a", "ai", [], { typicality: { score: 0.4, typical: true } }))).toBe(true);
    expect(isFlagged(page("a", "ai", [], { typicality: { score: 0.02, typical: false } }))).toBe(false);
  });
});

describe("calibrate", () => {
  const pages = [
    page("ai-1", "ai", HEAVY),
    page("ai-2", "ai", ["reflex-font"]),
    page("look-1", "ai-looking", ["reflex-font", "pill-everything", "glass-panel"]),
    page("human-1", "human", ["reflex-font"]),
    page("human-2", "human", []),
  ];

  it("counts a hit on ai or ai-looking for a tell, and a hit on human against it", () => {
    const c = calibrate(pages);
    const font = c.tells.find((t) => t.tell === "reflex-font");
    // Hit on 2 ai, 1 ai-looking, 1 human: precision 3/4; 3 of 3 positive pages.
    expect(font).toEqual({ tell: "reflex-font", hits: { ai: 2, "ai-looking": 1, human: 1 }, precision: 0.75, recall: 1 });
    const glass = c.tells.find((t) => t.tell === "glass-panel");
    expect(glass).toMatchObject({ precision: 1, recall: 0.67 });
    // Most hits first.
    expect(c.tells[0].tell).toBe("reflex-font");
  });

  it("lists the catalogue tells that never fired", () => {
    const c = calibrate(pages);
    expect(c.silent).not.toContain("reflex-font");
    expect(c.silent).toContain("ai-violet");
  });

  it("checks the first three targets", () => {
    const c = calibrate(pages);
    expect(c.typicality).toBe(false);
    // 1 of 2 ai pages flagged: under 90%.
    expect(c.targets[0]).toMatchObject({ met: false, detail: expect.stringMatching(/^1 of 2 \(50%\) flagged/) });
    // No block hits, typicality not measured: not known, never a pass.
    expect(c.targets[1]).toMatchObject({ met: null, detail: expect.stringMatching(/typicality not measured/) });
    expect(c.targets[2]).toMatchObject({ met: true });
  });

  it("fails target 2 on a single block hit", () => {
    const c = calibrate([page("h", "human", [], { blocking: 1, typicality: { score: 0, typical: false } })]);
    expect(c.targets[1].met).toBe(false);
  });

  it("meets target 2 with no block hits and few typical", () => {
    const humans = Array.from({ length: 10 }, (_, i) => page(`h${i}`, "human", [], { typicality: { score: i === 0 ? 0.3 : 0, typical: i === 0 } }));
    expect(calibrate(humans).targets[1]).toMatchObject({ met: true, detail: expect.stringMatching(/1 of 10 \(10%\) typical/) });
    humans[1] = { ...humans[1], typicality: { score: 0.3, typical: true } };
    expect(calibrate(humans).targets[1].met).toBe(false);
  });

  it("says a target is not known when no page with that label was measured", () => {
    const c = calibrate([page("ai-1", "ai", HEAVY)], [{ id: "look", label: "ai-looking", reason: "would not render" }]);
    expect(c.targets[2]).toMatchObject({ met: null, detail: "no page measured; 1 not measured, counted neither way" });
  });

  it("counts an unmeasured page neither way, and names it", () => {
    const c = calibrate([page("ai-1", "ai", HEAVY)], [{ id: "ai-2", label: "ai", reason: "HTTP 404" }]);
    expect(c.labels.find((l) => l.label === "ai")?.pages).toBe(1);
    expect(c.targets[0]).toMatchObject({ met: true, detail: expect.stringMatching(/1 not measured/) });
    expect(formatCalibration(c)).toMatch(/Not measured: 1\. A page not measured never counts as a pass\.\n\s+ai-2 \(ai\): HTTP 404/);
  });

  it("uses typicality only when every page has it", () => {
    const c = calibrate([page("a", "ai", [], { typicality: { score: 0.5, typical: true } }), page("b", "human", [])]);
    expect(c.typicality).toBe(false);
    expect(c.labels.find((l) => l.label === "ai")?.flagged).toBe(0);
  });
});

describe("the labels file", () => {
  const ok = { version: 1, pages: [{ id: "plumber", label: "ai", snapshot: "p.json" }] };

  it("reads a good one", () => {
    expect(parseLabels(ok, "labels.json").pages).toHaveLength(1);
  });

  it.each([
    [{ ...ok, version: 2 }, /needs "version": 1/],
    [{ version: 1, pages: [] }, /at least one page/],
    [{ version: 1, pages: [{ id: "Plumber", label: "ai", snapshot: "p" }] }, /lower case/],
    [{ version: 1, pages: [{ id: "a", label: "ai", snapshot: "p" }, { id: "a", label: "human", snapshot: "q" }] }, /listed twice/],
    [{ version: 1, pages: [{ id: "a", label: "robot", snapshot: "p" }] }, /one of ai, ai-looking, human/],
    [{ version: 1, pages: [{ id: "a", label: "ai" }] }, /needs a snapshot, a source or a url/],
    [{ ...ok, null: "null" }, /"null" is a list/],
  ])("refuses %j", (raw, message) => {
    expect(() => parseLabels(raw, "labels.json")).toThrow(message);
  });

  it("takes a skip in place of a page", () => {
    expect(parseLabels({ version: 1, pages: [{ id: "gated", label: "human", skip: "a preview gate" }] }, "l").pages[0].skip).toBe("a preview gate");
  });
});

describe("craft calibrate", () => {
  let dir: string;
  let out: string[];
  let err: string[];
  const io = () => ({ cwd: dir, out: (t: string) => out.push(t), err: (t: string) => err.push(t) });

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "craft-calibrate-"));
    out = [];
    err = [];
    mkdirSync(join(dir, "set"));
    // A decided page, and the same page with a violet accent, glass panels and a grid background.
    writeFileSync(join(dir, "set", "decided.json"), JSON.stringify(makeSnapshot()));
    writeFileSync(join(dir, "set", "generated.html"), `<html><head><style>body{font-family:"Inter",sans-serif}.b{border-radius:9999px}.c{backdrop-filter:blur(12px)}</style></head><body><h1>Elevate your smile</h1></body></html>`);
    writeFileSync(join(dir, "set", "generated.json"), JSON.stringify(makeSnapshot()));
    writeFileSync(
      join(dir, "set", "labels.json"),
      JSON.stringify({
        version: 1,
        pages: [
          { id: "generated", label: "ai", snapshot: "generated.json", source: "generated.html" },
          { id: "decided", label: "human", snapshot: "decided.json" },
          { id: "gated", label: "human", skip: "a preview gate, not the site" },
        ],
      }),
    );
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("reads pinned snapshots, scans the source, and names what it could not measure", async () => {
    expect(await run(["calibrate", "set/labels.json"], io())).toBe(0);
    const text = out.join("\n");
    expect(text).toMatch(/craft calibrate: 2 pages measured \(1 ai, 0 ai-looking, 1 human\)/);
    expect(text).toMatch(/gated \(human\): a preview gate, not the site/);
    expect(text).toMatch(/No null models: flagged means tell-heavy only\./);
    // The source scan found the reflex face on the generated page only.
    expect(text).toMatch(/reflex-font\s+1\/1\s+0\/0\s+0\/1\s+1\.00\s+1\.00/);
    expect(err).toEqual([]);
  });

  it("writes results.json under --out, versioned, with every page", async () => {
    expect(await run(["calibrate", "set/labels.json", "--out", "results"], io())).toBe(0);
    const saved = JSON.parse(readFileSync(join(dir, "results", "results.json"), "utf8"));
    expect(saved.schemaVersion).toBe(1);
    expect(saved.labelsFile).toBe("../set/labels.json");
    expect(Object.keys(saved.pages)).toEqual(["generated", "decided"]);
    expect(saved.unmeasured).toEqual([{ id: "gated", label: "human", reason: "a preview gate, not the site" }]);
    expect(saved.targets).toHaveLength(3);
  });

  it("prints the same as JSON", async () => {
    expect(await run(["calibrate", "set/labels.json", "--json"], io())).toBe(0);
    const data = JSON.parse(out.join("\n"));
    expect(data.pages.generated.tells).toContain("reflex-font");
    expect(data.labels.map((l: { label: string }) => l.label)).toEqual(["ai", "ai-looking", "human"]);
  });

  it("says which snapshots predate version 2", async () => {
    writeFileSync(join(dir, "set", "decided.json"), JSON.stringify({ ...makeSnapshot(), version: 1 }));
    expect(await run(["calibrate", "set/labels.json"], io())).toBe(0);
    expect(out.join("\n")).toMatch(/1 of 2 snapshots are older than version 2/);
  });

  it("with --fresh and nothing to take a snapshot from, lists the page as not measured", async () => {
    writeFileSync(join(dir, "set", "labels.json"), JSON.stringify({ version: 1, pages: [{ id: "decided", label: "human", snapshot: "decided.json" }] }));
    expect(await run(["calibrate", "set/labels.json", "--fresh"], io())).toBe(0);
    expect(out.join("\n")).toMatch(/decided \(human\): --fresh, and no source or url to take one from/);
  });

  it("says what it needs", async () => {
    expect(await run(["calibrate"], io())).toBe(2);
    expect(err.join("\n")).toMatch(/usage: craft calibrate <labels\.json>/);
    expect(await run(["calibrate", "nowhere.json"], io())).toBe(2);
    expect(err.join("\n")).toMatch(/no labels file at nowhere\.json/);
  });
});
