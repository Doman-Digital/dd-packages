import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { run } from "../character/cli.js";
import { addSite, compareToEstate, emptyEstate, estatePairs, SIBLING_AT, siblingLine, type EstateSite } from "../estate/index.js";
import type { Fingerprint } from "../fingerprint/index.js";
import { makeSnapshot } from "../snapshot/fixture.js";

/**
 * Signal 3. Two sites are siblings when they sit closer than two pages Claude
 * builds for one brief usually do. Each property is proved against sites
 * written to be alike, or not, on purpose.
 */

const fp = (patch: Partial<Fingerprint> = {}): Fingerprint => ({
  version: 1,
  accent: { l: 0.45, c: 0.12, h: 150 },
  ground: { l: 0.98, c: 0.01, h: 90 },
  display: { family: "Fraunces", class: "serif" },
  body: { family: "Inter", class: "sans" },
  roundness: 0.5,
  motion: 0,
  effects: [],
  layout: ["hero", "cards", "text"],
  ...patch,
});

const site = (id: string, fingerprint: Fingerprint): EstateSite => ({ id, client: id, url: `https://${id}.test/`, fingerprint, tells: [], addedAt: "2026-09-23T00:00:00.000Z" });

/** Two different trades built from one template: same faces, same green, same pills. */
const ELECTRICIAN = fp();
const SALON = fp({ accent: { l: 0.47, c: 0.12, h: 155 } });
/** A barber who chose: slab headline, oxblood, square corners, dark ground. */
const BARBER = fp({
  accent: { l: 0.4, c: 0.14, h: 25 },
  ground: { l: 0.18, c: 0.01, h: 60 },
  display: { family: "Alfa Slab One", class: "serif" },
  body: { family: "Source Serif 4", class: "serif" },
  roundness: 0.02,
  layout: ["hero", "text", "text", "cards", "text"],
});

describe("the register", () => {
  it("adds a site, replaces one with the same id, and keeps ids sorted", () => {
    let r = addSite(emptyEstate(), site("rmp", ELECTRICIAN));
    r = addSite(r, site("chair", BARBER));
    r = addSite(r, site("rmp", SALON));
    expect(r.sites.map((s) => s.id)).toEqual(["chair", "rmp"]);
    expect(r.sites[1].fingerprint.accent?.h).toBe(155);
  });

  it("refuses an id that is not short kebab-case", () => {
    expect(() => addSite(emptyEstate(), site("RMP Electrical", ELECTRICIAN))).toThrow(/kebab-case/);
  });
});

describe("siblings", () => {
  const register = [site("rmp", ELECTRICIAN), site("mmm", SALON), site("chair", BARBER)].reduce(addSite, emptyEstate());

  it("marks two trades built from one template as siblings, and says what they share", () => {
    const [nearest] = compareToEstate(ELECTRICIAN, register, { exclude: "rmp" });
    expect(nearest).toMatchObject({ id: "mmm", sibling: true });
    expect(nearest.shared).toEqual(expect.arrayContaining(["green accent", "Fraunces headline", "Inter body", "pill buttons", "no reveals"]));
  });

  it("does not mark a site that decided its own look", () => {
    const matches = compareToEstate(BARBER, register, { exclude: "chair" });
    expect(matches.every((m) => !m.sibling)).toBe(true);
    expect(matches[0].distance).toBeGreaterThan(SIBLING_AT * 1.5);
  });

  it("says 'no accent' when neither site has one, not that they share it", () => {
    const [m] = compareToEstate(fp({ accent: null }), addSite(emptyEstate(), site("hjb", fp({ accent: null }))));
    expect(m.shared).toContain("no accent");
    expect(m.shared).not.toContain("none accent");
  });

  it("lists every pair once, closest first", () => {
    const pairs = estatePairs(register);
    expect(pairs).toHaveLength(3);
    expect(pairs[0]).toMatchObject({ sibling: true });
    expect([pairs[0].a, pairs[0].b].sort()).toEqual(["mmm", "rmp"]);
    expect(pairs.filter((p) => p.sibling)).toHaveLength(1);
  });

  it("takes the line from null models: the median distance between two pages of one brief", () => {
    // Four pages of one brief whose only differences are in the accent.
    const brief = [0, 20, 40, 60].map((dh) => fp({ accent: { l: 0.45, c: 0.12, h: 150 + dh } }));
    const line = siblingLine([brief]);
    expect(line).toBeGreaterThan(0);
    expect(line).toBeLessThan(0.26);
    // A tighter null draws a tighter line: the salon is no longer the electrician's sibling.
    expect(compareToEstate(ELECTRICIAN, register, { exclude: "rmp", siblingAt: 0.001 })[0].sibling).toBe(false);
    expect(() => siblingLine([])).toThrow(/no null pages/);
  });
});

describe("craft estate", () => {
  let dir: string;
  let out: string[];
  let err: string[];
  const io = () => ({ cwd: dir, out: (t: string) => out.push(t), err: (t: string) => err.push(t) });

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "craft-estate-"));
    out = [];
    err = [];
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const green = makeSnapshot({ url: "https://rmp.test/" });
  const alsoGreen = makeSnapshot({ url: "https://salon.test/" });

  it("adds sites from saved snapshots and finds the sibling", async () => {
    writeFileSync(join(dir, "rmp.json"), JSON.stringify(green));
    writeFileSync(join(dir, "salon.json"), JSON.stringify(alsoGreen));
    expect(await run(["estate", "add", "rmp.json", "--id", "rmp", "--client", "RMP Electrical"], io())).toBe(0);
    expect(await run(["estate", "add", "salon.json", "--id", "salon"], io())).toBe(0);
    const saved = JSON.parse(readFileSync(join(dir, "estate.json"), "utf8"));
    expect(saved.sites.map((s: EstateSite) => s.id)).toEqual(["rmp", "salon"]);
    expect(saved.sites[0]).toMatchObject({ client: "RMP Electrical", url: "https://rmp.test/" });
    expect(out.join("\n")).toMatch(/salon: nearest sites[\s\S]*rmp\s+0\.00\s+SIBLING/);

    out = [];
    expect(await run(["estate", "compare"], io())).toBe(0);
    expect(out.join("\n")).toMatch(/2 sites, 1 pair, 1 sibling pair[\s\S]*rmp \+ salon/);
    expect(await run(["estate", "compare", "--strict"], io())).toBe(1);
    expect(await run(["estate", "compare", "rmp", "--json"], io())).toBe(0);
    expect(JSON.parse(out[out.length - 1]).matches[0]).toMatchObject({ id: "salon", sibling: true });
  });

  it("says what it needs", async () => {
    expect(await run(["estate", "add", "x.json"], io())).toBe(2);
    expect(err.join("\n")).toMatch(/--id <id>/);
    expect(await run(["estate", "compare", "nowhere"], io())).toBe(2);
    expect(err.join("\n")).toMatch(/neither a URL, a snapshot file, nor a site/);
    writeFileSync(join(dir, "estate.json"), JSON.stringify({ sites: "no" }));
    expect(await run(["estate", "compare"], io())).toBe(2);
    expect(err.join("\n")).toMatch(/not an estate register/);
    expect(existsSync(join(dir, "estate.json"))).toBe(true);
  });

  it("feeds craft direction propose, so a proposal steers away from a sibling's accent", async () => {
    // RMP's buttons are a strong green. The salon's fascia carries the same
    // green and a muted red; on chroma alone the green would win.
    const base = makeSnapshot();
    const rmp = makeSnapshot({ url: "https://rmp.test/", controls: base.controls.map((c) => ({ ...c, background: "rgb(22, 130, 70)" })) });
    writeFileSync(join(dir, "rmp.json"), JSON.stringify(rmp));
    await run(["estate", "add", "rmp.json", "--id", "rmp"], io());
    writeFileSync(
      join(dir, "art-direction.json"),
      JSON.stringify({ version: 1, client: "Salon", brief: "A nail studio in Brackley, Northamptonshire, for gel nails and brows.", sources: [{ id: "fascia", kind: "shopfront", note: "The painted fascia over the door", colours: ["#168246", "#9a5a4e"] }], choices: {} }),
    );
    expect(await run(["direction", "propose", "--out", "alone.json"], io())).toBe(0);
    expect(JSON.parse(readFileSync(join(dir, "alone.json"), "utf8")).choices.accent.value).toBe("#168246");
    expect(await run(["direction", "propose", "--estate", "estate.json", "--out", "steered.json"], io())).toBe(0);
    expect(JSON.parse(readFileSync(join(dir, "steered.json"), "utf8")).choices.accent.value).toBe("#9a5a4e");
  });
});
