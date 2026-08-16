# Changelog

All notable changes to `@domandigital/seo`.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project uses [semantic versioning](https://semver.org/spec/v2.0.0.html).

Releases before 0.1.2 were consumed as git dependencies pinned to a tag. This
file was written retroactively from that tag history.

## [Unreleased]

### Added

- `./package.json` is now exposed in the `exports` map. Tooling that reads a
  dependency's manifest previously hit `ERR_PACKAGE_PATH_NOT_EXPORTED`.
- CI on every push and pull request: typecheck, test and build across Node 20,
  22 and 24. Previously the only workflow was the tag-triggered release.
- An API stability note in the README. `policy.ts`, `links.ts` and `validate.ts`
  have a real consumer and are treated as stable for the rest of `0.1.x`.
  `targets.ts` and `trail.ts` are provisional: built and tested, but not yet
  adopted in production, so their shapes may still change.

### Changed

- `engines.node` raised from `>=18` to `>=20`. Node 18 reached end of life in
  April 2025, and the previous range was never exercised by anything.
- README rewritten for npm distribution. The install section still described the
  package as unpublished and documented a `resolve.preserveSymlinks` workaround
  that only ever applied to pnpm git dependencies.
- Doc comments on `PageTarget.geo` and `ValidateCoverageInput.moneyRoutes` now
  use generic examples. Both sit on exported types, so their previous
  client-specific examples were carried into `dist/index.d.ts` and shipped in
  the published tarball.

## [0.1.1] - 2026-08-16

### Changed

- Licensed Apache-2.0, with publish metadata (repository, homepage, bugs) and
  `publishConfig` for public access and provenance. First version published to
  the npm registry.

## [0.1.0] - 2026-07-29

### Added

- Initial release. Pure functions over route data the consuming repo still owns.
  The data itself stays per-repo: the policy array, the target list and the link
  declarations all live with the consumer.
- `policy.ts`: `getSitemapRoutes`, `getRoutePolicy` (exact match, then prefix
  match for dynamic patterns) and `isRouteIndexable`. Unknown routes default to
  indexable on purpose, so a missing policy entry stays a documentation gap
  rather than becoming a mid-request failure. Catching the gap is
  `validateCoverage`'s job, in CI.
- `validate.ts`: `validateCoverage`, which compares routes on disk against
  policy and flags a route with no policy entry, a sitemap-eligible entry with
  no page, and a money route with no keyword target. This is the check that
  would have caught six live case studies shipping indexable and unsubmitted,
  unnoticed for weeks. Filesystem enumeration stays with the caller, since
  globbing is a per-router concern.
- `links.ts`: `getRelatedLinks`, the internal-link graph. A page declares which
  money pages it supports, and the reverse edge is derived rather than declared
  twice, with a same-pillar fallback for pages that haven't declared anything.
- `targets.ts`: `getTargetForRoute` and `findKeywordCannibalization`, which
  flags two routes claiming the same primary keyword.
- `trail.ts`: `getBreadcrumbTrail`, which walks path segments and picks up the
  registered label at each level. Feed the result to `@domandigital/graph`'s
  `buildBreadcrumbs`. That's the one deliberate touchpoint between the two
  packages, and neither depends on the other.

[Unreleased]: https://github.com/Doman-Digital/dd-seo/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/Doman-Digital/dd-seo/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Doman-Digital/dd-seo/releases/tag/v0.1.0
