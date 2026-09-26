---
"@domandigital/craft": minor
---

Add art direction version 2 with customer job maps, per-page hierarchy and
reasons tied to the job. Record and compare declared directions before build,
print job-only research prompts, and validate order and token drift against
saved snapshots or preview URLs. Existing version 1 files remain valid with a
warning; the report requires all three layers before marking reasons decided.

Estate entries registered before build have no fingerprint. `EstateSite.fingerprint`
is now optional; rendered comparisons skip those entries until a snapshot is added.
