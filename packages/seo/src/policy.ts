/**
 * Route policy: indexability and sitemap-inclusion decisions for a known set
 * of routes. The route data itself (the actual RoutePolicyEntry[] array)
 * stays per-repo — this module only knows how to look entries up and derive
 * a sitemap from them.
 */

import { normalizeRoutePath } from "./normalize";

export type RoutePolicyEntry = {
  path: string;
  indexable: boolean;
  inSitemap: boolean;
  reason?: string;
  canonicalPath?: string;
  isDynamicPattern?: boolean;
  /**
   * @deprecated Google ignores `<priority>` in sitemaps ("Build and submit a
   * sitemap", Google Search Central). Kept so existing policies compile;
   * setting it changes nothing in search. Removal only in a later major.
   */
  sitemapPriority?: number;
  /**
   * @deprecated Google ignores `<changefreq>` in sitemaps. An accurate
   * `<lastmod>` is the signal Google uses. Removal only in a later major.
   */
  sitemapChangeFrequency?: "daily" | "weekly" | "monthly" | "yearly";
};

/** Routes that should appear in a generated sitemap.xml (inSitemap === true, non-pattern). */
export function getSitemapRoutes(policy: RoutePolicyEntry[]): RoutePolicyEntry[] {
  return policy.filter((r) => r.inSitemap && !r.isDynamicPattern);
}

/**
 * Look up the policy for a given path. Pattern entries match via prefix (e.g.
 * /locations/*). Both sides are compared after `normalizeRoutePath`, so
 * `/pricing/`, `/pricing?ref=x` and `/pricing#faq` find the `/pricing` entry
 * (a trailing slash never names a different route in Next.js).
 */
export function getRoutePolicy(
  policy: RoutePolicyEntry[],
  path: string,
): RoutePolicyEntry | undefined {
  const key = normalizeRoutePath(path);
  const exact = policy.find((r) => normalizeRoutePath(r.path) === key);
  if (exact) return exact;

  return policy.find((r) => {
    if (!r.isDynamicPattern) return false;
    const prefix = r.path.replace(/\/\*$/, "");
    return key.startsWith(prefix + "/");
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
