---
"@domandigital/craft": patch
---

A labelled page, a null page and an imported page now count as a home page, so `generic-hero-claim` can fire on them. Before, every local `file://` page read as an inner page and the tell could never fire on a labelled or null set. `Snapshot` gains an optional `home`; absent, the URL decides as before. `craft calibrate` takes `home: false` on a label entry, and its per-tell table shows each tell's catalogue generation.
