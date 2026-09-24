import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyBaseline, createBaseline, parseBaseline } from "../character/baseline.js";
import { CATALOGUE, scanSource } from "../character/check.js";
import { run } from "../character/cli.js";
import { applySeverity, globToRegExp, ignoreMatcher, parseCraftConfig } from "../character/config.js";
import { JSON_SCHEMA_VERSION } from "../character/json.js";
import { toSarif } from "../character/sarif.js";
import type { CheckReport } from "../character/types.js";
import { parseSitemap, parseUrlList, parseViewports } from "../audit/pages.js";

const TELLS = new Set(CATALOGUE.map((t) => t.id));
const VIOLET = `.a { color: #7c3aed; }`;

describe("craft.config.json", () => {
  it("accepts ignore, copyPaths and severity with a reason", () => {
    const config = parseCraftConfig(
      { ignore: ["docs/**"], copyPaths: ["content"], severity: { "ai-violet": { level: "off", because: "The shopfront has been this violet since 1998." } } },
      TELLS,
    );
    expect(config.ignore).toEqual(["docs/**"]);
    expect(config.copyPaths).toEqual(["content"]);
    expect(config.severity["ai-violet"].level).toBe("off");
  });

  it.each([
    [{ ignores: [] }, /unknown key "ignores"/],
    [{ ignore: "docs" }, /"ignore" must be an array/],
    [{ severity: { "no-such-tell": { level: "off", because: "a sentence long enough" } } }, /no tell called "no-such-tell"/],
    [{ severity: { "ai-violet": { level: "never", because: "a sentence long enough" } } }, /level of "warn", "block" or "off"/],
    [{ severity: { "ai-violet": { level: "off" } } }, /needs a because/],
    [{ severity: { "ai-violet": { level: "off", because: "brand" } } }, /needs a because/],
  ])("refuses %j", (data, message) => {
    expect(() => parseCraftConfig(data, TELLS)).toThrow(message);
  });

  it("changes a tell's severity after the run", () => {
    const report = scanSource([{ path: "a.css", text: VIOLET }]);
    const blocked = applySeverity(report, { ignore: [], severity: { "ai-violet": { level: "block", because: "This client's rule, in writing." } } });
    expect(blocked.findings.every((f) => f.tell !== "ai-violet" || f.severity === "block")).toBe(true);
    expect(blocked.summary.blocking).toBeGreaterThan(0);
  });
});

describe("ignore globs", () => {
  it.each([
    [".claude", ".claude/agents/cmo.md", true],
    [".claude", "apps/web/.claude/x.md", true],
    [".claude", "src/claude.md", false],
    ["docs/archive/**", "docs/archive/2024/a.md", true],
    ["docs/archive/**", "docs/archive", true],
    ["docs/archive/**", "site/docs/archive/a.md", false],
    ["*.stories.tsx", "src/Button.stories.tsx", true],
    ["*.stories.tsx", "src/Button.tsx", false],
    ["src/**/fixtures", "src/a/b/fixtures/x.html", true],
    ["page-?.md", "content/page-1.md", true],
  ])("%s on %s is %s", (glob, path, matches) => {
    expect(globToRegExp(glob).test(path)).toBe(matches);
  });

  it("normalises Windows separators", () => {
    expect(ignoreMatcher(["docs/**"])("docs\\a.md")).toBe(true);
  });
});

describe("baselines", () => {
  const scan = (text: string): CheckReport => scanSource([{ path: "a.css", text }]);

  it("hides every known finding, and says how many", () => {
    const report = scan(VIOLET);
    const result = applyBaseline(report, createBaseline(report));
    expect(result.findings).toEqual([]);
    expect(result.summary.findings).toBe(0);
    expect(result.baselined).toBe(report.findings.length);
  });

  it("matches a finding that moved down the file: the key is not the line", () => {
    const baseline = createBaseline(scan(VIOLET));
    const moved = scan(`\n\n\n${VIOLET}`);
    expect(moved.findings[0].line).toBeGreaterThan(1);
    expect(applyBaseline(moved, baseline).findings).toEqual([]);
  });

  it("reports a second copy of a known finding: keys are counted", () => {
    const one = scan(VIOLET);
    const baseline = createBaseline(one);
    const twice: CheckReport = { ...one, findings: [...one.findings, { ...one.findings[0], line: 99 }] };
    const result = applyBaseline(twice, baseline);
    expect(result.findings).toEqual([{ ...one.findings[0], line: 99 }]);
    expect(result.baselined).toBe(one.findings.length);
  });

  it("refuses a file that is not a baseline", () => {
    expect(() => parseBaseline({ version: 2, entries: [] })).toThrow(/not a craft baseline/);
    expect(() => parseBaseline({ version: 1, entries: [{ tell: "x" }] })).toThrow(/malformed entry/);
  });
});

describe("SARIF", () => {
  it("writes one rule per tell found, errors for blocks and warnings otherwise", () => {
    const report = applySeverity(scanSource([{ path: "src\\a.css", text: VIOLET }]), {
      ignore: [],
      severity: { "ai-violet": { level: "block", because: "This client's rule, in writing." } },
    });
    const sarif = toSarif(report, { tells: CATALOGUE });
    expect(sarif.version).toBe("2.1.0");
    const [runOut] = sarif.runs;
    expect(runOut.tool.driver.name).toBe("craft");
    const ruleIds = runOut.tool.driver.rules.map((r) => r.id);
    for (const r of runOut.results) {
      expect(ruleIds[r.ruleIndex]).toBe(r.ruleId);
      expect(r.level).toBe(r.ruleId === "ai-violet" ? "error" : "warning");
      expect(r.locations[0].physicalLocation.artifactLocation.uri).toBe("src/a.css");
      expect(r.locations[0].physicalLocation.region?.startLine).toBeGreaterThan(0);
      expect(r.partialFingerprints["craftFinding/v1"]).toMatch(/^[0-9a-f]{8}$/);
    }
    const violet = runOut.tool.driver.rules.find((r) => r.id === "ai-violet")!;
    expect(violet.help?.text).toBe(CATALOGUE.find((t) => t.id === "ai-violet")!.fix);
  });

  it("gives a rendered finding its URL and no line", () => {
    const report: CheckReport = {
      ...scanSource([]),
      findings: [{ tell: "ai-violet", name: "x", generation: 1, severity: "warn", path: "https://a.example/", line: 0, excerpt: "", message: "m", fix: "f" }],
    };
    const [result] = toSarif(report, { tells: CATALOGUE }).runs[0].results;
    expect(result.locations[0].physicalLocation).toEqual({ artifactLocation: { uri: "https://a.example/" } });
  });
});

describe("page lists", () => {
  it("reads a sitemap, decoding entities", () => {
    const xml = `<?xml version="1.0"?><urlset><url><loc>https://a.example/</loc></url><url><loc> https://a.example/?a=1&amp;b=2 </loc></url></urlset>`;
    expect(parseSitemap(xml)).toEqual({ urls: ["https://a.example/", "https://a.example/?a=1&b=2"], sitemaps: [] });
  });

  it("reads a sitemap index as sitemaps to follow", () => {
    const xml = `<sitemapindex><sitemap><loc>https://a.example/pages.xml</loc></sitemap></sitemapindex>`;
    expect(parseSitemap(xml)).toEqual({ urls: [], sitemaps: ["https://a.example/pages.xml"] });
  });

  it("reads a list of URLs, skipping blanks and comments", () => {
    expect(parseUrlList("https://a.example/\n\n# about\nhttps://a.example/about\n")).toEqual(["https://a.example/", "https://a.example/about"]);
  });

  it("gives each width the height of its first screen", () => {
    expect(parseViewports("390, 768,1440")).toEqual([
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ]);
    expect(() => parseViewports("390,wide")).toThrow(/"wide" is not a width/);
    expect(() => parseViewports("100")).toThrow(/between 240 and 3840/);
  });
});

describe("the command line", () => {
  let dir: string;
  let out: string[];
  let err: string[];
  const io = () => ({ cwd: dir, out: (t: string) => out.push(t), err: (t: string) => err.push(t) });
  const write = (path: string, text: string): void => {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), text);
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "craft-ci-"));
    out = [];
    err = [];
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("never walks agent folders: .claude, .agents, .cursor", () => {
    for (const folder of [".claude", ".agents", ".cursor"]) write(`${folder}/notes.css`, VIOLET);
    write("src/ok.css", `.a { color: #0f766e; }`);
    expect(run(["scan", "--strict"], io())).toBe(0);
    write(".claude/skill.md", "We build websites — fast, and we leverage seamless synergy.");
    expect(run(["copy", ".", "--gate"], io())).toBe(0);
  });

  it("still reads an agent file named on the command line", () => {
    write(".claude/a.css", VIOLET);
    expect(run(["scan", ".claude/a.css", "--strict"], io())).toBe(1);
  });

  it("applies craft.config.json ignores", () => {
    write("docs/archive/a.css", VIOLET);
    write("craft.config.json", JSON.stringify({ ignore: ["docs/archive/**"] }));
    expect(run(["scan", "--strict"], io())).toBe(0);
  });

  it("turns a tell off only with a reason, and lists what it silenced", () => {
    write("src/a.css", VIOLET);
    write("craft.config.json", JSON.stringify({ severity: { "ai-violet": { level: "off", because: "The shopfront has been this violet since 1998." } } }));
    expect(run(["scan", "--json"], io())).toBe(0);
    const report = JSON.parse(out.join("\n"));
    expect(report.findings.some((f: { tell: string }) => f.tell === "ai-violet")).toBe(false);
    expect(report.excepted.some((e: { tell: string }) => e.tell === "ai-violet")).toBe(true);
  });

  it("stops on a severity change with no reason", () => {
    write("src/a.css", VIOLET);
    write("craft.config.json", JSON.stringify({ severity: { "ai-violet": { level: "off" } } }));
    expect(run(["scan"], io())).toBe(2);
    expect(err.join("\n")).toMatch(/craft.config.json: severity.ai-violet needs a because/);
  });

  it("reads copyPaths when craft copy is given no path", () => {
    write("content/home.md", "We build websites — fast.");
    write("craft.config.json", JSON.stringify({ copyPaths: ["content"] }));
    expect(run(["copy", "--gate"], io())).toBe(1);
    expect(out.join("\n")).toMatch(/content\/home\.md/);
  });

  it("fails only on findings the baseline does not hold", () => {
    write("src/a.css", VIOLET);
    expect(run(["scan", "--baseline", "craft-baseline.json", "--update-baseline"], io())).toBe(0);
    expect(run(["scan", "--strict", "--baseline", "craft-baseline.json"], io())).toBe(0);
    expect(out.join("\n")).toMatch(/known findings? not shown/);
    write("src/b.css", VIOLET);
    out = [];
    expect(run(["scan", "--strict", "--baseline", "craft-baseline.json", "--json"], io())).toBe(1);
    const report = JSON.parse(out.join("\n"));
    expect(new Set(report.findings.map((f: { path: string }) => f.path))).toEqual(new Set(["src/b.css"]));
    expect(report.baselined).toBeGreaterThan(0);
  });

  it("needs --baseline to write one, and a baseline that exists to read one", () => {
    expect(run(["scan", "--update-baseline"], io())).toBe(2);
    expect(err.join("\n")).toMatch(/needs --baseline/);
    expect(run(["scan", "--baseline", "nope.json"], io())).toBe(2);
    expect(err.join("\n")).toMatch(/create it with --update-baseline/);
  });

  it("writes SARIF beside the normal report", () => {
    write("src/a.css", VIOLET);
    expect(run(["scan", "--sarif", "craft.sarif"], io())).toBe(0);
    const sarif = JSON.parse(readFileSync(join(dir, "craft.sarif"), "utf8"));
    expect(sarif.version).toBe("2.1.0");
    expect(sarif.runs[0].results.length).toBeGreaterThan(0);
    expect(out.join("\n")).toMatch(/ai-violet/);
  });

  it("puts schemaVersion on every JSON document it prints", () => {
    write("src/a.css", VIOLET);
    write("before.md", "From £1,200.");
    write("after.md", "From £1,200.");
    for (const argv of [["scan", "--json"], ["copy", ".", "--json"], ["tells", "list", "--json"], ["copy", "compare", "before.md", "after.md", "--json"]]) {
      out = [];
      run(argv, io());
      expect(JSON.parse(out.join("\n")).schemaVersion, argv.join(" ")).toBe(JSON_SCHEMA_VERSION);
    }
  });
});

describe("the --json contract", () => {
  // Every command prints JSON through toJson. A new command that calls
  // JSON.stringify straight onto stdout would ship without schemaVersion.
  const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const cliFiles = readdirSync(SRC, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith("cli.ts"));

  it("finds the command-line files", () => {
    expect(cliFiles.length).toBeGreaterThanOrEqual(6);
  });

  it("prints no JSON except through toJson (the snapshot itself aside)", () => {
    const offenders: string[] = [];
    for (const f of cliFiles) {
      readFileSync(join(SRC, f), "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (/io\.out\([^)]*JSON\.stringify/.test(line) && !/JSON\.stringify\(snapshot, null, 2\)/.test(line)) offenders.push(`${f}:${i + 1}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
