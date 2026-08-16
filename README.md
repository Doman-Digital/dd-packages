# dd-packages

Doman Digital's public npm packages, in one repo:

| Package | | |
|---|---|---|
| [`@domandigital/graph`](packages/graph) | Schema.org entity-graph builders | [npm](https://www.npmjs.com/package/@domandigital/graph) |
| [`@domandigital/gbp`](packages/gbp) | Google Business Profile OAuth + reviews client | [npm](https://www.npmjs.com/package/@domandigital/gbp) |
| [`@domandigital/seo`](packages/seo) | Route policy, link graph, coverage validator | [npm](https://www.npmjs.com/package/@domandigital/seo) |

Each package versions and publishes independently (see `.changeset/config.json`)
-- `graph` has had 21 releases to `seo`'s 2, and there's no dependency between
any of the three, so there's nothing to gain from lockstep versioning.

Previously three separate repos (`dd-graph`, `dd-gbp`, `dd-seo`), each with its
own CI and release workflow to maintain. Consolidated 2026-08-16, with full
commit history preserved per package via `git subtree` -- see each package's
own commit history for its pre-consolidation log.

## Development

```bash
pnpm install
pnpm run typecheck    # all three packages
pnpm run test         # all three packages
pnpm run build        # all three packages
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

## License

Apache-2.0. See each package's own `LICENSE`.
