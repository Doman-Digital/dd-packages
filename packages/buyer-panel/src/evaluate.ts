import { readFileSync } from "node:fs";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import type { ModelChoice, Panel } from "./config.js";
import type { SessionRecord } from "./buyer.js";
import type { GradingContext } from "./grading-context.js";
import { callForTool, type Usage } from "./model.js";

export const CATEGORIES = ["comprehension", "navigation", "pricing", "trust", "conversion", "mobile", "copy", "accessibility", "other"] as const;
export type Category = (typeof CATEGORIES)[number];
export type Verdict = "defect" | "expected_preview_state" | "not_a_defect";

export interface Measures {
  first_impression: { verdict: "accurate" | "partial" | "wrong"; says: string; expected: string };
  service_comprehension: { build_vs_run: "accurate" | "partial" | "wrong" | "not_reached"; notes: string };
  navigation: { path: string[]; wrong_turns: number; dead_ends: string[]; notes: string };
  pricing: { clarity: "clear" | "partial" | "unclear" | "not_reached"; invented: { claim: string; fact: string; step: string }[]; notes: string };
  trust: { missing_evidence: string[]; contradictions: string[] };
  conversion: { reached: "right_flow" | "wrong_flow" | "none"; flow: string; notes: string };
  mobile: { issues: string[] };
}

export interface GradedFinding {
  id: string;
  session: string;
  title: string;
  category: Category;
  severity: "high" | "medium" | "low";
  verdict: Verdict;
  /** "S3" = the screen after step 3, "S0" = the start screen, "P2" = the buyer's second noted problem. */
  ref: string;
  element: string;
  url: string;
  screenshot: string;
  rationale: string;
  fix_hint: string;
}

export interface DroppedFinding {
  session: string;
  title: string;
  ref: string;
  element: string;
  reason: string;
}

export interface SessionGrade {
  session: string;
  measures: Measures;
  findings: GradedFinding[];
  dropped: DroppedFinding[];
}

const GRADER_SYSTEM = (ctx: GradingContext) => `You grade one session of a synthetic buyer panel. A language model played a prospective buyer, with a persona and a task, browsing a company's website. You did not browse: you read the trace. You alone hold the reference material below; the buyer never saw it.

Your job is to find defects in the website: places where a reasonable buyer like this one would misunderstand what the company does, get lost, be put off, or be given wrong, missing or contradictory information. Be aggressively useful about defects and conservative about success: a session where nothing went wrong shows only that nothing was found, never that the site works.

Rules:
- Every finding cites evidence: a screen reference and the element it refers to. The reference is S<n> for the screen after step n (S0 is the start screen) or P<n> for the buyer's n-th noted problem. The element is the exact text of a heading, link, button, price or sentence copied from that screen's text (for a P reference, the element the buyer quoted). If something is missing, cite the text of the place where it should have been. A finding you cannot tie to a screen and an element on it is not a finding: leave it out.
- Read every screen, not only the buyer's noted problems. A buyer often misses what a real owner would trip on: compare what each screen offers with the journey map's expected answer for this buyer's door at that step (the proof they need, price one click away, what happens next), and file what is missing, unclear or contradictory even when the buyer did not notice.
- Check the buyer's first impression against what the fold should convey, and whether the buyer can tell the one-off build apart from the managed monthly plan.
- Check what the buyer concluded about prices, payment, terms and services against the brand facts. A price, term or promise the buyer states that the facts do not support is an invented assumption. Record it under pricing.invented. Where the site's wording or layout plausibly caused it, also file a pricing finding citing the screen the buyer was reading and the element the misreading came from: a misunderstanding a model buyer makes from the page is the panel's most useful signal. The buyer's finish (what it will cost, what happens next, whether to trust them) is where misunderstandings show; read it against the facts line by line.
- The known preview-only states listed below are expected on this preview. A finding that is only one of them gets the verdict expected_preview_state, never defect.
- The buyer is a model and may misbehave: click at random, misread a screenshot, invent things. Where the buyer rather than the site caused a problem, the verdict is not_a_defect.
- Judge the site as a real owner of this kind of business would meet it, not as a designer. Plain words; no marketing language.
- Titles name the defect on the site in a short sentence, e.g. "Pricing page does not say what the monthly plan includes".

## Journey map (the expected answers per door)
${ctx.journeyMap}

## Brand facts (the governed facts, JSON subset, version ${ctx.brandFactsVersion})
${ctx.brandFacts}

## Known preview-only states (expected, never defects)
${ctx.knownStates.map((s) => `- ${s}`).join("\n")}
${ctx.notes.length ? `\n## Notes\n${ctx.notes.map((s) => `- ${s}`).join("\n")}` : ""}`;

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)} [cut by the panel, not by the site]` : s);

const image = (buf: Buffer): Anthropic.ImageBlockParam => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: buf.toString("base64") } });

/** The trace as the evaluator reads it: the buyer's thoughts, actions and every screen's text, plus key screenshots. */
export function traceContent(panel: Panel, rec: SessionRecord, dir: string, maxImages = 6): Anthropic.ContentBlockParam[] {
  const profile = panel.profiles.find((p) => p.id === rec.profile);
  const lines: string[] = [
    `Session ${rec.id}`,
    `Persona: ${profile?.persona ?? rec.profile}`,
    `Task: ${profile?.task ?? ""}`,
    `Device: ${rec.device === "phone" ? "phone, 390 wide" : "desktop, 1440 wide"}. Buyer model ${rec.variant.model} at temperature ${rec.variant.temperature ?? "default"}. Step budget ${panel.stepBudget}; used ${rec.steps.length}; ended: ${rec.endReason}${rec.error ? ` (${rec.error})` : ""}.`,
    "",
    `First impression, from the 390 phone fold alone (image 1), before any scrolling: "${rec.firstImpression.question}"`,
    `Buyer: ${rec.firstImpression.answer}`,
    "",
    `S0 start screen: ${rec.start.title} (${rec.start.url})`,
    clip(rec.start.visible, 2500),
  ];
  for (const s of rec.steps) {
    lines.push("", `Step ${s.n}. Buyer thought: ${s.thought || "(nothing said)"}`, `Action: ${s.action} ${JSON.stringify(s.input)} → ${s.result}`, `S${s.n} screen: ${s.title} (${s.url}), ${s.scrolledPct}% down`, clip(s.visible, 2500));
  }
  lines.push("", "Problems the buyer noted:");
  if (!rec.problems.length) lines.push("(none)");
  for (const p of rec.problems) lines.push(`P${p.n} (on S${p.step}, ${p.kind}, element ${p.resolved ? "found on the page" : "NOT found on the page"}): "${p.element}": ${p.what} [${p.url}]`);
  lines.push("", "Buyer's finish:", rec.finish ? JSON.stringify(rec.finish, null, 1) : "(did not finish)");

  const content: Anthropic.ContentBlockParam[] = [image(readFileSync(join(dir, rec.firstImpression.screenshot)))];
  const shots = rec.problems.filter((p) => p.resolved).slice(0, maxImages - 1);
  for (const p of shots) content.push({ type: "text", text: `Screenshot of P${p.n}, element outlined:` }, image(readFileSync(join(dir, p.screenshot))));
  content.push({ type: "text", text: lines.join("\n") });
  return content;
}

const GRADE_TOOL: Anthropic.Tool = {
  name: "submit_grade",
  description: "Submit the measures and the findings for this session.",
  input_schema: {
    type: "object",
    properties: {
      measures: {
        type: "object",
        properties: {
          first_impression: { type: "object", properties: { verdict: { type: "string", enum: ["accurate", "partial", "wrong"] }, says: { type: "string" }, expected: { type: "string" } }, required: ["verdict", "says", "expected"] },
          service_comprehension: { type: "object", properties: { build_vs_run: { type: "string", enum: ["accurate", "partial", "wrong", "not_reached"] }, notes: { type: "string" } }, required: ["build_vs_run", "notes"] },
          navigation: { type: "object", properties: { path: { type: "array", items: { type: "string" } }, wrong_turns: { type: "integer" }, dead_ends: { type: "array", items: { type: "string" } }, notes: { type: "string" } }, required: ["path", "wrong_turns", "dead_ends", "notes"] },
          pricing: {
            type: "object",
            properties: {
              clarity: { type: "string", enum: ["clear", "partial", "unclear", "not_reached"] },
              invented: { type: "array", items: { type: "object", properties: { claim: { type: "string" }, fact: { type: "string" }, step: { type: "string" } }, required: ["claim", "fact", "step"] } },
              notes: { type: "string" },
            },
            required: ["clarity", "invented", "notes"],
          },
          trust: { type: "object", properties: { missing_evidence: { type: "array", items: { type: "string" } }, contradictions: { type: "array", items: { type: "string" } } }, required: ["missing_evidence", "contradictions"] },
          conversion: { type: "object", properties: { reached: { type: "string", enum: ["right_flow", "wrong_flow", "none"] }, flow: { type: "string" }, notes: { type: "string" } }, required: ["reached", "flow", "notes"] },
          mobile: { type: "object", properties: { issues: { type: "array", items: { type: "string" } } }, required: ["issues"] },
        },
        required: ["first_impression", "service_comprehension", "navigation", "pricing", "trust", "conversion", "mobile"],
      },
      findings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            category: { type: "string", enum: [...CATEGORIES] },
            severity: { type: "string", enum: ["high", "medium", "low"] },
            verdict: { type: "string", enum: ["defect", "expected_preview_state", "not_a_defect"] },
            ref: { type: "string", description: "S<n> or P<n>" },
            element: { type: "string", description: "Exact text of the element on that screen." },
            rationale: { type: "string" },
            fix_hint: { type: "string" },
          },
          required: ["title", "category", "severity", "verdict", "ref", "element", "rationale", "fix_hint"],
        },
      },
    },
    required: ["measures", "findings"],
  },
};

const norm = (s: string) => s.toLowerCase().replace(/[“”"'‘’]/g, "").replace(/\s+/g, " ").trim();

/** "S3", "S3-S5", "S3, S4, S6" or "P2" as a list of single references, at most 30. */
export function expandRefs(ref: string): string[] {
  const out: string[] = [];
  for (const part of ref.toUpperCase().split(/[,;/]|\band\b/)) {
    const range = /^\s*([SP])(\d+)\s*[-–]\s*[SP]?(\d+)\s*$/.exec(part);
    const single = /^\s*([SP])(\d+)\s*$/.exec(part);
    if (range) for (let n = Number(range[2]); n <= Number(range[3]) && out.length < 30; n++) out.push(`${range[1]}${n}`);
    else if (single) out.push(`${single[1]}${Number(single[2])}`);
    else return [];
  }
  return out.slice(0, 30);
}

/**
 * The evidence rule: a finding stands only with a screenshot and the element it names on that screen. For S<n>
 * the element's text must be on that screen; for P<n> the buyer's element must have been found on the page. A
 * range or list of screens is accepted when the element is on one of them, and that screen becomes the evidence.
 */
export function checkEvidence(rec: SessionRecord, ref: string, element: string): { ok: true; ref: string; url: string; screenshot: string } | { ok: false; reason: string } {
  const refs = expandRefs(ref);
  if (!refs.length) return { ok: false, reason: `reference "${ref}" is not S<n> or P<n>` };
  const el = norm(element);
  if (el.length < 3) return { ok: false, reason: "the finding names no element" };
  let reason = "";
  for (const r of refs) {
    const n = Number(r.slice(1));
    if (r[0] === "P") {
      const p = rec.problems.find((x) => x.n === n);
      if (!p) reason = `no problem P${n}`;
      else if (!p.resolved) reason = `P${n}'s element was not found on the page`;
      else return { ok: true, ref: r, url: p.url, screenshot: p.screenshot };
      continue;
    }
    const screen = n === 0 ? { visible: rec.start.visible, url: rec.start.url, screenshot: rec.start.screenshot } : rec.steps.find((s) => s.n === n);
    if (!screen) reason = `no screen S${n}`;
    else if (!norm(screen.visible).includes(el.slice(0, 120))) reason = `"${clip(element, 60)}" is not on screen ${refs.length > 1 ? `any of ${ref}` : `S${n}`}`;
    else return { ok: true, ref: r, url: screen.url, screenshot: screen.screenshot };
  }
  return { ok: false, reason };
}

function validateGrade(input: unknown): { measures: Measures; findings: Omit<GradedFinding, "id" | "session" | "url" | "screenshot">[] } {
  const g = input as { measures?: Measures; findings?: unknown[] };
  if (!g || typeof g !== "object" || !g.measures || !Array.isArray(g.findings)) throw new Error("measures and findings are required");
  for (const k of ["first_impression", "service_comprehension", "navigation", "pricing", "trust", "conversion", "mobile"] as const) if (!g.measures[k]) throw new Error(`measures.${k} is required`);
  const findings = g.findings.map((f, i) => {
    const x = f as Record<string, string>;
    for (const k of ["title", "category", "severity", "verdict", "ref", "element"]) if (typeof x[k] !== "string" || !x[k]) throw new Error(`findings[${i}].${k} is required`);
    if (!CATEGORIES.includes(x.category as Category)) x.category = "other";
    if (!["high", "medium", "low"].includes(x.severity!)) throw new Error(`findings[${i}].severity must be high, medium or low`);
    if (!["defect", "expected_preview_state", "not_a_defect"].includes(x.verdict!)) throw new Error(`findings[${i}].verdict is not valid`);
    return { title: x.title!, category: x.category as Category, severity: x.severity as GradedFinding["severity"], verdict: x.verdict as Verdict, ref: x.ref!, element: x.element!, rationale: x.rationale ?? "", fix_hint: x.fix_hint ?? "" };
  });
  return { measures: g.measures, findings };
}

export async function gradeSession(panel: Panel, ctx: GradingContext, rec: SessionRecord, dir: string, usage: Usage): Promise<SessionGrade> {
  const evaluator: ModelChoice = { temperature: 0, ...panel.evaluator };
  const graded = await callForTool(
    evaluator,
    {
      max_tokens: 8000,
      system: [{ type: "text", text: GRADER_SYSTEM(ctx), cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: [...traceContent(panel, rec, dir), { type: "text", text: "Grade this session by calling submit_grade." }] }],
    },
    GRADE_TOOL,
    usage,
    validateGrade,
  );
  const findings: GradedFinding[] = [];
  const dropped: DroppedFinding[] = [];
  graded.findings.forEach((f) => {
    const ev = checkEvidence(rec, f.ref, f.element);
    if (!ev.ok) {
      dropped.push({ session: rec.id, title: f.title, ref: f.ref, element: f.element, reason: ev.reason });
      return;
    }
    findings.push({ ...f, ref: ev.ref, id: `${rec.id}#${findings.length + 1}`, session: rec.id, url: ev.url, screenshot: ev.screenshot });
  });
  return { session: rec.id, measures: graded.measures, findings, dropped };
}

// ---- clustering and reproduction ----------------------------------------------------------------------------------

export interface Cluster {
  key: string;
  title: string;
  summary: string;
  category: Category;
  severity: "high" | "medium" | "low";
  members: string[];
  reproduces: boolean;
  why: string;
}

export interface SessionRef {
  id: string;
  profile: string;
  device: string;
  variant: string;
}

/**
 * The reproduction rule from DOM-642: a finding reproduces when both runs (every variant) of one profile show it, or
 * when two or more profiles show it. Anything else stays a seen-once finding in the run report.
 */
export function reproduction(members: SessionRef[], variantIds: string[]): { reproduces: boolean; why: string } {
  const profiles = [...new Set(members.map((m) => m.profile))];
  if (profiles.length >= 2) return { reproduces: true, why: `${profiles.length} profiles: ${profiles.join(", ")}` };
  const p = profiles[0];
  if (!p) return { reproduces: false, why: "the cluster has no sessions" };
  const seen = new Set(members.filter((m) => m.profile === p).map((m) => m.variant));
  if (variantIds.length >= 2 && variantIds.every((v) => seen.has(v))) return { reproduces: true, why: `both runs of ${p} (${variantIds.join(" and ")})` };
  return { reproduces: false, why: `seen in ${[...seen].map((v) => `${p} run ${v}`).join(", ")} only` };
}

const CLUSTER_TOOL: Anthropic.Tool = {
  name: "submit_clusters",
  description: "Group the findings into clusters, one per underlying defect on the site.",
  input_schema: {
    type: "object",
    properties: {
      clusters: {
        type: "array",
        items: {
          type: "object",
          properties: {
            key: { type: "string", description: "kebab-case slug naming the defect, stable enough to match the same defect in a later run" },
            title: { type: "string" },
            summary: { type: "string", description: "Two or three sentences: what is wrong, where, and what it does to a buyer." },
            category: { type: "string", enum: [...CATEGORIES] },
            severity: { type: "string", enum: ["high", "medium", "low"] },
            members: { type: "array", items: { type: "string" }, description: "Finding ids" },
          },
          required: ["key", "title", "summary", "category", "severity", "members"],
        },
      },
    },
    required: ["clusters"],
  },
};

export async function clusterFindings(panel: Panel, findings: GradedFinding[], sessions: SessionRef[], usage: Usage): Promise<Cluster[]> {
  const defects = findings.filter((f) => f.verdict === "defect");
  if (!defects.length) return [];
  const ids = new Set(defects.map((f) => f.id));
  const list = defects.map((f) => `${f.id} | ${f.category} | ${f.severity} | ${f.title} | element "${clip(f.element, 100)}" on ${f.url} | ${clip(f.rationale, 300)}`).join("\n");
  const clusters: Cluster[] = await callForTool(
    { temperature: 0, ...panel.evaluator },
    {
      max_tokens: 8000,
      system: "You merge findings from several sessions of a synthetic buyer panel. Two findings belong to one cluster when they describe the same underlying defect, so that one fix would remove both: the same misunderstanding caused by the same wording or layout is one cluster even when the buyers quoted it from different screens. Different defects on the same page are different clusters. Every finding id appears in exactly one cluster.",
      messages: [{ role: "user", content: `Findings (id | category | severity | title | evidence | rationale):\n${list}\n\nCall submit_clusters.` }],
    },
    CLUSTER_TOOL,
    usage,
    (input) => {
      const c = (input as { clusters?: Cluster[] }).clusters;
      if (!Array.isArray(c)) throw new Error("clusters must be an array");
      const seen = new Set<string>();
      for (const x of c) {
        if (!Array.isArray(x.members) || !x.members.length) throw new Error(`cluster ${x.key} has no members`);
        for (const m of x.members) {
          if (!ids.has(m)) throw new Error(`unknown finding id ${m}`);
          if (seen.has(m)) throw new Error(`finding ${m} is in two clusters`);
          seen.add(m);
        }
      }
      return c;
    },
  );
  const covered = new Set(clusters.flatMap((c) => c.members));
  for (const f of defects) {
    if (!covered.has(f.id)) clusters.push({ key: f.id.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), title: f.title, summary: f.rationale, category: f.category, severity: f.severity, members: [f.id], reproduces: false, why: "" });
  }
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const variantIds = panel.variants.map((v) => v.id);
  return clusters
    .map((c) => {
      const members = [...new Set(c.members.map((m) => m.split("#")[0]!))].map((id) => byId.get(id)).filter((x): x is SessionRef => Boolean(x));
      return { ...c, ...reproduction(members, variantIds) };
    })
    .sort((a, b) => Number(b.reproduces) - Number(a.reproduces) || "hml".indexOf(a.severity[0]!) - "hml".indexOf(b.severity[0]!) || b.members.length - a.members.length);
}
