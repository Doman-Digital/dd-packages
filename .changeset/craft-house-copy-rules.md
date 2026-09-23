---
"@domandigital/craft": minor
---

The house copy rules move into craft, so `copy-check` can become a thin wrapper over `craft copy --json`.

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
