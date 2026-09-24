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
  "@domandigital/craft": "^0.11.0",
  "@types/node": "^22.0.0",
  vitest: "^4.1.11",
} as const;
