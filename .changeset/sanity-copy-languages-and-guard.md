---
"@domandigital/sanity-copy": minor
---

Localised content, hidden fields, and an opt-in publish guard.

- `languages` option (e.g. `["en"]`): copy in other languages is skipped. The language comes from an internationalized-array item's `language` field (plugin v5), or from its `_key` (v4); from a field-level translation object whose keys are all two-letter language tags; or from a document's `language` field. `"en"` covers `en-GB` and `en_US`. Unset: unchanged.
- `withCopyGuard(publishAction)`: opt-in. Publishing stays disabled while the document has a blocking-tier finding, and the finding shows as the tooltip. It returns the Studio's own action type. No Sanity import.
- `withCopyCheck` never reads fields the schema hides with a static `hidden: true`, inline or through a named object type (new `hiddenPaths` option underneath). `hidden` functions are not evaluated.
- `language` and `locale` are skipped fields; mixed-case locale tags such as `nb_NO` are no longer read as copy; `assist.instruction.context` (AI Assist instructions) is an excluded type.
- The Studio validation cache is keyed on the collected copy, so editing a link or a slug no longer re-runs the check.
