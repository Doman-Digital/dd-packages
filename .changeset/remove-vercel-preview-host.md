---
"@domandigital/create-site": minor
"@domandigital/synthetic": patch
"@domandigital/craft": patch
---

Sites made with create-site deploy their preview to Cloudflare only. `scripts/gates/deploy-preview.mjs` no longer has a Vercel branch or looks for `.vercel/project.json`, `preview.host` in `site.programme.json` is `cloudflare` or null, the `host` answer prompt suggests `cloudflare`, and `docs/site-programme.md` and the README say so. A site that still sets `preview.host` to `vercel` now stops at Stage 06 with a message naming the host; remove the key or set it to `cloudflare`. The synthetic README and a craft comment no longer name Vercel; no behaviour changes in those two.
