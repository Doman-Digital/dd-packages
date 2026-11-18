// House rules that run on every test run, plus a launch check.
// Written by @domandigital/create-site.
//
//   pnpm seo:check      always-on rules
//   pnpm launch:check   adds the "ready to launch" block below

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";
import { facts } from "~site/facts";
import { legal } from "~site/legal";

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

// .dd/site-start.json says how the site was started. A handover keeps the
// client's look and copy, so it only has to place the visible pieces it was
// started with (create-site --handover --with <piece>). A new build places all.
function startedWith(): { handover: boolean; pieces: string[] } {
  try {
    const label = JSON.parse(readFileSync(join(ROOT, ".dd", "site-start.json"), "utf8")) as { mode?: string; with?: unknown };
    return { handover: label.mode === "handover", pieces: Array.isArray(label.with) ? label.with.filter((w): w is string => typeof w === "string") : [] };
  } catch {
    return { handover: false, pieces: [] };
  }
}
const started = startedWith();
const places = (piece: string) => !started.handover || started.pieces.includes(piece);

describe.runIf(mode === "launch")("ready to launch", () => {
  test.runIf(places("credit"))("the designer credit is placed on the site", () => {
    const placed = sourceFiles().some((file) => !/DesignerCredit\.(tsx|astro)$/.test(file) && readFileSync(file, "utf8").includes("<DesignerCredit"));
    expect(placed).toBe(true);
  });

  test.runIf(places("consent"))("the cookie banner is placed on the site", () => {
    const placed = sourceFiles().some((file) => !/CookieBanner\.(tsx|astro)$/.test(file) && readFileSync(file, "utf8").includes("<CookieBanner"));
    expect(placed).toBe(true);
  });

  test.runIf(places("analytics"))("Cloudflare Web Analytics is placed on the site and has its token", () => {
    const placed = sourceFiles().some((file) => !/WebAnalytics\.(tsx|astro)$/.test(file) && readFileSync(file, "utf8").includes("<WebAnalytics"));
    expect(placed).toBe(true);
    expect(facts.webAnalytics?.token ?? null).not.toBeNull();
  });

  test.runIf(places("legal"))("the legal pages have what every site needs: retention, the processors, the governing law, a review date", () => {
    const missing = [
      legal.retention ? null : "legal.retention",
      legal.processors.length > 0 ? null : "legal.processors (the host at least)",
      legal.governingLaw ? null : "legal.governingLaw",
      legal.reviewedOn ? null : "legal.reviewedOn",
    ].filter(Boolean);
    expect(missing).toEqual([]);
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
