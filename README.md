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
ESM and CJS builds ship together, each with its own types. Requires Node 20 or
newer.

Upgrading a repo that still pins `github:Doman-Digital/dd-seo#vX.Y.Z`? Swap it
for a semver range, and drop `resolve.preserveSymlinks: true` from
`vitest.config.ts` if it was added for this package. See
`@domandigital/graph`'s README for why that workaround existed and why registry
installs don't need it.

## API stability

`policy.ts`, `links.ts` and `validate.ts` are exercised by a real consumer and
are treated as stable for the rest of `0.1.x`.

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

### `targets.ts`

```ts
getTargetForRoute(targets: PageTarget[], routeKey: string): PageTarget | undefined
findKeywordCannibalization(targets: PageTarget[], allowlist?: string[]): KeywordCannibalization[]
```

### `links.ts`: the internal-link graph

```ts
getRelatedLinks(declarations: LinkDeclaration[], routeKey: string, opts?: { limit?: number }): RelatedLinks
```

A page declares `supports: string[]` (which money pages it should send
authority to) and optionally a `pillar` for same-topic fallback linking.
Calling `getRelatedLinks` on the money page returns every declaration that
named it: the reverse edge, derived once, not declared twice. Calling it on
the content page returns its own `supports`, topped up with pillar siblings
if under `opts.limit`.

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

## Deliberately not in v0.1

The metadata builder (title/description/OG/hreflang generation). Doman
Digital's `lib/metadata.ts` is mature and shaped around its own CMS overlay;
RMP Electrical has its own version tuned to location pages. Extracting a
shared metadata builder now would mean designing for two consumers whose
needs haven't converged yet. Revisit once a second real consumer is on this
package and the shape is clearer.
