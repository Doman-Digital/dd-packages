# @domandigital/seo

Route-fact primitives shared across Doman Digital and client properties:
sitemap and indexability policy, per-page keyword targets, the
internal-link graph, breadcrumb trail derivation, and a filesystem-vs-policy
coverage validator.

**Read [PRINCIPLES.md](PRINCIPLES.md) before wiring this into a new repo.**
This README is the API reference.

## Why this exists

Four properties (Doman Digital, RMP Electrical, MMM Beauty, Sensphere) each
grew their own version of the same route bookkeeping: which pages are
indexable, which belong in the sitemap, what a page is trying to rank for,
which pages should link to which. The recurring defect: nothing checked that
every page on disk had a policy entry, so six live case studies (`/work/*` on
`domandigital.co.uk`, including a page already earning its own search
traffic) shipped indexable and simply never got submitted to the sitemap.
Nobody noticed for weeks.

This package is the fix: pure functions over route data the consuming repo
still owns. It does not know your CMS, your framework, or your route data.
It only knows how to look entries up, derive edges between them, and flag
when the two don't line up.

**What's per-repo, on purpose:** the actual `RoutePolicyEntry[]` array, the
actual `PageTarget[]` list, the actual link declarations, Sanity queries, and
every component. This package ships none of that. See `## Deliberately not
in scope` below.

## Install

```bash
pnpm add @domandigital/seo
```

Public on npm, Apache-2.0, published with provenance from a tagged release.
ESM and CJS builds ship together, each with its own types. Requires Node 22.12 or
newer.

Upgrading a repo that still pins `github:Doman-Digital/dd-seo#vX.Y.Z`? Swap it
for a semver range, and drop `resolve.preserveSymlinks: true` from
`vitest.config.ts` if it was added for this package. See
`@domandigital/graph`'s README for why that workaround existed and why registry
installs don't need it.

## API stability

`policy.ts`, `links.ts` and `validate.ts` are exercised by a real consumer and
are treated as stable within a `0.x` minor: a breaking change to them comes only in a minor bump, with a changeset saying so.

`targets.ts` and `trail.ts` are provisional. They're built and tested, but no
repo has adopted them in production yet, so their shapes may change once a
second consumer shows what they actually need. Pin exactly if you depend on
them today.

## API

### `policy.ts`

```ts
getSitemapRoutes(policy: RoutePolicyEntry[]): RoutePolicyEntry[]
getRoutePolicy(policy: RoutePolicyEntry[], path: string): RoutePolicyEntry | undefined
isRouteIndexable(policy: RoutePolicyEntry[], path: string): boolean
```

`isRouteIndexable` defaults to `true` for an unknown route, deliberately.
See the comment in `src/policy.ts`. The corresponding failure belongs to
`validateCoverage`, which runs in CI, not at request time.

Lookups normalise the path first, so `/pricing/`, `/pricing?ref=x` and
`/pricing#faq` all find the `/pricing` entry. Before 0.2 they fell through
to the permissive default, so a noindex page reached with a query string
reported as indexable.

`sitemapPriority` and `sitemapChangeFrequency` are deprecated. Google says it
ignores `<priority>` and `<changefreq>`
([Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)).
They still compile and still reach your sitemap; they just don't do anything
in Google.

**Don't combine noindex with a robots.txt disallow.** For `noindex` to work,
Google has to crawl the page and see it; a `Disallow` for the same path
stops that, and the URL can stay indexed from links alone
([Block indexing](https://developers.google.com/search/docs/crawling-indexing/block-indexing)).
A route with `indexable: false` belongs out of the sitemap, not out of
robots.txt.

### `normalize.ts`

```ts
normalizeRoutePath(path: string, opts?: { trailingSlash?: "never" | "always" }): string
toPolicyPatterns(nextPath: string): string[]
```

`normalizeRoutePath` strips `?query` and `#hash` and applies one trailing-slash
rule (default `"never"`, Next.js's default; pass `"always"` for a site built
with `trailingSlash: true`).

`toPolicyPatterns` turns a Next.js App Router route into the policy paths it
needs, in this package's `/prefix/*` convention:

| Route on disk | Policy paths |
|---|---|
| `/blog/[slug]` | `/blog/*` |
| `/docs/[...slug]` | `/docs/*` |
| `/help/[[...slug]]` | `/help` and `/help/*` (an optional catch-all also serves its parent) |
| `/(marketing)/pricing` | `/pricing` (route groups are dropped) |

It throws on parallel-route slots (`@modal`) and intercepting routes
(`(.)photo`), which don't have URLs of their own. Filter those out first.

### `targets.ts`

```ts
getTargetForRoute(targets: PageTarget[], routeKey: string): PageTarget | undefined
findKeywordCannibalization(targets: PageTarget[], allowlist?: string[]): KeywordCannibalization[]
```

`findKeywordCannibalization` groups primary keywords case-insensitively with
whitespace collapsed, and matches the allowlist the same way. It checks your
own targeting. Google documents no cannibalisation penalty, so read a hit as
"two pages are written for one query: merge them or retarget one", not as
evidence that either page is being demoted.

### `links.ts`: the internal-link graph

```ts
getRelatedLinks(declarations: LinkDeclaration[], routeKey: string, opts?: GetRelatedLinksOptions): RelatedLinks
```

A page declares `supports: string[]` (which money pages it should send
authority to) and optionally a `pillar` for same-topic fallback linking.
Calling `getRelatedLinks` on the money page returns every declaration that
named it: the reverse edge, derived once, not declared twice. Calling it on
the content page returns its own `supports`, topped up with pillar siblings
if under `opts.limit`.

`opts.limit` caps `linksTo` only. `opts.linkedFromLimit` caps `linkedFrom`,
independently: the two are unrelated lists (a page's own outbound picks versus
every page that named it), so one option was never meant to cap both. Omit
either for no cap.

### `trail.ts`

```ts
getBreadcrumbTrail(labels: TrailLabel[], path: string): TrailEntry[]
```

Walks path segments, picking up the registered label at each level that has
one. Feed the result to `@domandigital/graph`'s `buildBreadcrumbs`. That's
the one touchpoint between the two packages (see PRINCIPLES.md in dd-graph).

### `validate.ts`

```ts
validateCoverage(input: ValidateCoverageInput): CoverageIssue[]
```

Pure: the caller does the filesystem enumeration (a per-router concern) and
passes `routesOnDisk` in. Flags: a route on disk with no policy entry (the
six-missing-case-studies bug), a sitemap-eligible policy entry with no
corresponding page (an orphan), and, if `moneyRoutes`/`targets` are
supplied, a money route with no keyword target declared.

Pass `dynamicRoutesOnDisk` (bracket paths such as `/blog/[slug]`) to check
dynamic routes too. That adds two issues:

- `dynamic-route-missing-policy`: a dynamic route whose `toPolicyPatterns`
  output has no matching policy entry. A new `app/case-studies/[slug]` page
  with no policy used to pass CI; this is the same bug as the six case
  studies, one level up.
- `policy-pattern-missing-route`: a `/prefix/*` entry that no dynamic route
  produces (a retired section still carrying policy).

Check patterns, not the URLs they generate. With `dynamicParams` on, pages
are generated at request time and never appear in a build-time list.

```ts
// e.g. with fast-glob, from the app directory
const pages = glob.sync("**/page.tsx", { cwd: "app" })
  .map((f) => "/" + f.replace(/\/?page\.tsx$/, ""))
  .filter((p) => !/\/(@|\(\.)/.test(p)); // drop parallel slots and intercepting routes
const routesOnDisk = pages.filter((p) => !p.includes("[")).flatMap(toPolicyPatterns);
const dynamicRoutesOnDisk = pages.filter((p) => p.includes("["));
validateCoverage({ routesOnDisk, dynamicRoutesOnDisk, policy });
```

## Deliberately not in v0.1

The metadata builder (title/description/OG/hreflang generation). Doman
Digital's `lib/metadata.ts` is mature and shaped around its own CMS overlay;
RMP Electrical has its own version tuned to location pages. Extracting a
shared metadata builder now would mean designing for two consumers whose
needs haven't converged yet. Revisit once a second real consumer is on this
package and the shape is clearer.
