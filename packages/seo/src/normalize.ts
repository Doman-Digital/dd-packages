/**
 * Path normalisation and Next.js route-pattern conversion. Pure string work:
 * no filesystem access, no knowledge of any particular router's config.
 */

export type TrailingSlash = "never" | "always";

export type NormalizeRoutePathOptions = {
  /**
   * `"never"` (default, and Next.js's own default): `/pricing/` becomes
   * `/pricing`. `"always"`: `/pricing` becomes `/pricing/`, for a site built
   * with `trailingSlash: true`. The root is always `/`.
   */
  trailingSlash?: TrailingSlash;
};

/**
 * Strips `?query` and `#hash` and applies one trailing-slash rule, so
 * `/pricing`, `/pricing/`, `/pricing?ref=x` and `/pricing#faq` all name the
 * same route. Use it on anything that reaches a policy lookup from a request
 * or a crawl, where the exact spelling is not under your control.
 */
export function normalizeRoutePath(path: string, options: NormalizeRoutePathOptions = {}): string {
  const { trailingSlash = "never" } = options;
  let p = path.split("#", 1)[0].split("?", 1)[0];
  if (!p.startsWith("/")) p = `/${p}`;
  p = p.replace(/\/+$/, "");
  if (p === "") return "/";
  return trailingSlash === "always" ? `${p}/` : p;
}

const ROUTE_GROUP = /^\([^.)][^)]*\)$/;
const DYNAMIC = /^\[.+\]$/;
const OPTIONAL_CATCH_ALL = /^\[\[\.\.\..+\]\]$/;

/**
 * The policy path(s) that must exist for one Next.js App Router route
 * pattern, using this package's `/prefix/*` convention for dynamic entries:
 *
 * - `/blog/[slug]` and `/docs/[...slug]` give `["/blog/*"]` and `["/docs/*"]`.
 * - Anything after the first dynamic segment is covered by the same prefix:
 *   `/blog/[slug]/comments` gives `["/blog/*"]`.
 * - An optional catch-all also matches its parent, so `/docs/[[...slug]]`
 *   gives `["/docs", "/docs/*"]`: the parent needs its own static entry.
 * - Route groups are dropped: `/(marketing)/pricing` gives `["/pricing"]`.
 * - A path with no dynamic segment is returned as-is, normalised.
 *
 * Parallel-route slots (`@modal`) and intercepting routes (`(.)photo`) do
 * not map to a URL of their own. Exclude them before calling this; it
 * throws on them rather than guessing.
 */
export function toPolicyPatterns(nextPath: string): string[] {
  const segments = nextPath.split("/").filter(Boolean);
  const kept: string[] = [];
  for (const segment of segments) {
    if (segment.startsWith("@") || /^\(\.{1,3}\)/.test(segment)) {
      throw new Error(
        `toPolicyPatterns: ${nextPath} contains a parallel or intercepting segment (${segment}); exclude it before calling`,
      );
    }
    if (ROUTE_GROUP.test(segment)) continue;
    if (DYNAMIC.test(segment)) {
      const parent = kept.length > 0 ? `/${kept.join("/")}` : "";
      const pattern = `${parent}/*`;
      return OPTIONAL_CATCH_ALL.test(segment) ? [parent || "/", pattern] : [pattern];
    }
    kept.push(segment);
  }
  return [normalizeRoutePath(`/${kept.join("/")}`)];
}
