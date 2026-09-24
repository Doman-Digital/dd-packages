import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";
import { applyHouseGate, checkCopy } from "@domandigital/craft";
import { layoutFor } from "../adapters";
import type { Project } from "../detect";
import { renderBaseline, renderChecklist, renderHouseMd, renderDirection } from "../render/docs";
import { TEMPLATE_ROOT, siteKeysIn } from "../templates";
import { ANSWERS } from "./fixtures";
import type { Answers } from "../answers";

const allTemplates = (): string[] => {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name);
      if (statSync(abs).isDirectory()) walk(abs);
      else out.push(relative(TEMPLATE_ROOT, abs));
    }
  };
  walk(TEMPLATE_ROOT);
  return out.sort();
};

const project = (framework: "next" | "astro"): Project => ({
  root: "/site",
  framework,
  routesDir: framework === "next" ? "app" : "src/pages",
  srcBase: framework === "next" ? "" : "src/",
  configFile: framework === "next" ? "next.config.ts" : "astro.config.mjs",
  packageManager: "pnpm",
  packageManagerWarning: null,
  packageJson: "{}",
});

describe("templates", () => {
  test("every template file is used by a layout, so nothing ships that no site gets", () => {
    const used = new Set([...layoutFor(project("next")).templates, ...layoutFor(project("astro")).templates].map((t) => t.template));
    expect(allTemplates().filter((t) => !used.has(t))).toEqual([]);
  });

  test("every ~site import resolves in the layout that uses the template", () => {
    for (const framework of ["next", "astro"] as const) {
      const layout = layoutFor(project(framework));
      for (const t of layout.templates) {
        const missing = siteKeysIn(readFileSync(join(TEMPLATE_ROOT, t.template), "utf8")).filter((k) => !(k in layout.siteKeys));
        expect(missing, t.template).toEqual([]);
      }
    }
  });

  test("the designer credit is exactly the decided text, target and rel, in both frameworks", () => {
    for (const file of ["next/components/DesignerCredit.tsx", "astro/components/DesignerCredit.astro"]) {
      const text = readFileSync(join(TEMPLATE_ROOT, file), "utf8");
      expect(text, file).toMatch(/href="https:\/\/domandigital\.co\.uk\/" rel="nofollow">\s*Website by Doman Digital\s*<\/a>/);
      expect(text, file).not.toMatch(/rel="(?!nofollow")/);
    }
  });

  test("templates and rendered house docs pass the house copy gate", () => {
    const answers = { ...ANSWERS, sector: "trades" } as Answers;
    const files = [
      ...allTemplates().map((path) => ({ path, text: readFileSync(join(TEMPLATE_ROOT, path), "utf8") })),
      { path: "docs/HOUSE.md", text: renderHouseMd(answers, project("next")) },
      { path: "docs/DIRECTION.md", text: renderDirection(answers, "2026-09-24") },
      { path: "docs/seo-launch-checklist.md", text: renderChecklist(answers) },
      { path: "docs/seo-baseline.md", text: renderBaseline(answers, "2026-09-24") },
    ];
    const report = applyHouseGate(checkCopy(files));
    const blocking = report.findings.filter((f) => f.severity === "block").map((f) => `${f.path}:${f.line} ${f.tell}: ${f.excerpt}`);
    expect(blocking).toEqual([]);
  });
});
