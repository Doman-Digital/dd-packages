---
"@domandigital/craft": minor
---

The calibration captures and the reviewer corpus move to a private repository, and craft names no client, client person, staff member or reviewer. `calibration/` and `reviews/` now live in Doman-Digital/dd-craft-corpus; the tests that read them find it through `CRAFT_CORPUS_DIR` or a `dd-craft-corpus` checkout beside dd-packages, and skip with a note when it is absent. The shape calibration scripts find it the same way and stop, saying where to put it, when it is missing, and `scripts/blind/prepare.mjs` reads each site's null-model brief from the run's config (`nullBrief`). The docs that ship (README, PRINCIPLES, COPY, CHARACTER, REGISTERS, CHANGELOG) describe clients and reviewers by trade and role instead of by name. A new guard, `scripts/deny-check.mjs`, checks every shipped file, the rest of the package and the packed tarball against salted hashes of the names, and goes red on a canary to prove it works. No API changes.
