# Releasing

How a change gets from a merged pull request to npm, and the things that have
broken it before. The workflow is `.github/workflows/release.yml`; its comments
carry the incident detail and stay the place to read it.

## The path

1. A pull request that changes a package's published behaviour carries a
   changeset: `pnpm changeset`, pick the package, pick the bump, one line of
   what changed and why a consumer would care.
2. On merge to `main`, `release.yml` runs. With pending changesets it opens or
   updates the "Version Packages" pull request (through the `doman-digital`
   GitHub App, not `GITHUB_TOKEN`; see the workflow comment for why).
3. Merging that pull request runs `release.yml` again. With no pending
   changesets and a version ahead of npm, it builds, runs the tarball gate, and
   publishes only the packages whose version moved.

Each package versions on its own. There are no fixed or linked groups, and
there should not be: a lockstep release makes unrelated packages bump for
nothing.

## The gates a release passes

- `pnpm run check:tarballs` (`scripts/check-tarballs.mjs`) packs every package,
  runs publint and `@arethetypeswrong/cli --profile node16` on each tarball,
  installs all of them into a clean ESM project and a clean CommonJS project,
  loads every export, runs every bin with `--help`, and checks every entry in
  `files` arrived. It runs in CI on every pull request and in `release.yml`
  before publishing. It was proved against two deliberate regressions before it
  was trusted: the old `exports` shape (CommonJS consumers got ESM types) and
  `css` dropped from craft's `files`.
- `.github/workflows/browser.yml` runs craft's rendered-page tests in
  Playwright's image, on pull requests touching craft or sanity-copy. It fails
  if the browser tests did not run, not only if they failed. A nightly run
  would need a cron registered in ci-standards' `budget.yml` first; the policy
  gate rejects an unregistered one.

## Trusted publishing

Publishing uses npm trusted publishing (GitHub Actions OIDC). No npm token is
stored anywhere, and npm generates provenance automatically.

Requirements, from docs.npmjs.com/trusted-publishers (last edited 2026-09-03):

- npm CLI 11.5.1 or later and Node 22.14.0 or later. `release.yml` runs Node
  `22.x` and installs `npm@^11.5.1`.
- GitHub-hosted runners only.
- `id-token: write` in the workflow's permissions.

### Adding a new package

Every package needs its own trusted publisher on npmjs.com before its first
release can publish:

1. On npmjs.com, open the package's settings (for a brand-new package, create
   the publisher from the organisation's pending packages first).
2. Add a GitHub Actions trusted publisher: owner `Doman-Digital`, repository
   `dd-packages`, workflow `release.yml` (with the extension).
3. **Allowed actions: tick `npm publish`.** Only `npm stage publish` is always
   allowed; `changeset publish` calls `npm publish`, so without the tick the
   release fails with `ENEEDAUTH`.
4. Every field is case-sensitive and must match exactly.

`package.json` must carry `"publishConfig": { "access": "public",
"provenance": true }` and a `repository.url` of
`git+https://github.com/Doman-Digital/dd-packages.git`.

## Tool versions, and why they are pinned

- **pnpm 10.34.6** (`packageManager`) and **`@changesets/cli` 3.0.3**. They
  move together: Changesets 3 requires pnpm 10 or later and Node `^22.11 ||
  ^24 || >=26` (its npm manifest). Changesets 2 passed pnpm's `--no-git-checks`
  through to npm, and npm 12 rejects it. Changesets 3 calls `pnpm publish`
  itself, so the flag stays with pnpm. Rehearsed 2026-09-30:
  `changeset version` works, and `pnpm publish --dry-run --no-git-checks`
  succeeds under both npm 11.20.0 and npm 12.1.0. A real publish through
  OIDC is not rehearsed yet; the first release after this change is that test.
  pnpm 10 does not run dependency install scripts by default, and prints
  "Ignored build scripts: esbuild" on install. That is expected: esbuild's
  binary arrives as a prebuilt optional package, its script only checks it,
  and build, test and the tarball gate pass without it.
- **npm `^11.5.1`** in `release.yml`. The flag leak that forced this pin is
  gone, but no real OIDC publish has run on npm 12 from this repo, so leave the
  pin until one has, then try `latest` on its own branch.
- **Node**: every package declares `engines.node >=22.12`. Node 20 reached end
  of life on 2026-04-30. CI runs 22 and 24; add 26 when it becomes LTS on
  2026-10-28.
