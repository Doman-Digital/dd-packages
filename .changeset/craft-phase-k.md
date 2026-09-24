---
"@domandigital/craft": minor
---

Phase K: snapshot version 2.

- Every section gains a `role`: `cta-band`, `footer-cta`, `pricing`, `testimonials`, `faq`, `process`, `features`, `team`, `contact`, or its `kind`. `kind` keeps its version 1 meaning, so the rendered tells and the calibrated null models and estate read exactly as before.
- Every section gains `geometry`: `centredShare`, `mirrorSymmetry`, `whitespaceRatio`, `contentWidthRatio`, `background` and `controls`. The page gains `rhythmVariance` (how much section heights vary).
- `visual`: colourfulness (Hasler and Süsstrunk), edge density and left-right symmetry, from a screenshot of the first 6000px. None of them passes or fails anything. `snapshotUrl(url, { visual: false })` skips the screenshot; a driver without `page.screenshot` gets no `visual`.
- `SNAPSHOT_VERSION` is 2. `readSnapshot()` reads version 1 files as version 2 marked `migratedFrom: 1`; every command that loads a saved snapshot uses it, so old snapshots still work.
- `FINGERPRINT_VERSION` is 2: fingerprints carry `sections` (role, centring, width), and `layoutDistance` compares by role and geometry when both sides have them. Against a version 1 fingerprint it compares by `kind`, exactly as before.
- New exports: `readSnapshot`, `READABLE_SNAPSHOT_VERSIONS`, `visualMeasures`, `EDGE_STEP`, `layoutDistance`, and the types `SectionRole`, `SectionGeometry`, `SnapshotVisual`, `FingerprintSection`, `RgbaImage`.
