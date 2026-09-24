import { describe, expect, it } from "vitest";
import { FINGERPRINT_VERSION, fingerprint, fingerprintDistance, layoutDistance } from "../fingerprint/index.js";
import { makeSnapshot } from "../snapshot/fixture.js";
import { readSnapshot } from "../snapshot/migrate.js";
import { SNAPSHOT_VERSION, type SectionGeometry, type Snapshot, type SnapshotSection } from "../snapshot/types.js";
import { EDGE_STEP, visualMeasures } from "../snapshot/visual.js";

/** An image from a function of (x, y) to [r, g, b]. */
function image(w: number, h: number, paint: (x: number, y: number) => [number, number, number]) {
  const rgba = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const [r, g, b] = paint(x, y);
      rgba.set([r, g, b, 255], (y * w + x) * 4);
    }
  }
  return { width: w, height: h, rgba };
}

describe("screenshot measures", () => {
  it("reads a flat grey page as colourless, edgeless and symmetric", () => {
    const v = visualMeasures(image(40, 30, () => [128, 128, 128]));
    expect(v).toMatchObject({ colourfulness: 0, edgeDensity: 0, symmetry: 1, width: 40, height: 30, sampled: 1200 });
  });

  it("scores a saturated page as more colourful than a muted one", () => {
    const loud = visualMeasures(image(40, 30, (x) => (x % 2 ? [230, 20, 40] : [20, 60, 230])));
    const quiet = visualMeasures(image(40, 30, (x) => (x % 2 ? [150, 140, 130] : [130, 140, 150])));
    expect(loud.colourfulness).toBeGreaterThan(quiet.colourfulness * 5);
  });

  it("counts a checkerboard as all edges and a flat page as none", () => {
    const board = visualMeasures(image(40, 40, (x, y) => ((x + y) % 2 ? [255, 255, 255] : [0, 0, 0])));
    expect(board.edgeDensity).toBe(1);
    const soft = visualMeasures(image(40, 40, (x) => [x, x, x]));
    expect(soft.edgeDensity).toBe(0); // a 1-per-pixel ramp never steps by EDGE_STEP
    expect(EDGE_STEP).toBeGreaterThan(2);
  });

  it("reads a page dark on the left and light on the right as asymmetric", () => {
    expect(visualMeasures(image(40, 20, (x) => (x < 20 ? [0, 0, 0] : [255, 255, 255]))).symmetry).toBe(0);
  });

  it("samples a large page on a grid rather than reading every pixel", () => {
    const v = visualMeasures(image(400, 300, () => [10, 200, 30]), 10_000);
    expect(v.sampled).toBeLessThanOrEqual(10_000);
    expect(v.sampled).toBeGreaterThan(5_000);
  });

  it("refuses a buffer too short for its size", () => {
    expect(() => visualMeasures({ width: 10, height: 10, rgba: new Uint8Array(10) })).toThrow(/10x10/);
  });
});

describe("reading saved snapshots", () => {
  it("reads a version 1 snapshot as version 2, marked as migrated", () => {
    const v1 = { ...makeSnapshot(), version: 1 };
    const read = readSnapshot(v1);
    expect(read.version).toBe(SNAPSHOT_VERSION);
    expect(read.migratedFrom).toBe(1);
    expect(read.sections).toEqual(v1.sections);
  });

  it("reads a version 2 snapshot unchanged", () => {
    const v2 = makeSnapshot();
    expect(readSnapshot(v2)).toBe(v2);
  });

  it("refuses anything else by name", () => {
    expect(() => readSnapshot({ ...makeSnapshot(), version: 3 }, "x.json")).toThrow(/x\.json is not a snapshot this craft reads \(version 3/);
    expect(() => readSnapshot(null)).toThrow(/not a snapshot/);
  });
});

const geo = (patch: Partial<SectionGeometry> = {}): SectionGeometry => ({
  centredShare: 0.1,
  mirrorSymmetry: 0.5,
  whitespaceRatio: 0.6,
  contentWidthRatio: 0.7,
  background: "rgb(255, 255, 255)",
  controls: 1,
  ...patch,
});

/** makeSnapshot's sections with roles and geometry, as a version 2 capture has them. */
function v2(roles: SnapshotSection["role"][], geometry: (i: number) => SectionGeometry = () => geo()): Snapshot {
  const base = makeSnapshot();
  return { ...base, sections: base.sections.map((s, i) => ({ ...s, role: roles[i] ?? s.kind, geometry: geometry(i) })) };
}

describe("fingerprint version 2", () => {
  it("records role and geometry when every section has them", () => {
    const fp = fingerprint(v2(["hero", "features", "pricing", "faq", "contact"]));
    expect(fp.version).toBe(FINGERPRINT_VERSION);
    expect(fp.sections?.map((s) => s.role)).toEqual(["hero", "features", "pricing", "faq", "contact"]);
  });

  it("records none from a version 1 snapshot", () => {
    expect(fingerprint(makeSnapshot()).sections).toBeUndefined();
  });

  it("tells two pages apart by role where kind alone sees the same page", () => {
    const a = fingerprint(v2(["hero", "text", "cards", "pricing", "faq"]));
    const b = fingerprint(v2(["hero", "text", "cards", "testimonials", "contact"]));
    expect(a.layout).toEqual(b.layout);
    expect(layoutDistance({ ...a, sections: undefined }, b)).toBe(0);
    expect(layoutDistance(a, b)).toBeCloseTo(2 / 5);
  });

  it("counts a different layout of the same role as at most half a change", () => {
    const centred = fingerprint(v2(["hero", "cta-band", "cards", "text", "text"], (i) => (i === 1 ? geo({ centredShare: 1, contentWidthRatio: 0.4 }) : geo())));
    const left = fingerprint(v2(["hero", "cta-band", "cards", "text", "text"], (i) => (i === 1 ? geo({ centredShare: 0, contentWidthRatio: 0.9 }) : geo())));
    const d = layoutDistance(centred, left);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThanOrEqual(0.5 / 5);
  });

  it("compares with a version 1 fingerprint exactly as version 1 did", () => {
    const old = { ...fingerprint(makeSnapshot()), version: 1 as const };
    const now = fingerprint(v2(["hero", "features", "pricing", "faq", "contact"]));
    const before = fingerprintDistance(old, { ...now, sections: undefined });
    expect(fingerprintDistance(old, now)).toEqual(before);
  });
});
