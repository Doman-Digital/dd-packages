import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { run } from "../character/cli.js";
import { briefTerms, compareCompetitor, pageCopy, specificity, specifics } from "../character/specificity.js";
import { unprovenClaims } from "../character/tells/specificity.js";
import { makeSnapshot } from "../snapshot/fixture.js";
import type { Snapshot } from "../snapshot/types.js";

/**
 * Phase N: specificity. What only this business could have written, counted;
 * and the page compared against a competitor's, sentence by sentence.
 */

const keys = (text: string, brief?: string) => specifics(text, brief).map((s) => `${s.kind}:${s.key}`);

describe("specificity", () => {
  it("counts names, places, numbers, prices and trade nouns, each once", () => {
    const s = specificity("Boilers fixed the same day in Brackley, from £85.\nWe fix boilers in Brackley and Towcester.");
    expect(keys("Boilers fixed the same day in Brackley, from £85.")).toEqual(expect.arrayContaining(["money:£85", "name:brackley", "trade:boiler"]));
    expect(s.specifics.filter((x) => x.key === "brackley")).toHaveLength(1);
    expect(s.hard).toBe(3);
    expect(s.trade).toBe(1);
    expect(s.generic).toBe(false);
    expect(s.perHundred).toBe(Math.round((4 / s.words) * 1000) / 10);
  });

  it("finds nothing in the claim every site makes", () => {
    for (const text of ["Quality you can trust", "Your vision, our expertise.", "Get a Free Quote Today", "We deliver reliable solutions tailored to your needs."]) {
      expect(specificity(text).specifics, text).toEqual([]);
      expect(specificity(text).generic, text).toBe(true);
    }
  });

  it("masks the figures every site uses", () => {
    expect(specificity("24/7 support, 100% satisfaction, 5-star service, the No. 1 choice, 24 hour callouts").specifics).toEqual([]);
    // A real figure next to them still counts.
    expect(keys("24/7 support from £85")).toEqual(["money:£85"]);
  });

  it("reads no names from a Title Case or shouted line, but keeps an acronym in Title Case", () => {
    expect(specificity("Plumbing Services You Can Rely On").specifics.filter((s) => s.kind === "name")).toEqual([]);
    expect(specificity("QUALITY PLUMBING IN BRACKLEY").specifics.filter((s) => s.kind === "name")).toEqual([]);
    expect(keys("Fully Certified NICEIC Electricians")).toContain("name:niceic");
    // A two-word line is neither: it is most likely a name.
    expect(keys("Hinton Heating")).toContain("name:hinton heating");
  });

  it("takes one trade noun as generic and two as particular", () => {
    expect(specificity("Quality plumbing you can trust").generic).toBe(true);
    expect(specificity("Plumbing and boiler repairs").generic).toBe(false);
    // Near misses are not trade nouns: "will" is not probate work, "unlock" is not a locksmith.
    expect(specificity("We will unlock your potential").trade).toBe(0);
  });

  it("recognises a brief's own terms wherever they appear", () => {
    const brief = "Hinton Heating, a Gas Safe engineer in Brackley fitting combi boilers since 2009";
    expect(briefTerms(brief)).toEqual(expect.arrayContaining(["hinton", "heating", "brackley", "combi", "boiler", "2009"]));
    // Opening a sentence, and in a Title Case heading: missed without the brief, found with it.
    const text = "Brackley Homeowners Choose Us For Everything";
    expect(specificity(text).generic).toBe(true);
    expect(keys(text, brief)).toEqual(["brief:brackley"]);
    expect(specificity(text, brief).generic).toBe(false);
    // Not counted twice when the name already holds it.
    expect(keys("Call Hinton Heating today.", brief)).toEqual(["name:hinton heating"]);
  });
});

const page = (url: string, first: string[], sections: { label: string; kind?: Snapshot["sections"][number]["kind"]; role?: Snapshot["sections"][number]["role"]; text: string[] }[]): Snapshot => {
  const base = makeSnapshot({ url });
  return {
    ...base,
    firstScreenText: first,
    sections: sections.map((s, i) => ({ ...base.sections[0], top: i * 800, kind: s.kind ?? (i === 0 ? "hero" : "text"), role: s.role, label: s.label, text: s.text })),
  };
};

const OURS = page("https://hinton.test/", ["Boilers fixed the same day in Brackley", "Gas Safe registered since 2009."], [
  { label: "Boilers fixed the same day in Brackley", text: ["Boilers fixed the same day in Brackley"] },
  { label: "Our services", role: "features", text: ["Combi boiler swaps from £1,850, fitted in a day.", "We offer a friendly and reliable service.", "Radiator upgrades across Brackley."] },
  { label: "What customers say", role: "testimonials", text: ["“Fixed our boiler in an hour. Brilliant.” Sam, Towcester"] },
]);
const THEIRS = page("https://rival.test/", ["Quality heating you can trust"], [
  { label: "Quality heating you can trust", text: ["Quality heating you can trust"] },
  { label: "Services", kind: "cards", text: ["We offer a friendly and reliable service.", "Boiler servicing in Brackley and the villages.", "Radiator upgrades done properly."] },
]);

describe("pageCopy", () => {
  it("takes the first screen and the sections that sell the work, not the reviews", () => {
    const copy = pageCopy(OURS)!;
    expect(copy.hero).toEqual(["Boilers fixed the same day in Brackley", "Gas Safe registered since 2009."]);
    expect(copy.services).toContain("Combi boiler swaps from £1,850, fitted in a day.");
    expect(copy.services.join(" ")).not.toContain("Sam");
    expect(copy.all.join(" ")).toContain("Sam, Towcester");
  });

  it("returns null for a snapshot taken before craft recorded text", () => {
    expect(pageCopy(makeSnapshot())).toBeNull();
  });
});

describe("compareCompetitor", () => {
  it("marks a sentence interchangeable when every specific in it is on the other page too", () => {
    const result = compareCompetitor(pageCopy(OURS)!, pageCopy(THEIRS)!);
    // "boiler", "Brackley" and "radiator" are on both pages; £1,850, 2009 and Gas Safe are only on ours.
    expect(result.ours.interchangeable).toEqual([
      "Boilers fixed the same day in Brackley",
      "We offer a friendly and reliable service.",
      "Radiator upgrades across Brackley.",
    ]);
    expect(result.ours.sentences).toBe(5);
    expect(result.ours.share).toBe(0.6);
    // Every sentence on theirs is one ours could also say.
    expect(result.competitor.share).toBe(1);
    expect(result.ours.perHundred).toBeGreaterThan(result.competitor.perHundred);
  });
});

describe("unprovenClaims", () => {
  it("finds a claim of standing, and not one backed next door", () => {
    const base = makeSnapshot();
    const claim = "Our fully qualified engineers are trusted by homeowners.";
    const snap = (proof: string[], at: number): Snapshot => ({ ...base, sections: base.sections.map((s, i) => ({ ...s, text: i === 1 ? [claim] : i === at ? proof : [] })) });
    expect(unprovenClaims(snap([], 0)).map((c) => c.claim)).toEqual(["fully qualified"]);
    for (const proof of [["NICEIC approved contractor"], ["Rated 4.9 out of 5 from 212 reviews"], ["Registration number: 123456"], ["“They were on time, tidy and fixed it first go, would use again.”"]]) {
      expect(unprovenClaims(snap(proof, 2)), proof[0]).toEqual([]);
      expect(unprovenClaims(snap(proof, 3)), proof[0]).toHaveLength(1);
    }
    // A lower-case "chas" in running text is not the register.
    expect(unprovenClaims(snap(["we chas down every leak"], 2))).toHaveLength(1);
  });
});

describe("craft copy compare --competitor", () => {
  let dir: string;
  let out: string[];
  let err: string[];
  const io = () => ({ cwd: dir, out: (t: string) => out.push(t), err: (t: string) => err.push(t) });
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "craft-competitor-"));
    out = [];
    err = [];
    writeFileSync(join(dir, "ours.json"), JSON.stringify(OURS));
    writeFileSync(join(dir, "theirs.json"), JSON.stringify(THEIRS));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("lists the interchangeable sentences and always exits 0", async () => {
    expect(await run(["copy", "compare", "ours.json", "--competitor", "theirs.json"], io())).toBe(0);
    const text = out.join("\n");
    expect(text).toMatch(/ours\s+3 of 5 \(60%\)/);
    expect(text).toMatch(/competitor\s+4 of 4 \(100%\)/);
    expect(text).toContain('"We offer a friendly and reliable service."');
  });

  it("takes the brief from art-direction.json, and reports JSON", async () => {
    writeFileSync(join(dir, "art-direction.json"), JSON.stringify({ brief: "Hinton Heating, a Gas Safe engineer in Brackley" }));
    expect(await run(["copy", "compare", "ours.json", "--competitor", "theirs.json", "--json"], io())).toBe(0);
    const data = JSON.parse(out.join(""));
    expect(data.schemaVersion).toBeDefined();
    expect(data.brief).toBe(true);
    expect(data.ours.interchangeable).toContain("We offer a friendly and reliable service.");
  });

  it("refuses a snapshot with no page text, and a target that is neither a URL nor a file", async () => {
    writeFileSync(join(dir, "old.json"), JSON.stringify(makeSnapshot()));
    expect(await run(["copy", "compare", "ours.json", "--competitor", "old.json"], io())).toBe(2);
    expect(err.join("\n")).toContain("old.json has no page text");
    expect(await run(["copy", "compare", "ours.json", "--competitor", "rival"], io())).toBe(2);
    expect(await run(["copy", "compare", "--competitor", "theirs.json"], io())).toBe(2);
  });
});

describe("the home page", () => {
  it("knows a home route file and a home URL, and nothing else", async () => {
    const { HOME_FILE, HOME_URL } = await import("../character/tells/specificity.js");
    for (const p of ["app/page.tsx", "src/app/(marketing)/page.tsx", "pages/index.tsx", "src/pages/index.astro", "src/routes/+page.svelte", "index.html", "public/index.html", "components/Hero.tsx", "src/components/HomeHero.astro"]) {
      expect(HOME_FILE.test(p), p).toBe(true);
    }
    for (const p of ["app/privacy/page.tsx", "pages/about.tsx", "src/pages/blog/index.astro", "about/index.html", "src/routes/contact/+page.svelte", "components/Footer.tsx"]) {
      expect(HOME_FILE.test(p), p).toBe(false);
    }
    for (const u of ["https://hinton.test", "https://hinton.test/", "https://hinton.test/?utm=x", "https://hinton.test/index.html", "https://hinton.test/en-gb/", "http://127.0.0.1:4000/#top"]) {
      expect(HOME_URL.test(u), u).toBe(true);
    }
    for (const u of ["https://hinton.test/privacy", "https://hinton.test/services/boilers", "https://hinton.test/en-gb/contact"]) {
      expect(HOME_URL.test(u), u).toBe(false);
    }
  });
});
