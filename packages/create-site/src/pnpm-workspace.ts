// pnpm's install protections, in the project's pnpm-workspace.yaml (pnpm 10
// reads its settings there; create-next-app writes the file for its
// ignoredBuiltDependencies list).
//
// dd doctor's SEC-002 fails a pnpm repo with no minimumReleaseAge: the 2025
// npm worms reached projects through releases installed minutes after they
// were published. A day's wait is long enough for most of those to be pulled.
// The house packages are excluded, so a site can take a release the day it
// ships; they come from this repo's own trusted-publishing workflow.
//
// Only ever adds: a project that already sets minimumReleaseAge keeps its value.

export const MINIMUM_RELEASE_AGE_MINUTES = 1440;

const BLOCK = `# Added by @domandigital/create-site (dd doctor SEC-002): a release must be a
# day old before pnpm installs it. The house packages are exempt.
minimumReleaseAge: ${MINIMUM_RELEASE_AGE_MINUTES}
minimumReleaseAgeExclude:
  - "@domandigital/*"
`;

/** The new file text, or null when the setting is already there. */
export function patchPnpmWorkspace(text: string | null): string | null {
  if (text === null) return BLOCK;
  if (/^minimumReleaseAge\s*:/m.test(text)) return null;
  // An exclude list of the project's own is kept, not doubled.
  const block = /^minimumReleaseAgeExclude\s*:/m.test(text) ? BLOCK.replace(/minimumReleaseAgeExclude:\n.*\n/, "") : BLOCK;
  const body = text.trimEnd();
  return body ? `${body}\n\n${block}` : block;
}
