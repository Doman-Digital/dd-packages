---
"@domandigital/craft": minor
---

Type, space, density, restraint, Tailwind adapters and STANDARD.md.

Fluid type and space scales after Utopia, always with a `rem` term so browser
text-size settings still apply (a bare-`vw` size fails WCAG 1.4.4 at 200% zoom).
Both accept pinned literals, so a live site adopts the scale without its type or
spacing moving.

Section rhythm ships three sizes rather than the five that shipped previously
with zero consumers. Density is three steps on a 4px grid, set once on a shell
via `[data-density]`.

`checkRestraint` is pure over strings — no filesystem, no parser, no
dependencies — so a guard, a CI check and an editor all run it on the same input
and agree. It catches accumulation, which a differentiation guard structurally
cannot see: a guard passes anything that differs from its siblings, however ugly.

STANDARD.md's canonical numbers are asserted against `HOUSE_BUDGET`, `EASE` and
`DURATION_MS` on every run, so the document cannot become a second source of
truth that reads as authoritative while being stale.
