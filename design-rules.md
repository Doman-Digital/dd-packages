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
so the rules were retired rather than kept as a second source. The one gap
is the unmodified shadcn Card class recipe, which no tell matches yet.

## Three things it held that craft does not

Read these from the old version (`git show e4f4c06:design-rules.md`) as
input to the art direction craft's Phase J waits on. None is a house rule.

- **Display type shortlist:** Velvetyne's Basteleur, Gulax and Le Murmure
  (SIL OFL). The technical and editorial buckets were never sourced.
- **Foundry licence research:** Blaze Type's own licence and EULA pages
  contradict each other on multi-client use; Power Type's terms were never confirmed.
  Get both in writing before any client build relies on either.
- **Icon base: Phosphor, for every build.** This conflicts with craft. Its
  icon-tile tells treat Phosphor exactly as they treat Lucide, and `CHARACTER.md`
  treats clients looking like each other as the agency's biggest tell. One
  icon set across every client is that pattern, so this one needs a
  decision per client, not a house default.
