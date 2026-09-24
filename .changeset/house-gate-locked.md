---
"@domandigital/craft": minor
---

**Behaviour change:** under `craft copy --gate`, a repo can no longer lower the house blocking tier. A `warn` or `off` in `craft.config.json`, or an `art-direction.json` exception, naming a blocking tell (em dash, contrastive negation, chatbot residue and the rest) is refused and listed as "Exception not applied". Raising a tell still works, runs without `--gate` are unchanged, and a genuine one-off still takes `copy-ok` on its line. `holdHouseBlocks` and `HOUSE_LOCKED` are exported from the house policy.
