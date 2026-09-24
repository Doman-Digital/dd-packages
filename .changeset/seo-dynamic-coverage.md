---
"@domandigital/seo": minor
---

Check dynamic routes, normalise paths, and stop overstating two SEO signals.

- `validateCoverage` accepts `dynamicRoutesOnDisk` (Next.js bracket paths). It reports `dynamic-route-missing-policy` when a dynamic route has no `/prefix/*` policy entry, and `policy-pattern-missing-route` when a pattern entry has no route. Omit the field for the old behaviour.
- New `toPolicyPatterns(nextPath)`: `/blog/[slug]` and `/docs/[...slug]` map to `/blog/*` and `/docs/*`; `/help/[[...slug]]` maps to `/help` and `/help/*`; route groups are dropped; parallel and intercepting segments throw.
- New `normalizeRoutePath(path, { trailingSlash })`. **Behaviour change:** `getRoutePolicy` and `isRouteIndexable` now normalise before matching, so `/pricing/`, `/pricing?ref=x` and `/pricing#faq` find the `/pricing` entry. Before, they fell through to the permissive default and a noindex page reported as indexable. `validateCoverage` compares static paths the same way.
- **Behaviour change:** `findKeywordCannibalization` groups keywords case-insensitively with whitespace collapsed, and matches the allowlist the same way. The JSDoc now says what it is: a check on your own targeting, not a documented Google penalty.
- `sitemapPriority` and `sitemapChangeFrequency` are marked `@deprecated` (Google ignores both). They still work.
- README: don't combine noindex with a robots.txt disallow.
