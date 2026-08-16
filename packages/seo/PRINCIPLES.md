# Architecture principles: route facts at Doman Digital

The sibling contract to `dd-graph/PRINCIPLES.md`. Read that file's "The seam
with `@domandigital/seo`" section first — it defines the boundary this
package exists inside of: **graph owns emission, this package owns facts.**

## The rule

**Route policy, keyword targets, the internal-link graph, and breadcrumb
trails go through `@domandigital/seo`. No repo hand-rolls a second copy of
`getRoutePolicy` / `getRelatedLinks` / a coverage check again.**

This existed as one implementation, in one repo
(`apps/marketing/lib/seo/routePolicy.ts` and
`apps/marketing/lib/resources.ts`'s `getRelatedResources`), before
extraction. The bug that forced the extraction: nothing checked "does every
page on disk have a policy entry", so six live pages — one of them already
earning its own search traffic — shipped indexable and unsubmitted, silently,
for weeks. `validateCoverage` exists specifically so that check exists
exactly once, and every repo on this package gets it for free.

## What stays per-repo, always

- The actual `RoutePolicyEntry[]` array. This package has no opinion on your
  routes, priorities, or change frequencies.
- The actual `PageTarget[]` list.
- The actual `LinkDeclaration[]` list.
- CMS queries, components, styling, the actual route filesystem.

If you're tempted to move real route data into this package "since it's
shared anyway" — stop. The package stays a pure function library over data
the consumer owns. The moment it starts owning data, every consumer is
coupled to every other consumer's routes.

## When you're porting a new repo onto this package

1. Find the existing route-policy-shaped code (a sitemap generator, an
   indexability check, a "related content" function). Inventory what it
   currently does before touching it — the same rule as dd-graph's porting
   checklist.
2. Keep the route data where it is; only replace the lookup/derivation
   functions with calls into this package.
3. Wire `validateCoverage` into CI immediately, not as a follow-up — it's the
   check that catches the class of bug this package exists to prevent, and a
   repo without it is exactly as exposed as marketing was before the fix.
4. If a second real consumer needs something in "Deliberately not in v0.1"
   (see README), that's the signal to build it — not before.

## Version discipline

Same as dd-graph: semver on npm, published from a `vX.Y.Z` tag, never a branch.
Consumers use a normal range against the registry
(`"@domandigital/seo": "^0.1.1"`).

One rule specific to this package while it's `0.1.x`: `policy.ts`, `links.ts`
and `validate.ts` have a real production consumer and are treated as stable.
`targets.ts` and `trail.ts` don't yet, so they stay provisional and may change
shape once a second consumer shows what's actually needed. That's the same "not
before" discipline the porting checklist applies to new features, turned on the
package's own API.

*Superseded, kept for context:* until 2026-08-16 this was a git dependency
pinned to a tag, and `dist/` was committed because a git-dependency install runs
no build step. CI builds now, so removing the committed `dist/` is tracked
separately.
