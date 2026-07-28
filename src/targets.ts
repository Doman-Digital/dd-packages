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
  /** Free-text geo qualifier, e.g. "Brackley" or "High Wycombe". Present on local-intent targets. */
  geo?: string;
};

export function getTargetForRoute(
  targets: PageTarget[],
  routeKey: string,
): PageTarget | undefined {
  return targets.find((t) => t.routeKey === routeKey);
}

export type KeywordCannibalization = {
  primaryKeyword: string;
  routeKeys: string[];
};

/**
 * Routes that share an identical primaryKeyword. Two pages both explicitly
 * targeting the same term almost always means one of them shouldn't be, or
 * the two need to be merged — search engines pick one to rank and the
 * other's work is wasted. `allowlist` is for the rare deliberate exception
 * (e.g. a pillar page and a comparison page both legitimately mentioning the
 * same head term).
 */
export function findKeywordCannibalization(
  targets: PageTarget[],
  allowlist: string[] = [],
): KeywordCannibalization[] {
  const byKeyword = new Map<string, string[]>();
  for (const t of targets) {
    if (allowlist.includes(t.primaryKeyword)) continue;
    const existing = byKeyword.get(t.primaryKeyword) ?? [];
    existing.push(t.routeKey);
    byKeyword.set(t.primaryKeyword, existing);
  }
  return [...byKeyword.entries()]
    .filter(([, routeKeys]) => routeKeys.length > 1)
    .map(([primaryKeyword, routeKeys]) => ({ primaryKeyword, routeKeys }));
}
