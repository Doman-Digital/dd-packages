/**
 * The briefing's status, its pill, its preheader and the launch block's state.
 *
 * Any approval makes the status `attention`; any failed uptime check makes it
 * `issue`. "Nothing needed from you" exists only when there are no approvals,
 * and this module is the only place that can produce it.
 */

import { daysBetween, formatLong, londonDate } from "./dates";
import type { Approval, Launch, Status, Uptime } from "./types";

export function computeStatus(approvals: readonly unknown[], uptime: Pick<Uptime, "failed">): Status {
  if (uptime.failed > 0) return "issue";
  if (approvals.length > 0) return "attention";
  return "ok";
}

export function statusLabel(status: Status, approvalCount: number): string {
  if (status === "issue") return "Something needs fixing";
  if (approvalCount > 0) return `${approvalCount} ${approvalCount === 1 ? "thing needs" : "things need"} you`;
  return "All good";
}

export const NOTHING_NEEDED = "Nothing needed from you.";

/** The reassurance line, which may only exist with zero approvals. */
export function nothingNeededLine(approvals: readonly unknown[]): string {
  if (approvals.length > 0) {
    throw new Error(`"${NOTHING_NEEDED}" cannot be said with ${approvals.length} approval(s) waiting.`);
  }
  return NOTHING_NEEDED;
}

/** Inbox preview text. With approvals it leads with the count. */
export function preheader(headline: string, approvals: readonly Approval[], status: Status): string {
  if (approvals.length > 0) return `${statusLabel("attention", approvals.length)}. ${headline}`;
  if (status === "issue") return `${statusLabel(status, 0)}. ${headline}`;
  return headline;
}

const DECISION_WORDS = /\b(decisions?|decide|approve|approvals?|approving|confirm|confirmation|sign(?:-| )?off|need(?:s|ed)? you|your (?:ok|go-ahead|say))\b/i;
const NUMBER_WORDS = ["zero", "one", "two", "three"];

/** With approvals waiting, the headline has to point at them. */
export function headlineReferencesApprovals(headline: string, approvals: readonly Pick<Approval, "title">[]): boolean {
  if (approvals.length === 0) return true;
  if (DECISION_WORDS.test(headline)) return true;
  const count = new RegExp(`\\b(${approvals.length}|${NUMBER_WORDS[approvals.length] ?? "-"})\\s+(things?|items?)\\b`, "i");
  return count.test(headline);
}

export const LAUNCH_PROPOSED = { pill: "Awaiting your confirmation", line: "The countdown starts once you confirm." } as const;

/**
 * The launch block. Proposed: the date, a pill and the line, no countdown.
 * Confirmed: days left, counted in London from the send date, not the build date.
 */
export function launchView(
  launch: { date: string; state: "proposed" | "confirmed"; milestones: Launch["milestones"] },
  sendAt: string,
): Launch {
  const base = { date: launch.date, state: launch.state, milestones: launch.milestones, dateLong: formatLong(launch.date) };
  if (launch.state === "proposed") return { ...base, ...LAUNCH_PROPOSED };
  return { ...base, daysLeft: Math.max(0, daysBetween(londonDate(sendAt), launch.date)) };
}

export const MILESTONE_LABELS = { ready: "Ready", waiting: "Waiting for you", next: "Next", planned: "Planned" } as const;
