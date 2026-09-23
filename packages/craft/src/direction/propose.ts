/**
 * Proposing an art direction from the client's world.
 *
 * A proposal is a draft, never a decision. Every choice it writes carries a
 * `because` that starts "PROPOSED:", and `validateDirection` rejects that
 * prefix, so the file cannot pass until a person has looked at the van, agreed
 * the green is the van's green, and said so in their own words.
 *
 * Pure. Pixels come in as numbers; the CLI decodes the images.
 */

import { isAiViolet, isCream, parseColour } from "../character/color.js";
import { deltaEOk, formatHex, hexToOklch, type Oklch } from "../color/oklch.js";
import type { Fingerprint } from "../fingerprint/index.js";
import type { ArtDirection, ChoiceKey, DirectionChoice, DirectionSource } from "./types.js";
import { DIRECTION_VERSION } from "./types.js";

export const PROPOSED = "PROPOSED:";

// ------------------------------------------------------------- palettes

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function toLab(r: number, g: number, b: number): [number, number, number] {
  const lr = srgbToLinear(r / 255);
  const lg = srgbToLinear(g / 255);
  const lb = srgbToLinear(b / 255);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

export interface PaletteColour {
  hex: string;
  /** Share of sampled pixels, 0 to 1. */
  share: number;
  oklch: Oklch;
}

/**
 * The dominant colours in an RGBA pixel buffer: k-means in OKLab, so colours
 * cluster the way they look alike. Deterministic: seeded by lightness order,
 * not at random, so the same photo always proposes the same colours.
 */
export function paletteFromPixels(rgba: ArrayLike<number>, k = 6, maxSamples = 20000): PaletteColour[] {
  const total = Math.floor(rgba.length / 4);
  const step = Math.max(1, Math.floor(total / maxSamples));
  const px: { lab: [number, number, number]; rgb: [number, number, number] }[] = [];
  for (let i = 0; i < total; i += step) {
    const o = i * 4;
    if (rgba[o + 3] < 128) continue;
    px.push({ lab: toLab(rgba[o], rgba[o + 1], rgba[o + 2]), rgb: [rgba[o], rgba[o + 1], rgba[o + 2]] });
  }
  if (px.length === 0) return [];
  const sorted = [...px].sort((a, b) => a.lab[0] - b.lab[0]);
  const n = Math.min(k, px.length);
  let centres = Array.from({ length: n }, (_, i) => sorted[Math.floor(((i + 0.5) / n) * sorted.length)].lab.slice() as [number, number, number]);
  let assign = new Array<number>(px.length).fill(0);
  for (let iter = 0; iter < 12; iter += 1) {
    assign = px.map((p) => {
      let best = 0;
      let bestD = Infinity;
      centres.forEach((c, j) => {
        const d = (p.lab[0] - c[0]) ** 2 + (p.lab[1] - c[1]) ** 2 + (p.lab[2] - c[2]) ** 2;
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      });
      return best;
    });
    centres = centres.map((c, j) => {
      const members = px.filter((_, i) => assign[i] === j);
      if (members.length === 0) return c;
      return [0, 1, 2].map((d) => members.reduce((s, m) => s + m.lab[d], 0) / members.length) as [number, number, number];
    });
  }
  return centres
    .map((_, j) => {
      const members = px.filter((__, i) => assign[i] === j);
      if (members.length === 0) return null;
      // Report a real pixel colour, the average in sRGB, not a synthetic centre.
      const avg = [0, 1, 2].map((d) => members.reduce((s, m) => s + m.rgb[d], 0) / members.length / 255);
      const hex = formatHex({ r: avg[0], g: avg[1], b: avg[2] });
      return { hex, share: members.length / px.length, oklch: hexToOklch(hex) };
    })
    .filter((c): c is PaletteColour => c !== null)
    .sort((a, b) => b.share - a.share);
}

// ------------------------------------------------------------- proposing

export interface ProposeInput {
  client: string;
  brief: string;
  sources: DirectionSource[];
  /** What the site ships today, if it exists. */
  current?: Fingerprint;
  /** The rest of the estate, so a proposal does not land on a sibling. */
  estate?: { id: string; fingerprint: Fingerprint }[];
}

export interface Proposal {
  key: ChoiceKey;
  candidates: { value: string; evidence: string[]; note: string }[];
}

const chromatic = (o: Oklch): boolean => o.c >= 0.04 && o.l >= 0.2 && o.l <= 0.85;

/** Colour candidates from the sources, furthest from the reflex band and the estate first. */
function accentCandidates(input: ProposeInput): Proposal["candidates"] {
  const out: { value: string; evidence: string[]; note: string; score: number }[] = [];
  for (const s of input.sources) {
    for (const c of s.colours ?? []) {
      const parsed = parseColour(c);
      if (!parsed || !chromatic(parsed.oklch)) continue;
      const o = parsed.oklch;
      const siblings = (input.estate ?? []).map((e) => ({ id: e.id, d: e.fingerprint.accent ? deltaEOk(o, e.fingerprint.accent) : 1 }));
      const nearest = siblings.sort((a, b) => a.d - b.d)[0];
      const penalty = isAiViolet(o) ? 1 : 0;
      out.push({
        value: c.startsWith("#") ? c.toLowerCase() : c,
        evidence: [s.id],
        note: `from ${s.id} (${s.kind})${nearest ? `; nearest estate accent ${nearest.id} at ΔE ${nearest.d.toFixed(2)}` : ""}${penalty ? "; in the reflex violet band" : ""}`,
        score: (nearest ? Math.min(nearest.d, 0.3) : 0.3) - penalty + o.c,
      });
    }
  }
  return out.sort((a, b) => b.score - a.score).map(({ score: _s, ...rest }) => rest);
}

function groundCandidates(input: ProposeInput): Proposal["candidates"] {
  const out: Proposal["candidates"] = [];
  for (const s of input.sources) {
    for (const c of s.colours ?? []) {
      const parsed = parseColour(c);
      if (!parsed || parsed.oklch.l < 0.9) continue;
      out.push({ value: c, evidence: [s.id], note: `a light colour from ${s.id}${isCream(parsed.oklch) ? "; reads as the cream tell, needs its reason" : ""}` });
    }
  }
  return out;
}

function typeCandidates(input: ProposeInput): Proposal["candidates"] {
  return input.sources
    .filter((s) => s.lettering)
    .map((s) => ({ value: "", evidence: [s.id], note: `find a face with the character of "${s.lettering}" on ${s.id}` }));
}

export function propose(input: ProposeInput): { proposals: Proposal[]; direction: ArtDirection } {
  const proposals: Proposal[] = [
    { key: "accent", candidates: accentCandidates(input) },
    { key: "ground", candidates: groundCandidates(input) },
    { key: "display", candidates: typeCandidates(input) },
  ];
  const choices: ArtDirection["choices"] = {};
  const draft = (p: Proposal): DirectionChoice | undefined => {
    const top = p.candidates[0];
    if (!top || !top.value) return undefined;
    const source = input.sources.find((s) => s.id === top.evidence[0])!;
    return {
      value: top.value,
      because: `${PROPOSED} taken from the ${source.id}: ${source.note} Confirm it matches, then rewrite this in your own words.`,
      evidence: top.evidence,
    };
  };
  for (const p of proposals) {
    const c = draft(p);
    if (c) choices[p.key] = c;
  }
  return {
    proposals,
    direction: { version: DIRECTION_VERSION, client: input.client, brief: input.brief, sources: input.sources, choices },
  };
}
