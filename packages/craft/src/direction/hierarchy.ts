/**
 * The hierarchy layer: what each page puts first, where it asks, and why.
 *
 * A conventional order is allowed and never penalised. What fails is an
 * order nobody chose: every field needs a reason that uses this client's job.
 * The primary action's reason must also say how the job's consideration (a
 * two-minute emergency call against a months-long decision) or one of its
 * objections leads to where the ask sits. The evidence on placement is mixed,
 * so craft encodes no default position; it requires the reason.
 *
 * Pure. The declared order is checked against a version 2 snapshot's section
 * roles when one is given.
 */

import type { SectionRole, Snapshot } from "../snapshot/types.js";
import { checkReason, contentWords } from "./reason.js";
import { HIERARCHY_FIELDS, PAGE_TYPES, type DirectionProblem, type DirectionSource, type JobMap, type PageHierarchy, type PageType } from "./types.js";

export const SECTION_ROLES: readonly SectionRole[] = [
  "hero",
  "logos",
  "stats",
  "cards",
  "marquee",
  "text",
  "other",
  "cta-band",
  "footer-cta",
  "pricing",
  "testimonials",
  "faq",
  "process",
  "features",
  "team",
  "contact",
];
const POSITIONS = new Set<string>([...SECTION_ROLES, "header", "sticky"]);

export interface PageResult {
  page: PageType;
  decided: number;
  total: number;
}

/** The job's words for the primary action tie: its consideration level and its objections. */
function considerationTied(because: string, job: JobMap): boolean {
  const text = because.toLowerCase();
  const level = job.consideration?.value;
  if (level && new RegExp(`\\b${level}\\b`).test(text)) return true;
  const said = contentWords(because);
  return (Array.isArray(job.objections) ? job.objections : []).some((o) => typeof o === "string" && [...contentWords(o)].some((w) => said.has(w)));
}

export function validateHierarchy(
  hierarchy: unknown,
  job: JobMap | undefined,
  sources: DirectionSource[],
): { problems: DirectionProblem[]; pages: PageResult[] } {
  const problems: DirectionProblem[] = [];
  const err = (at: string, message: string) => problems.push({ severity: "error", at: `hierarchy${at}`, message });
  const pages: PageResult[] = [];

  if (!hierarchy || typeof hierarchy !== "object" || Array.isArray(hierarchy)) {
    err("", "no hierarchy: decide what the home page leads with, where it asks, and the order, each from the job");
    return { problems, pages };
  }
  const h = hierarchy as Record<string, Partial<PageHierarchy>>;
  for (const key of Object.keys(h)) if (!(PAGE_TYPES as readonly string[]).includes(key)) err(`.${key}`, `not a page type craft knows. Page types are: ${PAGE_TYPES.join(", ")}`);
  if (!h.home) err(".home", "no home page hierarchy: the home page is where most visitors start");

  for (const page of PAGE_TYPES) {
    const p = h[page];
    if (!p) continue;
    let decided = 0;
    const at = (f: string) => `hierarchy.${page}.${f}`;
    const reason = (where: string, because: unknown, evidence?: unknown) => checkReason({ at: where, because, evidence, sources, tie: "job", job });
    const count = (found: DirectionProblem[]) => {
      problems.push(...found);
      if (!found.some((x) => x.severity === "error")) decided += 1;
    };

    // Primary action.
    if (!p.primaryAction) err(`.${page}.primaryAction`, "not decided yet");
    else {
      const a = p.primaryAction;
      const found: DirectionProblem[] = [];
      if (typeof a.value !== "string" || !a.value.trim()) found.push({ severity: "error", at: `${at("primaryAction")}.value`, message: "what the visitor is asked to do" });
      const positions = Array.isArray(a.positions) ? a.positions : [];
      if (positions.length === 0) found.push({ severity: "error", at: `${at("primaryAction")}.positions`, message: "where the ask sits: one place, or several (\"hero\", \"footer-cta\")" });
      for (const pos of positions) if (!POSITIONS.has(pos)) found.push({ severity: "error", at: `${at("primaryAction")}.positions`, message: `"${pos}" is not a section role, "header" or "sticky"` });
      const r = reason(at("primaryAction"), a.because, a.evidence);
      found.push(...r);
      if (r.length === 0 && job && typeof a.because === "string" && !considerationTied(a.because, job)) {
        found.push({
          severity: "error",
          at: `${at("primaryAction")}.because`,
          message: `say how the job's consideration (${job.consideration?.value ?? "not set"}) or one of its objections leads to asking here. Placement evidence is mixed, so the reason is what decides it.`,
        });
      }
      count(found);
    }

    // Order: every section placed on purpose.
    const order = Array.isArray(p.order) ? p.order : [];
    if (order.length < 2) err(`.${page}.order`, "the running order, two sections or more, each with why it sits there");
    else {
      const found: DirectionProblem[] = [];
      order.forEach((o, i) => {
        if (!o || !SECTION_ROLES.includes(o.role)) found.push({ severity: "error", at: `${at("order")}[${i}].role`, message: `a section role: ${SECTION_ROLES.join(", ")}` });
        found.push(...reason(`${at("order")}[${i}]`, o?.because));
      });
      count(found);
    }

    // Lead: what comes first, and what is kept back.
    if (!p.lead) err(`.${page}.lead`, "not decided yet");
    else {
      const found: DirectionProblem[] = [];
      if (typeof p.lead.value !== "string" || !p.lead.value.trim()) found.push({ severity: "error", at: `${at("lead")}.value`, message: "what the page leads with" });
      found.push(...reason(at("lead"), p.lead.because));
      count(found);
    }

    // Journey: the order of feeling, from the job.
    const journey = Array.isArray(p.journey) ? p.journey : [];
    if (journey.length < 2) err(`.${page}.journey`, "the stages the visitor goes through, two or more, each with why");
    else {
      const found: DirectionProblem[] = [];
      journey.forEach((s, i) => {
        if (!s || typeof s.stage !== "string" || !s.stage.trim()) found.push({ severity: "error", at: `${at("journey")}[${i}].stage`, message: "name the stage" });
        found.push(...reason(`${at("journey")}[${i}]`, s?.because));
      });
      count(found);
    }

    pages.push({ page, decided, total: HIERARCHY_FIELDS.length });
  }
  return { problems, pages };
}

/** Roles a snapshot shows, in running order, without the unclassified ones. */
export function renderedOrder(snapshot: Snapshot): SectionRole[] | null {
  const sections = snapshot.sections ?? [];
  if (sections.length === 0 || !sections.every((s) => s.role)) return null;
  return sections.map((s) => s.role as SectionRole).filter((r) => r !== "other");
}

/** The declared order against the page that ships. Drift warns; `strict` makes it an error. */
export function checkOrder(declared: PageHierarchy | undefined, page: PageType, snapshot: Snapshot, strict = false): DirectionProblem[] {
  if (!declared || !Array.isArray(declared.order)) return [{ severity: strict ? "error" : "warn", at: `hierarchy.${page}`, message: "no declared hierarchy for this page: its running order cannot be checked" }];
  const rendered = renderedOrder(snapshot);
  if (!rendered) return [{ severity: "warn", at: `hierarchy.${page}.order`, message: "the snapshot has no section roles (version 1): take a fresh one to check the order" }];
  const said = declared.order.map((o) => o.role).filter((r) => r !== "other");
  if (said.join(",") === rendered.join(",")) return [];
  return [{ severity: strict ? "error" : "warn", at: `hierarchy.${page}.order`, message: `the page runs ${rendered.join(", ")}; the file says ${said.join(", ")}` }];
}
