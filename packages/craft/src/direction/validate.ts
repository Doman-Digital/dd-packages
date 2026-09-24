/**
 * Checking an art direction: the file's shape, the reason rule, and whether
 * the site actually does what the file says.
 *
 * Pure. The CLI reads the file, any snapshot and the paths it cites.
 */

import { isAiViolet, isCream, parseColour } from "../character/color.js";
import { REFLEX_FONTS_1, REFLEX_FONTS_2 } from "../character/tells/source.js";
import { deltaEOk } from "../color/oklch.js";
import type { Fingerprint } from "../fingerprint/index.js";
import { normaliseFamily } from "../snapshot/fonts.js";
import { faceLicence } from "./licences.js";
import {
  CHOICE_KEYS,
  DIRECTION_VERSION,
  SOURCE_KINDS,
  type ArtDirection,
  type ChoiceKey,
  type DirectionProblem,
  type DirectionReport,
} from "./types.js";

/**
 * Reasons that are preferences, not evidence. "The client likes it" may be
 * true and still say nothing about why this site should look this way.
 */
const PREFERENCE = /\b(?:client (?:likes|liked|wants|wanted|asked|chose|prefers?)|(?:we|they|i) (?:like|liked|love|loved|prefer)|on[- ]trend|trendy|popular|what (?:everyone|competitors) (?:uses?|does)|brand (?:colou?r|font|guidelines?) (?:is|are|says?))\b/i;

/** Adjectives that describe a mood rather than a source. Two or more and the reason is a mood board. */
const MOOD = /\b(?:modern|clean|fresh|professional|trustworthy|premium|elegant|sleek|timeless|minimal(?:ist)?|bold|vibrant|friendly|approachable|luxur(?:y|ious)|sophisticated|contemporary|stylish|warm|inviting|high[- ]end)\b/gi;

/**
 * Words that describe a value rather than a source. "Green because the van is
 * green" names the van; "green because green is calming" only names green.
 */
const VALUE_WORDS = new Set(["green", "blue", "navy", "black", "white", "cream", "grey", "gray", "gold", "yellow", "orange", "purple", "violet", "pink", "brown", "teal", "bottle", "dark", "light", "deep", "pale", "bright", "colour", "color", "font", "face", "serif", "sans", "type", "lettering"]);

const STOP = new Set(["with", "that", "this", "from", "their", "they", "have", "been", "were", "which", "what", "when", "where", "there", "about", "into", "onto", "over", "same", "each", "every"]);

function words(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[a-z][a-z'-]{3,}/g) ?? []).map((w) => w.replace(/'s$/, "")).filter((w) => !STOP.has(w) && !VALUE_WORDS.has(w)));
}

/** The tell a choice value would trip, if any. */
function tellFor(key: ChoiceKey, value: string): string | null {
  if (key === "accent") {
    const c = parseColour(value);
    return c && isAiViolet(c.oklch) ? "ai-violet" : null;
  }
  if (key === "ground") {
    const c = parseColour(value);
    return c && isCream(c.oklch) ? "cream-palette" : null;
  }
  if (key === "display" || key === "body") {
    const name = normaliseFamily(value).toLowerCase();
    if (REFLEX_FONTS_1.some((f) => f.toLowerCase() === name)) return "reflex-font";
    if (REFLEX_FONTS_2.some((f) => f.toLowerCase() === name)) return "reflex-font-2";
  }
  return null;
}

export interface ValidateContext {
  /** The fingerprint of the rendered site, to check the file against what ships. */
  fingerprint?: Fingerprint;
  /** Which cited paths exist, when the caller can look. */
  pathExists?: (path: string) => boolean;
}

export function validateDirection(input: unknown, ctx: ValidateContext = {}): DirectionReport {
  const problems: DirectionProblem[] = [];
  const err = (at: string, message: string) => problems.push({ severity: "error", at, message });
  const warn = (at: string, message: string) => problems.push({ severity: "warn", at, message });

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    err("", "art-direction.json must be a JSON object");
    return { valid: false, problems, decided: 0 };
  }
  const d = input as Partial<ArtDirection>;

  // An exceptions-only file predates the schema. It stays valid for scan and
  // copy, and says what it is missing rather than failing.
  const legacy = d.version === undefined && d.choices === undefined && Array.isArray(d.exceptions);
  if (legacy) {
    warn("", "exceptions only: run craft direction init to record the choices and their reasons");
    return { valid: true, problems, decided: 0 };
  }

  if (d.version !== DIRECTION_VERSION) err("version", `version must be ${DIRECTION_VERSION}`);
  if (typeof d.client !== "string" || !d.client.trim()) err("client", "name the client");
  if (typeof d.brief !== "string" || d.brief.trim().split(/\s+/).length < 8) err("brief", "the brief needs a sentence: who, where, and what they do");

  const sources = Array.isArray(d.sources) ? d.sources : [];
  if (!Array.isArray(d.sources)) err("sources", "sources must be a list");
  if (sources.length === 0) err("sources", "no sources: a reason needs something in the client's world to point at");
  const ids = new Set<string>();
  sources.forEach((s, i) => {
    const at = `sources[${i}]`;
    if (!s || typeof s !== "object") return err(at, "a source must be an object");
    if (typeof s.id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(s.id)) err(`${at}.id`, "id must be short kebab-case");
    else if (ids.has(s.id)) err(`${at}.id`, `"${s.id}" is used twice`);
    else ids.add(s.id);
    if (!(SOURCE_KINDS as readonly string[]).includes(s.kind)) err(`${at}.kind`, `kind must be one of: ${SOURCE_KINDS.join(", ")}`);
    if (typeof s.note !== "string" || s.note.trim().split(/\s+/).length < 3) err(`${at}.note`, "say what it is and where");
    if (s.path && ctx.pathExists && !/^https?:/.test(s.path) && !ctx.pathExists(s.path)) err(`${at}.path`, `${s.path} does not exist`);
    for (const [j, c] of (s.colours ?? []).entries()) if (!parseColour(c)) err(`${at}.colours[${j}]`, `"${c}" is not a colour`);
  });

  const choices = d.choices && typeof d.choices === "object" ? d.choices : {};
  if (!d.choices || typeof d.choices !== "object") err("choices", "choices must be an object");
  const exceptions = Array.isArray(d.exceptions) ? d.exceptions : [];
  let decided = 0;

  for (const key of Object.keys(choices)) {
    if (!(CHOICE_KEYS as readonly string[]).includes(key)) err(`choices.${key}`, `not a choice craft knows. Choices are: ${CHOICE_KEYS.join(", ")}. Layout and navigation stay conventional.`);
  }

  for (const key of CHOICE_KEYS) {
    const c = choices[key];
    const at = `choices.${key}`;
    if (!c) {
      warn(at, "not decided yet");
      continue;
    }
    let ok = true;
    if (typeof c.value !== "string" || !c.value.trim()) {
      err(`${at}.value`, "no value");
      ok = false;
    } else if ((key === "accent" || key === "ground") && !parseColour(c.value)) {
      err(`${at}.value`, `"${c.value}" is not a colour`);
      ok = false;
    }

    const because = typeof c.because === "string" ? c.because.trim() : "";
    const evidence = Array.isArray(c.evidence) ? c.evidence : [];
    if (because.split(/\s+/).filter(Boolean).length < 8) {
      err(`${at}.because`, "a reason is at least a sentence. Without one this is a default, however good it looks.");
      ok = false;
    } else if (because.startsWith("PROPOSED:")) {
      err(`${at}.because`, "a proposal, not yet a decision. Check it against the source, then rewrite the reason in your own words.");
      ok = false;
    } else {
      if (PREFERENCE.test(because)) {
        err(`${at}.because`, "that is a preference, not a reason. Say what in the client's world this comes from.");
        ok = false;
      }
      const moods = because.match(MOOD) ?? [];
      if (moods.length >= 2) {
        err(`${at}.because`, `"${moods.join(", ")}" describes a mood, not a source. Name the thing it comes from.`);
        ok = false;
      }
    }
    if (evidence.length === 0) {
      err(`${at}.evidence`, "cite at least one source");
      ok = false;
    }
    for (const id of evidence) {
      if (!ids.has(id)) {
        err(`${at}.evidence`, `no source called "${id}"`);
        ok = false;
      }
    }
    // The reason must be about its evidence: it shares a word with a cited
    // source, or names it. A reason that could be pasted onto any site is not one.
    if (ok) {
      const cited = sources.filter((s) => evidence.includes(s.id));
      const reasonWords = words(because);
      const tied = cited.some((s) => reasonWords.has(s.id) || [...words(`${s.note} ${s.lettering ?? ""}`)].some((w) => reasonWords.has(w)));
      if (!tied) {
        err(`${at}.because`, `the reason does not mention what its evidence shows (${evidence.join(", ")}). Say what on it this comes from.`);
        ok = false;
      }
    }

    if (typeof c.value === "string") {
      const tell = tellFor(key, c.value);
      if (tell && !exceptions.some((e) => e.tell === tell)) {
        err(`${at}.value`, `${c.value} is on the tell catalogue (${tell}). Keep it only with an exception for ${tell}, carrying the same reason.`);
        ok = false;
      }
    }

    // A licence problem does not undecide a choice: the reason can be sound
    // and the face still unlicensed for this site. So it warns, and says what to do.
    if ((key === "display" || key === "body") && typeof c.value === "string" && c.value.trim()) {
      const family = normaliseFamily(c.value);
      const entry = faceLicence(family);
      if (!entry) {
        warn(`${at}.value`, `${family}: licence not in craft's register. Read the licensor's own terms for use on this client's site, then add it to src/direction/licences.ts.`);
      } else if (entry.multiClient === "unverified") {
        warn(`${at}.value`, `${family}: licence unverified (${entry.note})`);
      } else if (entry.multiClient === "capped" || entry.multiClient === "per-site") {
        const scope = entry.multiClient === "capped" ? `covers up to ${entry.cap} sites` : "needs a licence for this site, in the client's name";
        warn(`${at}.value`, `${family}: ${entry.licence} licence ${scope}. Record the purchase before launch.`);
      }
    }

    const fp = ctx.fingerprint;
    if (fp && typeof c.value === "string") {
      if ((key === "accent" || key === "ground") && parseColour(c.value)) {
        const declared = parseColour(c.value)!.oklch;
        const measured = key === "accent" ? fp.accent : fp.ground;
        if (measured && deltaEOk(declared, measured) > 0.08) {
          warn(`${at}.value`, `the page does not show it: its ${key} measures oklch(${measured.l.toFixed(2)} ${measured.c.toFixed(3)} ${measured.h.toFixed(0)})`);
        }
      }
      if (key === "display" || key === "body") {
        const measured = key === "display" ? fp.display.family : fp.body.family;
        if (normaliseFamily(c.value).toLowerCase() !== measured.toLowerCase()) warn(`${at}.value`, `the page sets ${measured}, not ${c.value}`);
      }
    }

    if (ok) decided += 1;
  }

  return { valid: problems.every((p) => p.severity !== "error"), problems, decided };
}
