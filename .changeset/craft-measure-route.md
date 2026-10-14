---
"@domandigital/craft": patch
---

`measureRoute(open, options)` measures every viewport for a page only the caller can open, such as a portal screen behind a sign-in: the phone half in a page the caller opens in `PHONE`, the wide half in one it opens in `DESKTOP` (now exported), merged and written once for `craft phone-first --measured`, as `measureSite` does for a public page (DOM-835).
