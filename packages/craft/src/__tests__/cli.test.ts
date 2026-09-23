import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { run } from "../character/cli.js";

let dir: string;
let out: string[];
let err: string[];
const io = () => ({ cwd: dir, out: (t: string) => out.push(t), err: (t: string) => err.push(t) });
const write = (path: string, text: string): void => {
  mkdirSync(join(dir, path, ".."), { recursive: true });
  writeFileSync(join(dir, path), text);
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "craft-cli-"));
  out = [];
  err = [];
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("craft scan", () => {
  it("reports and exits 0 on warnings, 1 with --strict", () => {
    write("src/Hero.tsx", `<a className="bg-indigo-600">Book</a>`);
    expect(run(["scan"], io())).toBe(0);
    expect(out.join("\n")).toMatch(/src\/Hero\.tsx[\s\S]*ai-violet \(gen 1, warn\)/);
    expect(run(["scan", "--strict"], io())).toBe(1);
  });

  it("skips node_modules and build output", () => {
    write("node_modules/x/a.css", `.a { color: #7c3aed; }`);
    write(".next/static/a.css", `.a { color: #7c3aed; }`);
    write("src/ok.css", `.a { color: #0f766e; }`);
    expect(run(["scan", "--strict"], io())).toBe(0);
  });

  it("applies exceptions from art-direction.json", () => {
    write("src/a.css", `.a { color: #7c3aed; }`);
    write("art-direction.json", JSON.stringify({ exceptions: [{ tell: "ai-violet", because: "Violet is on the shopfront fascia and the van." }] }));
    expect(run(["scan", "--strict"], io())).toBe(0);
    expect(out.join("\n")).toMatch(/Excepted: 1 × ai-violet/);
  });

  it("emits JSON", () => {
    write("src/a.css", `.a { color: #7c3aed; }`);
    run(["scan", "--json"], io());
    expect(JSON.parse(out.join("")).summary.findings).toBe(1);
  });

  it("reads the git index with --staged, not the working tree", () => {
    execFileSync("git", ["init", "-q"], { cwd: dir });
    write("a.css", `.a { color: #7c3aed; }`);
    execFileSync("git", ["add", "a.css"], { cwd: dir });
    write("a.css", `.a { color: #0f766e; }`); // unstaged fix does not count
    write("b.css", `.b { color: #7c3aed; }`); // untracked does not count
    run(["scan", "--staged", "--json"], io());
    const report = JSON.parse(out.join(""));
    expect(report.findings.map((f: { path: string }) => f.path)).toEqual(["a.css"]);
  });

  it("exits 2 on a bad path or option", () => {
    expect(run(["scan", "missing"], io())).toBe(2);
    expect(run(["scan", "--nope"], io())).toBe(2);
    expect(err.join("\n")).toMatch(/no such path|unknown option/);
  });
});

describe("craft copy", () => {
  it("checks prose", () => {
    write("content/home.md", "Look no further.");
    expect(run(["copy", "content", "--strict"], io())).toBe(1);
    expect(out.join("\n")).toMatch(/ai-phrase/);
  });

  it("reads a Sanity export as JSON lines, one document per line", () => {
    write("copy.jsonl", [JSON.stringify({ _id: "a", body: "Plain facts about us." }), JSON.stringify({ _id: "b", body: "Look no further for nails." })].join("\n"));
    run(["copy", "copy.jsonl", "--json"], io());
    const report = JSON.parse(out.join(""));
    expect(report.findings.map((x: { tell: string; line: number }) => [x.tell, x.line])).toEqual([["ai-phrase", 2]]);
  });

  it("skips build documentation and _notes when walking, but reads a file named outright", () => {
    write("README.md", "Look no further.");
    write("_notes/plan.md", "Look no further.");
    write("package.json", JSON.stringify({ description: "Look no further for the package." }));
    write("content/home.md", "Gel nails that last three weeks.");
    expect(run(["copy", ".", "--strict"], io())).toBe(0);
    expect(run(["copy", "README.md", "--strict"], io())).toBe(1);
  });

  it("needs a path", () => {
    expect(run(["copy"], io())).toBe(2);
  });

  it("--gate fails on the house blocking tier and passes the review tier", () => {
    // A guard that cannot fail is not a guard: prove both directions.
    write("content/block.md", "Walk-ins welcome — ring first.");
    write("content/review.md", "Elevate your nails in our bustling studio.");
    expect(run(["copy", "content/block.md"], io())).toBe(0);
    expect(run(["copy", "content/block.md", "--gate"], io())).toBe(1);
    expect(run(["copy", "content/review.md", "--gate"], io())).toBe(0);
    out = [];
    run(["copy", "content/block.md", "--gate", "--json"], io());
    const report = JSON.parse(out.join(""));
    expect(report.summary.blocking).toBe(1);
    expect(report.findings[0]).toMatchObject({ tell: "em-dash", house: "block", severity: "block" });
  });
});

describe("craft tells list", () => {
  it("lists the catalogue", () => {
    expect(run(["tells", "list", "--json"], io())).toBe(0);
    const data = JSON.parse(out.join(""));
    expect(data.tells.length).toBeGreaterThan(20);
    expect(data.tells[0]).toHaveProperty("fix");
  });

  it("publishes the house tier of every copy tell, and none for design tells", () => {
    run(["tells", "list", "--json"], io());
    const tells = JSON.parse(out.join("")).tells as { id: string; surface: string; house?: string; houseLabel?: string }[];
    for (const t of tells) {
      if (t.surface === "copy") expect(["block", "review", "explicit"], t.id).toContain(t.house);
      else expect(t.house, t.id).toBeUndefined();
    }
    expect(tells.filter((t) => t.house === "block").map((t) => t.id).sort()).toEqual(
      ["ai-phrase", "buzzword", "em-dash", "emoji", "negative-reassurance", "no-x-badge", "no-x-no-y", "not-just-but", "plain-english", "plainer-word"],
    );
  });
});
