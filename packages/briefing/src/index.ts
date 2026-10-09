export { buildBriefing, sectionOrder, BriefingBuildError, MAX_APPROVALS } from "./build";

export { classifyEntry, classifyEntries, parseBriefingBlock, refOf, resolveRef } from "./classify";
export type { BriefingBlock, ClassifiedEntry } from "./classify";

export { dedupe, similarity, contentWords, SIMILARITY_THRESHOLD } from "./dedupe";
export type { Group, DedupeResult } from "./dedupe";

export { rankChanges, toChange, maintenanceLine, MAX_CHANGES, KIND_ORDER, SECURITY_FALLBACK } from "./rank";
export type { Ranked } from "./rank";

export {
  computeStatus,
  statusLabel,
  nothingNeededLine,
  preheader,
  headlineReferencesApprovals,
  launchView,
  NOTHING_NEEDED,
  LAUNCH_PROPOSED,
  MILESTONE_LABELS,
} from "./status";

export {
  uptimeFromIncidents,
  speedFromRuns,
  speedBand,
  distinctRuns,
  median,
  searchSummary,
  lowDataSentence,
  visitsSummary,
  MIN_SPEED_RUNS,
  LOW_DATA,
} from "./metrics";
export type { SpeedResult, SearchResult, VisitsResult } from "./metrics";

export {
  lintText,
  lintDates,
  lintBriefing,
  assertLintClean,
  readableFields,
  headlineIsSpecific,
  BriefingLintError,
  NEGATIVE_REASSURANCES,
  DIRECTION_BANNED,
  JARGON,
  ALLOWED_STATUS_LABELS,
  EVENTS,
} from "./lint";
export type { LintFinding, LintRule } from "./lint";

export { buildTrackRecord, DEFAULT_MIN_MONTHS } from "./track-record";
export type { TrackRecordResult } from "./track-record";

export { londonMidnight, londonDate, londonOffsetMinutes, daysBetween, formatLong, findDates, TIME_ZONE } from "./dates";
export type { DateMention } from "./dates";

export { sha256Hex } from "./hash";

export type * from "./types";
