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
import type { Snapshot } from "../snapshot/types.js";
import { compareToDeclared, summariseDirection, type DirectionSummary } from "../estate/direction.js";
import { checkOrder, validateHierarchy } from "./hierarchy.js";
import { validateJob } from "./job.js";
import { faceLicence } from "./licences.js";
import { checkReason } from "./reason.js";
import { tradeOf } from "./research.js";
import {
  CHOICE_KEYS,
  DIRECTION_VERSIONS,
  SOURCE_KINDS,
  type ArtDirection,
  type ChoiceKey,
  type DirectionProblem,
  type DirectionReport,
  type DirectionSource,
  type PageType,
} from "./types.js";

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
  /** The rendered page itself, to check the declared order against its section roles. */
  snapshot?: Snapshot;
  /** Which page the snapshot is. Default home. */
  page?: PageType;
  /** Drift between the file and the page is an error, for a pre-launch gate. */
  strict?: boolean;
  /** Which cited paths exist, when the caller can look. */
  pathExists?: (path: string) => boolean;
  /** Text of a cited source's file, for checking quoted customer language. */
  readSource?: (source: DirectionSource) => string | undefined;
  /** Declared directions of the other sites in the estate, to catch convergence before build. */
  estate?: { id: string; direction?: DirectionSummary }[];
  /** This site's id in the estate, left out of the comparison. */
  estateId?: string;
}

/** Five of the seven tokens decided is a direction; fewer is a start. */
const MIN_TOKENS = 5;

const emptyLayers = (): DirectionReport["layers"] => ({ job: false, hierarchy: [], tokens: { decided: 0, total: CHOICE_KEYS.length }, complete: false });

export function validateDirection(input: unknown, ctx: ValidateContext = {}): DirectionReport {
  const problems: DirectionProblem[] = [];
  const err = (at: string, message: string) => problems.push({ severity: "error", at, message });
  const warn = (at: string, message: string) => problems.push({ severity: "warn", at, message });

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    err("", "art-direction.json must be a JSON object");
    return { valid: false, problems, decided: 0, layers: emptyLayers() };
  }
  const d = input as Partial<ArtDirection>;

  // An exceptions-only file predates the schema. It stays valid for scan and
  // copy, and says what it is missing rather than failing.
  const legacy = d.version === undefined && d.choices === undefined && Array.isArray(d.exceptions);
  if (legacy) {
    warn("", "exceptions only: run craft direction init to record the choices and their reasons");
    return { valid: true, problems, decided: 0, layers: emptyLayers() };
  }

  if (!(DIRECTION_VERSIONS as readonly unknown[]).includes(d.version)) err("version", `version must be ${DIRECTION_VERSIONS.join(" or ")}`);
  else if (d.version === 1) warn("version", "version 1: the job map and the hierarchy are not recorded, so the site cannot be decided. Move to version 2 (craft direction init --out) and add them.");
  if (typeof d.client !== "string" || !d.client.trim()) err("client", "name the client");
  if (typeof d.brief !== "string" || d.brief.trim().split(/\s+/).length < 8) err("brief", "the brief needs a sentence: who, where, and what they do");

  const rawSources = Array.isArray(d.sources) ? d.sources : [];
  const sources = rawSources.filter((s): s is DirectionSource => Boolean(s && typeof s === "object" && !Array.isArray(s)));
  if (!Array.isArray(d.sources)) err("sources", "sources must be a list");
  if (sources.length === 0) err("sources", "no sources: a reason needs something in the client's world to point at");
  const ids = new Set<string>();
  rawSources.forEach((s, i) => {
    const at = `sources[${i}]`;
    if (!s || typeof s !== "object" || Array.isArray(s)) return err(at, "a source must be an object");
    if (typeof s.id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(s.id)) err(`${at}.id`, "id must be short kebab-case");
    else if (ids.has(s.id)) err(`${at}.id`, `"${s.id}" is used twice`);
    else ids.add(s.id);
    if (!(SOURCE_KINDS as readonly string[]).includes(s.kind)) err(`${at}.kind`, `kind must be one of: ${SOURCE_KINDS.join(", ")}`);
    if (typeof s.note !== "string" || s.note.trim().split(/\s+/).length < 3) err(`${at}.note`, "say what it is and where");
    if (s.path !== undefined && typeof s.path !== "string") err(`${at}.path`, "a path must be text");
    if (typeof s.path === "string" && ctx.pathExists && !/^https?:/.test(s.path) && !ctx.pathExists(s.path)) err(`${at}.path`, `${s.path} does not exist`);
    if (s.colours !== undefined && !Array.isArray(s.colours)) err(`${at}.colours`, "colours must be a list");
    for (const [j, c] of (Array.isArray(s.colours) ? s.colours : []).entries()) if (typeof c !== "string" || !parseColour(c)) err(`${at}.colours[${j}]`, `"${c}" is not a colour`);
    // A reference is inspiration from outside the category: the category's own sites are the average it replaces.
    if (s.kind === "reference") {
      if (typeof s.category !== "string" || !s.category.trim()) err(`${at}.category`, "say where the reference comes from: print, a place, another trade");
      else if (/\b(?:web ?sites?|web design|competitors?|dribbble|behance|awwwards|themeforest)\b/i.test(s.category) || tradeOf(typeof d.brief === "string" ? d.brief : "").some((t) => tradeOf(s.category!).includes(t))) {
        err(`${at}.category`, `"${s.category}" is inside the client's category. A reference must come from outside it, or it hands back the category average.`);
      }
      if (typeof s.path === "string" && /^https?:/.test(s.path)) warn(`${at}.path`, "a web page as a reference: check it is not a site in the client's category");
    }
    if (/\bcompetitor(?:s|['’]s)?\b/i.test(`${s.note} ${s.category ?? ""}`)) err(at, "a source cannot be a competitor's website; use customer voice or a reference from outside the category");
  });

  const choices = d.choices && typeof d.choices === "object" ? d.choices : {};
  if (!d.choices || typeof d.choices !== "object") err("choices", "choices must be an object");
  const exceptions = Array.isArray(d.exceptions) ? d.exceptions : [];
  let decided = 0;

  for (const key of Object.keys(choices)) {
    if (!(CHOICE_KEYS as readonly string[]).includes(key)) err(`choices.${key}`, `not a choice craft knows. Choices are: ${CHOICE_KEYS.join(", ")}. Record section order and the primary action in hierarchy.`);
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

    const reasons = checkReason({ at, because: c.because, evidence: c.evidence, sources, tie: "source" });
    problems.push(...reasons);
    if (reasons.length) ok = false;

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

  // Version 2: the job, then the structure decided from it.
  let job = false;
  let hierarchy: DirectionReport["layers"]["hierarchy"] = [];
  if (d.version === 2) {
    const j = validateJob(d.job, sources, { brief: typeof d.brief === "string" ? d.brief : "", readSource: ctx.readSource });
    problems.push(...j.problems);
    job = j.decided && d.job !== undefined;
    const h = validateHierarchy(d.hierarchy, d.job, sources);
    problems.push(...h.problems);
    hierarchy = h.pages;
    if (ctx.snapshot) problems.push(...checkOrder(d.hierarchy?.[ctx.page ?? "home"], ctx.page ?? "home", ctx.snapshot, ctx.strict));
  }

  if (ctx.estate?.length) {
    for (const m of compareToDeclared(summariseDirection(d), ctx.estate, ctx.estateId)) {
      if (m.flagged) warn("", `close to ${m.id}'s declared direction: shares ${m.shared.join(", ")}. Decide which of these should differ before either site is built.`);
    }
  }

  // Drift from the rendered page is an error under --strict, for a pre-launch gate.
  if (ctx.strict) for (const p of problems) if (p.severity === "warn" && /the page (?:does not show|sets|runs)/.test(p.message)) p.severity = "error";

  const home = hierarchy.find((p) => p.page === "home");
  const complete = job && Boolean(home) && hierarchy.every((p) => p.decided === p.total) && decided >= MIN_TOKENS;
  return {
    valid: problems.every((p) => p.severity !== "error"),
    problems,
    decided,
    layers: { job, hierarchy, tokens: { decided, total: CHOICE_KEYS.length }, complete: complete && problems.every((p) => p.severity !== "error") },
  };
}
