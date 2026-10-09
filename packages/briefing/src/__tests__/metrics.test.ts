import { describe, expect, it } from "vitest";
import { distinctRuns, median, MIN_SPEED_RUNS, searchSummary, speedBand, speedFromRuns, uptimeFromIncidents, visitsSummary } from "../metrics";
import type { PageSpeedRun } from "../types";

const period = { start: "2026-09-27", end: "2026-10-10" };

describe("uptime: checks passed of checks made", () => {
  it("counts the period's checks from the interval", () => {
    const u = uptimeFromIncidents(period, 300, []);
    expect(u).toMatchObject({ passed: 4032, total: 4032, failed: 0, summary: "Every check passed", intervalMinutes: 5 });
    expect(u.smallPrint).toBe("Checked every 5 minutes, 27 September to 10 October. Counted from the check schedule and the outage record.");
  });

  it("stops at asOf when the period is not over", () => {
    const u = uptimeFromIncidents(period, 300, [], "2026-10-07T23:00:00Z");
    expect(u.total).toBe(3168);
    expect(u.smallPrint).toContain("27 September to 7 October");
  });

  it("an incident fails the checks inside it, and never more than the total", () => {
    const u = uptimeFromIncidents(period, 300, [{ startedAt: "2026-10-01T10:00:00Z", resolvedAt: "2026-10-01T10:12:00Z" }]);
    expect(u).toMatchObject({ failed: 3, passed: 4029, summary: "3 checks failed" });
    expect(u.failures).toEqual([{ startedAt: "2026-10-01T10:00:00.000Z", minutes: 12 }]);
    expect(uptimeFromIncidents(period, 300, [{ startedAt: "2026-09-01T00:00:00Z", resolvedAt: null }]).passed).toBe(0);
  });

  it("ignores incidents outside the period", () => {
    expect(uptimeFromIncidents(period, 300, [{ startedAt: "2026-09-20T10:00:00Z", resolvedAt: "2026-09-20T11:00:00Z" }]).failed).toBe(0);
  });
});

const run = (score: number, minute: number, extra: Partial<PageSpeedRun> = {}): PageSpeedRun => ({
  score,
  fetchTime: new Date(Date.UTC(2026, 9, 8, 20, minute)).toISOString(),
  url: "https://www.client.example/",
  strategy: "mobile",
  ...extra,
});
const five = (scores: number[]) => scores.map((s, i) => run(s, i * 2));

describe("speed: a median of distinct runs", () => {
  it("takes the median of five runs and names the band", () => {
    const { speed, flags } = speedFromRuns(five([71, 95, 88, 92, 90]));
    expect(flags).toEqual([]);
    expect(speed).toMatchObject({ median: 90, runs: 5, spread: 24, band: "fast", smallPrint: "Median of 5 phone tests on 8 October." });
    expect(median([1, 2, 3, 4])).toBe(3);
  });

  it("cached repeats are one run, so four distinct runs are held back", () => {
    const runs = [...five([90, 91, 92, 93]).slice(0, 4), run(90, 0)];
    expect(distinctRuns(runs)).toHaveLength(4);
    const { speed, flags } = speedFromRuns(runs);
    expect(speed).toBeUndefined();
    expect(flags[0]).toMatchObject({ code: "speed-runs" });
    expect(flags[0]!.message).toContain(`${MIN_SPEED_RUNS} needed`);
  });

  it("refuses runs of different pages or strategies", () => {
    expect(() => distinctRuns([run(90, 0), run(90, 2, { strategy: "desktop" })])).toThrow(/one URL and strategy/);
  });

  it("bands", () => {
    expect(speedBand(90).band).toBe("fast");
    expect(speedBand(89).band).toBe("middle");
    expect(speedBand(49).band).toBe("slow");
  });
});

describe("speed: a change only beyond the spread, held across two sends", () => {
  it("no comparison without two earlier sends", () => {
    expect(speedFromRuns(five([95, 95, 95, 95, 95]), [70]).speed!.change).toBeUndefined();
  });

  it("a move inside the measured spread is not a change", () => {
    // Spread 6 recorded for this site; 78 then 82 then 83 moved by 5.
    expect(speedFromRuns(five([83, 83, 83, 83, 83]), [78, 82], 6).speed!.change).toBeUndefined();
  });

  it("a move beyond the spread that held across two sends is reported", () => {
    expect(speedFromRuns(five([92, 92, 92, 92, 92]), [78, 90], 6).speed!.change).toEqual({ from: 78, to: 92, direction: "up" });
  });

  it("a move that did not hold last time is not reported yet", () => {
    expect(speedFromRuns(five([92, 92, 92, 92, 92]), [78, 80], 6).speed!.change).toBeUndefined();
  });

  it("the spread of this send's runs counts too", () => {
    // Recorded spread 2, but today's runs range 80 to 95.
    expect(speedFromRuns(five([80, 85, 90, 92, 95]), [78, 88], 2).speed!.change).toBeUndefined();
  });
});

describe("search: a sentence until there is data", () => {
  it("under 100 impressions or under 10 clicks is low-data, with the pre-launch sentence", () => {
    const r = searchSummary({ clicks: 1, impressions: 25, queries: [] }, { preLaunch: true });
    expect(r.search).toEqual({
      state: "low-data",
      title: "Still too early to read",
      sentence: "Search numbers stay small before a launch, so we'll start reporting trends once there's enough to go on.",
    });
    expect(searchSummary({ clicks: 9, impressions: 5000, queries: [] }).search.state).toBe("low-data");
  });

  it("shows numbers above both floors", () => {
    const r = searchSummary({ clicks: 40, impressions: 900, queries: [{ query: "planner" }, { query: "wren planner" }] });
    expect(r.search).toEqual({ state: "numbers", clicks: 40, impressions: 900, topQueries: ["planner", "wren planner"] });
  });

  it("our own name never reaches top searches, and is raised with the founder", () => {
    const r = searchSummary({ clicks: 40, impressions: 900, queries: [{ query: "domandigital.co.uk" }, { query: "planner" }] }, { clientName: "Example" });
    expect(r.search).toMatchObject({ topQueries: ["planner"] });
    expect(r.excluded).toEqual(["domandigital.co.uk"]);
    expect(r.flags[0]).toMatchObject({ code: "excluded-query" });
  });
});

describe("visits", () => {
  it("zero sessions beside real clicks is a tracking check, not a number", () => {
    expect(visitsSummary(0, 1)).toEqual({ flags: [expect.objectContaining({ code: "tracking-check" })] });
  });

  it("shows sessions otherwise, and nothing without a source", () => {
    expect(visitsSummary(120, 4)).toEqual({ visits: { sessions: 120 }, flags: [] });
    expect(visitsSummary(0, 0)).toEqual({ visits: { sessions: 0 }, flags: [] });
    expect(visitsSummary(undefined, 4)).toEqual({ flags: [] });
  });
});
