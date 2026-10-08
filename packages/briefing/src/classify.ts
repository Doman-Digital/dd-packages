/**
 * Every raw entry becomes needs-you, live, ready or maintenance, with a kind
 * for ranking. The rules read the PR title and its "For the client" line; a
 * `## Briefing` block in the PR body overrides them, so an author can be exact
 * where a rule would guess.
 *
 *   ## Briefing
 *   kind: visible
 *   supersedes: #44
 *   title: Your home page opens faster on phones
 *   outcome: Phones and tablets skip the intro video and go straight to your shop.
 *   image: https://briefings.example/client/home.png | The home page on a phone
 */

import type { Bucket, ChangeKind, RawEntry } from "./types";

export type BriefingBlock = {
  bucket?: Bucket;
  kind?: ChangeKind;
  supersedes?: string[];
  title?: string;
  outcome?: string;
  image?: { url: string; alt: string };
};

export type ClassifiedEntry = {
  ref: string;
  entry: RawEntry;
  bucket: Bucket;
  kind: ChangeKind;
  /** The client-facing line: the PR's own, else a did-log note, else null. */
  text: string | null;
  /** Where `text` came from. A note was not written by the PR's author. */
  textSource: "pr" | "note" | "block" | null;
  title?: string;
  outcome?: string;
  image?: { url: string; alt: string };
  supersedes: string[];
  /** The line asks the client for something. */
  approvalCandidate: boolean;
  /** The rule that decided the bucket, for the log. */
  rule: string;
  /** A feature or fix with no client line at all: worth a look before sending. */
  missingLine: boolean;
};

export const refOf = (e: Pick<RawEntry, "repo" | "number">) => `${e.repo}#${e.number}`;

/** `#44`, `44` or `owner/repo#44` resolved against the entry's own repo. */
export function resolveRef(ref: string, repo: string): string {
  const s = ref.trim();
  const local = /^#?(\d+)$/.exec(s);
  if (local) return `${repo}#${local[1]}`;
  return s;
}

const KIND_WORDS: Record<string, { bucket: Bucket; kind?: ChangeKind }> = {
  "needs-you": { bucket: "needs-you" },
  approval: { bucket: "needs-you" },
  live: { bucket: "live" },
  ready: { bucket: "ready" },
  maintenance: { bucket: "maintenance", kind: "maintenance" },
  visible: { bucket: "live", kind: "visible" },
  security: { bucket: "live", kind: "security" },
  privacy: { bucket: "live", kind: "privacy" },
  other: { bucket: "live", kind: "other" },
};

/**
 * Reads the `## Briefing` block: from that heading to the next heading or the
 * end. Unknown keys are ignored; an unknown kind is an error, because a typo
 * there would silently fall back to the rules.
 */
export function parseBriefingBlock(body: string | undefined): BriefingBlock | undefined {
  if (!body) return undefined;
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((l) => /^#{1,6}\s+briefing\s*$/i.test(l.trim()));
  if (start === -1) return undefined;
  const block: BriefingBlock = {};
  for (const raw of lines.slice(start + 1)) {
    const line = raw.trim();
    if (/^#{1,6}\s/.test(line)) break;
    const m = /^[-*]?\s*([a-z-]+)\s*:\s*(.+)$/i.exec(line);
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    const value = m[2]!.trim();
    if (key === "kind") {
      const k = KIND_WORDS[value.toLowerCase()];
      if (!k) throw new Error(`Unknown Briefing kind "${value}". Use one of: ${Object.keys(KIND_WORDS).join(", ")}`);
      block.bucket = k.bucket;
      if (k.kind) block.kind = k.kind;
    } else if (key === "supersedes") {
      block.supersedes = value.split(/[,\s]+/).filter(Boolean);
    } else if (key === "title") {
      block.title = value;
    } else if (key === "outcome") {
      block.outcome = value;
    } else if (key === "image") {
      const [url, alt] = value.split("|").map((s) => s.trim());
      if (!url || !alt) throw new Error("A Briefing image needs a URL and alt text: `image: <url> | <alt text>`");
      block.image = { url, alt };
    }
  }
  return block;
}

const CONVENTIONAL = /^(\w+)(?:\(([^)]*)\))?!?:/;
const HOUSEKEEPING_TYPES = new Set(["chore", "ci", "docs", "test", "tests", "build", "style", "refactor"]);

/** The PR's own line, or a did-log note. "none" (any case) means nothing for the client. */
function clientLine(entry: RawEntry, notes?: Record<string, string>): { text: string | null; source: "pr" | "note" | null; saidNone: boolean } {
  const own = entry.forClient?.trim();
  if (own) return /^none\.?$/i.test(own) ? { text: null, source: null, saidNone: true } : { text: own, source: "pr", saidNone: false };
  const note = notes?.[refOf(entry)]?.trim();
  if (note) return /^none\.?$/i.test(note) ? { text: null, source: null, saidNone: true } : { text: note, source: "note", saidNone: false };
  return { text: null, source: null, saidNone: false };
}

const ASKS = [
  /\?\s*$/,
  /\bplease\s+(confirm|approve|check|let us know|choose|decide|reply)\b/i,
  /\buntil you\s+(confirm|approve|say so|sign off|have\s+(read and\s+)?approved)\b/i,
  /\bonce you\s+(confirm|approve)\b/i,
];
const NOT_LIVE = [/\bnot live yet\b/i, /\bnot yet live\b/i, /\bwill switch over\b/i, /\bswitch over\b/i, /\bnothing changes on the live site yet\b/i];
const MAINTENANCE_WORDS = /\b(housekeeping|error monitoring|source maps?|sentry|monitoring settings?)\b/i;
const SECURITY = /\bsecurity\b|\bCVE\b|\bvulnerab/i;
const PRIVACY = /\bprivacy\b|\bconsent\b|\bcookies?\b|\banalytics\b|\bGDPR\b|\bpersonal data\b/i;
const VISIBLE = /\b(visitors?|customers?|home ?page|pages?|phones?|tablets?|desktops?|screens?|menu|photos?|images?)\b/i;

function kindFor(title: string, text: string, type: string | undefined): ChangeKind {
  const both = `${title}\n${text}`;
  if (SECURITY.test(both)) return "security";
  if (PRIVACY.test(both)) return "privacy";
  if (type === "feat" || type === "perf" || VISIBLE.test(text)) return "visible";
  return "other";
}

export function classifyEntry(entry: RawEntry, notes?: Record<string, string>): ClassifiedEntry {
  const ref = refOf(entry);
  const block = parseBriefingBlock(entry.body);
  const line = clientLine(entry, notes);
  const conv = CONVENTIONAL.exec(entry.title);
  const type = conv?.[1]?.toLowerCase();
  const scope = conv?.[2]?.toLowerCase();
  const text = line.text;
  const approvalCandidate = !!text && ASKS.some((r) => r.test(text));

  const base = {
    ref,
    entry,
    text: block?.outcome ?? text,
    textSource: (block?.outcome ? "block" : line.source) as ClassifiedEntry["textSource"],
    supersedes: (block?.supersedes ?? []).map((r) => resolveRef(r, entry.repo)),
    approvalCandidate,
    missingLine: false,
    ...(block?.title ? { title: block.title } : {}),
    ...(block?.outcome ? { outcome: block.outcome } : {}),
    ...(block?.image ? { image: block.image } : {}),
  };

  const ruled = ((): Pick<ClassifiedEntry, "bucket" | "kind" | "rule" | "missingLine"> => {
    // Security dependency bumps are client-relevant even as chores.
    if ((type === "chore" || type === "fix" || type === "build") && scope === "deps" && SECURITY.test(entry.title + (text ?? ""))) {
      return { bucket: "live", kind: "security", rule: "dependency security update", missingLine: false };
    }
    if (type && HOUSEKEEPING_TYPES.has(type)) return { bucket: "maintenance", kind: "maintenance", rule: `${type}: title`, missingLine: false };
    if (!text) {
      const missing = !line.saidNone;
      return { bucket: "maintenance", kind: "maintenance", rule: line.saidNone ? "author said none for the client" : "no client line", missingLine: missing }; // copy-ok: rule name for the log
    }
    if (approvalCandidate) return { bucket: "needs-you", kind: kindFor(entry.title, text, type), rule: "asks the client", missingLine: false };
    if (NOT_LIVE.some((r) => r.test(text))) return { bucket: "ready", kind: kindFor(entry.title, text, type), rule: "built, not live yet", missingLine: false };
    if (MAINTENANCE_WORDS.test(`${entry.title}\n${text}`)) return { bucket: "maintenance", kind: "maintenance", rule: "monitoring or housekeeping", missingLine: false };
    return { bucket: "live", kind: kindFor(entry.title, text, type), rule: "live change", missingLine: false };
  })();

  if (block?.bucket) {
    const kind: ChangeKind = block.kind ?? (block.bucket === "maintenance" ? "maintenance" : ruled.kind === "maintenance" ? "other" : ruled.kind);
    return { ...base, bucket: block.bucket, kind, rule: "## Briefing block", missingLine: false };
  }
  if (block?.kind) return { ...base, ...ruled, kind: block.kind, rule: `${ruled.rule}, kind from ## Briefing block` };
  return { ...base, ...ruled };
}

export function classifyEntries(entries: RawEntry[], notes?: Record<string, string>): ClassifiedEntry[] {
  return entries.map((e) => classifyEntry(e, notes));
}
