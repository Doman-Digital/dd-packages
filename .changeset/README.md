# Changesets

Every package here versions independently — see `config.json` (no
`linked`, no `fixed` groups). Forcing them into lockstep would release
packages that did not change.

Add a changeset for any PR that changes a package's published behavior:

```bash
pnpm changeset
```

Pick the package(s) affected, the bump type, and write the summary — this
becomes the CHANGELOG entry, so write it for a consumer, not for a reviewer.
No changeset is needed for changes that don't touch what ships (CI config,
this file, internal tooling).

`release.yml` runs `changeset version` and `changeset publish` on every push
to `main` that has pending changesets, tagging and publishing only the
packages that actually changed.
