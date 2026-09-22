---
"@domandigital/craft": minor
---

Character, phase A: a tell catalogue, a source scanner, a copy engine, and the `craft` command.

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
