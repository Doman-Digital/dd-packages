---
"@domandigital/craft": minor
---

Phase I: craft in CI.

- `craft.config.json`: `ignore` globs, `copyPaths` (where `craft copy` looks when given no path), and `severity` changes per tell. Every severity change needs a `because` of at least a sentence; `off` is applied as an exception, so the report still lists what it silenced. `--config <file>` points elsewhere.
- `.claude`, `.agents` and `.cursor` are never walked (a path named on the command line is still read).
- `--baseline <file>` reports only findings the baseline does not hold; `--update-baseline` writes it. Findings are keyed on tell, path and excerpt, not line, and counted.
- `--sarif <file>` writes SARIF 2.1.0 for GitHub code scanning.
- Every `--json` output carries `schemaVersion: 1`. The audit JSON adds `pages` and `failed`.
- `craft audit --pages <sitemap.xml | urls.txt>` and `--viewport 390,768,1440`. A page that will not load is listed as not measured and fails `--strict`.
- **Behaviour change:** a page that answers with an HTTP error (404, 500) is no longer snapshotted as if it were the page. `snapshotUrls` reports it as an error and `snapshotUrl` throws `HTTP <status>`. Before, a missing page was measured, and reported clean.
- New exports: `createBaseline`, `applyBaseline`, `parseBaseline`, `findingKey`, `parseCraftConfig`, `applySeverity`, `severityExceptions`, `globToRegExp`, `ignoreMatcher`, `DEFAULT_IGNORE`, `toSarif`, `toJson`, `JSON_SCHEMA_VERSION`.
