---
"@domandigital/create-site": patch
---

The protected-preview gate matches Access destination hosts without building a regular expression from registry data, so semgrep's `detect-non-literal-regexp` rule no longer blocks the pull request of every site that installs the gate. Matching is unchanged.
