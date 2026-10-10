/**
 * The copy gate. Every string a client can read is checked, and a finding
 * fails the build. The rules are the brief's (8 October 2026, Step 3) and the
 * banned strings in Doman-Digital `docs/DIRECTION.md` section 5.
 */

import { findDates, mentionOf, sameDate, type DateMention } from "./dates";
import { headlineReferencesApprovals, MILESTONE_LABELS, NOTHING_NEEDED } from "./status";
import type { SparseBriefing } from "./types";

export type LintRule =
  | "negative-reassurance"
  | "direction-banned"
  | "jargon"
  | "em-dash"
  | "finished-word"
  | "hours-or-rates"
  | "status-label"
  | "two-dates"
  | "headline-specific"
  | "headline-approvals"
  | "nothing-needed"
  | "empty";

export type LintFinding = { rule: LintRule; field: string; match: string; message: string };

type Pattern = { re: RegExp; message: string };

/** Say what does happen instead. */
export const NEGATIVE_REASSURANCES: Pattern[] = [
  { re: /\bnothing (?:changes|will change|has changed|is changing)\b/i, message: "Negative reassurance. Say what does happen." },
  { re: /\bno (?:waiting|downtime|disruption|interruption)\b/i, message: "Negative reassurance. Say what does happen." },
  { re: /\bno action (?:is )?(?:needed|required)\b/i, message: "Negative reassurance. Say what does happen." },
  { re: /\bnothing (?:for you )?to do\b/i, message: "Negative reassurance. Say what does happen." },
  { re: /\byou (?:don't|do not) need to do anything\b/i, message: "Negative reassurance. Say what does happen." },
  { re: /\bno need to worry\b|\bnothing to worry about\b/i, message: "Negative reassurance. Say what does happen." },
  { re: /\bstayed up (?:all|the whole)\b|\bthe whole fortnight\b/i, message: "Uptime is a count of checks, never \"stayed up the whole fortnight\"." },
];

/** DIRECTION.md section 5. Product names that only make sense as product names are left to review. */
export const DIRECTION_BANNED: Pattern[] = [
  { re: /every pound of the difference comes off/i, message: "DIRECTION.md section 5." },
  { re: /the amount left to pay only ever goes down/i, message: "DIRECTION.md section 5." },
  { re: /leaving never costs more than owning/i, message: "DIRECTION.md section 5." },
  { re: /you'?re paying off the build/i, message: "DIRECTION.md section 5." },
  { re: /\b(?:remaining|outstanding|owed|balance|paying off)\b/i, message: "DIRECTION.md section 5: never about a client's site." },
  { re: /\baftercare\b|\bcare plans?\b|\bsupport and hosting plans?\b/i, message: "DIRECTION.md section 5: retired product language." },
  { re: /\bwebsite as a service\b|\bWaaS\b/i, message: "DIRECTION.md section 5: retired product language." },
  { re: /\bentry product\b|\baudit\b/i, message: "DIRECTION.md section 5: retired product language." },
  { re: /unlimited edits under fair use/i, message: "DIRECTION.md section 5." },
  { re: /\bno minimum term\b/i, message: "DIRECTION.md section 5." },
  { re: /\badd-ons?\b/i, message: "DIRECTION.md section 5: it is a bolt-on." },
];

/** Plain UK English: the client's words, not ours. A client config can allow a term they use themselves. */
export const JARGON = [
  "framework", "frameworks", "dependency", "dependencies", "deploy", "deploys", "deployed", "deploying", "deployment",
  "Resend", "Loops", "repo", "repository", "pull request", "Sentry", "Astro", "Next.js", "CDN", "DNS", "API",
];

const FINISHED = /\b(?:done|fixed|complete|completed)\b/i;
const HOURS_OR_RATES = /\b\d+(?:\.\d+)?\s*(?:hours?|hrs?)\b|\bper hour\b|\/hr\b|\bhourly\b|\bday rate\b|\bcapacity\b|£\s?\d/i;
const EM_DASH = /—|\s–\s|\s--\s/;

export const ALLOWED_STATUS_LABELS = ["Live", "Ready", "Waiting for you", "Next", "Planned", "Awaiting your confirmation"] as const;

/** Lints one string. */
export function lintText(text: string, field: string, options: { allowedTerms?: string[] } = {}): LintFinding[] {
  const out: LintFinding[] = [];
  const hit = (rule: LintRule, re: RegExp, message: string) => {
    const m = re.exec(text);
    if (m) out.push({ rule, field, match: m[0], message });
  };
  for (const p of NEGATIVE_REASSURANCES) hit("negative-reassurance", p.re, p.message);
  for (const p of DIRECTION_BANNED) hit("direction-banned", p.re, p.message);
  const allowed = new Set((options.allowedTerms ?? []).map((t) => t.toLowerCase()));
  for (const term of JARGON) {
    if (allowed.has(term.toLowerCase())) continue;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Proper names match their case; common words match any case.
    const flags = /[A-Z]/.test(term) ? "" : "i";
    hit("jargon", new RegExp(`(?<![\\w.])${escaped}(?![\\w])`, flags), `Jargon: "${term}". Say what it means for the client.`);
  }
  hit("em-dash", EM_DASH, "No em dashes. Use a full stop, a colon or a comma.");
  hit("finished-word", FINISHED, 'Never "done", "fixed" or "complete". Use a status label: Live, Ready, Waiting for you, Next, Planned.');
  hit("hours-or-rates", HOURS_OR_RATES, "No hours, rates or capacity figures in a briefing.");
  return out;
}

/** Events a date can belong to, by the words around it. */
export const EVENTS: { key: string; re: RegExp }[] = [
  { key: "launch", re: /\b(launch\w*|on-sale|on sale|go(?:es)? on sale|sales open|release date)\b/i },
  { key: "switch", re: /\b(switch(?:es|ed)? over|switch to|cutover|go(?:es)? live)\b/i },
];

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter(Boolean);
}

/** Every client-readable string in a briefing, by field. */
export function readableFields(b: SparseBriefing): [string, string][] {
  const f: [string, string][] = [
    ["statusLabel", b.statusLabel],
    ["preheader", b.preheader],
    ["headline", b.headline],
    ["subhead", b.subhead],
    ["note", b.note],
    ["maintenanceLine", b.maintenanceLine],
  ];
  b.approvals.forEach((a, i) => {
    f.push([`approvals[${i}].title`, a.title], [`approvals[${i}].why`, a.why], [`approvals[${i}].review.label`, a.review.label]);
    if (a.secondary) f.push([`approvals[${i}].secondary.label`, a.secondary.label]);
  });
  if (b.launch) {
    f.push(["launch.dateLong", b.launch.dateLong]);
    if (b.launch.pill) f.push(["launch.pill", b.launch.pill]);
    if (b.launch.line) f.push(["launch.line", b.launch.line]);
    b.launch.milestones.forEach((m, i) => f.push([`launch.milestones[${i}].label`, m.label]));
  }
  b.changes.forEach((c, i) => {
    f.push([`changes[${i}].title`, c.title], [`changes[${i}].outcome`, c.outcome]);
    if (c.image) f.push([`changes[${i}].image.alt`, c.image.alt]);
  });
  if (b.featureImage) f.push(["featureImage.alt", b.featureImage.alt]);
  const h = b.health;
  if (h.uptime) f.push(["health.uptime.summary", h.uptime.summary], ["health.uptime.smallPrint", h.uptime.smallPrint]);
  if (h.speed) f.push(["health.speed.bandLine", h.speed.bandLine], ["health.speed.smallPrint", h.speed.smallPrint]);
  if (h.search?.state === "low-data") f.push(["health.search.title", h.search.title], ["health.search.sentence", h.search.sentence]);
  if (b.trackRecord) f.push(["trackRecord.line", b.trackRecord.line]);
  return f.filter(([, v]) => v !== "");
}

/**
 * One event, one date. Every date in the briefing is filed under the event
 * its sentence talks about; a second, different date for the same event fails.
 * The launch block's date counts as the launch's date.
 */
export function lintDates(fields: [string, string][], launchDate?: string): LintFinding[] {
  const seen = new Map<string, { mention: Omit<DateMention, "text" | "index">; text: string; field: string }[]>();
  if (launchDate) seen.set("launch", [{ mention: mentionOf(launchDate), text: launchDate, field: "launch.date" }]);
  const out: LintFinding[] = [];
  for (const [field, value] of fields) {
    for (const sentence of sentences(value)) {
      const event = EVENTS.find((e) => e.re.test(sentence));
      if (!event) continue;
      for (const d of findDates(sentence)) {
        const list = seen.get(event.key) ?? [];
        const clash = list.find((x) => !sameDate(x.mention, d));
        if (clash) {
          out.push({
            rule: "two-dates",
            field,
            match: d.text,
            message: `Two dates for the ${event.key}: "${d.text}" here and "${clash.text}" in ${clash.field}. Show only the latest; the history goes in the log.`,
          });
        }
        list.push({ mention: d, text: d.text, field });
        seen.set(event.key, list);
      }
    }
  }
  return out;
}

const VAGUE = /\b(a better experience|improvements?|various|some updates|lots of|all good|tweaks?|enhancements?)\b/i;
const DECISION = /\b(decisions?|decide|confirm|approve|choose|sign(?:-| )?off)\b/i;

/** A headline names a date, a decision or a change. */
export function headlineIsSpecific(headline: string, named: string[]): boolean {
  if (findDates(headline).length > 0) return true;
  if (DECISION.test(headline)) return true;
  const words = new Set(headline.toLowerCase().match(/[a-z]{5,}/g) ?? []);
  const generic = new Set(["about", "website", "update", "updates", "things", "fortnight", "change", "changes", "improve", "improved", "better"]);
  return named.some((n) => (n.toLowerCase().match(/[a-z]{5,}/g) ?? []).some((w) => !generic.has(w) && words.has(w)));
}

export function lintBriefing(b: SparseBriefing, options: { allowedTerms?: string[] } = {}): LintFinding[] {
  const fields = readableFields(b);
  const out: LintFinding[] = [];
  if (!b.headline.trim()) out.push({ rule: "empty", field: "headline", match: "", message: "The headline is hand-written and cannot be empty." });
  if (!b.note.trim()) out.push({ rule: "empty", field: "note", match: "", message: "The personal note is hand-written and cannot be empty." });
  for (const [field, value] of fields) out.push(...lintText(value, field, options));
  out.push(...lintDates(fields, b.launch?.date));

  if (b.headline.trim()) {
    const named = [...b.changes.map((c) => c.title), ...b.approvals.map((a) => a.title), ...(b.launch ? [b.launch.dateLong] : [])];
    if (!headlineIsSpecific(b.headline, named) || VAGUE.test(b.headline) && !DECISION.test(b.headline) && !findDates(b.headline).length) {
      out.push({ rule: "headline-specific", field: "headline", match: b.headline, message: "A headline names a date, a decision or a change." });
    }
    if (!headlineReferencesApprovals(b.headline, b.approvals)) {
      out.push({ rule: "headline-approvals", field: "headline", match: b.headline, message: "Approvals are waiting, so the headline has to point at them." });
    }
  }
  if (b.approvals.length > 0) {
    const needle = NOTHING_NEEDED.replace(/\.$/, "").toLowerCase();
    for (const [field, value] of fields) {
      if (value.toLowerCase().includes(needle)) {
        out.push({ rule: "nothing-needed", field, match: NOTHING_NEEDED, message: "\"Nothing needed from you\" with approvals waiting." });
      }
    }
  }

  const allowedLabels: readonly string[] = ALLOWED_STATUS_LABELS;
  for (const [i, m] of (b.launch?.milestones ?? []).entries()) {
    if (!(m.status in MILESTONE_LABELS)) out.push({ rule: "status-label", field: `launch.milestones[${i}].status`, match: String(m.status), message: `Status labels: ${ALLOWED_STATUS_LABELS.join(", ")}.` });
  }
  if (b.launch?.pill && !allowedLabels.includes(b.launch.pill)) {
    out.push({ rule: "status-label", field: "launch.pill", match: b.launch.pill, message: `Status labels: ${ALLOWED_STATUS_LABELS.join(", ")}.` });
  }
  return out;
}

export class BriefingLintError extends Error {
  readonly findings: LintFinding[];
  constructor(findings: LintFinding[]) {
    super(`Briefing failed the copy gate:\n${findings.map((f) => `  ${f.rule} at ${f.field}: "${f.match}". ${f.message}`).join("\n")}`);
    this.name = "BriefingLintError";
    this.findings = findings;
  }
}

export function assertLintClean(b: SparseBriefing, options: { allowedTerms?: string[] } = {}): void {
  const findings = lintBriefing(b, options);
  if (findings.length) throw new BriefingLintError(findings);
}
