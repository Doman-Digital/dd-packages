import { describe, expect, it } from "vitest";
import { fingerprint, fingerprintDistance, nearest } from "../fingerprint/index.js";
import { makeSnapshot } from "../snapshot/fixture.js";
import { fontClass, normaliseFamily } from "../snapshot/fonts.js";

describe("font names as a browser reports them", () => {
  it("undoes next/font's renaming", () => {
    expect(normaliseFamily("__Inter_d65c78")).toBe("Inter");
    expect(normaliseFamily("__Inter_Fallback_d65c78")).toBe("Inter");
    expect(normaliseFamily("__Instrument_Serif_1a2b3c")).toBe("Instrument Serif");
    expect(normaliseFamily("'Fraunces Variable'")).toBe("Fraunces");
    expect(normaliseFamily("-apple-system")).toBe("system-ui");
    // Seen live on MMM: the face arrives under its CSS variable's name.
    expect(normaliseFamily("cormorantGaramond")).toBe("Cormorant Garamond");
    expect(normaliseFamily("dm-sans")).toBe("DM Sans");
  });

  it("classes a face by name where the name says, and by list where it does not", () => {
    expect(fontClass("Fraunces")).toBe("serif");
    expect(fontClass("Source Serif 4")).toBe("serif");
    expect(fontClass("IBM Plex Sans")).toBe("sans");
    expect(fontClass("JetBrains Mono")).toBe("mono");
  });
});

describe("the fingerprint", () => {
  const plain = makeSnapshot();
  const violet = makeSnapshot({
    controls: plain.controls.map((c) => ({ ...c, background: "rgb(79, 70, 229)", radiusPx: 9999 })),
    fonts: [{ family: "__Inter_d65c78", chars: 5000, displayChars: 900, italicChars: 0, weights: [400, 700] }],
    effects: { glass: 1, marquees: 1 },
  });

  it("records what was chosen", () => {
    const fp = fingerprint(plain);
    expect(fp.display).toEqual({ family: "Tiempos Headline", class: "serif" });
    expect(fp.body.family).toBe("Söhne");
    expect(fp.accent!.h).toBeGreaterThan(140);
    expect(fp.roundness).toBeCloseTo(0.1, 1);
    expect(fp.effects).toEqual([]);
    expect(fp.layout[0]).toBe("hero");
  });

  it("is zero from itself, and far from a different accent, face and shape", () => {
    expect(fingerprintDistance(fingerprint(plain), fingerprint(plain)).total).toBe(0);
    const d = fingerprintDistance(fingerprint(plain), fingerprint(violet));
    expect(d.parts.accent).toBeGreaterThan(0.5);
    expect(d.parts.type).toBeCloseTo(0.8); // display serif vs sans (1), body both sans (0.5)
    expect(d.parts.shape).toBeGreaterThan(0.7);
    expect(d.total).toBeGreaterThan(0.5);
  });

  it("finds the nearest neighbour", () => {
    const near = makeSnapshot({ ground: "rgb(252, 252, 252)" });
    const ranked = nearest(fingerprint(plain), [
      { id: "violet", fingerprint: fingerprint(violet) },
      { id: "near", fingerprint: fingerprint(near) },
    ]);
    expect(ranked.map((r) => r.id)).toEqual(["near", "violet"]);
  });
});
