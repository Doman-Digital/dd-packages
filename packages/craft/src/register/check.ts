/**
 * `craft register check`: where a draft sits against the human baselines.
 *
 * A single short passage cannot be placed: at blurb length the registers
 * overlap too much (calibration/copy-shape/report-registers.md). Averaged over
 * five paragraphs, every register pair separates on several features. So the
 * check reads documents only, measures each blurb-sized paragraph with the
 * same functions the baselines used, averages them, and compares the average
 * with the document-level bands in `profile.ts`.
 *
 * It reports, never grades: which features fall outside the chosen
 * register's usual range, and which baseline the draft reads closest to.
 * `COPY.md` "Style is not evidence" applies: no score, no verdict.
 */

import { lexicalOf } from "../character/lexical.js";
import { isBlurb, shapeOf } from "../character/shape.js";
import { registerOf } from "./features.js";
import { getRegister, type RegisterId } from "./registers.js";

export interface Band {
  p10: number;
  p50: number;
  p90: number;
  sd: number;
  /** Baseline registers this feature separates this one from, at document level. */
  separates: string[];
}

/** Baseline register -> feature -> band. */
export type RegisterProfile = Readonly<Record<string, Readonly<Record<string, Band>>>>;

/** Which baseline each brief is compared with, and what that baseline is not. */
export const REGISTER_BASELINE: Readonly<Record<RegisterId, { baseline: string; note: string }>> = {
  plain: {
    baseline: "institutional",
    note: "Compared with Hansard: edited parliamentary debate, the closest free UK source, not plain writing itself.",
  },
  persuasive: {
    baseline: "marketing",
    note: "Compared with 715 passages from UK small-business websites before 2021: a small sample.",
  },
  warm: {
    baseline: "business-email",
    note: "Compared with Enron sent email, 1999 to 2002: corporate and American, not small-business email.",
  },
  literary: {
    baseline: "literary",
    note: "Compared with English fiction and essays, 1726 to 1925: older than any premium brand's copy.",
  },
};

export const MIN_PARAGRAPHS = 5;

/**
 * Features that measure what a text is about, not how it is written. Enron is
 * dense with deal names and figures because of its subject, not its register,
 * so these stay in the separation report but out of the check: a warm email
 * about a kitchen refit should not be told it names too few people.
 */
export const CONTENT_FEATURES: ReadonlySet<string> = new Set(["hardPer100", "specificsPer100", "tradePer100", "figures", "names", "generic"]);

const usable = (f: string, b: Band): boolean => !CONTENT_FEATURES.has(f) && b.p90 > b.p10;

export interface Outside {
  feature: string;
  value: number;
  band: [number, number];
  direction: "higher" | "lower";
  sentence: string;
}

export interface RegisterCheck {
  register: RegisterId;
  baseline: string;
  /** Blurb-sized paragraphs measured. */
  paragraphs: number;
  /** False under MIN_PARAGRAPHS: nothing is compared. */
  measured: boolean;
  means: Record<string, number>;
  outside: Outside[];
  /** Standardised distance to each baseline's median, closest first. */
  nearest: { register: string; distance: number }[];
  note: string;
  summary: string;
}

/** What a feature measures, in words a writer uses. */
const LABELS: Record<string, string> = {
  meanSentenceWords: "Words per sentence",
  contractionsPer100: "Contractions per 100 words",
  youPer100: "\"You\" per 100 words",
  firstPersonPer100: "\"I\" and \"we\" per 100 words",
  passiveShare: "Share of sentences in the passive",
  meanWordLength: "Letters per word",
  commasPer100: "Commas per 100 words",
  commasPerSentence: "Commas per sentence",
  clauseDepth: "Clauses per sentence",
  nominalisationRate: "Nominalisations (\"the provision of\") per 100 words",
  pronounOpenerShare: "Share of sentences opening with a pronoun",
  impersonalOpenerShare: "Share of sentences opening impersonally (\"It is\", \"There are\")",
  coordinationRate: "Paired phrases (\"fast and friendly\") per 100 words",
  participialRate: "\"-ing\" clauses per sentence",
  tricolons: "Lists of three",
  sentenceCv: "Spread of sentence lengths",
  skeletonRepeat: "Repeated sentence patterns",
  hardPer100: "Hard specifics (names, figures, dates) per 100 words",
  specificsPer100: "Specifics of any kind per 100 words",
  tradePer100: "Trade nouns per 100 words",
  figures: "Figures per paragraph",
  names: "Names per paragraph",
  generic: "Share of paragraphs with no specific at all",
};

export const featureLabel = (f: string): string => LABELS[f] ?? f;

/** Paragraphs as the baselines read them: blank lines split, headings dropped. */
export function documentParagraphs(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter((p) => p && !/^#{1,6}\s/.test(p));
}

/** Every measured feature for one paragraph, by baseline feature name. */
function measure(paragraph: string): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(shapeOf(paragraph))) out[k] = typeof v === "boolean" ? (v ? 1 : 0) : v;
  for (const [k, v] of Object.entries(lexicalOf(paragraph))) out[k] = v;
  for (const [k, v] of Object.entries(registerOf(paragraph))) out[k] = v;
  return out;
}

const fmt = (x: number): string => (Math.abs(x) >= 10 ? x.toFixed(0) : x.toFixed(Math.abs(x) >= 1 ? 1 : 2));

export function checkRegister(text: string, id: RegisterId, profile: RegisterProfile): RegisterCheck {
  const reg = getRegister(id);
  if (!reg) throw new Error(`unknown register "${id}"`);
  const { baseline, note } = REGISTER_BASELINE[id];
  const target = profile[baseline];
  if (!target) throw new Error(`no baseline profile for "${baseline}"`);

  const kept = documentParagraphs(text).filter((p) => isBlurb(shapeOf(p)));
  const base = { register: id, baseline, paragraphs: kept.length, note };
  if (kept.length < MIN_PARAGRAPHS) {
    return {
      ...base,
      measured: false,
      means: {},
      outside: [],
      nearest: [],
      summary: `Only ${kept.length} paragraph${kept.length === 1 ? "" : "s"} of 2 to 8 sentences. The registers overlap too much to place anything shorter than ${MIN_PARAGRAPHS}; read it against the brief instead.`,
    };
  }

  const rows = kept.map(measure);
  const features = [...new Set(Object.values(profile).flatMap((p) => Object.keys(p)))];
  const means: Record<string, number> = {};
  for (const f of features) {
    const xs = rows.map((r) => r[f]).filter((x): x is number => typeof x === "number" && Number.isFinite(x));
    if (xs.length) means[f] = xs.reduce((s, x) => s + x, 0) / xs.length;
  }

  const outside: Outside[] = [];
  for (const [f, b] of Object.entries(target)) {
    const v = means[f];
    if (v === undefined || b.separates.length === 0 || !usable(f, b)) continue;
    if (v >= b.p10 && v <= b.p90) continue;
    const direction = v > b.p90 ? "higher" : "lower";
    outside.push({
      feature: f,
      value: v,
      band: [b.p10, b.p90],
      direction,
      sentence: `${featureLabel(f)}: ${fmt(v)}. ${reg.name} writing in the baseline runs ${fmt(b.p10)} to ${fmt(b.p90)}, so this is ${direction}.`,
    });
  }

  const nearest = Object.entries(profile)
    .map(([register, bands]) => {
      const zs = Object.entries(bands)
        .filter(([f, b]) => means[f] !== undefined && b.sd > 0 && usable(f, b))
        .map(([f, b]) => ((means[f]! - b.p50) / b.sd) ** 2);
      return { register, distance: zs.length ? Math.sqrt(zs.reduce((s, z) => s + z, 0) / zs.length) : Infinity };
    })
    .filter((n) => Number.isFinite(n.distance))
    .sort((a, b) => a.distance - b.distance);

  const closest = nearest[0]?.register;
  const summary =
    (outside.length === 0
      ? `All ${Object.entries(target).filter(([f, b]) => b.separates.length && usable(f, b)).length} measured features sit inside the usual range for ${reg.name.toLowerCase()} writing.`
      : `${outside.length} feature${outside.length === 1 ? "" : "s"} outside the usual range for ${reg.name.toLowerCase()} writing.`) +
    (closest && closest !== baseline ? ` It reads closest to the ${closest} baseline.` : "");

  return { ...base, measured: true, means, outside, nearest, summary };
}
