# House design rules

**Canonical in `@domandigital/craft`, not here.** This file is a pointer. If
you find design rules pasted into a repo, delete the copy and link to the
package instead.

| Question | Where | Checked by |
| --- | --- | --- |
| Is it well made? Colour, contrast, type, space, motion, restraint | [`packages/craft/STANDARD.md`](packages/craft/STANDARD.md) | the restraint budget in each repo's build, via drift-guards |
| Did anyone decide how it looks, or is it a model's default? | [`packages/craft/CHARACTER.md`](packages/craft/CHARACTER.md) | `craft scan` (source), `craft audit` (rendered) |
| What is being built next | [`packages/craft/ROADMAP.md`](packages/craft/ROADMAP.md) | |

## Why this file used to be longer

Until 2026-09-24 this file held a full visual rule set, written on
2026-09-11 before craft covered the same ground. It claimed to be canonical
while craft was also canonical, and its blocking tier named a
`design-check.py` that was never in this repo. Craft's tell catalogue now
covers most of what that tier described (`ai-violet`,
`blue-purple-gradient`, `gradient-text`, `hero-then-proof`, `shadcn-dump`),
so the rules were retired rather than kept as a second source. The one gap,
the unmodified shadcn Card class recipe, is now `shadcn-card-stock`.

## Where the research went

The research behind the old file is kept, graded by source, in
[`packages/craft/research/2026-09-11-ai-look.md`](packages/craft/research/2026-09-11-ai-look.md).
What it found that craft lacked is now in craft: `shadcn-card-stock`, Cal
Sans as a reflex font, more icon libraries seen by the icon-tile tells, and a
licence register that `craft direction validate` reads
([`src/direction/licences.ts`](packages/craft/src/direction/licences.ts)).

Two of its picks are deliberately not house defaults. The Velvetyne faces are
licence facts, not a shortlist, and Phosphor is not a house icon set: one set
on every client site is the estate sameness `CHARACTER.md` measures.
