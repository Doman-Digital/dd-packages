/**
 * Route policy: indexability and sitemap-inclusion decisions for a known set
 * of routes. The route data itself (the actual RoutePolicyEntry[] array)
 * stays per-repo — this module only knows how to look entries up and derive
 * a sitemap from them.
 */
type RoutePolicyEntry = {
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
declare function getSitemapRoutes(policy: RoutePolicyEntry[]): RoutePolicyEntry[];
/** Look up the policy for a given path. Pattern entries match via prefix (e.g. /locations/*). */
declare function getRoutePolicy(policy: RoutePolicyEntry[], path: string): RoutePolicyEntry | undefined;
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
declare function isRouteIndexable(policy: RoutePolicyEntry[], path: string): boolean;

/**
 * Per-page keyword targets: what a page is trying to rank for. The register
 * of *observed* performance against these targets (GSC positions over time)
 * lives in the portal DB, not here — this module only knows the target
 * declarations themselves and how to spot the one mistake that's easy to
 * make by hand: two routes silently targeting the same primary keyword.
 */
type TargetIntent = "informational" | "commercial" | "transactional" | "local";
type PageTarget = {
    routeKey: string;
    primaryKeyword: string;
    secondaryKeywords?: string[];
    intent?: TargetIntent;
    /** Free-text geo qualifier, e.g. a town or city name. Present on local-intent targets. */
    geo?: string;
};
declare function getTargetForRoute(targets: PageTarget[], routeKey: string): PageTarget | undefined;
type KeywordCannibalization = {
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
declare function findKeywordCannibalization(targets: PageTarget[], allowlist?: string[]): KeywordCannibalization[];

/**
 * The internal-link graph: which pages should send authority to which other
 * pages. This is the mechanism behind "guides rank, the pages that take
 * bookings don't" — a content page declares which money page(s) it supports,
 * and this module derives the reverse edge for free, plus a same-pillar
 * fallback for pages that haven't declared anything explicit yet.
 *
 * The rendering primitive (an actual "read more" component) stays per-repo,
 * since every site has its own design system. This module only returns
 * route keys.
 */
type LinkDeclaration = {
    routeKey: string;
    /** routeKeys this page should send authority to, e.g. a guide -> its treatment page. */
    supports?: string[];
    /** Fallback grouping used when supports is empty or needs topping up. */
    pillar?: string;
};
type RelatedLinks = {
    /** Pages this route should link out to: its own declared supports, topped up with pillar siblings. */
    linksTo: string[];
    /** Pages that declared this route in their own supports — the reverse edge, derived, not declared twice. */
    linkedFrom: string[];
};
declare function getRelatedLinks(declarations: LinkDeclaration[], routeKey: string, opts?: {
    limit?: number;
}): RelatedLinks;

/**
 * Breadcrumb trail derivation: given a site's known path -> label entries
 * and a target path, walk the path segments and pick up the registered
 * label at each level that has one. This is the one touchpoint with
 * @domandigital/graph — feed the result to buildBreadcrumbs there. Neither
 * package depends on the other; see dd-graph/PRINCIPLES.md for why.
 *
 * Deliberately doesn't read from a live route (usePathname() or similar) —
 * that couples breadcrumb generation to whatever's rendering, and a page
 * three levels deep with no registered parent produces a broken trail
 * instead of a short-but-correct one.
 */
type TrailLabel = {
    path: string;
    label: string;
};
type TrailEntry = {
    path: string;
    label: string;
};
declare function getBreadcrumbTrail(labels: TrailLabel[], path: string): TrailEntry[];

/**
 * Coverage validator: the check that would have caught six live case-study
 * pages shipping indexable and unsubmitted, with no policy entry and no CI
 * failure. Filesystem route enumeration vs policy, generalised so every
 * repo on this package runs the same check instead of reinventing it.
 *
 * Pure function — no filesystem access here. Callers do the `page.tsx`
 * enumeration (glob is a per-repo, per-router concern) and pass the
 * resulting route list in.
 */

type CoverageIssue = {
    kind: "route-missing-policy";
    path: string;
} | {
    kind: "policy-missing-route";
    path: string;
} | {
    kind: "money-route-missing-target";
    path: string;
};
type ValidateCoverageInput = {
    /** Routes found on disk, e.g. every app/**\/page.tsx resolved to its URL path. Dynamic segments excluded by the caller. */
    routesOnDisk: string[];
    policy: RoutePolicyEntry[];
    /** Routes that must have a target declared (the pages the business actually wants to rank), e.g. ["/pricing", "/services/rewiring"]. */
    moneyRoutes?: string[];
    targets?: PageTarget[];
};
declare function validateCoverage(input: ValidateCoverageInput): CoverageIssue[];

export { type CoverageIssue, type KeywordCannibalization, type LinkDeclaration, type PageTarget, type RelatedLinks, type RoutePolicyEntry, type TargetIntent, type TrailEntry, type TrailLabel, type ValidateCoverageInput, findKeywordCannibalization, getBreadcrumbTrail, getRelatedLinks, getRoutePolicy, getSitemapRoutes, getTargetForRoute, isRouteIndexable, validateCoverage };
