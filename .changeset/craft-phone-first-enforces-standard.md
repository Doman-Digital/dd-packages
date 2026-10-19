---
"@domandigital/craft": minor
---

`craft phone-first` now enforces the portal standard's phone lessons itself (DOM-1053, from DOM-1044's `phone-faults.md`). **This tightens the gate: a portal that upgrades can fail where it passed before.** Four checks:

- **The baseline only shrinks.** The run compares `phone-first.baseline.json` with the base branch's copy (`origin/main`, the pull request's target branch, or `--base <ref>`) and fails on an entry main does not have, or a higher count. An entry with a non-empty `reason` is a named exception and may be added or raised; the new optional `reason` field is kept by `--update-baseline`, and old baselines read unchanged. The runner must see the base branch (`fetch-depth: 0`); if it cannot, the gate fails rather than skips.
- **Every route is measured.** With `--measured`, every Next `app/**/page.tsx` route (from `appDir`, or a `source` folder called `app`, or `routesManifest`) must be among the measured routes, or in `excludeRoutes` with a reason. Add the routes of a redirect-only page to `excludeRoutes`.
- **Field floor 48px** (tightening): a text field, select or textarea under 48px tall fails the `field` check, to match portal standard rule 5. The gate failed only under 44px before. Set `floors: { fieldHeightPx: 44 }` to keep the old floor; the default is 48. `measurePhone` now takes `floors` too.
- **Tailwind 3 `var()` opacity:** on an app whose `tailwindcss` is v3, `/NN` opacity on an arbitrary `var()` colour (`bg-[var(--bg-1)]/95`) fails the source scan, because Tailwind 3 emits no CSS for it. The `tailwind` key in `phone-first.json` overrides the detected version.

A portal adopting this version fixes its new findings where they are (a field gets `min-h-12`), or records a named exception with a reason; it cannot grow the baseline to make the upgrade pass.
