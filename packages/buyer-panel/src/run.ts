import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Device, Panel } from "./config.js";
import { accessCookie } from "./browser.js";
import { runSession, sessionId, type SessionRecord } from "./buyer.js";
import { clusterFindings, gradeSession, type SessionGrade, type SessionRef } from "./evaluate.js";
import { loadGradingContext } from "./grading-context.js";
import { emptyUsage, mergeUsage, type Usage } from "./model.js";
import { renderReport, type RunMeta, type RunReport } from "./report.js";

export interface RunOptions {
  version: string;
  label?: string;
  only?: string[];
  devices?: Device[];
  variants?: string[];
  concurrency?: number;
  evaluate?: boolean;
  /** An existing run directory to finish instead of starting a new run. */
  into?: string;
  log?: (line: string) => void;
}

export const runIdFor = (version: string, at: Date): string => `${version.slice(0, 8)}-${at.toISOString().slice(0, 16).replace(/:/g, "")}`;

export const panelRoot = (panel: Panel): string => join(panel.archive, panel.client, "panel");

/** Runs tasks with at most `limit` in flight; results keep the input order. */
export async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return out;
}

/** The version the panel's Worker serves to all traffic, read with wrangler; undefined when there is no single one. */
export function deployedVersion(panel: Panel): string | undefined {
  const w = panel.target.worker;
  if (!w) return undefined;
  const out = execFileSync("wrangler", ["deployments", "status", "--name", w.name, "--json"], {
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: w.accountId },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const d = JSON.parse(out) as { versions?: { version_id: string; percentage: number }[] };
  const full = d.versions?.find((v) => v.percentage === 100);
  return full?.version_id;
}

export async function runPanel(panel: Panel, o: RunOptions): Promise<string> {
  const log = o.log ?? console.log;
  if (o.version === "auto") {
    const v = deployedVersion(panel);
    if (!v) throw new Error("--version auto needs target.worker in the panel and one version at 100%");
    o = { ...o, version: v };
  }
  if (!/^[0-9a-f]{8}/i.test(o.version)) throw new Error("--version must be the Worker version id (at least its first 8 hex characters), or auto");
  const at = new Date();
  const profiles = panel.profiles.filter((p) => !o.only?.length || o.only.includes(p.id));
  const devices = panel.devices.filter((d) => !o.devices?.length || o.devices.includes(d));
  const variants = panel.variants.filter((v) => !o.variants?.length || o.variants.includes(v.id));
  let plan = profiles.flatMap((profile) => devices.flatMap((device) => variants.map((variant) => ({ profile, device, variant }))));
  if (!plan.length) throw new Error("nothing to run: check --only, --device and --variant");

  let runDir: string;
  let meta: RunMeta;
  if (o.into) {
    // Finish an earlier run: same version only, and only the sessions that are missing or ended in an error.
    runDir = o.into;
    meta = JSON.parse(readFileSync(join(runDir, "run.json"), "utf8")) as RunMeta;
    if (!meta.version.startsWith(o.version.slice(0, 8))) throw new Error(`run ${meta.runId} is keyed to ${meta.version}; the site now serves ${o.version}. Start a new run.`);
    const done = new Set(readSessions(runDir).filter((r) => r.endReason !== "error").map((r) => r.id));
    plan = plan.filter((x) => !done.has(sessionId(x.profile.id, x.device, x.variant.id)));
    log(`run ${meta.runId}: ${plan.length} sessions to finish in ${runDir}`);
  } else {
    const runId = runIdFor(o.version, at);
    runDir = join(panelRoot(panel), "runs", runId);
    mkdirSync(join(runDir, "sessions"), { recursive: true });
    meta = {
      runId,
      panel: panel.name,
      client: panel.client,
      target: new URL(panel.target.start, panel.target.origin).toString(),
      version: o.version,
      label: o.label ?? "",
      ranAt: at.toISOString(),
      stepBudget: panel.stepBudget,
      variants,
      evaluator: panel.evaluator,
      usage: { buyers: emptyUsage(), evaluator: emptyUsage() },
    };
    writeFileSync(join(runDir, "run.json"), JSON.stringify({ ...meta, plan: plan.map((x) => sessionId(x.profile.id, x.device, x.variant.id)) }, null, 1));
    log(`run ${runId}: ${plan.length} sessions into ${runDir}`);
  }

  const cookie = await accessCookie(panel);
  await pool(plan, o.concurrency ?? 3, async ({ profile, device, variant }) => {
    const id = sessionId(profile.id, device, variant.id);
    const dir = join(runDir, "sessions", id);
    rmSync(dir, { recursive: true, force: true }); // a failed attempt's screenshots must not outlive it
    const rec = await runSession({ panel, profile, device, variant, dir, cookie, log });
    log(`${id}: ${rec.endReason} after ${rec.steps.length} steps, ${rec.problems.length} problems`);
    return rec;
  });

  // A deploy during the run would mix two versions in one report: check, and say so in the run record.
  const after = panel.target.worker ? deployedVersion(panel) : undefined;
  if (after && !after.startsWith(o.version) && !o.version.startsWith(after)) {
    meta.versionChangedTo = after;
    writeFileSync(join(runDir, "run.json"), JSON.stringify(meta, null, 1));
    log(`warning: the Worker moved to ${after} during the run; the report says so`);
  }

  if (o.evaluate !== false) await evaluateRun(panel, runDir, log);
  return runDir;
}

export function readSessions(runDir: string): SessionRecord[] {
  const dir = join(runDir, "sessions");
  return readdirSync(dir)
    .filter((d) => existsSync(join(dir, d, "session.json")))
    .sort()
    .map((d) => JSON.parse(readFileSync(join(dir, d, "session.json"), "utf8")) as SessionRecord);
}

/** Grades every session, clusters the findings, applies the reproduction rule, writes the report and the archive index. */
export async function evaluateRun(panel: Panel, runDir: string, log: (line: string) => void = console.log): Promise<RunReport> {
  const meta = JSON.parse(readFileSync(join(runDir, "run.json"), "utf8")) as RunMeta;
  const records = readSessions(runDir);
  const ctx = loadGradingContext(panel);
  meta.brandFactsVersion = ctx.brandFactsVersion;
  meta.usage.buyers = emptyUsage();
  for (const r of records) mergeUsage(meta.usage.buyers, r.usage);
  const evalUsage: Usage = emptyUsage();
  const graded = records.filter((r) => r.endReason !== "error" || r.steps.length > 0);
  const grades = (
    await pool(graded, 3, async (rec) => {
      try {
        const g = await gradeSession(panel, ctx, rec, join(runDir, "sessions", rec.id), evalUsage);
        writeFileSync(join(runDir, "sessions", rec.id, "grade.json"), JSON.stringify(g, null, 1));
        log(`${rec.id}: graded, ${g.findings.length} findings kept, ${g.dropped.length} dropped`);
        return g;
      } catch (e) {
        log(`${rec.id}: grading failed: ${(e as Error).message}`);
        return undefined;
      }
    })
  ).filter((g): g is SessionGrade => Boolean(g));
  const findings = grades.flatMap((g) => g.findings);
  const refs: SessionRef[] = records.map((r) => ({ id: r.id, profile: r.profile, device: r.device, variant: r.variant.id }));
  const clusters = await clusterFindings(panel, findings, refs, evalUsage);
  meta.usage.evaluator = evalUsage;
  const report: RunReport = {
    meta,
    sessions: records.map((r) => ({ id: r.id, profile: r.profile, device: r.device, variant: r.variant.id, endReason: r.endReason, steps: r.steps.length, problems: r.problems.length, ...(r.error ? { error: r.error } : {}) })),
    grades,
    clusters,
    findings,
    dropped: grades.flatMap((g) => g.dropped),
  };
  writeFileSync(join(runDir, "report.json"), JSON.stringify(report, null, 1));
  writeFileSync(join(runDir, "report.md"), renderReport(report, records));
  writeFileSync(join(runDir, "run.json"), JSON.stringify(meta, null, 1));
  updateIndex(panel, report);
  log(`report: ${join(runDir, "report.md")} (${clusters.filter((c) => c.reproduces).length} reproducing, ${clusters.filter((c) => !c.reproduces).length} seen once)`);
  return report;
}

/** The client-capsule index: one entry per run under "panel", keyed by the Worker version it ran against. */
export function updateIndex(panel: Panel, report: RunReport): void {
  const file = join(panel.archive, panel.client, "index.json");
  mkdirSync(dirname(file), { recursive: true });
  const index = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>) : { schemaVersion: 1, client: panel.client };
  const section = (index.panel as { origin?: string; runs?: unknown[] } | undefined) ?? {};
  const runs = ((section.runs ?? []) as { runId: string }[]).filter((r) => r.runId !== report.meta.runId);
  runs.push({
    runId: report.meta.runId,
    version: report.meta.version,
    label: report.meta.label,
    ranAt: report.meta.ranAt,
    sessions: report.sessions.length,
    reproducing: report.clusters.filter((c) => c.reproduces).length,
    seenOnce: report.clusters.filter((c) => !c.reproduces).length,
  } as { runId: string });
  index.panel = { origin: panel.target.origin, runs };
  writeFileSync(file, JSON.stringify(index, null, 2) + "\n");
}
