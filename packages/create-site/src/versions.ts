// The house packages a site gets, and the ranges it gets them at. A site
// upgrades by bumping these, never by copying code: that is the point of the
// scaffold. versions.test.ts fails when a range falls behind the workspace.

export const HOUSE_DEPENDENCIES = {
  "@domandigital/graph": "^0.7.0",
  "@domandigital/seo": "^0.3.0",
} as const;

// @types/node: the generated tests and route enumerator import node:fs, and
// the Astro starter templates do not ship Node types. Added only if missing.
export const HOUSE_DEV_DEPENDENCIES = {
  "@domandigital/craft": "^0.18.0",
  "@types/node": "^22.0.0",
  vitest: "^4.1.11",
} as const;

// The actions the generated workflow uses, each pinned to the full commit SHA
// of a release with the version as a comment. dd doctor's SEC-001 fails a
// tag (tj-actions/changed-files, March 2025: a re-pointed tag ran code that
// dumped CI secrets). The site's own Renovate keeps them current after that.
// versions.test.ts checks the shape; the nightly starter job runs dd doctor
// on a generated site.
export const ACTIONS = {
  checkout: "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1",
  setupNode: "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0",
  setupPnpm: "pnpm/action-setup@fc06bc1257f339d1d5d8b3a19a8cae5388b55320 # v4.4.0",
} as const;
