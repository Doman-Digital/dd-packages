/**
 * Metric rules. Never make the business look healthier, busier or further
 * along than the data shows: a weak number is replaced by a plain sentence or
 * held back for the founder, never dressed up.
 */

import { formatShort, londonDate, londonMidnight, nextDay } from "./dates";
import type { Flag, Incident, PageSpeedRun, Search, Speed, Uptime, Visits } from "./types";

// ---------------------------------------------------------------- uptime

/**
 * Checks passed of checks made in the period. UptimeRobot gives incidents, not
 * check counts, so the total is the period divided by the monitor's interval
 * and the failures are the checks that fell inside an incident. The small
 * print says so, until a source with real counts is wired in.
 */
export function uptimeFromIncidents(
  period: { start: string; end: string },
  intervalSeconds: number,
  incidents: Incident[],
  asOf?: string,
): Uptime {
  const from = londonMidnight(period.start).getTime();
  let to = londonMidnight(nextDay(period.end)).getTime();
  if (asOf) to = Math.min(to, Math.max(from, new Date(asOf).getTime()));
  const step = intervalSeconds * 1000;
  const total = Math.floor((to - from) / step);
  let failed = 0;
  const failures: Uptime["failures"] = [];
  for (const inc of incidents) {
    const s = Math.max(from, new Date(inc.startedAt).getTime());
    const e = Math.min(to, inc.resolvedAt ? new Date(inc.resolvedAt).getTime() : to);
    if (e <= s) continue;
    const checks = Math.max(1, Math.ceil((e - s) / step));
    failed += checks;
    failures.push({ startedAt: new Date(s).toISOString(), minutes: Math.round((e - s) / 60000) });
  }
  failed = Math.min(failed, total);
  const minutes = Math.round(intervalSeconds / 60);
  return {
    passed: total - failed,
    total,
    failed,
    failures,
    intervalMinutes: minutes,
    summary: failed === 0 ? "Every check passed" : `${failed} ${failed === 1 ? "check" : "checks"} failed`,
    smallPrint: `Checked every ${minutes} minutes, ${formatShort(period.start)} to ${formatShort(londonDate(new Date(Math.max(from, to - 1))))}. Counted from the check schedule and the outage record.`,
  };
}

// ---------------------------------------------------------------- speed

export const MIN_SPEED_RUNS = 5;

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

export function speedBand(score: number): Pick<Speed, "band" | "bandLine"> {
  if (score >= 90) return { band: "fast", bandLine: "Fast. 90 and above is the top band." };
  if (score >= 50) return { band: "middle", bandLine: "Middle band. 50 to 89 is the middle of the scale." };
  return { band: "slow", bandLine: "Slow. Below 50 is the bottom band." };
}

/**
 * Distinct runs only. PageSpeed Insights hands back a cached Lighthouse result
 * when the same URL is asked for again within a short window, so two runs with
 * the same fetch time are one measurement. Mixed URLs or strategies are refused.
 */
export function distinctRuns(runs: PageSpeedRun[]): PageSpeedRun[] {
  const urls = new Set(runs.map((r) => `${r.strategy} ${r.url}`));
  if (urls.size > 1) throw new Error(`Speed runs must share one URL and strategy; got ${[...urls].join(", ")}`);
  const seen = new Set<string>();
  return runs.filter((r) => (seen.has(r.fetchTime) ? false : (seen.add(r.fetchTime), true)));
}

export type SpeedResult = { speed?: Speed; flags: Flag[] };

/**
 * The median of at least five distinct runs. A change is reported only when
 * the median has moved by more than the site's measured spread and the move
 * held across two consecutive sends; with fewer than two earlier sends there
 * is no comparison at all.
 */
export function speedFromRuns(runs: PageSpeedRun[], history: number[] = [], recordedSpread = 0): SpeedResult {
  const distinct = distinctRuns(runs);
  if (distinct.length < MIN_SPEED_RUNS) {
    return {
      flags: [{ code: "speed-runs", message: `Speed held back: ${distinct.length} distinct PageSpeed runs, ${MIN_SPEED_RUNS} needed (${runs.length - distinct.length} were cached repeats).` }],
    };
  }
  const scores = distinct.map((r) => r.score);
  const spread = Math.max(recordedSpread, Math.max(...scores) - Math.min(...scores));
  const now = median(scores);
  const days = [...new Set(distinct.map((r) => londonDate(r.fetchTime)))].sort();
  const when = days.length === 1 ? `on ${formatShort(days[0]!)}` : `from ${formatShort(days[0]!)} to ${formatShort(days[days.length - 1]!)}`;
  const speed: Speed = { median: now, runs: distinct.length, spread, ...speedBand(now), smallPrint: `Median of ${distinct.length} phone tests ${when}.` };
  if (history.length >= 2) {
    const baseline = history[history.length - 2]!;
    const previous = history[history.length - 1]!;
    const held = Math.abs(previous - baseline) > spread && Math.abs(now - baseline) > spread && Math.sign(previous - baseline) === Math.sign(now - baseline);
    if (held) speed.change = { from: baseline, to: now, direction: now > baseline ? "up" : "down" };
  }
  return { speed, flags: [] };
}

// ---------------------------------------------------------------- search

export const LOW_DATA = { impressions: 100, clicks: 10 } as const;

export function lowDataSentence(preLaunch: boolean): { title: string; sentence: string } {
  return {
    title: "Still too early to read",
    sentence: preLaunch
      ? "Search numbers stay small before a launch, so we'll start reporting trends once there's enough to go on."
      : "Search numbers are still small, so we'll start reporting trends once there's enough to go on.",
  };
}

export type SearchResult = { search: Search; excluded: string[]; flags: Flag[] };

/**
 * Under 100 impressions or under 10 clicks, the client gets a sentence, not
 * numbers. Queries containing an excluded pattern (our own name, by default)
 * never reach top searches; they are logged and raised with the founder.
 */
export function searchSummary(
  input: { clicks: number; impressions: number; queries: { query: string }[] },
  options: { exclude?: string[]; preLaunch?: boolean; clientName?: string } = {},
): SearchResult {
  const patterns = (options.exclude ?? ["domandigital"]).map((p) => p.toLowerCase());
  const excluded = input.queries.map((q) => q.query).filter((q) => patterns.some((p) => q.toLowerCase().includes(p)));
  const flags: Flag[] = excluded.length
    ? [{ code: "excluded-query", message: `Search Console shows ${excluded.map((q) => `"${q}"`).join(", ")} for ${options.clientName ?? "this client"}. Left out of top searches; find out why our name shows on their property.` }]
    : [];
  if (input.impressions < LOW_DATA.impressions || input.clicks < LOW_DATA.clicks) {
    return { search: { state: "low-data", ...lowDataSentence(!!options.preLaunch) }, excluded, flags };
  }
  const topQueries = input.queries.map((q) => q.query).filter((q) => !excluded.includes(q)).slice(0, 3);
  return { search: { state: "numbers", clicks: input.clicks, impressions: input.impressions, topQueries }, excluded, flags };
}

// ---------------------------------------------------------------- visits

export type VisitsResult = { visits?: Visits; flags: Flag[] };

/** Zero sessions beside real Google clicks means tracking is broken: no number goes to the client. */
export function visitsSummary(sessions: number | null | undefined, clicks: number): VisitsResult {
  if (sessions === null || sessions === undefined) return { flags: [] };
  if (sessions === 0 && clicks > 0) {
    return { flags: [{ code: "tracking-check", message: `Tracking check needed: Google Analytics reports 0 visits while Search Console reports ${clicks} ${clicks === 1 ? "click" : "clicks"}. Visits tile held back.` }] };
  }
  return { visits: { sessions }, flags: [] };
}
