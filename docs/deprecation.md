# Deprecation

How a public API leaves a package without surprising anyone who uses it.

SemVer's own guidance: update the documentation, then "issue a new minor
release with the deprecation in place". Before the functionality is removed in
a major release there should be at least one minor release that contains the
deprecation (semver.org, "How should I handle deprecating functionality?").

## The steps

1. **Mark it.** Add a JSDoc `@deprecated` tag that says what to use instead and
   why. Editors strike the name through, and TypeScript reports it.
2. **Release it.** A changeset at `minor` whose line starts `Deprecated:`, so
   the changelog says it in the consumer's words.
3. **Remove it later.** Only in a later major of that package, never in the
   same release as the deprecation. Before 1.0 a "major" is the next minor
   (0.x rules), and the same one-release gap applies.
4. **Tell npm, if a whole range is retired.** After the removal ships, run
   `npm deprecate <package>@"<old range>" "<message and what to upgrade to>"`
   once per package. Packages version independently, so this is never a single
   command for the repository.

## What not to do

- **No runtime warnings.** These packages are pure and some run in the browser
  (sanity-copy inside Sanity Studio), so a deprecation never prints, logs, or
  calls `process.emitWarning`. The JSDoc tag and the changelog carry it. craft's
  command line may mention a deprecated flag in its own output, because output
  is its job.
- **No silent removals.** A removal without a prior deprecation release is a
  bug in the release, even before 1.0.
