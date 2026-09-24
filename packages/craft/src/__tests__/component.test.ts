import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { describeComponents } from "../audit/cli.js";
import { run } from "../character/cli.js";
import {
  COMPONENT_ROLES,
  PROMO_BADGE,
  closestComponents,
  componentDistance,
  componentShared,
  componentTypicalities,
  componentTypicality,
  componentsOf,
  estateComponentPairs,
} from "../fingerprint/component.js";
import { fingerprint, type Fingerprint, type FingerprintSection } from "../fingerprint/index.js";
import { addSite, emptyEstate, type EstateSite } from "../estate/index.js";
import { MIN_RUNS, type NullRun } from "../null/index.js";
import { makeSnapshot } from "../snapshot/fixture.js";
import type { SectionGeometry } from "../snapshot/types.js";

/**
 * Component-level sameness. Each property is proved on components written to
 * share a recipe, or not, on purpose.
 */

const GREEN = { l: 0.35, c: 0.06, h: 160 };
const OXBLOOD = { l: 0.35, c: 0.12, h: 25 };

const section = (patch: Partial<FingerprintSection> = {}): FingerprintSection => ({
  role: "cta-band",
  centred: 1,
  width: 0.45,
  symmetry: 0.95,
  controls: 1,
  cards: 0,
  background: GREEN,
  badges: [],
  avatars: 0,
  carousel: false,
  figures: 0,
  ...patch,
});

/** The stock band: centred, narrow, its own colour, one button. */
const STOCK_BAND = section();
/** The same ask laid out like the page: left-aligned, wide, on the ground, a phone number and a button. */
const OWN_BAND = section({ centred: 0.05, width: 0.9, symmetry: 0.4, controls: 2, background: null });

const fp = (sections: FingerprintSection[] | undefined): Fingerprint => ({
  version: sections ? 2 : 1,
  accent: GREEN,
  ground: { l: 0.99, c: 0, h: 0 },
  display: { family: "Fraunces", class: "serif" },
  body: { family: "Inter", class: "sans" },
  roundness: 0.1,
  motion: 0,
  effects: [],
  layout: ["hero", "text"],
  ...(sections ? { sections } : {}),
});

const site = (id: string, fingerprint: Fingerprint): EstateSite => ({ id, client: id, url: `https://${id}.test/`, fingerprint, tells: [], addedAt: "2026-09-24T00:00:00.000Z" });

describe("componentDistance", () => {
  it("is 0 for the same recipe and 1 across roles", () => {
    expect(componentDistance(STOCK_BAND, section())).toBe(0);
    expect(componentDistance(STOCK_BAND, section({ role: "faq" }))).toBe(1);
  });

  it("puts a band laid out like the page far from the stock band, and a recoloured stock band near it", () => {
    const recoloured = section({ background: OXBLOOD });
    expect(componentDistance(STOCK_BAND, recoloured)).toBeLessThan(0.15);
    expect(componentDistance(STOCK_BAND, OWN_BAND)).toBeGreaterThan(0.4);
  });

  it("ignores parts only one side measured instead of counting them as different", () => {
    const bare: FingerprintSection = { role: "cta-band", centred: 1, width: 0.45 };
    expect(componentDistance(STOCK_BAND, bare)).toBe(0);
  });
});

describe("componentShared", () => {
  it("names the stock band's recipe", () => {
    expect(componentShared(STOCK_BAND, section({ background: { ...GREEN, l: 0.36 } }))).toEqual(["centred", "narrow column", "1 button", "same coloured band"]);
  });

  it("names a pricing trio with a badge", () => {
    const trio = section({ role: "pricing", centred: 0.9, width: 0.85, controls: 3, cards: 3, background: null, badges: ["most popular"] });
    expect(componentShared(trio, { ...trio, badges: ["recommended"] })).toEqual(["centred", "full width", "3 buttons", "3 cards", "promo badge", "on the page ground"]);
  });

  it("shares nothing across roles", () => {
    expect(componentShared(STOCK_BAND, section({ role: "pricing" }))).toEqual([]);
  });
});

describe("PROMO_BADGE", () => {
  it("matches the badges that promote one option, and not a plain label", () => {
    for (const t of ["Most popular", "RECOMMENDED", "Best value", "Bestseller"]) expect(PROMO_BADGE.test(t)).toBe(true);
    for (const t of ["New", "Gas Safe", "From £80"]) expect(PROMO_BADGE.test(t)).toBe(false);
  });
});

describe("fingerprint sections from a version 2 snapshot", () => {
  const geo = (patch: Partial<SectionGeometry> = {}): SectionGeometry => ({
    centredShare: 0.1,
    mirrorSymmetry: 0.6,
    whitespaceRatio: 0.7,
    contentWidthRatio: 0.85,
    background: "rgb(255, 255, 255)",
    controls: 0,
    ...patch,
  });

  it("carries the parts, marks the page ground as null and lower-cases badges", () => {
    const base = makeSnapshot();
    const snap = {
      ...base,
      sections: base.sections.map((s, i) => ({
        ...s,
        role: i === 3 ? ("pricing" as const) : s.kind,
        geometry: i === 3 ? geo({ background: "rgb(31, 58, 46)", controls: 3 }) : geo(),
        ...(i === 3 ? { cards: 3, badges: ["Most popular"], avatars: 0, carousel: false, figures: 0 } : {}),
      })),
    };
    const f = fingerprint(snap);
    const [pricing] = componentsOf(f, "pricing");
    expect(pricing).toMatchObject({ role: "pricing", cards: 3, controls: 3, badges: ["most popular"], carousel: false });
    expect(pricing.background).not.toBeNull();
    expect(componentsOf(f, "hero")[0].background).toBeNull();
  });

  it("has no components for a version 1 snapshot", () => {
    expect(componentsOf(fingerprint(makeSnapshot()), "cta-band")).toEqual([]);
  });
});

describe("estate comparison per component", () => {
  const register = [
    site("plumber", fp([section({ role: "hero", centred: 0, width: 0.9, background: null }), STOCK_BAND])),
    site("salon", fp([section({ role: "hero", centred: 0, width: 0.9, background: null }), section({ background: OXBLOOD })])),
    site("barber", fp([section({ role: "hero", centred: 0, width: 0.9, background: null }), OWN_BAND])),
    site("old", fp(undefined)),
  ].reduce(addSite, emptyEstate());

  it("ranks the two stock bands first, names what they share, and skips sites with no roles", () => {
    const pairs = estateComponentPairs(register, "cta-band");
    expect(pairs).toHaveLength(3);
    expect([pairs[0].a, pairs[0].b].sort()).toEqual(["plumber", "salon"]);
    expect(pairs[0].shared).toEqual(expect.arrayContaining(["centred", "narrow column", "1 button"]));
    expect(pairs.every((p) => p.a !== "old" && p.b !== "old")).toBe(true);
    expect(pairs[2].distance).toBeGreaterThan(pairs[0].distance);
  });

  it("compares the closest pair when a page has two components of a role", () => {
    const two = fp([OWN_BAND, STOCK_BAND]);
    expect(closestComponents(two, fp([STOCK_BAND]), "cta-band")?.distance).toBe(0);
    expect(closestComponents(two, fp([STOCK_BAND]), "pricing")).toBeNull();
  });
});

describe("component typicality against a null model", () => {
  const run_ = (id: string, sections: FingerprintSection[]): NullRun => ({ id, fingerprint: fp(sections), tells: [], copy: [] });
  /** Six null pages ending on nearly the same band: the model's default. */
  const runs = Array.from({ length: 6 }, (_, i) => run_(String(i + 1).padStart(2, "0"), [section({ width: 0.42 + i * 0.01, symmetry: 0.9 + i * 0.01 })]));

  it("scores the stock band typical and the band laid out like the page not typical", () => {
    const stock = componentTypicality(STOCK_BAND, runs);
    const own = componentTypicality(OWN_BAND, runs);
    expect(stock?.typical).toBe(true);
    expect(own?.typical).toBe(false);
    expect(own!.distance).toBeGreaterThan(stock!.distance);
    expect(stock?.runs).toBe(6);
  });

  it("says nothing when fewer than MIN_RUNS null pages have the role", () => {
    expect(componentTypicality(STOCK_BAND, runs.slice(0, MIN_RUNS - 1))).toBeNull();
    expect(componentTypicality(section({ role: "pricing" }), runs)).toBeNull();
  });

  it("scores every component role the null can speak to, and only those", () => {
    const page = fp([section({ role: "hero" }), section({ role: "pricing" }), STOCK_BAND]);
    const scored = componentTypicalities(page, runs);
    expect(scored.map((c) => c.role)).toEqual(["cta-band"]);
    expect(COMPONENT_ROLES).not.toContain("hero");
  });

  it("explains an empty result instead of printing nothing", () => {
    expect(describeComponents([], false, true)).toMatch(/page's snapshot predates version 2/);
    expect(describeComponents([], true, false)).toMatch(/null model predates snapshot version 2/);
    expect(describeComponents([], true, true)).toMatch(/none the null model/);
    expect(describeComponents(componentTypicalities(fp([STOCK_BAND]), runs), true, true)).toMatch(/cta-band\s+\d\.\d\d: typical \(6 null pages have one\)/);
  });
});

describe("craft estate compare --component", () => {
  let dir: string;
  let out: string[];
  let err: string[];
  const io = () => ({ cwd: dir, out: (t: string) => out.push(t), err: (t: string) => err.push(t) });
  const write = (sites: EstateSite[]) => writeFileSync(join(dir, "estate.json"), JSON.stringify(sites.reduce(addSite, emptyEstate())));

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "craft-component-"));
    out = [];
    err = [];
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("ranks pairs as JSON", async () => {
    write([site("plumber", fp([STOCK_BAND])), site("salon", fp([section({ background: OXBLOOD })])), site("barber", fp([OWN_BAND]))]);
    expect(await run(["estate", "compare", "--component", "cta-band", "--json"], io())).toBe(0);
    const data = JSON.parse(out.join("\n"));
    expect(data).toMatchObject({ schemaVersion: 1, role: "cta-band", measured: 3, sites: 3 });
    expect([data.pairs[0].a, data.pairs[0].b].sort()).toEqual(["plumber", "salon"]);
  });

  it("compares one site against the rest", async () => {
    write([site("plumber", fp([STOCK_BAND])), site("salon", fp([section({ background: OXBLOOD })])), site("barber", fp([OWN_BAND]))]);
    expect(await run(["estate", "compare", "plumber", "--component", "cta-band"], io())).toBe(0);
    expect(out.join("\n")).toMatch(/plumber \+ salon\s+0\.\d\d\s+shares centred, narrow column, 1 button/);
  });

  it("says why there is nothing to compare when the sites predate version 2", async () => {
    write([site("old-a", fp(undefined)), site("old-b", fp(undefined))]);
    expect(await run(["estate", "compare", "--component", "pricing"], io())).toBe(0);
    expect(out.join("\n")).toMatch(/0 of 2 sites have one[\s\S]*re-add the sites from a fresh snapshot/);
  });

  it("refuses a role that is not a component", async () => {
    write([]);
    expect(await run(["estate", "compare", "--component", "hero"], io())).toBe(2);
    expect(err.join("\n")).toMatch(/--component takes one of cta-band/);
  });
});
