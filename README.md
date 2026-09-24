# dd-packages

Doman Digital's public npm packages, in one repo.

**Status:** live on npm; each package publishes from here when its changeset merges.
**Used by:** every Doman Digital and client site, and the tooling in claude-kit.

| Package | | |
|---|---|---|
| [`@domandigital/create-site`](packages/create-site) | The first thing that runs on a new client site | [npm](https://www.npmjs.com/package/@domandigital/create-site) |
| [`@domandigital/craft`](packages/craft) | The house design and copy standards, and the checks that enforce them | [npm](https://www.npmjs.com/package/@domandigital/craft) |
| [`@domandigital/graph`](packages/graph) | Schema.org entity-graph builders | [npm](https://www.npmjs.com/package/@domandigital/graph) |
| [`@domandigital/gbp`](packages/gbp) | Google Business Profile OAuth + reviews client | [npm](https://www.npmjs.com/package/@domandigital/gbp) |
| [`@domandigital/sanity-copy`](packages/sanity-copy) | craft's copy rules as Sanity Studio field warnings | [npm](https://www.npmjs.com/package/@domandigital/sanity-copy) |
| [`@domandigital/seo`](packages/seo) | Route policy, link graph, coverage and redirect validators | [npm](https://www.npmjs.com/package/@domandigital/seo) |

Each package versions and publishes independently (see `.changeset/config.json`),
so nothing is released that did not change.

No package has a third-party runtime dependency. `sanity-copy` depends on
`craft`, a sibling here; everything else depends on nothing at runtime.

Previously separate repos (`dd-graph`, `dd-gbp`, `dd-seo`), each with its
own CI and release workflow to maintain. Consolidated 2026-08-16, with full
commit history preserved per package via `git subtree` -- see each package's
own commit history for its pre-consolidation log.

## Starting a client site

```bash
pnpm create next-app@latest acme && cd acme   # or: pnpm create astro@latest acme
pnpm create @domandigital/site
```

See [`packages/create-site`](packages/create-site) for what it writes and why.

## Development

```bash
pnpm install
pnpm run typecheck    # every package
pnpm run test         # every package
pnpm run build        # every package
```

Scope any command to one package: `pnpm --filter @domandigital/graph test`.

## Releasing

```bash
pnpm changeset
```

picks the package(s), the bump type, and the changelog summary. Push it on a
PR; `release.yml` opens a "Version Packages" PR bumping the affected
package(s) and their `CHANGELOG.md`. Merging that PR publishes to npm via
trusted publishing (OIDC, no stored token), with a provenance attestation,
and tags each published package `<name>@<version>`.

## Checking what npm will ship

```bash
pnpm -r run build && pnpm run check:tarballs
```

Packs every package, runs publint and attw on each tarball, installs them
into clean ESM and CommonJS projects, and loads every export and bin. CI and
`release.yml` both run it. [`docs/releasing.md`](docs/releasing.md) covers
the whole release path, trusted publishing for a new package, and why the
toolchain is pinned where it is (pnpm 9 and Changesets 2 until they move
together).

## License

Apache-2.0. See each package's own `LICENSE`.
