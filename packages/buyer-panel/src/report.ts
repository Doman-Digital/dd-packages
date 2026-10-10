import type { Panel } from "./config.js";
import type { SessionRecord } from "./buyer.js";
import type { Cluster, DroppedFinding, GradedFinding, SessionGrade } from "./evaluate.js";
import type { Usage } from "./model.js";

export interface RunMeta {
  runId: string;
  panel: string;
  client: string;
  target: string;
  version: string;
  label: string;
  ranAt: string;
  stepBudget: number;
  variants: Panel["variants"];
  evaluator: Panel["evaluator"];
  brandFactsVersion?: string;
  /** Set when the Worker served a different version at the end of the run than at the start. */
  versionChangedTo?: string;
  usage: { buyers: Usage; evaluator: Usage };
}

export interface RunReport {
  meta: RunMeta;
  sessions: { id: string; profile: string; device: string; variant: string; endReason: string; steps: number; problems: number; error?: string }[];
  grades: SessionGrade[];
  clusters: Cluster[];
  findings: GradedFinding[];
  dropped: DroppedFinding[];
}

const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n+/g, " ");

export function renderReport(r: RunReport, records: SessionRecord[]): string {
  const m = r.meta;
  const byId = new Map(r.findings.map((f) => [f.id, f]));
  const reproducing = r.clusters.filter((c) => c.reproduces);
  const once = r.clusters.filter((c) => !c.reproduces);
  const expected = r.findings.filter((f) => f.verdict === "expected_preview_state");
  const notDefects = r.findings.filter((f) => f.verdict === "not_a_defect");
  const out: string[] = [];
  out.push(
    `# Buyer panel run ${m.runId}`,
    "",
    `**Target** ${m.target} · **version** \`${m.version}\` · **ran** ${m.ranAt} · **panel** ${m.panel}${m.label ? ` · ${m.label}` : ""}`,
    "",
    `**Buyers** ${m.variants.map((v) => `run ${v.id}: ${v.model} at temperature ${v.temperature ?? "default"}`).join("; ")} · **evaluator** ${m.evaluator.model} · **step budget** ${m.stepBudget} · **brand facts** v${m.brandFactsVersion ?? "?"}`,
    "",
    ...(m.versionChangedTo ? [`> **Warning:** the site moved to version \`${m.versionChangedTo}\` during this run, so some sessions may have seen the later version.`, ""] : []),
    "> A defect-finding layer, never validation. The panel can show where a site is hard to understand, navigate or trust; it cannot show that real owners trust it or would pay for it. A finding that does not appear here was not found, which is not the same as not present.",
    "",
    `Sessions: ${r.sessions.length} (${r.sessions.filter((s) => s.endReason === "finished").length} finished, ${r.sessions.filter((s) => s.endReason === "budget").length} out of steps, ${r.sessions.filter((s) => s.endReason === "error").length} errors). Findings: ${r.clusters.length} distinct defects, **${reproducing.length} reproducing**, ${once.length} seen once; ${expected.length} expected preview states; ${notDefects.length} judged the buyer's own error; ${r.dropped.length} dropped for want of evidence.`,
    "",
    `## Reproducing findings (${reproducing.length})`,
    "",
  );
  if (!reproducing.length) out.push("None reproduced.", "");
  reproducing.forEach((c, i) => {
    out.push(`### R${i + 1}. ${c.title}`, "", `\`${c.key}\` · ${c.category} · ${c.severity} · reproduces: ${c.why}`, "", c.summary, "", "| Finding | Screen | Element | Page | Screenshot |", "| --- | --- | --- | --- | --- |");
    for (const id of c.members) {
      const f = byId.get(id);
      if (f) out.push(`| ${f.id} | ${f.ref} | ${esc(f.element.slice(0, 90))} | ${esc(new URL(f.url).pathname)} | \`sessions/${f.session}/${f.screenshot}\` |`);
    }
    const hint = c.members.map((id) => byId.get(id)?.fix_hint).find(Boolean);
    if (hint) out.push("", `Fix hint: ${hint}`);
    out.push("");
  });
  out.push(`## Seen once (${once.length})`, "");
  if (!once.length) out.push("None.", "");
  for (const c of once) out.push(`- **${c.title}** (${c.category}, ${c.severity}; ${c.why}). ${c.summary} Evidence: ${c.members.map((id) => `${id} ${byId.get(id)?.ref ?? ""}`).join(", ")}`);
  out.push("", "## Measures per session", "", "| Session | First impression | Build vs Run | Wrong turns | Dead ends | Pricing | Invented | Trust gaps | Conversion | Mobile issues | Steps | End |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const g of r.grades) {
    const s = r.sessions.find((x) => x.id === g.session)!;
    const ms = g.measures;
    out.push(
      `| ${g.session} | ${ms.first_impression.verdict} | ${ms.service_comprehension.build_vs_run} | ${ms.navigation.wrong_turns} | ${ms.navigation.dead_ends.length} | ${ms.pricing.clarity} | ${ms.pricing.invented.length} | ${ms.trust.missing_evidence.length + ms.trust.contradictions.length} | ${ms.conversion.reached} | ${s.device === "phone" ? ms.mobile.issues.length : "–"} | ${s.steps} | ${s.endReason} |`,
    );
  }
  for (const s of r.sessions.filter((x) => !r.grades.some((g) => g.session === x.id))) out.push(`| ${s.id} | not graded | | | | | | | | | ${s.steps} | ${s.endReason}${s.error ? `: ${esc(s.error)}` : ""} |`);
  out.push("", "## First impressions from the 390 fold", "");
  for (const rec of records) out.push(`- **${rec.id}**: ${esc(rec.firstImpression.answer)}`);
  const invented = r.grades.flatMap((g) => g.measures.pricing.invented.map((x) => ({ ...x, session: g.session })));
  out.push("", `## Invented pricing assumptions (${invented.length})`, "");
  if (!invented.length) out.push("None recorded.");
  for (const x of invented) out.push(`- ${x.session} (${x.step}): the buyer took "${esc(x.claim)}"; the facts say ${esc(x.fact)}`);
  out.push("", `## Expected preview states seen (${expected.length})`, "");
  for (const f of expected) out.push(`- ${f.id} ${f.ref}: ${f.title}`);
  out.push("", `## Dropped for want of evidence (${r.dropped.length})`, "");
  for (const d of r.dropped) out.push(`- ${d.session}: ${d.title} (${d.ref}, ${d.reason})`);
  const u = m.usage;
  out.push(
    "",
    "## Cost record",
    "",
    `Buyers: ${u.buyers.calls} calls, ${u.buyers.input} input and ${u.buyers.output} output tokens. Evaluator: ${u.evaluator.calls} calls, ${u.evaluator.input} input (${u.evaluator.cacheRead} read from cache) and ${u.evaluator.output} output tokens.`,
    "",
    "Each session folder holds session.json (every step, thought, screen text and problem), the screenshots, grade.json and trace.zip (Playwright trace: `npx playwright show-trace trace.zip`).",
    "",
  );
  return out.join("\n");
}
