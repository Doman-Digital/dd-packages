import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { main } from "../cli.js";

const run = async (args: string[]) => {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(args, (t) => out.push(t), (t) => err.push(t));
  return { code, out: out.join("\n"), err: err.join("\n") };
};

const exportFile = (docs: unknown) => {
  const path = join(mkdtempSync(join(tmpdir(), "sanity-copy-")), "export.json");
  writeFileSync(path, JSON.stringify(docs));
  return path;
};

describe("sanity-copy --file", () => {
  it("exits 1 on a house-rule finding and names the field", async () => {
    const r = await run(["--file", exportFile({ result: [{ _id: "h", _type: "homepage", heroTitle: "Built to last — and found" }] })]);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/homepage\/h\n {2}heroTitle {2}House rule \(Em dash\)/);
  });

  it("exits 0 on clean copy", async () => {
    const r = await run(["--file", exportFile([{ _id: "s", _type: "service", title: "Gel nails that last three weeks" }])]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/1 documents, 0 house-rule findings/);
  });

  it("never reports clean when it checked nothing", async () => {
    expect((await run(["--file", exportFile([])])).code).toBe(2);
    expect((await run([])).code).toBe(2);
    const bad = await run(["--project", "bad project!"]);
    expect(bad.code).toBe(2);
    expect(bad.err).toMatch(/Nothing was checked/);
  });
});

describe("sanity-copy --claims", () => {
  it("lists each figure on its field, marks the unsourced ones, and exits 0 even with a house-rule finding", async () => {
    const docs = [
      {
        _id: "a",
        _type: "resourceArticle",
        slug: { current: "builders" },
        title: "Builders — compared",
        body: [
          { _type: "block", _key: "p1", children: [{ _type: "span", text: "Bark says a small site costs £300 to £1,000." }] },
          { _type: "block", _key: "p2", children: [{ _type: "span", text: "An agency charges £5,000 or more." }] },
        ],
      },
      { _id: "t", _type: "testimonial", quote: "They doubled our bookings in 3 months." },
    ];
    const r = await run(["--file", exportFile(docs), "--claims"]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/resourceArticle\/builders\n {2}body\[_key=="p1"\] {2}sourced +£300 · £1,000 · source: Bark/);
    expect(r.out).toMatch(/body\[_key=="p2"\] {2}UNSOURCED +£5,000/);
    expect(r.out).not.toMatch(/doubled/);
    expect(r.out).toMatch(/2 documents, 2 claims to check, 1 with no source named/);
  });

  it("still exits 2 when nothing was read", async () => {
    expect((await run(["--file", exportFile([]), "--claims"])).code).toBe(2);
  });
});

