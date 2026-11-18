// The start guard: a real run passes the programme gate first, a handover keeps
// the client's look, and the label says how the site was started. The proof is
// `--check` passing, which the estate sweep runs; these tests pin both.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { parseOptions } from "../args";
import { run } from "../run";
import type { Io } from "../run";
import { captureIo, cleanup, makeProject, snapshotTree, writeAnswers } from "./fixtures";

const roots: string[] = [];
const project = (kind: Parameters<typeof makeProject>[0] = "astro") => {
  const root = makeProject(kind);
  roots.push(root);
  return root;
};
afterEach(() => roots.splice(0).forEach(cleanup));

const passes: Io["gate"] = async () => ({ ok: true, message: "" });
const fails: Io["gate"] = async () => ({ ok: false, message: "Stage 03 is open" });
const label = (root: string) => JSON.parse(readFileSync(join(root, ".dd", "site-start.json"), "utf8")) as Record<string, unknown>;

const base = (root: string, extra: string[] = []) => ["--yes", "--skip-install", "--answers", writeAnswers(root, { programme: "DOM-123" }), ...extra];

describe("the programme gate", () => {
  test("a real run with no gate available is refused and writes nothing", async () => {
    const root = project();
    const before = snapshotTree(root);
    const { io, err } = captureIo(root);
    expect(await run(base(root), io)).toBe(1);
    expect(err.join("\n")).toMatch(/cannot run the programme gate/);
    expect(snapshotTree(root)).toEqual(before);
  });

  test("a failing gate refuses the run, names the reason and writes nothing", async () => {
    const root = project();
    const before = snapshotTree(root);
    const { io, err } = captureIo(root, { gate: fails });
    expect(await run(base(root), io)).toBe(1);
    expect(err.join("\n")).toMatch(/did not pass[\s\S]*Stage 03 is open/);
    expect(snapshotTree(root)).toEqual(before);
  });

  test("a real run with no programme at all is refused", async () => {
    const root = project();
    const { io, err } = captureIo(root, { gate: passes });
    const code = await run(["--yes", "--skip-install", "--answers", writeAnswers(root)], io);
    expect(code).toBe(1);
    expect(err.join("\n")).toMatch(/name the programme/);
  });

  test("a passing gate scaffolds and the label records the Stage 05 gate", async () => {
    const root = project();
    const { io } = captureIo(root, { gate: passes });
    expect(await run(base(root), io)).toBe(0);
    expect(label(root)).toMatchObject({ mode: "programme", programme: "DOM-123", stage05Gate: true });
  });

  test("--no-gate scaffolds, says so, and the label records the skip", async () => {
    const root = project();
    const { io, err } = captureIo(root);
    expect(await run(base(root, ["--no-gate"]), io)).toBe(0);
    expect(err.join("\n")).toMatch(/not count this site as started/);
    expect(label(root)).toMatchObject({ mode: "programme", stage05Gate: false });
  });

  test("a dry run and --check never need the gate", async () => {
    const root = project();
    const { io } = captureIo(root);
    expect(await run(base(root, ["--dry-run"]), io)).toBe(0);
    expect(await run(base(root, ["--check"]), io)).toBe(3);
  });
});

describe("--handover", () => {
  test("needs a reason and a programme", async () => {
    const root = project();
    const { io, err } = captureIo(root, { gate: passes });
    expect(await run(["--yes", "--skip-install", "--answers", writeAnswers(root, { programme: "DOM-123" }), "--handover"], io)).toBe(2);
    expect(err.join("\n")).toMatch(/--reason/);
    const none = captureIo(root, { gate: passes });
    expect(await run(["--yes", "--skip-install", "--answers", writeAnswers(root), "--handover", "--reason", "the client has an Astro site already"], none.io)).toBe(2);
    expect(none.err.join("\n")).toMatch(/--programme/);
  });

  test("a failing handover gate writes nothing", async () => {
    const root = project();
    const before = snapshotTree(root);
    const { io } = captureIo(root, { gate: fails });
    expect(await run(base(root, ["--handover", "--reason", "the client has an Astro site already"]), io)).toBe(1);
    expect(snapshotTree(root)).toEqual(before);
  });

  test("by default adds only invisible layers: no credit, banner, analytics, legal pages, press or resources", async () => {
    const root = project();
    const kinds: string[] = [];
    const { io } = captureIo(root, { gate: async (_p, kind) => (kinds.push(kind), { ok: true, message: "" }) });
    expect(await run(base(root, ["--handover", "--reason", "the client has an Astro site already"]), io)).toBe(0);
    expect(kinds).toEqual(["handover"]);
    for (const file of [
      "src/components/DesignerCredit.astro",
      "src/components/CookieBanner.astro",
      "src/components/WebAnalytics.astro",
      "src/pages/privacy.astro",
      "src/pages/cookies.astro",
      "src/pages/terms.astro",
      "src/pages/accessibility.astro",
      "src/pages/press.astro",
      "src/pages/resources/index.astro",
    ]) {
      expect(existsSync(join(root, file)), file).toBe(false);
    }
    for (const file of ["site.facts.ts", "site.routes.ts", "redirects.json", "src/components/JsonLd.astro", "src/lib/consent.ts", "tests/seo/graph.test.ts", "scripts/gates/prebuild.mjs"]) {
      expect(existsSync(join(root, file)) || existsSync(join(root, file.replace("src/", ""))), file).toBe(true);
    }
    expect(label(root)).toMatchObject({ mode: "handover", programme: "DOM-123", handoverGate: true, with: [], reason: "the client has an Astro site already" });
    expect(JSON.parse(readFileSync(join(root, "site.programme.json"), "utf8"))).toMatchObject({ mode: "handover" });
  });

  test("--with adds only the pieces named", async () => {
    const root = project();
    const { io } = captureIo(root, { gate: passes });
    expect(await run(base(root, ["--handover", "--reason", "the client has an Astro site already", "--with", "legal,credit"]), io)).toBe(0);
    expect(existsSync(join(root, "src/pages/privacy.astro"))).toBe(true);
    expect(existsSync(join(root, "src/components/DesignerCredit.astro"))).toBe(true);
    expect(existsSync(join(root, "src/components/CookieBanner.astro"))).toBe(false);
    expect(existsSync(join(root, "src/pages/press.astro"))).toBe(false);
  });

  test("--check on a handover keeps the mode from its label, so the flags are not repeated", async () => {
    const root = project();
    const { io } = captureIo(root, { gate: passes });
    expect(await run(base(root, ["--handover", "--reason", "the client has an Astro site already"]), io)).toBe(0);
    const again = captureIo(root);
    expect(await run(base(root, ["--check"]), again.io)).toBe(0);
  });
});

describe("flag validation", () => {
  test("--with and --reason belong to --handover", () => {
    expect(parseOptions(["--with", "legal"])).toMatch(/--with is for --handover/);
    expect(parseOptions(["--reason", "x"])).toMatch(/--reason is for --handover/);
  });
  test("--with takes known pieces only", () => {
    expect(parseOptions(["--handover", "--with", "legal,sparkles"])).toMatch(/sparkles/);
    const ok = parseOptions(["--handover", "--with", "legal, press,legal"]);
    expect(typeof ok !== "string" && ok.with).toEqual(["legal", "press"]);
  });
});

describe("DD_CREATE_SITE_NO_GATE", () => {
  test("acts as --no-gate for a job that cannot pass the flag, and is recorded in the label", async () => {
    const root = project();
    const { io } = captureIo(root, { noGateEnv: "1" });
    expect(await run(base(root), io)).toBe(0);
    expect(label(root)).toMatchObject({ stage05Gate: false });
  });
});
