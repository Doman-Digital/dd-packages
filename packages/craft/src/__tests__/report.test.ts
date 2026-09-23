import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CATALOGUE } from "../character/check.js";
import { run } from "../character/cli.js";
import type { CheckReport, Finding } from "../character/types.js";
import type { ArtDirection, DirectionReport } from "../direction/types.js";
import type { EstateMatch } from "../estate/index.js";
import type { Typicality } from "../null/index.js";
import { characterReport } from "../report/index.js";
import { retrofitPlan } from "../report/retrofit.js";
import { makeSnapshot } from "../snapshot/fixture.js";

const COPY = new Set(CATALOGUE.filter((t) => t.surface === "copy").map((t) => t.id));

const finding = (tell: string, line = 0): Finding => {
  const t = CATALOGUE.find((x) => x.id === tell)!;
  return { tell, name: t.name, generation: t.generation, severity: "warn", path: line ? "src/Hero.tsx" : "https://site.test/", line, excerpt: "", message: "", fix: t.fix };
};
const findings = (list: Finding[]): CheckReport => ({
  catalogueVersion: "test",
  findings: list,
  rejectedExceptions: [],
  excepted: [],
  suppressed: [],
  summary: { files: 1, findings: list.length, byGeneration: { 1: 0, 2: 0, 3: 0 }, byTell: {}, blocking: 0 },
});
const typical = (score: number, shared: Typicality["shared"] = []): Typicality => ({ score, typical: score >= 0.1, distance: 0.2, baseline: 0.25, nearest: [], shared });
const decided: DirectionReport = { valid: true, problems: [], decided: 7 };
const undecided: DirectionReport = { valid: true, problems: [{ severity: "warn", at: "choices.accent", message: "not decided yet" }], decided: 3 };
const noSibling: EstateMatch[] = [{ id: "chair", distance: 0.7, sibling: false, shared: [] }];

describe("the verdict", () => {
  it("is default when two or more signals are raised", () => {
    const r = characterReport({ site: "s", findings: findings([finding("reflex-font"), finding("pill-everything"), finding("glass-panel")]), typicality: typical(0.6), estate: noSibling, direction: decided }, COPY);
    expect(r.verdict).toBe("default");
    expect(r.signals.filter((s) => s.raised).map((s) => s.id)).toEqual(["tells", "typicality"]);
  });

  it("is mixed when one is raised, and names it", () => {
    const r = characterReport({ site: "s", findings: findings([finding("reflex-font")]), typicality: typical(0.02), estate: [{ id: "dd", distance: 0.28, sibling: true, shared: ["Fraunces headline"] }], direction: decided }, COPY);
    expect(r.verdict).toBe("mixed");
    expect(r.summary).toMatch(/estate/);
  });

  it("is decided only when every signal was measured and none raised", () => {
    const r = characterReport({ site: "s", findings: findings([finding("marquee")]), typicality: typical(0.02), estate: noSibling, direction: decided }, COPY);
    expect(r.verdict).toBe("decided");
  });

  it("is unproven, never decided, when something was not measured", () => {
    // The same clean site with no art-direction.json and no null model.
    const r = characterReport({ site: "s", findings: findings([finding("marquee")]), estate: noSibling }, COPY);
    expect(r.verdict).toBe("unproven");
    expect(r.summary).toMatch(/typicality, reasons not measured/);
    expect(r.signals.find((s) => s.id === "reasons")?.raised).toBeNull();
  });

  it("counts too few reasons as a raised signal", () => {
    const r = characterReport({ site: "s", findings: findings([]), typicality: typical(0.02), estate: noSibling, direction: undecided }, COPY);
    expect(r.verdict).toBe("mixed");
    expect(r.signals.find((s) => s.id === "reasons")).toMatchObject({ raised: true, detail: "3 of 7 choices decided with a reason" });
  });
});

describe("the actions", () => {
  it("decides before it changes, then goes surface by surface", () => {
    const r = characterReport({ site: "s", findings: findings([finding("pill-everything", 12), finding("reflex-font", 3), finding("reflex-font"), finding("em-dash", 9)]), direction: undecided }, COPY);
    expect(r.actions[0]).toMatchObject({ area: "direction", what: "Decide accent, with a source from the client's world.", choice: "accent" });
    // In source and on the page comes before source only; copy comes last.
    expect(r.actions.map((a) => a.area)).toEqual(["direction", "type", "shape", "copy"]);
    expect(r.actions[1].why).toMatch(/in source and on the page/);
  });

  it("names the model's pick to move off, but never a default or an absence", () => {
    const r = characterReport(
      {
        site: "s",
        typicality: typical(0.5, [
          { part: "motion", value: "no scroll reveals", runs: 20, of: 20 },
          { part: "ground", value: "white", runs: 19, of: 20 },
          { part: "display", value: "Fraunces", runs: 13, of: 20 },
        ]),
      },
      COPY,
    );
    const moves = r.actions.filter((a) => a.what.startsWith("Move off"));
    expect(moves.map((a) => a.what)).toEqual(["Move off the model's pick for this brief: display Fraunces."]);
    expect(moves[0]).toMatchObject({ area: "type", choice: "display", why: "13 of 20 null pages chose it" });
  });

  it("says what to change to stop being a sibling, and leaves the absences alone", () => {
    const r = characterReport({ site: "s", estate: [{ id: "dd", distance: 0.28, sibling: true, shared: ["no accent", "Fraunces headline", "no reveals"] }] }, COPY);
    const differ = r.actions.filter((a) => a.what.startsWith("Differ"));
    // Type before colour, the order the retrofit works in.
    expect(differ.map((a) => a.what)).toEqual(["Differ from dd: both have Fraunces headline.", "Differ from dd: both have no accent."]);
    expect(differ.map((a) => a.choice)).toEqual(["display", "accent"]);
  });
});

describe("one change per choice", () => {
  it("folds a tell, the null and a sibling that all point at the display face into one action", () => {
    const r = characterReport(
      {
        site: "s",
        findings: findings([finding("reflex-font-2", 3), finding("reflex-font-2"), finding("italic-serif-display", 5)]),
        typicality: typical(0.4, [{ part: "display", value: "Fraunces", runs: 13, of: 20 }]),
        estate: [{ id: "hjbeauty", distance: 0.28, sibling: true, shared: ["Fraunces headline"] }],
      },
      COPY,
    );
    const type = r.actions.filter((a) => a.area === "type");
    expect(type).toHaveLength(1);
    expect(type[0].what).toMatch(/^Pick the display face from the client's world/);
    expect(type[0].why).toMatch(/reflex-font-2[\s\S]*Move off the model's pick for this brief: display Fraunces \(13 of 20[\s\S]*Differ from hjbeauty: both have Fraunces headline \(sibling at 0\.28\)/);
    expect(type[0].priority).toBe(1);
    // A second tell on the same choice adds its name, not its fix again.
    expect(type[0].why).toMatch(/; Italic serif display \(italic-serif-display, gen 2\)/);
    expect(type[0].why.match(/Pick the display face/g)).toBeNull();
  });
});

describe("the retrofit plan", () => {
  const direction: ArtDirection = {
    version: 1,
    client: "RMP Electrical",
    brief: "Electricians based in Uxbridge covering London and the Home Counties.",
    sources: [{ id: "van", kind: "livery", note: "The vans parked at the Uxbridge yard" }],
    choices: { accent: { value: "#1f6f4a", because: "The green on the side of every van, the colour customers already know.", evidence: ["van"] } },
  };

  it("shows the decided value where there is one, and waits where there is not", () => {
    const r = characterReport({ site: "https://rmp.test/", findings: findings([finding("ai-violet", 4), finding("reflex-font", 2)]) }, COPY);
    const plan = retrofitPlan(r, direction);
    expect(plan).toMatch(/^# Retrofit: https:\/\/rmp\.test\//);
    expect(plan).toMatch(/## 1\. Decide first/);
    expect(plan).toMatch(/Use: \*\*#1f6f4a\*\* for accent\. The green on the side of every van/);
    expect(plan).toMatch(/Waits on: deciding \*\*display\*\*/);
    expect(plan).toMatch(/## Leave alone[\s\S]*never the page grammar/);
    expect(plan).not.toMatch(/—/);
  });

  it("does not treat a proposal as a decision", () => {
    const proposed: ArtDirection = { ...direction, choices: { accent: { ...direction.choices.accent!, because: "PROPOSED: taken from the van." } } };
    const plan = retrofitPlan(characterReport({ site: "s", findings: findings([finding("ai-violet", 4)]) }, COPY), proposed);
    expect(plan).toMatch(/Waits on: deciding \*\*accent\*\*/);
  });
});

describe("craft report and craft retrofit", () => {
  let dir: string;
  let out: string[];
  let err: string[];
  const io = () => ({ cwd: dir, out: (t: string) => out.push(t), err: (t: string) => err.push(t) });
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "craft-report-"));
    out = [];
    err = [];
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("reports a saved snapshot, says what was not measured, and fails --strict unless decided", async () => {
    const base = makeSnapshot();
    const pills = makeSnapshot({ controls: base.controls.map((c) => ({ ...c, radiusPx: 999 })), fonts: [{ family: "Inter", chars: 5000, displayChars: 900, italicChars: 0, weights: [400, 700] }] });
    writeFileSync(join(dir, "home.json"), JSON.stringify(pills));
    expect(await run(["report", "home.json"], io())).toBe(0);
    const text = out.join("\n");
    expect(text).toMatch(/Verdict: (UNPROVEN|MIXED|DEFAULT)\./);
    expect(text).toMatch(/typicality\s+·\s+not measured: no null model/);
    expect(text).toMatch(/reasons\s+·\s+not measured: no art-direction\.json/);
    expect(await run(["report", "home.json", "--strict"], io())).toBe(1);
  });

  it("writes the retrofit checklist", async () => {
    writeFileSync(join(dir, "home.json"), JSON.stringify(makeSnapshot()));
    expect(await run(["retrofit", "home.json", "--out", "RETROFIT.md"], io())).toBe(0);
    expect(out[0]).toMatch(/craft retrofit: \d+ steps? for https:\/\/example\.test\/ in RETROFIT\.md/);
    expect(readFileSync(join(dir, "RETROFIT.md"), "utf8")).toMatch(/## 1\. Decide first[\s\S]*Write art-direction\.json/);
  });

  it("says what it needs", async () => {
    expect(await run(["report"], io())).toBe(2);
    expect(err.join("\n")).toMatch(/usage: craft report\|retrofit/);
    writeFileSync(join(dir, "home.json"), JSON.stringify(makeSnapshot()));
    expect(await run(["report", "home.json", "--direction", "missing.json"], io())).toBe(2);
    expect(err.join("\n")).toMatch(/no such file: missing\.json/);
  });
});
