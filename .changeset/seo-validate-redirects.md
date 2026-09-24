---
"@domandigital/seo": minor
---

Add `validateRedirects`, the migration gate: every URL another site links to must still land on a page in one hop. It flags linked URLs with no page and no redirect, redirects to missing pages, chains, loops, redirects that hide a live page, redirects to `noindex` pages and duplicate redirects. Add `liveLinkedUrls` and the `Backlink` types for a site's `links.json`, and ship `links.schema.json` and `redirects.schema.json`. All provisional: pin exactly if you depend on them before a second consumer settles the shape.
