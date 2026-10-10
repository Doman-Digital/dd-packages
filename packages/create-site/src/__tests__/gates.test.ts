// The site programme's gates, run as a generated site runs them: plain node,
// from the site's root. A gate is only worth having if it fails, so each one
// is shown refusing first and passing second. craft is a stand-in that
// prints a canned report; the nightly starter job runs the real one.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { run } from "../run";
import { captureIo, cleanup, makeProject, writeAnswers } from "./fixtures";

const roots: string[] = [];
afterAll(() => roots.forEach(cleanup));

async function generate(overrides: Record<string, unknown> = {}): Promise<string> {
  const root = makeProject("astro");
  roots.push(root);
  const { io } = captureIo(root);
  expect(await run(["--yes", "--skip-install", "--answers", writeAnswers(root, overrides)], io)).toBe(0);
  return root;
}

const write = (root: string, path: string, text: string) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};
const json = (root: string, path: string) => JSON.parse(readFileSync(join(root, path), "utf8")) as Record<string, any>;
const edit = (root: string, path: string, change: (value: Record<string, any>) => void) => {
  const value = json(root, path);
  change(value);
  write(root, path, `${JSON.stringify(value, null, 2)}\n`);
};

function gate(root: string, script: string, ...args: string[]) {
  const r = spawnSync(process.execPath, [join(root, "scripts", "gates", script), ...args], { cwd: root, encoding: "utf8" });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

/** A stand-in craft bin that prints the report it is given, as `craft direction validate --json` would. */
function fakeCraft(root: string, report: { valid: boolean; complete: boolean }) {
  write(root, "node_modules/@domandigital/craft/package.json", JSON.stringify({ name: "@domandigital/craft", bin: { craft: "cli.mjs" } }));
  const body = {
    schemaVersion: 1,
    valid: report.valid,
    problems: report.valid ? [] : [{ severity: "error", at: "choices.accent.because", message: "the reason is missing" }],
    decided: report.complete ? 5 : 2,
    layers: { job: report.complete, hierarchy: [{ page: "home", decided: report.complete ? 4 : 1, total: 4 }], tokens: { decided: report.complete ? 5 : 2, total: 7 }, complete: report.complete },
  };
  write(root, "node_modules/@domandigital/craft/cli.mjs", `console.log(${JSON.stringify(JSON.stringify(body))});\nprocess.exitCode = ${report.valid ? 0 : 1};\n`);
}

// The Doman Digital redesign's own sheet (apps/site/scripts/tokens.mjs), so
// the lifted gate is checked against the numbers it reported there.
const DIRECTION = {
  version: 2,
  client: "Acme Electrical",
  choices: {
    ground: { value: "#ffffff" },
    accent: { value: "#b5176b" },
    display: { value: "Saira Semi Condensed" },
    body: { value: "Public Sans" },
    shape: { value: "2px corners, 1px rules, 2px leader lines" },
  },
};
const SHEETS = {
  light: { ink: "#15141c", "ink-2": "#4b4a52", "ink-3": "#6f6e76", rule: "#d6d5d9", "accent-soft": "#f8e2ee" },
  night: { ground: "#121117", accent: "#f0509f", ink: "#f3f1f6", "ink-2": "#c4c0cc", "ink-3": "#9a95a4", rule: "#2c2a35", "accent-soft": "#311826" },
  because: "The same sheet turned over, the one magenta lifted so a 12px label holds on the dark ground.",
};

async function decided(): Promise<string> {
  const root = await generate({ programme: "DOM-999" });
  fakeCraft(root, { valid: true, complete: true });
  write(root, "art-direction.json", `${JSON.stringify(DIRECTION, null, 2)}\n`);
  write(root, "art-direction.sheets.json", `${JSON.stringify(SHEETS, null, 2)}\n`);
  return root;
}

describe("the scaffold writes the programme", () => {
  test("the gates, the process document and the two data files, with prebuild wired", async () => {
    const root = await generate();
    for (const f of ["scripts/gates/prebuild.mjs", "scripts/gates/measure.mjs", "scripts/gates/deploy-preview.mjs", "docs/site-programme.md"]) expect(existsSync(join(root, f)), f).toBe(true);
    expect(json(root, "package.json").scripts.prebuild).toBe("node scripts/gates/prebuild.mjs");
    expect(json(root, "site.programme.json").paths).toMatchObject({ tokens: "src/styles/tokens.css", deck: "src/content/deck.ts", source: ["src"] });
    expect(json(root, "art-direction.sheets.json").night.ground).toBeNull();
  });

  test("a programme id that is not a Linear issue is refused", async () => {
    const root = makeProject("astro");
    roots.push(root);
    const { io, err } = captureIo(root);
    expect(await run(["--yes", "--skip-install", "--answers", writeAnswers(root, { programme: "the redesign" })], io)).toBe(2);
    expect(err.join("\n")).toContain("DOM-123");
  });
});

describe("prebuild", () => {
  test("refuses a site with no programme issue (Stage 01)", async () => {
    const root = await generate();
    const r = gate(root, "prebuild.mjs");
    expect(r.status).toBe(1);
    expect(r.out).toContain("(Stage 01)");
  });

  test("refuses a site with no direction (Stage 05)", async () => {
    const root = await generate({ programme: "DOM-999" });
    const r = gate(root, "prebuild.mjs");
    expect(r.status).toBe(1);
    expect(r.out).toContain("check-direction (Stage 05): no art-direction.json");
  });

  test("passes a decided site with a current deck, and stops at the first gate that fails", async () => {
    const root = await decided();
    write(root, "src/content/deck.ts", 'export const deck = { home: { headline: "Electricians in Leeds", contact: { label: "Get in touch", href: "/contact" } } } as const;\n');
    expect(gate(root, "copy-deck.mjs").status).toBe(0);
    const ok = gate(root, "prebuild.mjs");
    expect(ok.out).toContain("night-contrast");
    expect(ok.status).toBe(0);

    write(root, "src/pages/index.astro", "<h1>Rewires from £2400</h1>\n");
    const r = gate(root, "prebuild.mjs");
    expect(r.status).toBe(1);
    expect(r.out).toContain("The build stops at facts.mjs");
  });
});

describe("check-direction", () => {
  test("refuses a direction craft finds invalid, then one that is valid but undecided", async () => {
    const root = await decided();
    fakeCraft(root, { valid: false, complete: false });
    expect(gate(root, "check-direction.mjs").out).toContain("not valid");
    fakeCraft(root, { valid: true, complete: false });
    const r = gate(root, "check-direction.mjs");
    expect(r.status).toBe(1);
    expect(r.out).toContain("not decided yet: job not decided; hierarchy home 1 of 4; tokens 2 of 7");
  });

  test("refuses a direction that differs from its registered copy, and passes when it matches or is absent", async () => {
    const root = await decided();
    const registered = join(root, "..", `${root.split(/[\\/]/).pop()}.registered.json`);
    edit(root, "site.programme.json", (p) => (p.registeredDirection = registered));
    expect(gate(root, "check-direction.mjs").out).toContain("no registered copy on this machine");
    writeFileSync(registered, "{}\n");
    const r = gate(root, "check-direction.mjs");
    expect(r.status).toBe(1);
    expect(r.out).toContain("differs from");
    writeFileSync(registered, readFileSync(join(root, "art-direction.json")));
    expect(gate(root, "check-direction.mjs")).toMatchObject({ status: 0 });
  });
});

describe("tokens and night-contrast", () => {
  test("tokens refuses a sheet with a null and names it", async () => {
    const root = await generate({ programme: "DOM-999" });
    write(root, "art-direction.json", `${JSON.stringify(DIRECTION)}\n`);
    const r = gate(root, "tokens.mjs");
    expect(r.status).toBe(1);
    expect(r.out).toContain("art-direction.sheets.json night.ground");
    expect(r.out).toContain("because");
  });

  test("writes both sides of the sheet and measures them as the redesign did", async () => {
    const root = await decided();
    expect(gate(root, "tokens.mjs").status).toBe(0);
    const css = readFileSync(join(root, "src/styles/tokens.css"), "utf8");
    expect(css).toContain("--accent: #b5176b;");
    expect(css).toContain("--shape-corners: 2px;");
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain(':root[data-theme="dark"]');
    const r = gate(root, "night-contrast.mjs");
    expect(r.status).toBe(0);
    // The redesign recorded ink 16.7:1, ink-2 10.5:1, ink-3 6.5:1 and accent 5.7:1 on the night ground.
    for (const n of ["16.74:1  ink on", "10.52:1  ink-2 on", "6.45:1  ink-3 on", "5.68:1  accent on"]) expect(r.out).toContain(n);
  });

  test("night-contrast fails a night ink that cannot be read", async () => {
    const root = await decided();
    edit(root, "art-direction.sheets.json", (s) => (s.night["ink-3"] = "#3a3940"));
    gate(root, "tokens.mjs");
    const r = gate(root, "night-contrast.mjs");
    expect(r.status).toBe(1);
    expect(r.out).toContain("FAIL");
    expect(r.out).toContain("ink-3 on ground");
  });
});

describe("copy-deck", () => {
  test("refuses a site with no deck, then a stale rendering", async () => {
    const root = await decided();
    expect(gate(root, "copy-deck.mjs", "--check").out).toContain("no copy deck at src/content/deck.ts");
    write(root, "src/content/deck.ts", 'export const deck = { home: { headline: "One", list: ["a", "b"] } };\n');
    expect(gate(root, "copy-deck.mjs", "--check").status).toBe(1);
    expect(gate(root, "copy-deck.mjs").status).toBe(0);
    expect(readFileSync(join(root, "docs/copy-deck.md"), "utf8")).toContain("## home\n\n**headline**: One\n\n**list**\n\n- a\n- b");
    expect(gate(root, "copy-deck.mjs", "--check").status).toBe(0);
    write(root, "src/content/deck.ts", 'export const deck = { home: { headline: "Two" } };\n');
    expect(gate(root, "copy-deck.mjs", "--check").out).toContain("is not the current deck");
  });
});

describe("null-check", () => {
  test("skips without a harvest, fails an unjustified phrase, passes it with a reason", async () => {
    const root = await decided();
    write(root, "src/content/deck.ts", 'export const deck = { home: { headline: "Tell us what you need" } };\n');
    gate(root, "copy-deck.mjs");
    expect(gate(root, "null-check.mjs").out).toContain("skipped");
    write(root, "harvest.txt", "Not on the catalogue: candidates for the next generation. A person decides.\n  phrase   what you need                                 14 of 20\n");
    edit(root, "site.programme.json", (p) => (p.nullCheck.harvest = "harvest.txt"));
    const r = gate(root, "null-check.mjs");
    expect(r.status).toBe(1);
    expect(r.out).toContain('"what you need"');
    edit(root, "site.programme.json", (p) => (p.nullCheck.justified = { "what you need": "The contact lead the hierarchy names." }));
    expect(gate(root, "null-check.mjs").status).toBe(0);
    expect(readFileSync(join(root, "docs/null-check.md"), "utf8")).toContain("The contact lead the hierarchy names.");
  });
});

describe("deploy-preview", () => {
  test("never deploys to production, and refuses a wrangler config with a route", async () => {
    const root = await decided();
    expect(gate(root, "deploy-preview.mjs", "--prod").out).toContain("never deploys to production");
    write(root, "wrangler.jsonc", '// A preview: never a route here.\n{ "name": "acme-preview", "routes": [{ "pattern": "acme.example/*" }] }\n');
    const r = gate(root, "deploy-preview.mjs");
    expect(r.status).toBe(1);
    expect(r.out).toContain("carries a route");
  });
});
