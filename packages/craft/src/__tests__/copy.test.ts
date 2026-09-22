import { describe, expect, it } from "vitest";
import { checkCopy } from "../character/check.js";
import { extractCopy } from "../character/prose.js";

describe("extracting prose", () => {
  it("reads text between tags and sentences in data, never class lists or imports", () => {
    const tsx = [
      `import { Elevate } from "./seamless";`,
      `const services = [{ title: "Gel", body: "Unlock your best nails today." }];`,
      `export function Hero() {`,
      `  return <h1 className="text-elevate seamless-grid">Nails — done properly</h1>;`,
      `}`,
    ].join("\n");
    const text = extractCopy({ path: "Hero.tsx", text: tsx }).map((b) => b.text.trim());
    expect(text).toEqual(["Nails — done properly", "Unlock your best nails today."]);
  });

  it("skips Markdown code and front matter", () => {
    const md = "---\ntitle: Seamless\n---\nPlain words.\n\n```\nelevate()\n```\n";
    const blocks = extractCopy({ path: "a.md", text: md });
    expect(blocks.map((b) => b.text).join("")).not.toMatch(/Seamless|elevate/);
  });

  it("does not read an arrow function as tag text", () => {
    const blocks = extractCopy({ path: "a.tsx", text: `const f = (a) => a < limit;` });
    expect(blocks).toEqual([]);
  });
});

describe("checking copy", () => {
  it("places a finding on the real line", () => {
    const tsx = `export function A() {\n  return (\n    <p>Walk-ins welcome — just ring first.</p>\n  );\n}`;
    const [finding] = checkCopy([{ path: "A.tsx", text: tsx }]).findings;
    expect(finding).toMatchObject({ tell: "em-dash", line: 3 });
  });

  it("catches the constructions, not only the words", () => {
    const md = [
      "It's not just a haircut, it's an experience.",
      "No fuss. No jargon. Just results.",
      "Where luxury meets comfort.",
      "Looking for a plumber you can trust?",
    ].join("\n\n");
    const tells = checkCopy([{ path: "home.md", text: md }]).findings.map((f) => f.tell);
    expect(new Set(tells)).toEqual(new Set(["not-just-but", "staccato-triplet", "where-x-meets-y", "rhetorical-opener"]));
  });

  it("reads curly apostrophes the same as straight ones", () => {
    const tells = checkCopy([{ path: "a.md", text: "It’s not just a cut, it’s a ritual." }]).findings.map((f) => f.tell);
    expect(tells).toContain("not-just-but");
  });

  it("passes plain, specific copy", () => {
    const md = "Gel nails that last three weeks. Book online, or ring 01280 000000. Open Tuesday to Saturday, 9 till 5.";
    expect(checkCopy([{ path: "home.md", text: md }]).findings).toEqual([]);
  });
});
