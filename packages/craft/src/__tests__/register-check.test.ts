import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { run } from "../character/cli.js";
import { checkRegister, documentParagraphs, type Band, type RegisterProfile } from "../register/check.js";

const band = (p10: number, p50: number, p90: number, separates = ["other"]): Band => ({ p10, p50, p90, sd: (p90 - p10) / 2.5, separates });

/** Fixture bands, so the tests do not depend on the generated profile. */
const PROFILE: RegisterProfile = {
  "business-email": { meanSentenceWords: band(8, 12, 16), commasPer100: band(0, 2, 5), names: band(2, 3, 4) },
  literary: { meanSentenceWords: band(18, 24, 30), commasPer100: band(6, 8, 11) },
  institutional: { meanSentenceWords: band(15, 20, 25), commasPer100: band(3, 5, 7) },
  marketing: { meanSentenceWords: band(10, 14, 18), commasPer100: band(2, 4, 6) },
};

const SHORT = "We fixed the tap on Monday. The part cost twelve pounds and took an hour. Call us if it drips again and we will come back.";
const LONG =
  "When the light went out across the valley, and the last of the carts had come down from the high field, she stood at the gate for a long while and watched the road. Nobody came, and in time she went in, closed the door behind her, and sat by the fire until the room was cold.";

const doc = (p: string, n: number) => Array.from({ length: n }, () => p).join("\n\n");

describe("checkRegister", () => {
  it("measures nothing under five paragraphs, and says why", () => {
    const c = checkRegister(doc(SHORT, 4), "warm", PROFILE);
    expect(c.measured).toBe(false);
    expect(c.paragraphs).toBe(4);
    expect(c.summary).toMatch(/overlap too much/);
  });

  it("drops headings and counts only blurb-sized paragraphs", () => {
    expect(documentParagraphs("# Title\n\nOne. Two.\n\n## Next\n\nThree.")).toEqual(["One. Two.", "Three."]);
    expect(checkRegister(`${doc(SHORT, 5)}\n\nToo short.`, "warm", PROFILE).paragraphs).toBe(5);
  });

  it("reports long literary sentences as outside the warm range", () => {
    const c = checkRegister(doc(LONG, 5), "warm", PROFILE);
    expect(c.measured).toBe(true);
    const words = c.outside.find((o) => o.feature === "meanSentenceWords");
    expect(words?.direction).toBe("higher");
    expect(words?.sentence).toMatch(/^Words per sentence: \d+\. Warm and conversational writing in the baseline runs 8\.0 to 16, so this is higher\.$/);
    expect(c.nearest[0]?.register).toBe("literary");
  });

  it("finds short, plain sentences closest to email, with nothing outside", () => {
    const c = checkRegister(doc(SHORT, 5), "warm", PROFILE);
    expect(c.outside).toEqual([]);
    expect(c.nearest[0]?.register).toBe("business-email");
    expect(c.summary).toMatch(/inside the usual range/);
  });

  it("leaves content features out of the check", () => {
    const c = checkRegister(doc(SHORT, 5), "warm", PROFILE);
    expect(c.outside.some((o) => o.feature === "names")).toBe(false);
  });
});

describe("craft register", () => {
  let dir = "";
  const out: string[] = [];
  const err: string[] = [];
  const io = () => ({ cwd: dir, out: (t: string) => out.push(t), err: (t: string) => err.push(t) });
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    out.length = 0;
    err.length = 0;
  });

  it("prints a brief and lists registers", async () => {
    dir = mkdtempSync(join(tmpdir(), "craft-register-"));
    expect(await run(["register", "brief", "plain"], io())).toBe(0);
    expect(out.join("\n")).toMatch(/^Register: Plain and trustworthy \(plain\)[\s\S]*Always: /);
    expect(await run(["register", "list"], io())).toBe(0);
    expect(out.join("\n")).toMatch(/literary/);
  });

  it("exits 2 on an unknown register or a missing --as", async () => {
    dir = mkdtempSync(join(tmpdir(), "craft-register-"));
    expect(await run(["register", "brief", "nope"], io())).toBe(2);
    writeFileSync(join(dir, "a.md"), doc(SHORT, 5));
    expect(await run(["register", "check", "a.md"], io())).toBe(2);
    expect(err.join("\n")).toMatch(/--as <register> is required/);
  });

  it("checks a short file without measuring it", async () => {
    dir = mkdtempSync(join(tmpdir(), "craft-register-"));
    writeFileSync(join(dir, "a.md"), doc(SHORT, 2));
    expect(await run(["register", "check", "a.md", "--as", "warm"], io())).toBe(0);
    expect(out.join("\n")).toMatch(/Only 2 paragraphs/);
  });
});
