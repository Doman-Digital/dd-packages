/**
 * Route policy: indexability and sitemap-inclusion decisions for a known set
 * of routes. The route data itself (the actual RoutePolicyEntry[] array)
 * stays per-repo — this module only knows how to look entries up and derive
 * a sitemap from them.
 */

export type RoutePolicyEntry = {
  path: string;
  indexable: boolean;
  inSitemap: boolean;
  reason?: string;
  canonicalPath?: string;
  isDynamicPattern?: boolean;
  sitemapPriority?: number;
  sitemapChangeFrequency?: "daily" | "weekly" | "monthly" | "yearly";
};

/** Routes that should appear in a generated sitemap.xml (inSitemap === true, non-pattern). */
export function getSitemapRoutes(policy: RoutePolicyEntry[]): RoutePolicyEntry[] {
  return policy.filter((r) => r.inSitemap && !r.isDynamicPattern);
}

/** Look up the policy for a given path. Pattern entries match via prefix (e.g. /locations/*). */
export function getRoutePolicy(
  policy: RoutePolicyEntry[],
  path: string,
): RoutePolicyEntry | undefined {
  const exact = policy.find((r) => r.path === path);
  if (exact) return exact;

  return policy.find((r) => {
    if (!r.isDynamicPattern) return false;
    const prefix = r.path.replace(/\/\*$/, "");
    return path.startsWith(prefix + "/");
  });
}

/**
 * Whether a route should be indexable. Defaults to true for routes with no
 * policy entry — deliberately: throwing or defaulting to false at request
 * time would turn a missing policy entry (a documentation gap) into a
 * production incident (metadata generation failing mid-request for a page
 * that otherwise works fine). Unknown routes ARE an error, but that error
 * belongs in validateCoverage (validate.ts), which runs in CI before a
 * missing entry ships — not in this runtime path. This is the fix for the
 * bug that shipped six case studies indexable-but-unsubmitted: the runtime
 * default staying permissive is fine as long as something actually checks
 * for the gap before merge.
 */
export function isRouteIndexable(policy: RoutePolicyEntry[], path: string): boolean {
  const found = getRoutePolicy(policy, path);
  return found ? found.indexable : true;
}
