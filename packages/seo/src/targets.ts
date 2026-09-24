/**
 * Per-page keyword targets: what a page is trying to rank for. The register
 * of *observed* performance against these targets (GSC positions over time)
 * lives in the portal DB, not here — this module only knows the target
 * declarations themselves and how to spot the one mistake that's easy to
 * make by hand: two routes silently targeting the same primary keyword.
 */

export type TargetIntent = "informational" | "commercial" | "transactional" | "local";

export type PageTarget = {
  routeKey: string;
  primaryKeyword: string;
  secondaryKeywords?: string[];
  intent?: TargetIntent;
  /** Free-text geo qualifier, e.g. a town or city name. Present on local-intent targets. */
  geo?: string;
};

export function getTargetForRoute(
  targets: PageTarget[],
  routeKey: string,
): PageTarget | undefined {
  return targets.find((t) => t.routeKey === routeKey);
}

export type KeywordCannibalization = {
  /** The keyword as first written in `targets`. Grouping ignores case and spacing. */
  primaryKeyword: string;
  routeKeys: string[];
};

/** Case- and whitespace-insensitive form used for grouping. */
function keywordKey(keyword: string): string {
  return keyword.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Routes that declare the same primaryKeyword, compared case-insensitively
 * with whitespace collapsed ("Website Audit" and "website  audit" are one
 * keyword).
 *
 * This is a check on your own targeting, not a model of a search penalty.
 * Google documents no "keyword cannibalisation" penalty; the practical risk
 * is two pages written for one query, where neither is the clear best
 * answer and effort is split between them. Treat a hit as a question (merge
 * them, or retarget one), not as proof that either page is being held back.
 * `allowlist` is for the deliberate exception (e.g. a pillar page and a
 * comparison page both legitimately about the same head term) and is
 * matched the same way.
 */
export function findKeywordCannibalization(
  targets: PageTarget[],
  allowlist: string[] = [],
): KeywordCannibalization[] {
  const allowed = new Set(allowlist.map(keywordKey));
  const byKeyword = new Map<string, KeywordCannibalization>();
  for (const t of targets) {
    const key = keywordKey(t.primaryKeyword);
    if (allowed.has(key)) continue;
    const existing = byKeyword.get(key);
    if (existing) existing.routeKeys.push(t.routeKey);
    else byKeyword.set(key, { primaryKeyword: t.primaryKeyword, routeKeys: [t.routeKey] });
  }
  return [...byKeyword.values()].filter((group) => group.routeKeys.length > 1);
}
