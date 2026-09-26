/**
 * The job map: what the visitor is trying to get done, in their words.
 *
 * It replaces "what do other sites in the trade do" as the starting point.
 * Hierarchy reasons are checked against it, so it has to describe this
 * client's customer, not the category: "find an electrician they can trust
 * with a dangerous fault, today" is a job; "electrician website" is a label.
 *
 * Pure. Quotes are checked against source text the caller can read.
 */

import { TRADE_NOUNS } from "../character/specificity.js";
import { checkReason, isCustomerVoice } from "./reason.js";
import { CONSIDERATION, type DirectionProblem, type DirectionSource, type JobMap } from "./types.js";

/** Verbs a job statement usually opens with. Not exhaustive: an unknown verb warns, it does not fail. */
const JOB_VERBS = new Set(
  (
    "find choose pick book get fix stop avoid know feel understand compare decide keep protect prepare plan sort arrange " +
    "replace repair learn prove show recover reduce save spend hire check see buy sell move start finish handle manage " +
    "meet reach return treat look end make give take bring hand leave trust rely feel prove explain secure settle solve " +
    "restore improve change become stay pass sign agree ask call reassure justify confirm"
  ).split(" "),
);

/** What a category label is made of: the trade, and the word for a website. */
const LABEL_WORDS = new Set(["website", "websites", "site", "sites", "page", "pages", "homepage", "web", "online", "presence", "company", "business", "services", "service", "local", "best", "good", "an", "a", "the", "for", "uk"]);
const NOUNISH = /(?:tion|sion|ment|ness|ity|site|page)$/;

const words = (s: string): string[] => s.toLowerCase().match(/[a-z][a-z'’-]*/g) ?? [];

/** An object that is only trade nouns and website words: "electrician website", "a local salon site". */
export function isCategoryLabel(object: string, brief = ""): boolean {
  const trade = new Set([...TRADE_NOUNS.flatMap((t) => t.split(" ")), ...words(brief).filter((w) => w.length > 3)]);
  const ws = words(object);
  return ws.length > 0 && ws.every((w) => LABEL_WORDS.has(w) || trade.has(w) || trade.has(w.replace(/s$/, "")));
}

const normalise = (s: string): string => s.toLowerCase().replace(/[“”"‘’'.,!?;:()-]/g, " ").replace(/\s+/g, " ").trim();

export interface JobContext {
  brief?: string;
  /** Text of a cited source's file, when the caller can read it. */
  readSource?: (source: DirectionSource) => string | undefined;
}

export function validateJob(job: unknown, sources: DirectionSource[], ctx: JobContext = {}): { problems: DirectionProblem[]; decided: boolean } {
  const problems: DirectionProblem[] = [];
  const err = (at: string, message: string) => problems.push({ severity: "error", at: `job${at}`, message });
  const warn = (at: string, message: string) => problems.push({ severity: "warn", at: `job${at}`, message });

  if (!job || typeof job !== "object" || Array.isArray(job)) {
    err("", "no job map: say what the visitor is trying to get done, in their words, before deciding structure or look");
    return { problems, decided: false };
  }
  const j = job as Partial<JobMap>;
  const ids = new Map(sources.map((s) => [s.id, s]));

  // The statement: verb + object + context.
  const st = j.statement;
  if (!st || typeof st !== "object") err(".statement", "a job statement is verb, object and context");
  else {
    const verb = typeof st.verb === "string" ? st.verb.trim().toLowerCase() : "";
    if (!verb) err(".statement.verb", "what the visitor is trying to do, as a verb: find, choose, book, fix");
    else if (verb.split(/\s+/).length > 3 || NOUNISH.test(verb) || TRADE_NOUNS.includes(verb)) err(".statement.verb", `"${st.verb}" is not a verb. A job starts with what the visitor is trying to do.`);
    else if (!JOB_VERBS.has(verb.split(/\s+/)[0])) warn(".statement.verb", `"${st.verb}" is not a verb craft knows. Check it says what the visitor does, not what the site is.`);
    const object = typeof st.object === "string" ? st.object.trim() : "";
    if (words(object).length < 3) err(".statement.object", "the object needs a few words: what they are trying to get, and what makes it hard");
    else if (isCategoryLabel(object, ctx.brief)) err(".statement.object", `"${object}" names the category, not the job. Say what the visitor needs from it: "an electrician they can trust with a dangerous fault".`);
    if (typeof st.context !== "string" || words(st.context).length < 3) err(".statement.context", "the context: when, under what pressure, or what they are trying to avoid");
  }

  // Functional, emotional, social: each shown by the customer's own words.
  for (const part of ["functional", "emotional", "social"] as const) {
    const p = j[part];
    if (!p || typeof p !== "object") {
      err(`.${part}`, `the ${part} side of the job, with the customer-voice source that shows it`);
      continue;
    }
    if (typeof p.value !== "string" || words(p.value).length < 6) err(`.${part}.value`, "a sentence: what they need, in the terms they would use");
    else problems.push(...checkReason({ at: `job.${part}`, because: p.value, evidence: p.evidence, sources, tie: "customer" }).map((x) => ({ ...x, at: x.at.replace(/\.because$/, ".value") })));
  }

  const c = j.consideration;
  if (!c || typeof c !== "object") err(".consideration", `how long and how carefully they decide: ${CONSIDERATION.join(", ")}`);
  else {
    if (!(CONSIDERATION as readonly string[]).includes(c.value)) err(".consideration.value", `one of ${CONSIDERATION.join(", ")}`);
    problems.push(...checkReason({ at: "job.consideration", because: c.because, evidence: c.evidence, sources, tie: "customer" }));
  }

  const objections = Array.isArray(j.objections) ? j.objections : [];
  if (objections.length === 0) err(".objections", "what stops them: the worries they bring to the page");
  objections.forEach((o, i) => {
    if (typeof o !== "string" || words(o).length < 3) err(`.objections[${i}]`, "an objection is a few words: what they worry about");
  });

  const evidence = Array.isArray(j.evidence) ? j.evidence : [];
  const voice = evidence.map((id) => ids.get(id)).filter(isCustomerVoice);
  if (evidence.length === 0 || voice.length === 0) err(".evidence", "cite the reviews, enquiries or conversations the job comes from");
  for (const id of evidence) if (!ids.has(id)) err(".evidence", `no source called "${id}"`);

  const language = Array.isArray(j.language) ? j.language : [];
  if (language.length === 0) err(".language", "quote the customer: the words they use for the problem");
  const texts = voice.map((s) => normalise(`${s!.note} ${ctx.readSource?.(s!) ?? ""}`));
  language.forEach((q, i) => {
    if (typeof q !== "string" || !q.trim()) return err(`.language[${i}]`, "an empty quote");
    const n = normalise(q);
    if (!texts.some((t) => t.includes(n))) warn(`.language[${i}]`, `"${q}" is not in any cited source's note or file. Quote it from the source, or it may be invented.`);
  });

  return { problems, decided: problems.every((p) => p.severity !== "error") };
}
