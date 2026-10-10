/**
 * The Client Briefing data model. The output types (`Briefing` and what it
 * holds) are the brief of 8 October 2026, Step 2, with field names kept. The
 * input types (`RawInput`, `ClientConfig`) are what the box posts and what is
 * written by hand per client.
 */

// ---------------------------------------------------------------- output

export type Status = "ok" | "attention" | "issue";

/** Where a raw entry goes. Every entry lands in exactly one. */
export type Bucket = "needs-you" | "live" | "ready" | "maintenance";

/**
 * Client impact, used for ranking: visible to their customers, then security,
 * then privacy, then everything else. The brief's union plus `other`, which is
 * "everything else" given a name.
 */
export type ChangeKind = "visible" | "security" | "privacy" | "other" | "maintenance";

export type Action = { label: string; url: string };

export type Approval = {
  id: string;
  /** SHA-256 of the exact content being approved. A changed hash asks again. */
  version: string;
  title: string;
  why: string;
  /** Opens the review page. Never records a decision. */
  review: Action;
  secondary?: Action;
};

export type MilestoneStatus = "ready" | "waiting" | "next" | "planned";
export type Milestone = { label: string; status: MilestoneStatus };

export type Launch = {
  date: string;
  /** The countdown renders only when "confirmed". */
  state: "proposed" | "confirmed";
  milestones: Milestone[];
  /** "Wednesday 13 January". */
  dateLong: string;
  /** Days from the send date (Europe/London) to the launch. Confirmed only. */
  daysLeft?: number;
  /** "Awaiting your confirmation" while proposed. */
  pill?: string;
  /** "The countdown starts once you confirm." while proposed. */
  line?: string;
};

export type Change = {
  id: string;
  title: string;
  outcome: string;
  kind: ChangeKind;
  supersedes?: string[];
  /** Only ever on a visible change. */
  image?: { url: string; alt: string };
};

export type Uptime = {
  passed: number;
  total: number;
  failed: number;
  failures: { startedAt: string; minutes: number }[];
  intervalMinutes: number;
  /** "Every check passed" or "2 checks failed". */
  summary: string;
  /** Small print naming how the count was made. */
  smallPrint: string;
};

export type Speed = {
  median: number;
  runs: number;
  spread: number;
  band: "fast" | "middle" | "slow";
  /** "Fast. 90 and above is the top band." */
  bandLine: string;
  /** "Median of 5 phone tests on 8 October." */
  smallPrint: string;
  /** Present only when the move beats the site's spread and held for two sends. */
  change?: { from: number; to: number; direction: "up" | "down" };
};

export type Search =
  | { state: "low-data"; title: string; sentence: string }
  | { state: "numbers"; clicks: number; impressions: number; topQueries: string[] };

export type Visits = { sessions: number };

export type TrackRecord = {
  startDate: string;
  uptime?: { passed: number; total: number };
  speedBand?: { then: string; now: string };
  ordersHandled?: number;
  /** The rendered sentence, built from the clauses that qualified. */
  line: string;
};

export type Briefing = {
  client: { name: string; contactFirstName: string; signoffName: string };
  period: { start: string; end: string; sendAt: string };
  status: Status;
  /** "All good", "3 things need you", "Something needs fixing". */
  statusLabel: string;
  preheader: string;
  headline: string;
  subhead: string;
  approvals: Approval[];
  launch?: Launch;
  changes: Change[];
  featureImage?: { url: string; alt: string };
  // Built but not live yet ("ready") is not a section: those entries are in the
  // full log, and the launch milestones say what is ready in the client's words.
  maintenanceCount: number;
  /** Live changes past the cap of three. They are in the full log. */
  moreChangesCount: number;
  /** "Plus 2 more changes and 14 maintenance tasks behind the scenes." Empty when both are 0. */
  maintenanceLine: string;
  health: { uptime: Uptime; speed?: Speed; search: Search; visits?: Visits };
  trackRecord?: TrackRecord;
  note: string;
  urls: { log: string; webView: string };
  /** The order the template renders sections in. Needs you is never pushed down. */
  sections: Section[];
};

export type Section = "status" | "needs-you" | "launch" | "changes" | "health" | "track-record" | "note";

export type FlagCode =
  | "tracking-check"
  | "failed-checks"
  | "unresolved-supersession"
  | "launch-proposed"
  | "launch-date-mismatch"
  | "unmatched-approval"
  | "approvals-over-cap"
  | "missing-client-line"
  | "unreviewed-line"
  | "excluded-query"
  | "speed-runs";

/** What the founder's preview shows next to the draft. */
export type Flag = { code: FlagCode; message: string; refs?: string[] };

export type LogEntry = {
  ref: string;
  title: string;
  mergedAt: string;
  bucket: Bucket;
  kind: ChangeKind;
  /** Where it went in the briefing. "held": asks the client for something no approval stands for (flagged). */
  shownAs: "approval" | "change" | "overflow" | "ready" | "maintenance" | "superseded" | "merged" | "held";
  /** The group's lead entry, when this entry was merged or superseded. */
  groupedInto?: string;
  /** Why it was classified so: the rule that matched. */
  rule: string;
  text: string | null;
};

/** One supersession: an earlier fact replaced by a later one. */
export type Supersession = { ref: string; by: string; reason: string; from?: string; to?: string };

export type BriefingLog = {
  entries: LogEntry[];
  supersessions: Supersession[];
  excludedQueries: string[];
  derivations: string[];
};

// ---------------------------------------------------------------- input

/** One merged pull request, as the worklog holds it. */
export type RawEntry = {
  repo: string;
  number: number;
  title: string;
  mergedAt: string;
  /** The PR's "For the client" line. "none" means the author said nothing is for the client. */
  forClient: string | null;
  url?: string;
  /** The PR body, read only for its `## Briefing` block. */
  body?: string;
};

export type Incident = { startedAt: string; resolvedAt: string | null; reason?: string };

export type PageSpeedRun = { score: number; fetchTime: string; url: string; strategy: "mobile" | "desktop" };

export type LedgerEntry = {
  periodStart: string;
  periodEnd: string;
  uptime?: { passed: number; total: number };
  speed?: { median: number; spread: number };
  orders?: { count: number; verified: boolean };
};

export type RawInput = {
  period: { start: string; end: string; sendAt: string };
  /** When the data was read. Uptime is counted to this instant when it falls inside the period. */
  asOf?: string;
  entries: RawEntry[];
  /** Did-log notes keyed `repo#number`, used where a PR has no "For the client" line. Not author-written. */
  notes?: Record<string, string>;
  uptime: { monitorId?: string | number; intervalSeconds: number; incidents: Incident[] };
  speed?: {
    runs: PageSpeedRun[];
    /** Medians of earlier sends, oldest first. */
    history?: number[];
    /** The site's recorded run-to-run spread (highest minus lowest under identical conditions). */
    spread?: number;
  };
  search: {
    clicks: number;
    impressions: number;
    queries: { query: string; clicks?: number; impressions?: number }[];
  };
  analytics?: { sessions: number | null };
  ledger?: LedgerEntry[];
};

export type ApprovalConfig = {
  id: string;
  title: string;
  why: string;
  /** The exact content being approved. Its hash is the approval's version. */
  content: string;
  review: Action;
  secondary?: Action;
  /** Entries this approval stands for (`repo#number` or `#number`). They become this card, never a change. */
  sources?: string[];
};

export type ClientConfig = {
  slug: string;
  name: string;
  contactFirstName: string;
  signoffName: string;
  /** Hand-written. The build fails when it is empty. */
  headline: string;
  subhead: string;
  /** Hand-written. The build fails when it is empty. */
  note: string;
  approvals: ApprovalConfig[];
  launch?: { date: string; state: "proposed" | "confirmed"; milestones: Milestone[] };
  urls: { log: string; webView: string };
  /** Terms the client uses themselves, so the jargon rule lets them through. */
  allowedTerms?: string[];
  /** Search queries left out of top searches and logged. Default: `["domandigital"]`. */
  searchExclude?: string[];
  /** Off by default. Enable only with measured outcomes for this client. */
  trackRecordEnabled?: boolean;
  /** Default 1 for private client reports. Public or marketing claims still need a year. */
  trackRecordMinMonths?: number;
  /** Orders count only once sales are live. */
  salesLive?: boolean;
};

export type BuildResult = { briefing: Briefing; flags: Flag[]; log: BriefingLog };

/** A client without a monitor or Search Console omits that source, rather than sending zeroes. */
export type SparseRawInput = Omit<RawInput, "uptime" | "search"> & Partial<Pick<RawInput, "uptime" | "search">>;

/** Missing sources stay absent. Existing complete-input callers retain the Briefing contract. */
export type SparseBriefing = Omit<Briefing, "health"> & { health: Partial<Briefing["health"]> };
export type SparseBuildResult = Omit<BuildResult, "briefing"> & { briefing: SparseBriefing };
