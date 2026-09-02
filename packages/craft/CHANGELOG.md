# @domandigital/craft

## 0.2.0

### Minor Changes

- 6462b3a: Use the `text-wrap-style` longhand, and stop applying orphan control to every
  `li`.

  `text-wrap` is shorthand for `text-wrap-mode` + `text-wrap-style`, so
  `text-wrap: pretty` silently resets the mode to `wrap`. `white-space: nowrap` is
  itself shorthand setting `text-wrap-mode: nowrap`, so the shorthand defeated it
  along with any `text-overflow: ellipsis` truncation that relied on it.

  Caught by a visual regression suite: `li { text-wrap: pretty }` expanded a
  breadcrumb that truncates to one line into three lines and pushed the page 40px
  taller. The longhand sets only the style, so an element that asked not to wrap
  still does not.

  `li` is now scoped to `.craft-prose li`. Breadcrumbs, navs, tab strips and menus
  are all `li` and none of them are body copy.

## 0.1.0

### Minor Changes

- 000eb90: Initial release: OKLCh colour, contrast, motion tokens and the base stylesheet.

  Colour ramps snap to anchors byte-identically, so an existing site adopts craft
  without a visual diff. Semantic tokens are derived with measured WCAG 2.x _and_
  APCA-W3 contrast, and `accentFork` returns the step nearest the brand accent that
  clears both bars, emitting the measured ratios as a CSS comment.

  Motion ships one vocabulary for CSS and JS (`EASE` / `EASE_TUPLE` hold identical
  control points), replacing three ease curves that were wrong in the shared layer:
  two byte-identical curves under different names, and an `ease-in` exit.

  `craft.css` collapses reduced-motion durations rather than using `animation:
none`, which strands forwards-filled entrances at `opacity: 0`.

- 0b6d77e: Type, space, density, restraint, Tailwind adapters and STANDARD.md.

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
