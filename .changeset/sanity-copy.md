---
"@domandigital/sanity-copy": minor
---

First release. `withCopyCheck(schemaTypes)` adds the house copy check to every Sanity document type as validation warnings on the field that caused them, including inside Portable Text and image alt text. `checkDocumentCopy` runs the same check anywhere. The `sanity-copy` command sweeps a whole dataset (public, or private with `SANITY_API_TOKEN`) and lists findings by document and field. No Sanity dependency.
