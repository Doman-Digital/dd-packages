/**
 * Entries about the same change become one item, and a decision that changed
 * during the period shows only its latest form. What was merged or replaced
 * stays in the full log as a supersession chain.
 *
 * Entries join a group when:
 *  - one names another in its `## Briefing` block (`supersedes: #44`);
 *  - one moves a date ("from 18 November to Wednesday 13 January") that an
 *    earlier one stated;
 *  - both are live security updates (two in a period are one item);
 *  - both have the same bucket and kind and mostly the same words.
 *
 * The latest entry leads its group: latest fact wins.
 */

import type { ClassifiedEntry } from "./classify";
import { findDates, sameDate } from "./dates";
import type { Bucket, ChangeKind, Supersession } from "./types";

export type Group = {
  /** The lead entry's ref. */
  id: string;
  lead: ClassifiedEntry;
  /** Oldest first. */
  members: ClassifiedEntry[];
  bucket: Bucket;
  kind: ChangeKind;
  title?: string;
  text: string | null;
  textSource: ClassifiedEntry["textSource"];
  image?: { url: string; alt: string };
  /** Refs named by `supersedes` that are not in this period. */
  supersedesOutside: string[];
  approvalCandidate: boolean;
};

export type DedupeResult = {
  groups: Group[];
  supersessions: Supersession[];
  /** Human-readable reasons a supersession could not be settled from the entries. */
  unresolved: { message: string; refs: string[] }[];
};

const STOP = new Set(
  "about after again also been before being both could does from have here into just like more most much once only other over same some such than that their them then there these they this those through very want were what when where which while will with would your yours you're we've we'll".split(" "),
);

export function contentWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOP.has(w)),
  );
}

export function similarity(a: string, b: string): number {
  const [x, y] = [contentWords(a), contentWords(b)];
  if (!x.size || !y.size) return 0;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared++;
  return shared / (x.size + y.size - shared);
}

/** Two lines describe the same change at or above this word overlap. */
export const SIMILARITY_THRESHOLD = 0.5;

const DATE_MOVE = /\bfrom\s+(.+?)\s+to\s+(.+?)(?=[.,;]|$)/gi;

export function dedupe(entries: ClassifiedEntry[]): DedupeResult {
  const sorted = [...entries].sort((a, b) => a.entry.mergedAt.localeCompare(b.entry.mergedAt));
  const byRef = new Map(sorted.map((e) => [e.ref, e]));
  const parent = new Map(sorted.map((e) => [e.ref, e.ref]));
  const find = (r: string): string => {
    let p = parent.get(r)!;
    while (p !== parent.get(p)) p = parent.get(p)!;
    parent.set(r, p);
    return p;
  };
  const union = (a: string, b: string) => parent.set(find(a), find(b));
  const supersessions: Supersession[] = [];
  const unresolved: DedupeResult["unresolved"] = [];
  const outside = new Map<string, string[]>();
  const dateMoved = new Set<string>();

  for (const e of sorted) {
    for (const target of e.supersedes) {
      if (byRef.has(target)) {
        union(target, e.ref);
        supersessions.push({ ref: target, by: e.ref, reason: "named in the ## Briefing block" });
      } else {
        outside.set(e.ref, [...(outside.get(e.ref) ?? []), target]);
        unresolved.push({ message: `${e.ref} says it supersedes ${target}, which is not in this period. Check the earlier briefing.`, refs: [e.ref, target] });
      }
    }
  }

  for (const e of sorted) {
    for (const move of e.text?.matchAll(DATE_MOVE) ?? []) {
      const [fromDate] = findDates(move[1]!);
      const [toDate] = findDates(move[2]!);
      if (!fromDate || !toDate) continue;
      for (const earlier of sorted) {
        if (earlier === e || earlier.entry.mergedAt > e.entry.mergedAt || !earlier.text) continue;
        if (findDates(earlier.text).some((d) => sameDate(d, fromDate))) {
          union(earlier.ref, e.ref);
          dateMoved.add(earlier.ref).add(e.ref);
          supersessions.push({ ref: earlier.ref, by: e.ref, reason: "date moved", from: fromDate.text, to: toDate.text });
        }
      }
    }
  }

  const security = sorted.filter((e) => e.bucket === "live" && e.kind === "security");
  for (const e of security.slice(1)) {
    union(security[0]!.ref, e.ref);
    supersessions.push({ ref: security[0]!.ref, by: e.ref, reason: "security updates in one period are one item" });
  }

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const [a, b] = [sorted[i]!, sorted[j]!];
      if (a.bucket === "maintenance" || a.bucket !== b.bucket || a.kind !== b.kind || !a.text || !b.text) continue;
      if (find(a.ref) === find(b.ref)) continue;
      if (similarity(a.text, b.text) >= SIMILARITY_THRESHOLD) {
        union(a.ref, b.ref);
        supersessions.push({ ref: a.ref, by: b.ref, reason: "same change, described twice" });
      }
    }
  }

  const members = new Map<string, ClassifiedEntry[]>();
  for (const e of sorted) members.set(find(e.ref), [...(members.get(find(e.ref)) ?? []), e]);

  const groups: Group[] = [];
  for (const list of members.values()) {
    const lead = list[list.length - 1]!;
    const latestWith = <K extends keyof ClassifiedEntry>(k: K) => [...list].reverse().find((m) => m[k] !== undefined && m[k] !== null)?.[k];
    const withText = [...list].reverse().find((m) => m.text);

    // Two different dates inside one group with no move between them: nobody said which is current.
    const dated = list.filter((m) => m.text && !dateMoved.has(m.ref)).flatMap((m) => findDates(m.text!).filter((d) => d.day).map((d) => ({ d, ref: m.ref })));
    const distinct = dated.filter((x, i) => dated.findIndex((y) => sameDate(x.d, y.d)) === i);
    if (distinct.length > 1 && new Set(distinct.map((x) => x.ref)).size > 1) {
      unresolved.push({
        message: `Different dates in entries about one change (${distinct.map((x) => `${x.d.text} in ${x.ref}`).join(", ")}) and none says which replaced which.`,
        refs: distinct.map((x) => x.ref),
      });
    }

    groups.push({
      id: lead.ref,
      lead,
      members: list,
      bucket: lead.bucket,
      kind: lead.kind,
      ...(latestWith("title") ? { title: latestWith("title") as string } : {}),
      text: withText?.text ?? null,
      textSource: withText?.textSource ?? null,
      ...(latestWith("image") ? { image: latestWith("image") as Group["image"] } : {}),
      supersedesOutside: list.flatMap((m) => outside.get(m.ref) ?? []),
      approvalCandidate: list.some((m) => m.approvalCandidate),
    });
  }

  return { groups, supersessions, unresolved };
}
