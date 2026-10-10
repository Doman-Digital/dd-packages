/**
 * The track record: measured outcomes since a client started, never a count
 * of changes, improvements or tasks.
 *
 * Two gates:
 *  - `trackRecordEnabled` on the client config, false by default;
 *  - the data gate: comparable data covering `trackRecordMinMonths` full months.
 *
 * The founder's ruling of 9 October 2026 permits one full month of the client's
 * own measured data in a private report to that client. The year rule in
 * DIRECTION.md section 4 still applies to public or marketing claims.
 */

import { addMonths, formatShort, nextDay } from "./dates";
import { speedBand } from "./metrics";
import type { ClientConfig, LedgerEntry, TrackRecord } from "./types";

export const DEFAULT_MIN_MONTHS = 1;

export type TrackRecordResult = { trackRecord?: TrackRecord; reason: string };

const bandName = (score: number) => speedBand(score).bandLine.split(".")[0]!;

export function buildTrackRecord(
  ledger: LedgerEntry[] | undefined,
  config: Pick<ClientConfig, "trackRecordEnabled" | "trackRecordMinMonths" | "salesLive">,
): TrackRecordResult {
  if (!config.trackRecordEnabled) return { reason: "Track record is off for this client (trackRecordEnabled is false)." };
  const entries = [...(ledger ?? [])].sort((a, b) => a.periodStart.localeCompare(b.periodStart));
  if (!entries.length) return { reason: "No measured outcomes stored yet." };

  const months = config.trackRecordMinMonths ?? DEFAULT_MIN_MONTHS;
  const start = entries[0]!.periodStart;
  const end = entries[entries.length - 1]!.periodEnd;
  // Periods must join up: a gap means the data is not comparable across it.
  for (let i = 1; i < entries.length; i++) {
    if (entries[i]!.periodStart > nextDay(entries[i - 1]!.periodEnd)) {
      return { reason: `Gap in the record between ${entries[i - 1]!.periodEnd} and ${entries[i]!.periodStart}.` };
    }
  }
  if (addMonths(start, months) > nextDay(end)) {
    return { reason: `Less than ${months} full month${months === 1 ? "" : "s"} of comparable data (${start} to ${end}).` };
  }

  const clauses: string[] = [];
  const record: Omit<TrackRecord, "line"> = { startDate: start };

  if (entries.every((e) => e.uptime)) {
    const passed = entries.reduce((n, e) => n + e.uptime!.passed, 0);
    const total = entries.reduce((n, e) => n + e.uptime!.total, 0);
    record.uptime = { passed, total };
    clauses.push(`${passed.toLocaleString("en-GB")} of ${total.toLocaleString("en-GB")} uptime checks passed.`);
  }

  const speeds = entries.filter((e) => e.speed);
  if (speeds.length >= 2) {
    const first = speeds[0]!.speed!;
    const last = speeds[speeds.length - 1]!.speed!;
    const spread = Math.max(first.spread, last.spread);
    const [then, now] = [bandName(first.median), bandName(last.median)];
    // Only a move bigger than the measured spread that also changed band is worth a clause.
    if (Math.abs(last.median - first.median) > spread && then !== now) {
      record.speedBand = { then, now };
      clauses.push(`Phone speed ${then.toLowerCase()} then, ${now.toLowerCase()} now.`);
    }
  }

  if (config.salesLive) {
    const orders = entries.filter((e) => e.orders);
    if (orders.length && orders.every((e) => e.orders!.verified)) {
      record.ordersHandled = orders.reduce((n, e) => n + e.orders!.count, 0);
      clauses.push(`${record.ordersHandled.toLocaleString("en-GB")} orders handled.`);
    }
  }

  if (!clauses.length) return { reason: "Held back: every clause failed its test." };
  return { trackRecord: { ...record, line: `Since ${formatShort(start)}: ${clauses.join(" ")}` }, reason: "Shown." };
}
