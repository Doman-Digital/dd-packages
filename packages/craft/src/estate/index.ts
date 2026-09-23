/**
 * The estate register: every site the agency has shipped, fingerprinted, so a
 * new one can be checked against its siblings. Signal 3 of CHARACTER.md.
 *
 * An agency's biggest tell is its clients looking like each other. No single
 * site shows it; only the set does. So the register holds one fingerprint per
 * site, and `compareToEstate` says which sites a page sits nearest and what
 * it shares with them.
 *
 * The line for "siblings" is not a number picked here. Two different
 * businesses are siblings when they sit closer together than two pages Claude
 * builds for the same brief usually do: if a barber and an electrician look
 * more alike than two drafts of one barber, nobody chose either look. The
 * median comes from null models when they are given, and from the 2026-09-23
 * calibration when they are not.
 *
 * Pure. The CLI reads and writes the register file.
 */

import type { Fingerprint, FingerprintDistance } from "../fingerprint/index.js";
import { fingerprintDistance } from "../fingerprint/index.js";
import { groundName, hueName, shapeName } from "../null/index.js";

export const ESTATE_VERSION = 1;

/**
 * Median fingerprint distance between two null pages built from the same
 * brief, across seven briefs and 1,330 pairs (calibration/null, 2026-09-23).
 */
export const SIBLING_AT = 0.31;

export interface EstateSite {
  /** Short kebab-case id: "rmp", "chair-and-blade". */
  id: string;
  client: string;
  url: string;
  /** Where the site's source lives, if known: "rmp474/RMP-Electrical". */
  repo?: string;
  fingerprint: Fingerprint;
  /** Rendered tells found when it was added, for the record. */
  tells: string[];
  addedAt: string;
}

export interface EstateRegister {
  version: typeof ESTATE_VERSION;
  sites: EstateSite[];
}

export function emptyEstate(): EstateRegister {
  return { version: ESTATE_VERSION, sites: [] };
}

/** Add a site, or replace the one with the same id. Sorted by id so the file diffs cleanly. */
export function addSite(register: EstateRegister, site: EstateSite): EstateRegister {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(site.id)) throw new Error(`site id "${site.id}" must be short kebab-case`);
  const sites = [...register.sites.filter((s) => s.id !== site.id), site].sort((a, b) => a.id.localeCompare(b.id));
  return { version: ESTATE_VERSION, sites };
}

/**
 * What two fingerprints effectively share, named the way a person would see
 * it: "Fraunces headline", "no accent", "pill buttons". A part counts when its
 * distance is 0.2 or less.
 */
export function sharedParts(a: Fingerprint, b: Fingerprint, d: FingerprintDistance = fingerprintDistance(a, b)): string[] {
  const out: string[] = [];
  const close = (k: keyof FingerprintDistance["parts"]) => d.parts[k] <= 0.2;
  if (close("accent")) out.push(a.accent || b.accent ? `${hueName(a.accent)} accent` : "no accent");
  if (close("type")) {
    if (a.display.family === b.display.family) out.push(`${a.display.family} headline`);
    if (a.body.family === b.body.family) out.push(`${a.body.family} body`);
  }
  if (close("ground")) out.push(`${groundName(a.ground)} ground`);
  if (close("shape")) out.push(`${shapeName(a.roundness)} buttons`);
  if (close("motion")) out.push(a.motion > 0 || b.motion > 0 ? "scroll reveals" : "no reveals");
  if (close("effects") && a.effects.length) out.push(a.effects.filter((e) => b.effects.includes(e)).join(", "));
  if (close("layout")) out.push("running order");
  return out;
}

export interface EstateMatch {
  id: string;
  distance: number;
  sibling: boolean;
  shared: string[];
}

/** The sites nearest a fingerprint, closest first, leaving out `exclude` (the site itself). */
export function compareToEstate(target: Fingerprint, register: EstateRegister, options: { exclude?: string; siblingAt?: number } = {}): EstateMatch[] {
  const at = options.siblingAt ?? SIBLING_AT;
  return register.sites
    .filter((s) => s.id !== options.exclude)
    .map((s) => {
      const d = fingerprintDistance(target, s.fingerprint);
      return { id: s.id, distance: d.total, sibling: d.total < at, shared: sharedParts(target, s.fingerprint, d) };
    })
    .sort((a, b) => a.distance - b.distance);
}

export interface EstatePair {
  a: string;
  b: string;
  distance: number;
  sibling: boolean;
  shared: string[];
}

/** Every pair in the register, closest first. */
export function estatePairs(register: EstateRegister, siblingAt = SIBLING_AT): EstatePair[] {
  const out: EstatePair[] = [];
  const s = register.sites;
  for (let i = 0; i < s.length; i += 1) {
    for (let j = i + 1; j < s.length; j += 1) {
      const d = fingerprintDistance(s[i].fingerprint, s[j].fingerprint);
      out.push({ a: s[i].id, b: s[j].id, distance: d.total, sibling: d.total < siblingAt, shared: sharedParts(s[i].fingerprint, s[j].fingerprint, d) });
    }
  }
  return out.sort((x, y) => x.distance - y.distance);
}

/**
 * The sibling line from null models: the median distance between two pages
 * built from the same brief. Each inner array is one brief's fingerprints.
 */
export function siblingLine(briefs: Fingerprint[][]): number {
  const d: number[] = [];
  for (const runs of briefs) {
    for (let i = 0; i < runs.length; i += 1) for (let j = i + 1; j < runs.length; j += 1) d.push(fingerprintDistance(runs[i], runs[j]).total);
  }
  if (d.length === 0) throw new Error("no null pages to measure the sibling line from");
  d.sort((a, b) => a - b);
  const mid = Math.floor(d.length / 2);
  const m = d.length % 2 ? d[mid] : (d[mid - 1] + d[mid]) / 2;
  return Math.round(m * 1000) / 1000;
}
