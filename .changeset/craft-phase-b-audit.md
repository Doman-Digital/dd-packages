---
"@domandigital/craft": minor
---

Phase B: the rendered page. `craft snapshot`, `craft audit`, rendered detection paths and a fingerprint.

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
