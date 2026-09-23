# @domandigital/craft

## 0.6.0

### Minor Changes

- 8c6304b: Character, phase A: a tell catalogue, a source scanner, a copy engine, and the `craft` command.

  The standard asks whether a surface is well made. The new CHARACTER.md asks
  whether anyone decided how it looks. A site can pass every craft number and
  still be the indigo-and-Inter answer a model gives any brief.

  - `scanSource(files)` finds 21 design tells in markup, component code and CSS,
    tagged by generation: the first wave (indigo, blue-to-purple gradients, Inter,
    glass panels, hero straight into a trust strip, icon-card grids, reveal on
    every section, pills everywhere, a stock shadcn dump) and the second (cream
    grounds, italic serif display, eyebrow chips, icon tiles, bento grids, radial
    glows, graph-paper backgrounds, marquees, hairline-border cards, intro
    cinematics).
  - It reads classes the way Tailwind does, through `cn()`, `clsx()` and `cva()`,
    and colour in hex, `rgb()`, `hsl()` and `oklch()` in raw CSS, `@theme` blocks
    and arbitrary values. Hue is judged in OKLCh, so a violet set as `#5a35d1` is
    caught.
  - `checkCopy(files)` finds 8 copy tells, including em dashes, "not just X, it's
    Y", staccato triplets and "where X meets Y". The word and phrase lists are
    exported data with a test per entry.
  - `craft scan [--staged]`, `craft copy`, `craft tells list`. Exceptions are
    declared in `art-direction.json` with a `because`; one without a reason is
    not applied and is reported.
  - Every tell ships as `warn`. Nothing blocks until its estate hits have been
    read. Every entry has a flag case per detection path and a pass case, and
    the test proves each one fires on its own.

  STANDARD.md section 10 now hands layout defaults to CHARACTER.md. Still eleven sections.

- 161a771: The house copy rules move into craft, so `copy-check` can become a thin wrapper over `craft copy --json`.

  - Ten tells carry the lists that claude-kit's `copy-check` hardcoded: `ai-phrase`,
    `plainer-word`, `plain-english`, `buzzword`, `negative-reassurance`, `emoji`,
    `no-x-no-y`, `no-x-badge`, `review-phrase` and `vague-word`. `not-just-but` now
    covers every form of contrastive negation the house rules name, including the
    parallel participle ("dispatched from here, not shipped in from Seoul").
    Each word and phrase belongs to exactly one tell, with a test per entry.
    Every tell still ships as `warn`. Catalogue `2026.09.2`, 39 tells.
  - `copy-ok` or `craft-ok` on a finding's line, or the line above, suppresses it.
    Suppressed findings are listed in `report.suppressed`, never hidden.
  - `craft copy` never reads a comment as copy, reads JSX text that runs into an
    expression, reads the text inside HTML held in a string, sees short strings
    for the dash, emoji and badge tells, leaves a lone dash placeholder alone,
    and reads `.jsonl` (a Sanity export) a document per line.
  - Class lists written with arbitrary values (`bg-[var(--bg-elevated)]`) are no
    longer read as prose.

- 8093ad7: Phase B: the rendered page. `craft snapshot`, `craft audit`, rendered detection paths and a fingerprint.

  - `@domandigital/craft/audit` captures a snapshot of a live page in Chromium: faces by
    text and headline, colours by painted area, button shape, sections in running order
    and which wait for a scroll, glass, gradients, glows, grid backgrounds, marquees,
    hairline-shadow cards, the eyebrow chip, and an intro that covers the page at load.
    Playwright is an optional peer dependency; the core import never loads a browser.
    `collectInPage` is exported for any caller already driving a page.
  - 18 tells gain a rendered detection path, with their own flag and pass snapshots,
    proved like every other path. `auditSnapshot(snapshot)` judges a saved snapshot
    without a browser. Catalogue `2026.09.3`.
  - `fingerprint(snapshot)` and `fingerprintDistance(a, b)`: accent and ground in
    OKLCh, display and body faces, roundness, reveal density, effects and running order,
    compared 0 to 1. `nearest()` ranks a set.
  - `craft audit <url | snapshot.json> [--repo dir]` reports the page and its source
    together, with the fingerprint. `HTTPS_PROXY` is honoured.
  - Colour parsing reads `oklab()` and `color(srgb ...)`, which browsers return.
  - First estate baseline recorded in CHARACTER.md and `calibration/estate/2026-09-23/`.

- ee6d6cd: Phase C: `art-direction.json`, the reason rule, and `craft direction init | validate | propose`.

  - A schema for the seven expressive choices (accent, ground, display, body, shape, motif,
    signature), the sources in the client's world they come from, and the tell exceptions
    from phase A. Ships as `art-direction.schema.json` for editors.
  - `validateDirection` applies the reason rule: a reason is a sentence, cites a declared
    source and mentions what that source shows; preferences, mood boards and unconfirmed
    proposals are rejected; a value on the tell catalogue needs an exception. Given a
    fingerprint it warns where the page does not show what the file declares.
  - `initDirection` writes today's choices with empty reasons. `propose` reads dominant
    colours off PNG photos (`paletteFromPixels`, k-means in OKLab) and drafts choices ranked
    away from the reflex band and the estate, every one marked `PROPOSED:` until a person
    rewrites it.
  - An exceptions-only file stays valid.

## 0.5.0

### Minor Changes

- f49922c: A font size in `em` or `%` counts against its own budget, not the type scale's.

  `code { font-size: 0.875em }` does not add a step to a scale. It states one
  relationship — code is 87.5% of whatever it sits in — and applies it wherever
  code appears. Counting it as a step is the same category error section 9 already
  corrected once for the framework's theme: a number that is not part of the
  vocabulary a reader has to hold.

  They are still counted, under `maxRelativeFontSizes` (house value 3), because
  the failure they can cause is real — eight competing ratios is as unreadable as
  eight competing steps. Split, not dropped. A value that stops being reported is
  a value that grows.

  `counts.relativeFontSizes` is new; `counts.fontSizes` now excludes them, so a
  surface using `em` will report a lower scale count than under 0.4.0.

  Only bare ratios move: `0.875em` and `75%` are relative, `0.875rem` is not, and
  neither is a composite like `max(16px, 1em)`.

## 0.4.0

### Minor Changes

- 1b2e8bf: `checkRestraint` resolves token references instead of skipping them.

  The old rule skipped any value starting with `var(`, on the reasoning that a
  token reference is the token layer doing its job rather than a new value. True
  of a hand-written sheet. On a Tailwind v4 sheet it is close to measuring
  nothing: `text-sm` compiles to `font-size: var(--text-sm)` and `rounded-lg` to
  `border-radius: var(--radius-lg)`, and `shadow-[…]` emits no `box-shadow` at
  all — it assigns `--tw-shadow` and lets one shared composite read it.

  Measured on the estate this was hiding, per surface: 19 font sizes reported
  against 28 shipped, 5 shadows against 18, 7 radii against 13. A second surface
  reported `ok: true` on every axis and is over budget on four.

  What changes:

  - A value that is exactly one `var()` is resolved through the token chain to
    the value that renders, and counted.
  - `--tw-shadow` assignments count as shadows; Tailwind's composite plumbing
    value does not, and neither does its `0 0 #0000` initial.
  - `var(--tw-shadow-color, X)` is unwrapped to `X`, so the report names what a
    reader would see.
  - Definitions are read from the whole sheet, including ignored layers, while
    usage is still read only from kept ones. The layer exclusion is unchanged in
    intent and now works: a framework default nothing uses still counts for
    nothing. Used versus unused was always the real distinction; which layer the
    definition sat in never was.
  - New `unresolved-token` warning for a declaration whose token is defined
    nowhere and which carries no fallback. It applies nothing, so it is not
    vocabulary — it is a bug, and it now says so. It found two on first contact.

  **Every consumer's baseline will move**, upward, on surfaces built with a
  utility framework. That is the correction, not a regression.

## 0.3.0

### Minor Changes

- 2075e76: `checkRestraint` measures the surface, not the framework underneath it.

  Two defects, both found by running the checker against a real compiled
  stylesheet — `apps/portal` in the Doman Digital monorepo — rather than against
  its own fixtures.

  **It rejected `EASE.inOut`, one of its own canonical curves.** The ease-in test
  compared only the first control point (`y1 < x1`), which is true of every
  ease-in-_out_ as well. So the standard failed its own checker on any surface
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
