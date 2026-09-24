---
"@domandigital/sanity-copy": patch
---

`withCopyCheck` accepts a real Studio's schema types. Sanity declares its definitions as interfaces, which have no index signature, so the old `SchemaTypeLike` made `tsc` fail in the first Studio it was installed in.
