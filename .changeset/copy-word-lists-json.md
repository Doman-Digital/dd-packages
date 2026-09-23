---
"@domandigital/craft": patch
---

Export the copy catalogue's word and phrase lists as portable JSON
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
