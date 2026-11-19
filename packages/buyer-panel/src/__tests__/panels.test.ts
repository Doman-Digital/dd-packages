import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CAPSULE_FILE_PREFIX, isCapsuleFile, validatePanel, type Panel } from "../config.js";
import { checkGrading, loadGradingContext, resolveGradingPath } from "../grading-context.js";
import { runPanel } from "../run.js";

// The panel files this package ships (DOM-18300). Each one must parse, pass the same checks a run makes, and name its
// grading files in a form that works on any machine: a capsule path, or a repo's own checkout under ~/GitHub.
const PANELS = fileURLToPath(new URL("../../panels/", import.meta.url));
const files = readdirSync(PANELS).filter((f) => f.endsWith(".json"));

describe("the panel files in panels/", () => {
  it("there is at least one, and none is the retired preview panel", () => {
    expect(files.length).toBeGreaterThan(0);
    expect(files).not.toContain("dd-redesign.json");
  });

  for (const f of files) {
    describe(f, () => {
      const raw = JSON.parse(readFileSync(join(PANELS, f), "utf8")) as Panel;
      const p = validatePanel(raw, PANELS);

      it("parses and passes the run's own checks (models priced, two variants, profiles)", () => {
        expect(p.name).toBeTruthy();
        expect(p.variants.length).toBeGreaterThanOrEqual(2);
        expect(p.profiles.length).toBeGreaterThan(0);
      });

      it("names its grading files portably, as a capsule path or a checkout under ~/GitHub", () => {
        for (const path of [raw.grading.journeyMap, raw.grading.brandFacts.path]) {
          expect(path).not.toMatch(/^\/(home|Users)\//);
          expect(path).not.toMatch(/\.claude\/worktrees\//);
          expect(path).not.toMatch(/dd-journey-map-v1/);
          expect(isCapsuleFile(path) || path.startsWith("~/GitHub/")).toBe(true);
        }
      });

      it("keeps a capsule map in its own client's folder", () => {
        if (!isCapsuleFile(raw.grading.journeyMap)) return;
        expect(raw.grading.journeyMap.slice(CAPSULE_FILE_PREFIX.length).split("/")[0]).toBe(p.client);
      });

      it("lists each brand-facts section once", () => {
        const inc = p.grading.brandFacts.include;
        expect(inc.length).toBeGreaterThan(0);
        expect(new Set(inc).size).toBe(inc.length);
      });
    });
  }
});

describe("grading paths in a panel file", () => {
  const raw = JSON.parse(readFileSync(join(PANELS, files[0]!), "utf8")) as Panel;
  const withGrading = (g: Partial<Panel["grading"]>): Panel => ({ ...raw, grading: { ...raw.grading, ...g } });

  it("keeps a capsule path as a token, so a panel parses where there is no capsule (CI)", () => {
    expect(validatePanel(withGrading({ journeyMap: "storage:capsule/x/panel/inputs/map.txt" })).grading.journeyMap).toBe("storage:capsule/x/panel/inputs/map.txt");
  });
  it("refuses another storage token, an escape from the capsule, and an empty path inside it", () => {
    expect(() => validatePanel(withGrading({ journeyMap: "storage:metrics/x.txt" }))).toThrow(/not a capsule path/);
    expect(() => validatePanel(withGrading({ journeyMap: "storage:capsule/../etc/passwd" }))).toThrow(/inside the capsule/);
    expect(() => validatePanel(withGrading({ journeyMap: "storage:capsule/" }))).toThrow(/inside the capsule/);
  });
  it("refuses a path inside a git worktree, which disappears when its session ends", () => {
    const facts = { path: "/home/someone/GitHub/Repo/.claude/worktrees/teardown-x/docs/brand-facts.json", include: ["entity"] };
    expect(() => validatePanel(withGrading({ brandFacts: facts }))).toThrow(/inside a git worktree/);
  });
  it("refuses a panel that gives the evaluator no brand-facts section", () => {
    expect(() => validatePanel(withGrading({ brandFacts: { path: "facts.json", include: [] } }))).toThrow(/brandFacts.include/);
  });
});

describe("checkGrading: a missing journey map is refused before anything is paid for", () => {
  let dir: string;
  let capsule: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "buyer-panel-grading-"));
    capsule = join(dir, "capsule");
    mkdirSync(join(capsule, "acme", "panel", "inputs"), { recursive: true });
    writeFileSync(join(dir, "facts.json"), JSON.stringify({ version: 7, entity: { name: "Acme" }, pricing: { from: 1 } }));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const panel = (journeyMap: string, include = ["entity"]): Panel =>
    ({ grading: { journeyMap, brandFacts: { path: join(dir, "facts.json"), include }, knownStates: [] } }) as unknown as Panel;
  const cap = () => capsule;

  it("resolves a capsule path in the capsule's working copy", () => {
    expect(resolveGradingPath("storage:capsule/acme/panel/inputs/map.txt", cap)).toBe(join(capsule, "acme/panel/inputs/map.txt"));
    expect(resolveGradingPath("/abs/map.txt", cap)).toBe("/abs/map.txt");
  });
  it("refuses a map that does not exist, naming both the token and the file", () => {
    expect(() => checkGrading(panel("storage:capsule/acme/panel/inputs/map.txt"), cap)).toThrow(
      /grading\.journeyMap: no file at .*acme\/panel\/inputs\/map\.txt \(from storage:capsule\/acme\/panel\/inputs\/map\.txt\)/,
    );
    expect(() => checkGrading(panel(join(dir, "gone.html")), cap)).toThrow(/grading\.journeyMap: no file at/);
  });
  it("refuses an empty map and a folder", () => {
    writeFileSync(join(capsule, "acme/panel/inputs/map.txt"), "  \n");
    expect(() => checkGrading(panel("storage:capsule/acme/panel/inputs/map.txt"), cap)).toThrow(/is empty/);
    expect(() => checkGrading(panel("storage:capsule/acme/panel/inputs"), cap)).toThrow(/no file at/);
  });
  it("refuses a brand-facts section the file does not hold", () => {
    writeFileSync(join(capsule, "acme/panel/inputs/map.txt"), "Expected answers");
    expect(() => checkGrading(panel("storage:capsule/acme/panel/inputs/map.txt", ["entity", "founderDecisions2099"]), cap)).toThrow(/no section "founderDecisions2099"/);
  });
  it("loads the map and only the included sections when everything is there", () => {
    writeFileSync(join(capsule, "acme/panel/inputs/map.txt"), "Expected answers");
    const ctx = loadGradingContext(panel("storage:capsule/acme/panel/inputs/map.txt"), cap);
    expect(ctx.journeyMap).toBe("Expected answers");
    expect(JSON.parse(ctx.brandFacts)).toEqual({ entity: { name: "Acme" } });
    expect(ctx.brandFactsVersion).toBe("7");
  });
  it("stops a run at the start, before any buyer session, when the map is missing", async () => {
    const raw = JSON.parse(readFileSync(join(PANELS, files[0]!), "utf8")) as Panel;
    const p = validatePanel({ ...raw, archive: join(dir, "runs"), grading: { ...raw.grading, journeyMap: join(dir, "gone.txt"), brandFacts: { path: join(dir, "facts.json"), include: ["entity"] } } });
    const lines: string[] = [];
    await expect(runPanel(p, { version: "20261119", log: (l) => lines.push(l) })).rejects.toThrow(/grading\.journeyMap: no file at/);
    expect(lines).toEqual([]);
    expect(existsSync(join(dir, "runs", p.client, "panel", "runs"))).toBe(false);
  });
});

// On the box that runs the panels (dd-work-01), the shipped panels' files are really there: the capsule's working copy
// and the repo checkout. CI has neither, so this part runs only where both exist; the checks above are the CI guard.
const capsuleHome = join(homedir(), "dd-client-capsule");
describe.skipIf(!existsSync(capsuleHome))("the shipped panels' grading files on this machine", () => {
  for (const f of files) {
    it(`${f}: the journey map and every brand-facts section resolve`, () => {
      const p = validatePanel(JSON.parse(readFileSync(join(PANELS, f), "utf8")) as Panel, PANELS);
      const facts = p.grading.brandFacts.path;
      if (!isCapsuleFile(facts) && !existsSync(facts)) return;
      expect(() => checkGrading(p, () => capsuleHome)).not.toThrow();
    });
  }
});
