/**
 * `buildBriefing(input, config)`: one JSON input in, one briefing out, with the
 * flags the founder's preview shows and the full log the client can open.
 *
 * Nothing here writes the headline or the personal note. They are hand-written
 * on the client config and the build fails when either is empty. The build
 * also fails on any copy-gate finding (see lint.ts).
 */

import { classifyEntries, resolveRef, type ClassifiedEntry } from "./classify";
import { dedupe, type Group } from "./dedupe";
import { findDates, sameDate, mentionOf } from "./dates";
import { sha256Hex } from "./hash";
import { assertLintClean, BriefingLintError } from "./lint";
import { searchSummary, speedFromRuns, uptimeFromIncidents, visitsSummary } from "./metrics";
import { maintenanceLine, rankChanges } from "./rank";
import { computeStatus, launchView, preheader, statusLabel } from "./status";
import { buildTrackRecord } from "./track-record";
import type { Approval, Briefing, BriefingLog, BuildResult, ClientConfig, Flag, LogEntry, RawInput, Section } from "./types";

export const MAX_APPROVALS = 3;

export class BriefingBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BriefingBuildError";
  }
}

/** Needs you comes straight after the headline whenever there is anything in it. */
export function sectionOrder(b: Pick<Briefing, "approvals" | "launch" | "changes" | "maintenanceCount" | "moreChangesCount" | "trackRecord">): Section[] {
  const s: Section[] = ["status"];
  if (b.approvals.length) s.push("needs-you");
  if (b.launch) s.push("launch");
  if (b.changes.length || b.maintenanceCount || b.moreChangesCount) s.push("changes");
  s.push("health");
  if (b.trackRecord) s.push("track-record");
  s.push("note");
  return s;
}

export function buildBriefing(input: RawInput, config: ClientConfig): BuildResult {
  if (!config.headline?.trim()) throw new BriefingBuildError(`No headline for ${config.name}. The headline is hand-written on the client config; it is never generated.`);
  if (!config.note?.trim()) throw new BriefingBuildError(`No personal note for ${config.name}. The note is hand-written on the client config; it is never generated.`);

  const flags: Flag[] = [];
  const defaultRepo = input.entries[0]?.repo ?? config.slug;

  // ---- entries: classify, then group
  const classified = classifyEntries(input.entries, input.notes);
  const { groups, supersessions, unresolved } = dedupe(classified);
  for (const u of unresolved) flags.push({ code: "unresolved-supersession", message: u.message, refs: u.refs });

  // ---- approvals come from the config; the entries they stand for become the card
  const sourceOf = new Map<string, string>();
  for (const a of config.approvals) for (const s of a.sources ?? []) sourceOf.set(resolveRef(s, defaultRepo), a.id);
  const isApproval = (g: Group) => g.members.some((m) => sourceOf.has(m.ref));
  for (const g of groups) {
    if (!isApproval(g) && (g.bucket === "needs-you" || g.approvalCandidate)) {
      flags.push({ code: "unmatched-approval", message: `${g.id} asks the client for something and no approval on the config stands for it: "${g.text ?? g.lead.entry.title}"`, refs: g.members.map((m) => m.ref) });
    }
  }
  const allApprovals: Approval[] = config.approvals.map((a) => ({
    id: a.id,
    version: sha256Hex(a.content),
    title: a.title,
    why: a.why,
    review: a.review,
    ...(a.secondary ? { secondary: a.secondary } : {}),
  }));
  const approvals = allApprovals.slice(0, MAX_APPROVALS);
  if (allApprovals.length > MAX_APPROVALS) {
    flags.push({ code: "approvals-over-cap", message: `${allApprovals.length} approvals; the briefing shows ${MAX_APPROVALS}. Send ${allApprovals.slice(MAX_APPROVALS).map((a) => a.id).join(", ")} as their own short email.` });
  }

  // ---- live, ready, maintenance
  const nonApproval = groups.filter((g) => !isApproval(g));
  const live = nonApproval.filter((g) => g.bucket === "live");
  const ranked = rankChanges(live);
  const maintenanceCount = nonApproval.filter((g) => g.bucket === "maintenance").length;

  for (const c of ranked.shown) {
    const g = groups.find((x) => x.id === c.id)!;
    if (g.textSource === "note" && !g.title) {
      flags.push({ code: "unreviewed-line", message: `"${c.title}" was written from the change description, not by the PR's author. Read it, or add a ## Briefing block to ${c.id}.`, refs: [c.id] });
    }
  }
  const missing = classified.filter((e) => e.missingLine);
  if (missing.length) {
    flags.push({ code: "missing-client-line", message: `${missing.length} ${missing.length === 1 ? "entry has" : "entries have"} no "For the client" line and were counted as maintenance: ${missing.map((e) => e.ref).join(", ")}.`, refs: missing.map((e) => e.ref) });
  }

  // ---- metrics
  const uptime = uptimeFromIncidents(input.period, input.uptime.intervalSeconds, input.uptime.incidents, input.asOf);
  if (uptime.failed > 0) {
    flags.push({ code: "failed-checks", message: `${uptime.failed} uptime ${uptime.failed === 1 ? "check" : "checks"} failed: ${uptime.failures.map((f) => `${f.startedAt} for ${f.minutes} minutes`).join("; ")}.` });
  }
  const speedResult = input.speed ? speedFromRuns(input.speed.runs, input.speed.history, input.speed.spread) : { flags: [] };
  flags.push(...speedResult.flags);
  const searchResult = searchSummary(input.search, { exclude: config.searchExclude, preLaunch: !!config.launch, clientName: config.name });
  flags.push(...searchResult.flags);
  const visitsResult = visitsSummary(input.analytics?.sessions, input.search.clicks);
  flags.push(...visitsResult.flags);

  // ---- launch
  const launch = config.launch ? launchView(config.launch, input.period.sendAt) : undefined;
  if (launch?.state === "proposed") {
    flags.push({ code: "launch-proposed", message: `Launch date ${launch.dateLong} is still proposed: the briefing shows it awaiting confirmation, with no countdown.` });
  }
  if (launch) {
    // The latest dated fact about the launch in the entries should agree with the config.
    const moves = supersessions.filter((s) => s.reason === "date moved" && s.to);
    const latest = moves[moves.length - 1];
    const latestDate = latest ? findDates(latest.to!)[0] : undefined;
    if (latestDate && !sameDate(latestDate, mentionOf(launch.date))) {
      flags.push({ code: "launch-date-mismatch", message: `The entries last moved a date to ${latest!.to} (${latest!.by}); the config's launch date is ${launch.dateLong}.`, refs: [latest!.by] });
    }
  }

  const trackRecord = buildTrackRecord(input.ledger, config).trackRecord;
  const status = computeStatus(approvals, uptime);

  const briefing: Briefing = {
    client: { name: config.name, contactFirstName: config.contactFirstName, signoffName: config.signoffName },
    period: input.period,
    status,
    statusLabel: statusLabel(status, approvals.length),
    preheader: preheader(config.headline.trim(), approvals, status),
    headline: config.headline.trim(),
    subhead: config.subhead.trim(),
    approvals,
    ...(launch ? { launch } : {}),
    changes: ranked.shown,
    ...(ranked.featureImage ? { featureImage: ranked.featureImage } : {}),
    maintenanceCount,
    moreChangesCount: ranked.overflow.length,
    maintenanceLine: maintenanceLine(maintenanceCount, ranked.overflow.length),
    health: {
      uptime,
      ...(speedResult.speed ? { speed: speedResult.speed } : {}),
      search: searchResult.search,
      ...(visitsResult.visits ? { visits: visitsResult.visits } : {}),
    },
    ...(trackRecord ? { trackRecord } : {}),
    note: config.note.trim(),
    urls: config.urls,
    sections: [],
  };
  briefing.sections = sectionOrder(briefing);

  assertLintClean(briefing, { allowedTerms: config.allowedTerms });

  // ---- the full log
  const shownIds = new Set(ranked.shown.map((c) => c.id));
  const overflowIds = new Set(ranked.overflow.map((c) => c.id));
  const groupOf = new Map<string, Group>();
  for (const g of groups) for (const m of g.members) groupOf.set(m.ref, g);
  const shownAs = (e: ClassifiedEntry): LogEntry["shownAs"] => {
    const g = groupOf.get(e.ref)!;
    if (isApproval(g)) return "approval";
    if (g.lead !== e) return supersessions.some((s) => s.ref === e.ref && s.reason !== "same change, described twice" && !s.reason.startsWith("security")) ? "superseded" : "merged";
    if (shownIds.has(g.id)) return "change";
    if (overflowIds.has(g.id)) return "overflow";
    if (g.bucket === "ready") return "ready";
    if (g.bucket === "needs-you") return "held";
    return "maintenance";
  };
  const log: BriefingLog = {
    entries: classified
      .slice()
      .sort((a, b) => a.entry.mergedAt.localeCompare(b.entry.mergedAt))
      .map((e) => {
        const g = groupOf.get(e.ref)!;
        return {
          ref: e.ref,
          title: e.entry.title,
          mergedAt: e.entry.mergedAt,
          bucket: e.bucket,
          kind: e.kind,
          shownAs: shownAs(e),
          ...(g.lead !== e ? { groupedInto: g.id } : {}),
          rule: e.rule,
          text: e.text,
        };
      }),
    supersessions,
    excludedQueries: searchResult.excluded,
    derivations: [
      `Uptime: ${uptime.passed} of ${uptime.total} checks, counted from the ${uptime.intervalMinutes}-minute check interval and ${input.uptime.incidents.length} recorded incident(s)${input.asOf ? `, to ${input.asOf}` : ""}.`,
      ...(speedResult.speed ? [`Speed: median ${speedResult.speed.median} of ${speedResult.speed.runs} distinct mobile runs, spread ${speedResult.speed.spread}.`] : []),
    ],
  };

  return { briefing, flags, log };
}

export { BriefingLintError };
