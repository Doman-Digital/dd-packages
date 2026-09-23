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
