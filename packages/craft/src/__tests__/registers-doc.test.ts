import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkCopy } from "../character/check.js";
import { HOUSE } from "../character/house.js";
import { REGISTERS, registerBrief, registersDoc } from "../register/registers.js";

const DOC = readFileSync(fileURLToPath(new URL("../../REGISTERS.md", import.meta.url)), "utf8");

describe("REGISTERS.md is bound to the register data", () => {
  it("carries the generated briefs, unedited", () => {
    const start = "<!-- craft:registers:start -->\n";
    const end = "\n<!-- craft:registers:end -->";
    const a = DOC.indexOf(start);
    const b = DOC.indexOf(end);
    expect(a, "REGISTERS.md has no registers markers").toBeGreaterThan(-1);
    expect(DOC.slice(a + start.length, b), "run `pnpm --filter @domandigital/craft run docs`").toBe(registersDoc());
  });

  it("is written without em dashes", () => {
    expect(DOC).not.toContain("—");
    for (const r of REGISTERS) expect(registerBrief(r.id)).not.toContain("—");
  });
});

describe("register briefs", () => {
  it("give each register 5 to 8 directives, a source and an example", () => {
    for (const r of REGISTERS) {
      expect(r.directives.length, r.id).toBeGreaterThanOrEqual(5);
      expect(r.directives.length, r.id).toBeLessThanOrEqual(8);
      expect(r.sources.length, r.id).toBeGreaterThan(0);
      expect(r.example.after.length, r.id).toBeGreaterThan(0);
    }
  });

  it("say what to do, never what to avoid", () => {
    for (const r of REGISTERS) for (const d of r.directives) expect(d.text, `${r.id}: ${d.text}`).not.toMatch(/^(?:Don't|Do not|Avoid|Never|No)\b/);
  });

  it("pass the house blocking tier themselves", () => {
    const files = REGISTERS.map((r) => ({
      path: `${r.id}.md`,
      text: [...r.directives.map((d) => d.text), r.useFor, r.example.after, r.example.why].join("\n\n"),
    }));
    const blocking = checkCopy(files).findings.filter((f) => HOUSE[f.tell]?.tier === "block");
    expect(blocking.map((f) => `${f.path}: ${f.tell} "${f.excerpt}"`)).toEqual([]);
  });
});
