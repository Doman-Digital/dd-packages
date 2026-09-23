import { describe, expect, it } from "vitest";
import { checkCopy } from "../character/check.js";
import { extractCopy, extractStrings } from "../character/prose.js";

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

  it("never reads a comment as copy, and an apostrophe in one does not swallow the next line", () => {
    const ts = [
      `// It's seamless — really.`,
      `/* A long note — with dashes. */`,
      `const url = "https://example.com"; // don't read this`,
      `export const body = "Gel nails that last three weeks.";`,
    ].join("\n");
    expect(extractCopy({ path: "a.ts", text: ts }).map((b) => b.text)).toEqual(["Gel nails that last three weeks."]);
    const tsx = [`{/* It's seamless — really. */}`, `  // It's a note — for us.`, `<p>Plain words here.</p>`].join("\n");
    expect(extractCopy({ path: "a.tsx", text: tsx }).map((b) => b.text)).toEqual(["Plain words here."]);
  });

  it("reads JSX text that runs into an expression, and never code between braces", () => {
    const tsx = [
      `export function A({ n, start, end }) {`,
      `  if (n) { return null } else { return <p>Ready to confirm — {n}</p> }`,
      `  return <p>{start} — {end}</p>;`,
      `}`,
    ].join("\n");
    const text = extractStrings({ path: "A.tsx", text: tsx }).map((b) => b.text.trim());
    expect(text).toContain("Ready to confirm —");
    expect(text).toContain("—");
    expect(text.join(" ")).not.toMatch(/else|return/);
    const tells = checkCopy([{ path: "A.tsx", text: tsx }]).findings.map((x) => [x.tell, x.line]);
    expect(tells).toEqual([["em-dash", 2], ["em-dash", 3]]);
  });

  it("reads HTML held in a string as copy, and a GraphQL query as code", () => {
    const ts = [
      "export const page = `<p>Rest assured, we reply within a day.</p>`;",
      "export const query = `query { products { title } } # not just the stock display`;",
    ].join("\n");
    const tells = checkCopy([{ path: "seed.ts", text: ts }]).findings.map((x) => [x.tell, x.line]);
    expect(tells).toEqual([["ai-phrase", 1]]);
  });

  it("reads the text inside an HTML email held in a template literal", () => {
    // Shipped live in a welcome email, 2026-09-05. Read whole, the style
    // attributes and holes made the template look like code.
    const ts = [
      "export const html = `<tr><td style=\"padding: 40px;\">${eyebrow(c, \"HERE\")}",
      "  <p style=\"margin:0; color:${c.muted};\">",
      "    Order today and it's dispatched from here, not shipped in from Seoul.",
      "  </p></td></tr>`;",
    ].join("\n");
    expect(checkCopy([{ path: "welcome-3.ts", text: ts }]).findings.map((x) => [x.tell, x.line])).toEqual([["not-just-but", 3]]);
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

  it("drops a finding marked copy-ok or craft-ok on its line or the line above, and lists it", () => {
    const ts = [`// copy-ok: the client's own review`, `export const review = "Genuinely seamless — loved it.";`, `export const b = "Rest assured, we call back.";`].join("\n");
    const report = checkCopy([{ path: "reviews.ts", text: ts }]);
    expect(report.findings.map((x) => [x.tell, x.line])).toEqual([["ai-phrase", 3]]);
    expect(report.suppressed.map((x) => x.line)).toEqual([2, 2, 2]);
  });

  it("sees short strings for badges, dashes and emoji, and leaves placeholders alone", () => {
    const tsx = `export const A = () => <><span>No catch.</span><td>{x ?? "—"}</td><b>{"Mon — Fri"}</b><i>Book 🚀</i></>;`;
    const tells = checkCopy([{ path: "A.tsx", text: tsx }]).findings.map((x) => x.tell).sort();
    expect(tells).toEqual(["em-dash", "emoji", "no-x-badge"]);
  });

  it("catches a template a formatter has wrapped across two lines", () => {
    const tsx = ["<p className=\"mt-4\">", "  A prioritised fix plan for the whole site, not", "  just three headlines. Look no", "  further.", "</p>"].join("\n");
    const tells = checkCopy([{ path: "app/x.tsx", text: tsx }]).findings.map((x) => [x.tell, x.line]);
    expect(tells).toEqual([["not-just-but", 2], ["ai-phrase", 3]]);
  });

  it("passes plain, specific copy", () => {
    const md = "Gel nails that last three weeks. Book online, or ring 01280 000000. Open Tuesday to Saturday, 9 till 5.";
    expect(checkCopy([{ path: "home.md", text: md }]).findings).toEqual([]);
  });
});

describe("chatbot-residue on a run of citation tokens", () => {
  it("reports a run as one finding, not one per token", () => {
    const report = checkCopy([{ path: "content/a.md", text: "Fees vary. citeturn11search1turn10view0turn10view1turn2view3\n" }]);
    expect(report.findings.filter((f) => f.tell === "chatbot-residue")).toHaveLength(1);
  });

  it("reads through the invisible characters ChatGPT wraps them in", () => {
    const text = "Fees vary. \uE200cite\uE202turn11search1\uE202turn10view0\uE202turn2view3\uE201\n";
    expect(checkCopy([{ path: "content/a.md", text }]).findings.filter((f) => f.tell === "chatbot-residue")).toHaveLength(1);
  });
});
