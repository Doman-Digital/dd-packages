import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { run } from "../character/cli.js";
import { fingerprint } from "../fingerprint/index.js";
import { initDirection } from "../direction/init.js";
import { decodePng } from "../direction/png.js";
import { paletteFromPixels, propose, PROPOSED } from "../direction/propose.js";
import type { ArtDirection } from "../direction/types.js";
import { validateDirection } from "../direction/validate.js";
import { makeSnapshot } from "../snapshot/fixture.js";

/** A direction every rule accepts. Each test below breaks exactly one thing. */
const good = (): ArtDirection => ({
  version: 1,
  client: "RMP Electrical",
  brief: "A two-person electrical contractor in Brackley doing rewires, fuse boards and EV chargers for homes.",
  sources: [
    { id: "van", kind: "livery", note: "The Transit van, bottle green with cream sign-writing on both doors.", colours: ["#1f4d3a"], lettering: "hand-painted sign-writing" },
    { id: "cards", kind: "print", note: "Letterpress business cards Ryan had printed in 2016." },
  ],
  choices: {
    accent: { value: "#1f4d3a", because: "The bottle green is the van's own paint, and the van is what people in Brackley recognise.", evidence: ["van"] },
    display: { value: "Clarendon", because: "The sign-writing on the van doors is a bracketed slab, so the headlines use one too.", evidence: ["van"] },
  },
});

const errorsAt = (d: unknown, ctx = {}) => validateDirection(d, ctx).problems.filter((p) => p.severity === "error").map((p) => p.at);

describe("the reason rule", () => {
  it("accepts a direction whose choices rest on the client's world", () => {
    const r = validateDirection(good());
    expect(r.valid).toBe(true);
    expect(r.decided).toBe(2);
  });

  it("rejects a reason shorter than a sentence", () => {
    const d = good();
    d.choices.accent!.because = "Van green.";
    expect(errorsAt(d)).toContain("choices.accent.because");
  });

  it("rejects a preference", () => {
    const d = good();
    d.choices.accent!.because = "The client likes this green on the van and asked us to use it everywhere.";
    expect(errorsAt(d)).toContain("choices.accent.because");
  });

  it("rejects a mood board", () => {
    const d = good();
    d.choices.accent!.because = "A modern, clean and trustworthy green that suits the van and the business.";
    expect(errorsAt(d)).toContain("choices.accent.because");
  });

  it("rejects a reason with no evidence, or evidence that does not exist", () => {
    const a = good();
    a.choices.accent!.evidence = [];
    expect(errorsAt(a)).toContain("choices.accent.evidence");
    const b = good();
    b.choices.accent!.evidence = ["shopfront"];
    expect(errorsAt(b)).toContain("choices.accent.evidence");
  });

  it("rejects a reason that says nothing about what it cites", () => {
    const d = good();
    d.choices.accent!.because = "Green is calming and suits a company that people need to rely on at short notice.";
    expect(errorsAt(d)).toContain("choices.accent.because");
  });

  it("rejects a proposal nobody has confirmed", () => {
    const d = good();
    d.choices.accent!.because = `${PROPOSED} taken from the van: the Transit van, bottle green with cream sign-writing.`;
    expect(errorsAt(d)).toContain("choices.accent.because");
  });

  it("rejects a choice on the tell catalogue unless the tell is excepted with a reason", () => {
    const d = good();
    d.choices.display = { value: "Inter", because: "The letterpress cards were set in a grotesque, so the headlines use Inter to match them.", evidence: ["cards"] };
    expect(errorsAt(d)).toContain("choices.display.value");
    d.exceptions = [{ tell: "reflex-font", because: "The 2016 letterpress cards are set in a grotesque; Inter is the closest licence-free match." }];
    expect(errorsAt(d)).not.toContain("choices.display.value");
  });

  it("rejects a choice craft does not know, so layout stays out of it", () => {
    const d = good() as ArtDirection & { choices: Record<string, unknown> };
    (d.choices as Record<string, unknown>).navigation = { value: "hamburger", because: "x", evidence: [] };
    expect(errorsAt(d)).toContain("choices.navigation");
  });

  it("rejects a cited path that does not exist, when it can look", () => {
    const d = good();
    d.sources[0].path = "brand/van.png";
    expect(errorsAt(d, { pathExists: () => false })).toContain("sources[0].path");
  });

  it("keeps an exceptions-only file from phase A valid, and says what is missing", () => {
    const r = validateDirection({ exceptions: [{ tell: "ai-violet", because: "Violet has been the mark since 2019." }] });
    expect(r.valid).toBe(true);
    expect(r.problems[0].message).toMatch(/craft direction init/);
  });

  it("warns when the page does not show what the file declares", () => {
    const fp = fingerprint(makeSnapshot());
    const r = validateDirection(good(), { fingerprint: fp });
    expect(r.problems.some((p) => p.at === "choices.display.value" && p.severity === "warn")).toBe(true);
  });
});

describe("init", () => {
  it("writes down what the site does today and leaves every reason empty, so it fails until someone decides", () => {
    const d = initDirection({ client: "X", current: fingerprint(makeSnapshot()) });
    expect(d.choices.display?.value).toBe("Tiempos Headline");
    expect(d.choices.accent?.value).toMatch(/^#/);
    expect(validateDirection(d).valid).toBe(false);
  });
});

describe("propose", () => {
  it("reads the dominant colours of a photo", () => {
    const px: number[] = [];
    for (let i = 0; i < 600; i += 1) px.push(31, 77, 58, 255); // van green
    for (let i = 0; i < 400; i += 1) px.push(240, 232, 214, 255); // cream lettering
    const palette = paletteFromPixels(px, 2);
    expect(palette.map((c) => c.hex)).toEqual(["#1f4d3a", "#f0e8d6"]);
    expect(palette[0].share).toBeCloseTo(0.6);
  });

  it("ranks an accent away from the reflex violet and from a sibling, and marks every draft as a proposal", () => {
    const sources = [{ id: "van", kind: "livery" as const, note: "The van, green and violet stripes.", colours: ["#6d28d9", "#1f4d3a", "#1e7a4f"] }];
    const sibling = fingerprint(makeSnapshot({ controls: [{ kind: "button", radiusPx: 4, heightPx: 44, background: "#1e7a4f", text: "Book" }] }));
    const { proposals, direction } = propose({ client: "X", brief: "y", sources, estate: [{ id: "sibling", fingerprint: sibling }] });
    const accents = proposals.find((p) => p.key === "accent")!.candidates.map((c) => c.value);
    expect(accents[0]).toBe("#1f4d3a");
    expect(accents[accents.length - 1]).toBe("#6d28d9");
    expect(direction.choices.accent!.because.startsWith(PROPOSED)).toBe(true);
    expect(validateDirection(direction).valid).toBe(false);
  });
});

// A minimal PNG, filter 1 (sub) on every row, to prove the decoder undoes it.
function png(width: number, height: number, rgb: [number, number, number]): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const rows: number[] = [];
  for (let y = 0; y < height; y += 1) {
    rows.push(1, ...rgb);
    for (let x = 1; x < width; x += 1) rows.push(0, 0, 0);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.from(rows))), chunk("IEND", Buffer.alloc(0))]);
}

describe("reading a PNG", () => {
  it("undoes the row filters", () => {
    const { width, rgba } = decodePng(png(4, 3, [31, 77, 58]));
    expect(width).toBe(4);
    expect(Array.from(rgba.slice(-4))).toEqual([31, 77, 58, 255]);
  });

  it("says so, rather than guessing, when it cannot read one", () => {
    expect(() => decodePng(Buffer.from("not a png"))).toThrow(/not a PNG/);
  });
});

describe("craft direction", () => {
  let dir: string;
  let out: string[];
  let err: string[];
  const io = () => ({ cwd: dir, out: (t: string) => out.push(t), err: (t: string) => err.push(t) });
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "craft-dir-"));
    out = [];
    err = [];
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("init, then propose from a photo, then validate until a person has written the reasons", async () => {
    writeFileSync(join(dir, "snap.json"), JSON.stringify(makeSnapshot()));
    expect(await run(["direction", "init", "--snapshot", "snap.json", "--client", "RMP"], io())).toBe(0);
    expect(await run(["direction", "validate"], io())).toBe(1);

    writeFileSync(join(dir, "van.png"), png(8, 8, [31, 77, 58]));
    const d = JSON.parse(readFileSync(join(dir, "art-direction.json"), "utf8")) as ArtDirection;
    d.brief = good().brief;
    d.sources = [{ id: "van", kind: "livery", note: "The Transit van, bottle green with cream sign-writing.", path: "van.png" }];
    d.choices = {};
    writeFileSync(join(dir, "art-direction.json"), JSON.stringify(d));
    expect(await run(["direction", "propose", "--out", "proposed.json"], io())).toBe(0);
    const proposed = JSON.parse(readFileSync(join(dir, "proposed.json"), "utf8")) as ArtDirection;
    expect(proposed.sources[0].colours?.length).toBeGreaterThan(0);
    expect(proposed.choices.accent?.because.startsWith(PROPOSED)).toBe(true);

    proposed.choices.accent!.because = "The bottle green is the van's own paint, and the van is what people in Brackley recognise.";
    writeFileSync(join(dir, "art-direction.json"), JSON.stringify(proposed));
    out = [];
    expect(await run(["direction", "validate"], io())).toBe(0);
    expect(out.join("\n")).toMatch(/valid, 1 of 7 choices decided/);
  });

  it("keeps a phase A exceptions file's exceptions when init writes over it", async () => {
    writeFileSync(join(dir, "art-direction.json"), JSON.stringify({ exceptions: [{ tell: "ai-violet", because: "Violet has been the mark since 2019." }] }));
    expect(await run(["direction", "init"], io())).toBe(0);
    const d = JSON.parse(readFileSync(join(dir, "art-direction.json"), "utf8")) as ArtDirection;
    expect(d.exceptions?.[0].tell).toBe("ai-violet");
    expect(await run(["direction", "init"], io())).toBe(2);
  });
});

describe("the JSON Schema", () => {
  it("names the same choices and source kinds as the code", async () => {
    const { CHOICE_KEYS, SOURCE_KINDS } = await import("../direction/types.js");
    const schema = JSON.parse(readFileSync(new URL("../../art-direction.schema.json", import.meta.url), "utf8"));
    expect(schema.properties.choices.propertyNames.enum).toEqual([...CHOICE_KEYS]);
    expect(schema.properties.sources.items.properties.kind.enum).toEqual([...SOURCE_KINDS]);
  });
});
