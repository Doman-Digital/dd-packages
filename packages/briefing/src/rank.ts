/**
 * Which live changes the client sees, in what order, and whether one gets a
 * picture. Ranked by impact on the client: visible to their customers, then
 * security, then privacy, then everything else; latest first within a kind.
 * At most three are shown; the rest are in the full log. Maintenance is a
 * count, never a list.
 */

import type { Group } from "./dedupe";
import type { Change, ChangeKind } from "./types";

export const MAX_CHANGES = 3;

export const KIND_ORDER: ChangeKind[] = ["visible", "security", "privacy", "other"];

/** Wording for a security group whose entries carry no client line of their own. */
export const SECURITY_FALLBACK = {
  title: "A security update",
  outcome: "We applied a security update to the software your site runs on.",
};

const firstSentence = (text: string) => {
  const m = /^(.+?[.!?])(\s+|$)([\s\S]*)$/.exec(text.trim());
  return m ? { head: m[1]!.trim(), rest: m[3]!.trim() } : { head: text.trim(), rest: "" };
};

/**
 * A group as a client-facing change. Title and outcome come from the
 * `## Briefing` block when there is one; otherwise the line's first sentence is
 * the title and the rest the outcome.
 */
export function toChange(group: Group): Change | undefined {
  let title: string;
  let outcome: string;
  if (group.title) {
    title = group.title;
    outcome = group.text ?? (group.kind === "security" ? SECURITY_FALLBACK.outcome : "");
  } else if (group.text) {
    const { head, rest } = firstSentence(group.text);
    title = head.replace(/[.]$/, "");
    outcome = rest;
  } else if (group.kind === "security") {
    ({ title, outcome } = SECURITY_FALLBACK);
  } else {
    return undefined;
  }
  const supersedes = group.members.filter((m) => m !== group.lead).map((m) => m.ref);
  return {
    id: group.id,
    title,
    outcome,
    kind: group.kind,
    ...(supersedes.length ? { supersedes } : {}),
    // Pictures belong to visible changes only.
    ...(group.image && group.kind === "visible" ? { image: group.image } : {}),
  };
}

export type Ranked = {
  shown: Change[];
  overflow: Change[];
  featureImage?: { url: string; alt: string };
};

export function rankChanges(live: Group[]): Ranked {
  const order = (g: Group) => {
    const i = KIND_ORDER.indexOf(g.kind);
    return i === -1 ? KIND_ORDER.length : i;
  };
  const sorted = [...live].sort((a, b) => order(a) - order(b) || b.lead.entry.mergedAt.localeCompare(a.lead.entry.mergedAt));
  const changes = sorted.map(toChange).filter((c): c is Change => !!c);
  const shown = changes.slice(0, MAX_CHANGES);
  const top = shown[0];
  // The picture goes with the top change or not at all: never a weaker change because it has one.
  const featureImage = top && top.kind === "visible" && top.image ? top.image : undefined;
  return { shown, overflow: changes.slice(MAX_CHANGES), ...(featureImage ? { featureImage } : {}) };
}

/** The line under the changes. Live changes past the cap are counted here, never hidden. */
export function maintenanceLine(maintenance: number, moreChanges = 0): string {
  const more = moreChanges > 0 ? `${moreChanges} more ${moreChanges === 1 ? "change" : "changes"}` : "";
  const tasks = maintenance > 0 ? `${maintenance} maintenance ${maintenance === 1 ? "task" : "tasks"} behind the scenes` : "";
  if (!more && !tasks) return "";
  return `Plus ${[more, tasks].filter(Boolean).join(" and ")}.`;
}
