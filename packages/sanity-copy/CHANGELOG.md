# @domandigital/sanity-copy

## 0.3.0

### Minor Changes

- cd13c94: `sanity-copy --claims` lists every price, figure, date and named source in a dataset, on its field, marked sourced or UNSOURCED, for a person to check against the primary source. `documentClaims(doc)` does the same in code.

### Patch Changes

- cd13c94: `withCopyCheck` accepts a real Studio's schema types. Sanity declares its definitions as interfaces, which have no index signature, so the old `SchemaTypeLike` made `tsc` fail in the first Studio it was installed in.
- Updated dependencies [cd13c94]
- Updated dependencies [cd13c94]
  - @domandigital/craft@0.10.0

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
