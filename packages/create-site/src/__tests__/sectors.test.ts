import { describe, expect, test } from "vitest";
import { renderChecklist } from "../render/docs";
import { REGISTERS, SECTORS, registersFor } from "../sectors";
import type { Answers } from "../answers";
import { ANSWERS } from "./fixtures";

describe("sector registers", () => {
  test("ids are unique and every URL is https", () => {
    const ids = REGISTERS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(REGISTERS.filter((r) => r.url && !r.url.startsWith("https://")).map((r) => r.id)).toEqual([]);
  });

  test("a website status is only ever recorded with the date a listing was opened", () => {
    const DATE = /^\d{4}-\d{2}-\d{2}$/;
    expect(REGISTERS.filter((r) => (r.website === null) !== (r.checkedOn === null)).map((r) => r.id)).toEqual([]);
    expect(REGISTERS.filter((r) => r.checkedOn !== null && !DATE.test(r.checkedOn)).map((r) => r.id)).toEqual([]);
    expect(REGISTERS.filter((r) => r.note.trim().length < 10).map((r) => r.id)).toEqual([]);
  });

  test("a register with no single site cannot claim to have been checked", () => {
    expect(REGISTERS.filter((r) => r.url === null && r.website !== null).map((r) => r.id)).toEqual([]);
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

  test("says beside every register whether it was checked, and how many were", () => {
    const listed = registersFor("trades");
    const bullets = text.split("\n").filter((l) => l.startsWith("- [ ] **"));
    const registerBullets = bullets.filter((l) => listed.some((r) => l.startsWith(`- [ ] **${r.name}**`)));
    expect(registerBullets).toHaveLength(listed.length);
    for (const b of registerBullets) expect(b).toMatch(/Website link on a listing|without a link|No website on its listings|Not checked: /);
    const checked = listed.filter((r) => r.checkedOn).length;
    expect(text).toContain(`${checked} of the ${listed.length} registers below`);
    expect(text).toContain('The rest say "not checked"');
  });

  test("an unchecked register carries the reason, not a guess", () => {
    const gasSafe = text.split("\n").find((l) => l.includes("**Gas Safe Register**"))!;
    expect(gasSafe).toContain("Not checked: Bot challenge");
    const mcs = text.split("\n").find((l) => l.includes("**MCS**"))!;
    expect(mcs).toContain("Website link on a listing: followed (checked 2026-09-24)");
  });
});
