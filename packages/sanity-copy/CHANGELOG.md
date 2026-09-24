# @domandigital/sanity-copy

## 0.4.1

### Patch Changes

- Updated dependencies [7622bd9]
- Updated dependencies [07d1cf5]
- Updated dependencies [c63cded]
  - @domandigital/craft@0.12.0

## 0.4.0

### Minor Changes

- 3eb1560: CommonJS consumers now get the CommonJS type declarations. The `exports` map put a top-level `types` (the ESM `.d.ts`) ahead of `require`, so TypeScript resolving a `require` under `node16` stopped at the ESM file ("Masquerading as ESM" in @arethetypeswrong/cli). `types` now sits inside `import` and `require` separately. Runtime behaviour is unchanged.

  Requires Node 22.12 or later (`engines.node`). Node 20 reached end of life on 2026-04-30. Also declares `sideEffects` so bundlers can tree-shake (craft keeps its CSS).

- a5868b0: Localised content, hidden fields, and an opt-in publish guard.

  - `languages` option (e.g. `["en"]`): copy in other languages is skipped. The language comes from an internationalized-array item's `language` field (plugin v5), or from its `_key` (v4); from a field-level translation object whose keys are all two-letter language tags; or from a document's `language` field. `"en"` covers `en-GB` and `en_US`. Unset: unchanged.
  - `withCopyGuard(publishAction)`: opt-in. Publishing stays disabled while the document has a blocking-tier finding, and the finding shows as the tooltip. It returns the Studio's own action type. No Sanity import.
  - `withCopyCheck` never reads fields the schema hides with a static `hidden: true`, inline or through a named object type (new `hiddenPaths` option underneath). `hidden` functions are not evaluated.
  - `language` and `locale` are skipped fields; mixed-case locale tags such as `nb_NO` are no longer read as copy; `assist.instruction.context` (AI Assist instructions) is an excluded type.
  - The Studio validation cache is keyed on the collected copy, so editing a link or a slug no longer re-runs the check.

### Patch Changes

- Updated dependencies [e2ea0e8]
- Updated dependencies [3eb1560]
  - @domandigital/craft@0.11.0

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
