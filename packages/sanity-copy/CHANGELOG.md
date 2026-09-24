# @domandigital/sanity-copy

## 0.2.1

### Patch Changes

- f57f546: `withCopyCheck` accepts a real Studio's schema types. Sanity declares its definitions as interfaces, which have no index signature, so the old `SchemaTypeLike` made `tsc` fail in the first Studio it was installed in.
- Updated dependencies [bbf1f54]
  - @domandigital/craft@0.9.0

## 0.2.0

### Minor Changes

- 7765dda: First release. `withCopyCheck(schemaTypes)` adds the house copy check to every Sanity document type as validation warnings on the field that caused them, including inside Portable Text and image alt text. `checkDocumentCopy` runs the same check anywhere. The `sanity-copy` command sweeps a whole dataset (public, or private with `SANITY_API_TOKEN`) and lists findings by document and field. No Sanity dependency.

### Patch Changes

- Updated dependencies [2b6f823]
- Updated dependencies [7765dda]
- Updated dependencies [ef5b85b]
  - @domandigital/craft@0.8.0
