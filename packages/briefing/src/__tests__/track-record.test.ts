import { describe, expect, it } from "vitest";
import { buildTrackRecord, DEFAULT_MIN_MONTHS } from "../track-record";
import type { LedgerEntry } from "../types";

const fortnight = (start: string, end: string, extra: Partial<LedgerEntry> = {}): LedgerEntry => ({
  periodStart: start,
  periodEnd: end,
  uptime: { passed: 4032, total: 4032 },
  ...extra,
});
const twoMonths: LedgerEntry[] = [
  fortnight("2026-09-27", "2026-10-10", { speed: { median: 62, spread: 4 }, orders: { count: 3, verified: true } }),
  fortnight("2026-10-11", "2026-10-24", { orders: { count: 5, verified: true } }),
  fortnight("2026-10-25", "2026-11-07", { orders: { count: 4, verified: true } }),
  fortnight("2026-11-08", "2026-11-21", { speed: { median: 96, spread: 3 }, orders: { count: 6, verified: true } }),
];

describe("gates", () => {
  it("is off by default, whatever the data", () => {
    expect(buildTrackRecord(twoMonths, {})).toEqual({ reason: "Track record is off for this client (trackRecordEnabled is false)." });
  });

  it("needs a full month of comparable data by default", () => {
    expect(DEFAULT_MIN_MONTHS).toBe(1);
    expect(buildTrackRecord(twoMonths.slice(0, 2), { trackRecordEnabled: true }).trackRecord).toBeUndefined();
    expect(buildTrackRecord(twoMonths.slice(0, 3), { trackRecordEnabled: true }).trackRecord).toBeDefined();
  });

  it("takes the minimum as a setting: a year (DIRECTION.md section 4) holds it back", () => {
    const r = buildTrackRecord(twoMonths, { trackRecordEnabled: true, trackRecordMinMonths: 12 });
    expect(r.trackRecord).toBeUndefined();
    expect(r.reason).toMatch(/Less than 12 full months/);
  });

  it("a gap in the record means the data is not comparable", () => {
    const gappy = [twoMonths[0]!, twoMonths[2]!, twoMonths[3]!];
    expect(buildTrackRecord(gappy, { trackRecordEnabled: true }).reason).toMatch(/Gap in the record/);
  });

  it("nothing stored, nothing shown", () => {
    expect(buildTrackRecord(undefined, { trackRecordEnabled: true }).reason).toBe("No measured outcomes stored yet.");
  });
});

describe("clauses: measured outcomes only", () => {
  it("sums uptime and names a speed band change beyond the spread", () => {
    const r = buildTrackRecord(twoMonths, { trackRecordEnabled: true });
    expect(r.trackRecord!.line).toBe("Since 27 September: 16,128 of 16,128 uptime checks passed. Phone speed middle band then, fast now.");
    expect(r.trackRecord!.ordersHandled).toBeUndefined();
  });

  it("no speed clause when the band did not change", () => {
    const same = twoMonths.map((e, i) => (i === 3 ? { ...e, speed: { median: 70, spread: 3 } } : e));
    expect(buildTrackRecord(same, { trackRecordEnabled: true }).trackRecord!.line).not.toMatch(/speed/i);
  });

  it("orders only once sales are live, and only when every count is verified", () => {
    expect(buildTrackRecord(twoMonths, { trackRecordEnabled: true, salesLive: true }).trackRecord!.line).toMatch(/18 orders handled\.$/);
    const unverified = twoMonths.map((e, i) => (i === 1 ? { ...e, orders: { count: 5, verified: false } } : e));
    expect(buildTrackRecord(unverified, { trackRecordEnabled: true, salesLive: true }).trackRecord!.line).not.toMatch(/orders/);
  });

  it("never counts changes or tasks", () => {
    const line = buildTrackRecord(twoMonths, { trackRecordEnabled: true, salesLive: true }).trackRecord!.line;
    expect(line).not.toMatch(/\b(changes?|improvements?|tasks?|updates?)\b/i);
  });
});
