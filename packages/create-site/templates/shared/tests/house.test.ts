// House rules that run on every test run, plus a launch check.
// Written by @domandigital/create-site.
//
//   pnpm seo:check      always-on rules
//   pnpm launch:check   adds the "ready to launch" block below

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";
import { facts } from "~site/facts";

const ROOT = process.cwd();
const SOURCE_DIRS = ["app", "src", "components", "lib", "content"];
const SOURCE_FILE = /\.(tsx?|jsx?|astro|mdx?)$/;

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (SOURCE_FILE.test(entry.name)) out.push(path);
    }
  };
  for (const dir of SOURCE_DIRS) walk(join(ROOT, dir));
  return out;
}

// vitest sets MODE from --mode; typed loosely so this file needs no Vite types.
const mode = (import.meta as unknown as { env?: { MODE?: string } }).env?.MODE;

describe("the facts file is the single source of contact details", () => {
  test("no page or component hard-codes the phone number, email or postcode from site.facts.ts", () => {
    const values = [facts.phone, facts.email, facts.address?.postalCode].filter((v): v is string => Boolean(v));
    const offenders = sourceFiles().flatMap((file) => {
      const text = readFileSync(file, "utf8");
      return values.filter((v) => text.includes(v)).map((v) => `${relative(ROOT, file)}: ${v}`);
    });
    expect(offenders).toEqual([]);
  });
});

describe.runIf(mode === "launch")("ready to launch", () => {
  test("the designer credit is placed on the site", () => {
    const placed = sourceFiles().some((file) => !/DesignerCredit\.(tsx|astro)$/.test(file) && readFileSync(file, "utf8").includes("<DesignerCredit"));
    expect(placed).toBe(true);
  });

  test("phone and postcode are filled in", () => {
    expect(facts.phone).not.toBeNull();
    expect(facts.address?.postalCode ?? null).not.toBeNull();
  });

  test("at least one profile is live", () => {
    expect(facts.profiles.some((p) => p.status === "live")).toBe(true);
  });

  test("every accreditation has a register link and a date someone checked it", () => {
    const unchecked = facts.accreditations.filter((a) => !a.registerUrl || !a.verifiedOn).map((a) => a.name);
    expect(unchecked).toEqual([]);
  });
});
