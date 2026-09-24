---
"@domandigital/seo": patch
---

`validateRedirects` compares paths with the package's own `normalizeRoutePath` instead of a private copy, so a redirect or linked path written without a leading slash, or with repeated trailing slashes, matches the same route the rest of the package would.
