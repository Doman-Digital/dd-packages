import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { describeFingerprint } from "../audit/cli.js";
import { parseColour } from "../character/color.js";
import { run } from "../character/cli.js";
import { compareToEstate, estatePairs, sharedParts, SIBLING_AT, type EstateRegister } from "../estate/index.js";
import {
  DISTANCE_WEIGHTS,
  FINGERPRINT_VERSION,
  fingerprint,
  fingerprintDistance,
  groundDistance,
  groundTemperature,
  heroDistance,
  rhythmDistance,
  rhythmOf,
  SHARED_PART,
  TEMPERATURE_NAMED,
  temperatureName,
} from "../fingerprint/index.js";
import { groundLabel } from "../null/index.js";
import { makeSnapshot } from "../snapshot/fixture.js";
import { readSnapshot } from "../snapshot/migrate.js";
import type { SectionGeometry, Snapshot, SnapshotSection } from "../snapshot/types.js";

/**
 * Two kinds of likeness the version 2 distance missed, found on Bellerose
 * Plumbing against RMP Electrical (DOM-637): a warm cream and a cool
 * porcelain filed as the same "grey ground", and two pages that open the
 * same way (light hero, serif headline, photo right, then a near-black
 * band) scoring as if their structure had nothing in common.
 */

const oklch = (css: string) => parseColour(css)!.oklch;
/** RMP's live ground, Bellerose's stone (before PR #32), its porcelain (after) and its van black. */
const CREAM = oklch("rgb(245, 241, 234)");
const STONE = oklch("#eeede8");
const PORCELAIN = oklch("#f1f3f4");
const WHITE = oklch("#ffffff");
const VAN = oklch("#151617");
const BROWN_BLACK = oklch("rgb(40, 34, 28)");

describe("ground temperature", () => {
  it("reads cream and stone as warm, porcelain and the van black as cool, pure white as neutral", () => {
    expect(temperatureName(CREAM)).toBe("warm");
    expect(temperatureName(STONE)).toBe("warm");
    expect(temperatureName(PORCELAIN)).toBe("cool");
    expect(temperatureName(VAN)).toBe("cool");
    expect(temperatureName(BROWN_BLACK)).toBe("warm");
    expect(temperatureName(WHITE)).toBe("neutral");
    expect(groundTemperature(CREAM)).toBe(1);
    expect(groundTemperature(PORCELAIN)).toBeLessThan(-TEMPERATURE_NAMED);
  });

  it("counts a green or a magenta tint as neither warm nor cool", () => {
    expect(temperatureName({ l: 0.95, c: 0.02, h: 145 })).toBe("neutral");
    expect(temperatureName({ l: 0.95, c: 0.02, h: 320 })).toBe("neutral");
    expect(temperatureName({ l: 0.95, c: 0.02, h: 350 })).toBe("warm");
    expect(temperatureName({ l: 0.95, c: 0.02, h: 250 })).toBe("cool");
  });

  it("separates cream from porcelain where ΔE alone cannot, and keeps cream and stone as one paper", () => {
    // ΔE_OK between cream and porcelain is about 0.013: a tenth of GROUND_SCALE.
    expect(groundDistance(CREAM, PORCELAIN)).toBeGreaterThan(SHARED_PART * 2);
    expect(groundDistance(CREAM, STONE)).toBeLessThanOrEqual(SHARED_PART);
    expect(groundDistance(CREAM, STONE)).toBeLessThan(groundDistance(CREAM, PORCELAIN));
    // A warm brown-black band and a cool blue-black are not the same dark either.
    expect(groundDistance(BROWN_BLACK, VAN)).toBeGreaterThan(SHARED_PART * 2);
    // Light against dark is still the whole distance.
    expect(groundDistance(CREAM, VAN)).toBe(1);
    expect(groundDistance(CREAM, CREAM)).toBe(0);
  });

  it("names the paper with its temperature", () => {
    expect(groundLabel(CREAM)).toBe("cream");
    expect(groundLabel(STONE)).toBe("warm grey");
    expect(groundLabel(PORCELAIN)).toBe("cool grey");
    expect(groundLabel(WHITE)).toBe("white");
    expect(groundLabel(VAN)).toBe("cool dark");
    expect(groundLabel(BROWN_BLACK)).toBe("warm dark");
  });
});

// A page as sections with roles and geometry, so the fingerprint carries version 2 sections.
const geo = (background: string, patch: Partial<SectionGeometry> = {}): SectionGeometry => ({
  centredShare: 0,
  mirrorSymmetry: 0.9,
  whitespaceRatio: 0.5,
  contentWidthRatio: 0.75,
  background,
  controls: 1,
  ...patch,
});
const section = (top: number, kind: SnapshotSection["kind"], role: NonNullable<SnapshotSection["role"]>, background: string, patch: Partial<SectionGeometry> = {}): SnapshotSection => ({
  top,
  height: 800,
  kind,
  label: role,
  cards: 0,
  iconCards: 0,
  hiddenAtLoad: false,
  role,
  geometry: geo(background, patch),
});

/** Light hero, dark band, light features, dark closer: RMP's and Bellerose's opening. */
function page(ground: string, band: string, patch: Partial<Snapshot> = {}): Snapshot {
  return makeSnapshot({
    ground,
    sections: [section(0, "hero", "hero", ground), section(800, "text", "contact", band), section(1600, "cards", "features", ground), section(2400, "text", "footer-cta", band)],
    headings: [{ level: 1, family: "Fraunces", sizePx: 96, weight: 300, italic: false, italicPart: true, text: "Your local electricians.", top: 256 }],
    images: [{ src: "https://x.test/van.jpg", host: "x.test", width: 425, height: 532, top: 177, left: 900, role: "photo", alt: "The van", decorative: false, section: 0, background: false }],
    ...patch,
  });
}

describe("rhythm", () => {
  it("reads the bands of light and dark in running order, merging runs and the page ground", () => {
    expect(rhythmOf(fingerprint(page("rgb(245, 241, 234)", "rgb(40, 34, 28)")))).toEqual(["light", "dark", "light", "dark"]);
    // A white logo strip between a cream hero and the dark band is part of the light opening.
    const strip = page("rgb(245, 241, 234)", "rgb(40, 34, 28)", {
      sections: [section(0, "hero", "hero", "rgb(245, 241, 234)"), section(800, "logos", "logos", "rgb(255, 255, 255)"), section(900, "text", "contact", "rgb(40, 34, 28)")],
    });
    expect(rhythmOf(fingerprint(strip))).toEqual(["light", "dark"]);
    expect(rhythmOf(fingerprint(makeSnapshot()))).toBeNull(); // version 1 sections carry no backgrounds
  });

  it("is near zero for two pages that open light then dark, and far for dark mode of the same page", () => {
    const rmp = fingerprint(page("rgb(245, 241, 234)", "rgb(40, 34, 28)"));
    const stone = fingerprint(page("#eeede8", "#151617"));
    const dark = fingerprint(page("#151617", "#eeede8"));
    expect(rhythmDistance(rmp, stone)).toBe(0);
    expect(rhythmDistance(rmp, dark)).toBeGreaterThan(0.5);
    expect(rhythmDistance(rmp, fingerprint(makeSnapshot()))).toBeNull();
  });
});

describe("hero composition", () => {
  it("records the headline and which side the picture sits", () => {
    const fp = fingerprint(page("#eeede8", "#151617"));
    expect(fp.version).toBe(FINGERPRINT_VERSION);
    expect(fp.hero).toEqual({ headline: { sizePx: 96, weight: 300, class: "serif", italic: true }, image: "right" });
    const left = page("#eeede8", "#151617", { images: [{ ...page("#eeede8", "#151617").images![0], left: 40 }] });
    expect(fingerprint(left).hero?.image).toBe("left");
    const full = page("#eeede8", "#151617", { images: [{ ...page("#eeede8", "#151617").images![0], left: 0, width: 1440 }] });
    expect(fingerprint(full).hero?.image).toBe("full");
    expect(fingerprint(page("#eeede8", "#151617", { images: [] })).hero?.image).toBe("none");
  });

  it("leaves the picture out when the snapshot predates image positions, and the hero out when there is none", () => {
    const old = page("#eeede8", "#151617");
    delete old.images![0].left;
    expect(fingerprint(old).hero).toEqual({ headline: { sizePx: 96, weight: 300, class: "serif", italic: true } });
    expect(fingerprint(makeSnapshot({ sections: [] })).hero).toBeUndefined();
  });

  it("puts a left-aligned serif hero with the photo right near another, and a centred sans one far", () => {
    const a = fingerprint(page("#eeede8", "#151617"));
    const b = fingerprint(page("#f1f3f4", "#151617", { headings: [{ level: 1, family: "Libre Caslon Text", sizePx: 60, weight: 400, italic: false, italicPart: false, text: "Plumbing and heating", top: 199 }] }));
    const centred = fingerprint(
      page("#ffffff", "#111111", {
        sections: [section(0, "hero", "hero", "#ffffff", { centredShare: 1, contentWidthRatio: 0.5 }), section(800, "text", "contact", "#111111")],
        headings: [{ level: 1, family: "Inter", sizePx: 56, weight: 700, italic: false, italicPart: false, text: "Plumbing, sorted", top: 300 }],
        images: [],
      }),
    );
    expect(heroDistance(a, b)!).toBeLessThanOrEqual(SHARED_PART);
    expect(heroDistance(a, centred)!).toBeGreaterThan(0.6);
    expect(heroDistance(a, fingerprint(makeSnapshot()))).toBeNull();
  });
});

describe("the distance", () => {
  it("weighs structure at a quarter and leaves out what only one side measures", () => {
    expect(Object.values(DISTANCE_WEIGHTS).reduce((s, w) => s + w, 0)).toBeCloseTo(1);
    expect(DISTANCE_WEIGHTS.layout + DISTANCE_WEIGHTS.rhythm + DISTANCE_WEIGHTS.hero).toBeCloseTo(0.25);
    const v1 = fingerprint(makeSnapshot());
    const v3 = fingerprint(page("#eeede8", "#151617"));
    const d = fingerprintDistance(v1, v3);
    expect(d.parts.rhythm).toBeNull();
    expect(d.parts.hero).toBeNull();
    // The total is the weighted mean over the parts that were measured, not of nine.
    const measured = (["accent", "ground", "type", "shape", "motion", "effects", "layout"] as const).reduce((s, k) => s + DISTANCE_WEIGHTS[k] * d.parts[k], 0) / 0.85;
    expect(d.total).toBeCloseTo(measured, 3);
    expect(fingerprintDistance(v3, v3).total).toBe(0);
  });

  it("names the shared paper, rhythm and hero in words a person would use", () => {
    const rmp = fingerprint(page("rgb(245, 241, 234)", "rgb(40, 34, 28)"));
    const stone = fingerprint(page("#eeede8", "#151617"));
    const porcelain = fingerprint(page("#f1f3f4", "#151617"));
    expect(sharedParts(rmp, stone)).toEqual(expect.arrayContaining(["warm ground", "light hero then dark band", "left-aligned serif hero, photo right", "same running order"]));
    const shared = sharedParts(rmp, porcelain);
    expect(shared).toEqual(expect.arrayContaining(["light hero then dark band", "left-aligned serif hero, photo right"]));
    expect(shared.some((s) => /ground/.test(s))).toBe(false);
    expect(sharedParts(stone, stone)).toContain("warm grey ground");
    expect(sharedParts(porcelain, porcelain)).toContain("cool grey ground");
  });
});

describe("craft snapshot --scheme", () => {
  it("takes light or dark, and nothing else", async () => {
    const err: string[] = [];
    const io = { cwd: process.cwd(), out: () => undefined, err: (t: string) => err.push(t) };
    expect(await run(["snapshot", "https://example.test/", "--scheme", "sideways"], io)).toBe(2);
    expect(err.join("\n")).toMatch(/--scheme takes light or dark/);
  });

  it("prints the rhythm and the hero with the fingerprint", () => {
    const text = describeFingerprint(fingerprint(page("#eeede8", "#151617")));
    expect(text).toMatch(/rhythm {5}light > dark > light > dark/);
    expect(text).toMatch(/hero {7}left-aligned, serif headline at 96px, picture right/);
    expect(describeFingerprint(fingerprint(makeSnapshot()))).toMatch(/rhythm {5}not measured/);
  });
});

const fixture = (name: string): Snapshot => readSnapshot(JSON.parse(readFileSync(fileURLToPath(new URL(`../../calibration/estate/2026-10-09-temperature/${name}.snapshot.json`, import.meta.url)), "utf8")), name);

describe("RMP Electrical against Bellerose Plumbing (DOM-637)", () => {
  // RMP live on 2026-10-09; Bellerose built locally at c62590c (stone light
  // mode, before bellerose-plumbing#32) and 47f9d79 (porcelain, after), each
  // snapshotted with --scheme light and --scheme dark.
  const rmp = fingerprint(fixture("rmp"));
  const stone = fingerprint(fixture("bellerose-stone-light"));
  const porcelain = fingerprint(fixture("bellerose-porcelain-light"));
  const stoneDark = fingerprint(fixture("bellerose-stone-dark"));
  const porcelainDark = fingerprint(fixture("bellerose-porcelain-dark"));

  it("files the grounds by temperature", () => {
    expect(groundLabel(rmp.ground)).toBe("cream");
    expect(groundLabel(stone.ground)).toBe("warm grey");
    expect(groundLabel(porcelain.ground)).toBe("cool grey");
    expect(groundLabel(stoneDark.ground)).toBe("cool dark");
  });

  it("puts the stone page nearer RMP than the porcelain one, and names the rhythm both share", () => {
    const toStone = fingerprintDistance(rmp, stone);
    const toPorcelain = fingerprintDistance(rmp, porcelain);
    expect(toStone.total).toBeLessThan(toPorcelain.total);
    expect(toStone.parts.ground).toBeLessThanOrEqual(SHARED_PART);
    expect(toPorcelain.parts.ground).toBeGreaterThan(SHARED_PART * 2);
    for (const d of [toStone, toPorcelain]) {
      expect(d.parts.rhythm).toBeLessThanOrEqual(SHARED_PART);
      expect(d.parts.hero).toBeLessThanOrEqual(SHARED_PART);
    }
    expect(sharedParts(rmp, stone, toStone)).toEqual(expect.arrayContaining(["warm ground", "light hero then dark band", "left-aligned serif hero, photo right"]));
    expect(sharedParts(rmp, porcelain, toPorcelain)).toEqual(expect.arrayContaining(["light hero then dark band", "left-aligned serif hero, photo right"]));
    expect(sharedParts(rmp, porcelain, toPorcelain).some((s) => /ground/.test(s))).toBe(false);
    // Neither is a sibling: different faces, accent and shape. The pair is named, not judged.
    expect(toStone.total).toBeGreaterThan(SIBLING_AT);
  });

  it("does not share the rhythm with Bellerose in dark mode, which opens dark then light", () => {
    const d = fingerprintDistance(rmp, porcelainDark);
    expect(rhythmOf(porcelainDark)![0]).toBe("dark");
    expect(d.parts.rhythm).toBeGreaterThan(SHARED_PART);
    expect(d.parts.ground).toBe(1);
    expect(fingerprintDistance(stoneDark, porcelainDark).total).toBe(0);
  });

  it("is zero from itself, and reads a register of version 2 fingerprints without re-adding them", () => {
    expect(fingerprintDistance(rmp, rmp).total).toBe(0);
    // A copy of the redesign workstream's register (dd-ops/dd-redesign/estate-v2.json, 2026-10-09): seven
    // sites with version 2 fingerprints, so rhythm is read from their sections and the hero from its geometry.
    const register = JSON.parse(readFileSync(fileURLToPath(new URL("../../calibration/estate/2026-10-09-temperature/estate-v2-dd-ops-copy.json", import.meta.url)), "utf8")) as EstateRegister;
    expect(register.sites.filter((s) => s.fingerprint).every((s) => s.fingerprint!.version === 2 && !s.fingerprint!.hero)).toBe(true);
    // On stone, RMP is the nearest site in the estate; on porcelain it no longer is.
    const [nearestToStone] = compareToEstate(stone, register);
    expect(nearestToStone.id).toBe("rmp");
    expect(nearestToStone.shared).toEqual(expect.arrayContaining(["warm ground", "light hero then dark band"]));
    expect(compareToEstate(porcelain, register)[0].id).not.toBe("rmp");
    expect(compareToEstate(rmp, register)[0]).toMatchObject({ id: "rmp", sibling: true });
    // Nothing in the register became a sibling of anything.
    expect(estatePairs(register).filter((p) => p.sibling)).toEqual([]);
  });
});
