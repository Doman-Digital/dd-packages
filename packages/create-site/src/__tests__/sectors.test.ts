import { describe, expect, test } from "vitest";
import { renderChecklist } from "../render/docs";
import { REGISTERS, REGISTERS_CHECKED_ON, SECTORS, registersFor } from "../sectors";
import type { Answers } from "../answers";
import { ANSWERS } from "./fixtures";

describe("sector registers", () => {
  test("ids are unique and every URL is https", () => {
    const ids = REGISTERS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(REGISTERS.filter((r) => r.url && !r.url.startsWith("https://")).map((r) => r.id)).toEqual([]);
  });

  test("every sector gets the universal listings", () => {
    for (const sector of Object.keys(SECTORS) as (keyof typeof SECTORS)[]) {
      expect(registersFor(sector).map((r) => r.id)).toContain("gbp");
    }
  });
});

describe("the launch checklist", () => {
  const answers = { ...ANSWERS, sector: "trades", registers: ["niceic"] } as Answers;
  const text = renderChecklist(answers);
  const claim = text.slice(text.indexOf("## Claim"), text.indexOf("## Only if"));

  test("lists under Claim only the registers the business holds", () => {
    expect(claim).toContain("NICEIC");
    expect(claim).not.toContain("Gas Safe");
    expect(text.slice(text.indexOf("## Only if"))).toContain("Gas Safe");
  });

  test("says plainly that the register list is unchecked until a person has checked it", () => {
    expect(REGISTERS_CHECKED_ON).toBeNull();
    expect(text).toContain("has not yet been checked by a person");
  });
});
