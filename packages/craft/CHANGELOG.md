# @domandigital/craft

## 0.12.0

### Minor Changes

- 7622bd9: Phase K: snapshot version 2.

  - Every section gains a `role`: `cta-band`, `footer-cta`, `pricing`, `testimonials`, `faq`, `process`, `features`, `team`, `contact`, or its `kind`. `kind` keeps its version 1 meaning, so the rendered tells and the calibrated null models and estate read exactly as before.
  - Every section gains `geometry`: `centredShare`, `mirrorSymmetry`, `whitespaceRatio`, `contentWidthRatio`, `background` and `controls`. The page gains `rhythmVariance` (how much section heights vary).
  - `visual`: colourfulness (Hasler and Süsstrunk), edge density and left-right symmetry, from a screenshot of the first 6000px. None of them passes or fails anything. `snapshotUrl(url, { visual: false })` skips the screenshot; a driver without `page.screenshot` gets no `visual`.
  - `SNAPSHOT_VERSION` is 2. `readSnapshot()` reads version 1 files as version 2 marked `migratedFrom: 1`; every command that loads a saved snapshot uses it, so old snapshots still work.
  - `FINGERPRINT_VERSION` is 2: fingerprints carry `sections` (role, centring, width), and `layoutDistance` compares by role and geometry when both sides have them. Against a version 1 fingerprint it compares by `kind`, exactly as before.
  - New exports: `readSnapshot`, `READABLE_SNAPSHOT_VERSIONS`, `visualMeasures`, `EDGE_STEP`, `layoutDistance`, and the types `SectionRole`, `SectionGeometry`, `SnapshotVisual`, `FingerprintSection`, `RgbaImage`.

- 07d1cf5: From the 2026-09-11 AI-look research. A new tell, `shadcn-card-stock`: the registry Card recipe left unchanged (`warn`). Cal Sans joins the second-wave reflex fonts. The icon-tile tells now see Unicons, MUI icons and Material Symbols as well as Lucide, Heroicons, Phosphor and Tabler. `craft direction validate` warns when a display or body face is missing from the new licence register, or is capped, per-site or unverified there. The register ships as `licences.json` and as `LICENCES` and `faceLicence()`. Catalogue `2026.09.9`.
- c63cded: **Behaviour change:** under `craft copy --gate`, a repo can no longer lower the house blocking tier. A `warn` or `off` in `craft.config.json`, or an `art-direction.json` exception, naming a blocking tell (em dash, contrastive negation, chatbot residue and the rest) is refused and listed as "Exception not applied". Raising a tell still works, runs without `--gate` are unchanged, and a genuine one-off still takes `copy-ok` on its line. `holdHouseBlocks` and `HOUSE_LOCKED` are exported from the house policy.

## 0.11.0

### Minor Changes

- e2ea0e8: Phase I: craft in CI.

  - `craft.config.json`: `ignore` globs, `copyPaths` (where `craft copy` looks when given no path), and `severity` changes per tell. Every severity change needs a `because` of at least a sentence; `off` is applied as an exception, so the report still lists what it silenced. `--config <file>` points elsewhere.
  - `.claude`, `.agents` and `.cursor` are never walked (a path named on the command line is still read).
  - `--baseline <file>` reports only findings the baseline does not hold; `--update-baseline` writes it. Findings are keyed on tell, path and excerpt, not line, and counted.
  - `--sarif <file>` writes SARIF 2.1.0 for GitHub code scanning.
  - Every `--json` output carries `schemaVersion: 1`. The audit JSON adds `pages` and `failed`.
  - `craft audit --pages <sitemap.xml | urls.txt>` and `--viewport 390,768,1440`. A page that will not load is listed as not measured and fails `--strict`.
  - **Behaviour change:** a page that answers with an HTTP error (404, 500) is no longer snapshotted as if it were the page. `snapshotUrls` reports it as an error and `snapshotUrl` throws `HTTP <status>`. Before, a missing page was measured, and reported clean.
  - New exports: `createBaseline`, `applyBaseline`, `parseBaseline`, `findingKey`, `parseCraftConfig`, `applySeverity`, `severityExceptions`, `globToRegExp`, `ignoreMatcher`, `DEFAULT_IGNORE`, `toSarif`, `toJson`, `JSON_SCHEMA_VERSION`.

- 3eb1560: CommonJS consumers now get the CommonJS type declarations. The `exports` map put a top-level `types` (the ESM `.d.ts`) ahead of `require`, so TypeScript resolving a `require` under `node16` stopped at the ESM file ("Masquerading as ESM" in @arethetypeswrong/cli). `types` now sits inside `import` and `require` separately. Runtime behaviour is unchanged.

  Requires Node 22.12 or later (`engines.node`). Node 20 reached end of life on 2026-04-30. Also declares `sideEffects` so bundlers can tree-shake (craft keeps its CSS).

## 0.10.0

### Minor Changes

- cd13c94: `craft copy claims <paths>` lists every sentence holding a price, figure, date or named source, marked sourced or UNSOURCED, for a person to check against the primary source. `findClaims` and `formatClaims` do the same in code. No tell can tell a true figure from a false one; this makes the checking a list instead of a hunt.
- cd13c94: Catalogue 2026.09.8, from reading all 144 review findings on the live DD site. New tell `prompt-context` (review): the model naming its own inputs, "the attached Perplexity research file", 24 real hits in five live articles. Tuned: `inline-label-list` leaves reference and data lists alone (0 of 11 hits were real), `staccato-triplet` no longer crosses a paragraph break, `ing-tail` passes a list of tasks, `repeated-sentence` ignores footnotes repeating a source title.

## 0.9.0

### Minor Changes

- bbf1f54: `chatbot-residue` moves to the house blocking tier. A pasted chat reply (citation tokens, entity markers, "as an AI language model") now fails `craft copy --gate`, `copy-check` and `sanity-copy`. Its estate hits were read first: 15 of 15 real, no false alarms.

## 0.8.1

### Patch Changes

- 74a6fd6: `chatbot-residue` now finds ChatGPT entity markers, such as `entity["company","Bark","services marketplace"]`, which render as visible text where a plain name belongs. Found live on a published article, 2026-09-23. Catalogue version 2026.09.7.

## 0.8.0

### Minor Changes

- 2b6f823: The house copy standard moves into craft. `COPY.md` ships in the package, `craft copy --gate` applies the house policy (the blocking tier fails the run), and `craft tells list --json` publishes each copy tell's house tier so `copy-check` reads the policy instead of keeping its own list. Catalogue 2026.09.4 adds the density tier (`phrase-density`, `aphorism-density`, `contraction-scarcity`, `sentence-rhythm`, `repeated-sentence`, `heading-shape`, `heading-echo`) and four review tells from research (`ing-tail`, `vague-attribution`, `closing-summary`, `false-range`), all warn. The emoji tell now catches sparkles, the green tick box and other emoji in the older symbol blocks.

  Words inside a URL or a Markdown link target are no longer read as copy, so a slug such as `/seamless-booking` no longer blocks.

- 7765dda: Catalogue 2026.09.6, tuned against the Doman Digital site's live Sanity content. `chatbot-residue` reads a run of ChatGPT citation tokens as one finding, through the invisible private-use characters ChatGPT wraps them in. `placeholder` skips a placeholder inside quotation marks, which is a template being taught. `vague-attribution` skips a claim that names its source or carries a footnote or link. `inline-label-list` fires only when the text after the label is six words or fewer, so a definition list passes.
- ef5b85b: Catalogue 2026.09.5. Four more review tells: `chatbot-residue` (pasted chat replies, chat citation tokens, links tracked `utm_source=chatgpt.com`), `placeholder` (`[Insert ...]`, lorem ipsum, `TODO_PLACEHOLDER`, including a placeholder that is a whole element), `question-reveal` and `inline-label-list`. New command `craft copy compare <before> <after>`: the preservation gate, listing the protected facts (prices, numbers, dates, times, phones, emails, links, postcodes, names) a rewrite lost or added, exit 1 if any. Exported as `compareFacts` and `protectedFacts`.

## 0.7.0

### Minor Changes

- dbdef56: Signal 2, the counterfactual. `craft null build --brief "..." --out <dir>` asks `claude -p` for about 20 home pages from the brief alone, renders and fingerprints each, and writes `null.json`. `craft audit <url> --null <dir>` scores how typical a page is against them: the share of the model's own pages that sit further out than this one, typical at 0.10 or above, with the choices it shares with most of them. `craft tells harvest <dir>` lists what recurs across null pages and which tell already catches it, so the next generation of tells comes from what the model builds now. `snapshotUrls` in `@domandigital/craft/audit` snapshots several pages through one browser. The rendered reveal check now also reads the text blocks inside a section, so reveals on cards two levels down are no longer read as a still page.
- f765c69: Signal 3, the estate. `craft estate add <url | snapshot.json> --id <id>` fingerprints a shipped site into `estate.json`; `craft estate compare` lists every pair, or one site against the rest, closest first, and marks siblings: two sites closer together than two pages Claude builds for one brief (0.31, or measured again from `--null`). What a pair shares is named in plain words ("Fraunces headline", "no accent"). `--strict` exits 1 on a sibling. `craft direction propose --estate estate.json` reads the register. The fingerprint no longer takes a small painted patch, such as a floating chat button, for the accent: a painted colour needs a panel's worth of area.
- f3c3dc0: The character report. `craft report <url | snapshot.json>` reads a site against all three signals and the reason rule (`--repo`, `--null`, `--estate`, `--direction`) and gives a verdict: default, mixed, decided, or unproven when something was not measured. The actions come in retrofit order, one per choice, with every reason that points at it. `craft retrofit` writes them as a Markdown checklist that names the art-direction choice settling each change, shows the decided value, and ends with what to leave alone. `characterReport` and `retrofitPlan` are exported. System font keywords such as `ui-monospace` no longer read as CSS variable names.

### Patch Changes

- 235b558: Export the copy catalogue's word and phrase lists as portable JSON
  (`wordListsJson()`, checked in at `word-lists.json`), so a non-TypeScript
  consumer can source from them instead of duplicating them by hand.

  `claude-kit`'s `copy_check.py` hardcoded its own copies of these same lists
  and had drifted from this package (documented in claude-kit's
  `house-style/copy-rules.md`, "Note the enforcement gap"). `word-lists.json` is
  the file that ends the drift: `install/sync-copy-wordlists.sh` on that side
  copies it in verbatim, the same shape `sync-craft-standard.sh` already uses
  for `STANDARD.md`.

  No tell's detection or severity changed. Regenerate the checked-in file with
  `pnpm --filter @domandigital/craft run docs` after editing any list in
  `tells/copy.ts`.

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
