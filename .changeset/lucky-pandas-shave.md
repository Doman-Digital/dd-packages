---
"@domandigital/craft": minor
---

`checkRestraint` measures the surface, not the framework underneath it.

Two defects, both found by running the checker against a real compiled
stylesheet — `apps/portal` in the Doman Digital monorepo — rather than against
its own fixtures.

**It rejected `EASE.inOut`, one of its own canonical curves.** The ease-in test
compared only the first control point (`y1 < x1`), which is true of every
ease-in-*out* as well. So the standard failed its own checker on any surface
that adopted the token the standard recommends. Section 7's objection to ease-in
is about the end of the movement — a curve that accelerates into its final
position reads as the interface pulling away — so the test is now the end
tangent: rejected when the curve covers more ground per unit time arriving than
it averaged. `EASE.out`, `EASE.inOut`, `EASE.drawer`, `EASE.reveal`, Tailwind's
default and `linear` all pass; the `ease-in` keyword's curve, the portal's old
`--ease-exit`, and a back-loaded custom curve are all still rejected.

**It counted the framework's reset and theme as house vocabulary.** Tailwind v4
alone contributes three font sizes nobody chose (`small` at 80%, `sub`/`sup` at
75%, `code` at 1em) and two timing functions, which was enough to report a
surface as over its font-size budget for values its author never wrote.
`@layer theme` and `@layer base` are now excluded by default via a new
`ignoreAtLayers` option; pass `[]` to count everything, as before.

**Its reduced-motion check read the rest of the file, not the block.** It sliced
from the first `@media (prefers-reduced-motion: reduce)` to the end of the sheet,
so every rule after that point counted as being inside it. On a real sheet that
meant `[data-craft-lcp] { animation: none }` — this package's own section 7 rule,
correctly outside any media query — was reported as a section 8 violation. The
scan is now brace-matched to each block's own body, and reads every such block
rather than only the first.

**CSS-wide keywords are no longer counted as vocabulary.** `inherit` and
`initial` were already excluded; `unset`, `revert` and `revert-layer` were not,
and `revert` appears in compiled output. A declaration that defers to the cascade
names no value, so it is not a step of anything.
