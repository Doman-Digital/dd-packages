---
"@domandigital/create-site": minor
---

The site programme's gates, as code (DOM-647). A new site gets `scripts/gates/`, lifted from the Doman Digital redesign: the programme issue (Stage 01), `check-direction` against the registered copy, the token generator writing both sides of the sheet, `night-contrast`, the governed-facts check, the copy deck and the null-set check, all run by `prebuild`; `measure` at 1440 and 390; and `deploy:preview`, which sets `PUBLIC_PREVIEW` itself, measures with noindex required and deploys a preview only. With `docs/site-programme.md`, `site.programme.json`, `art-direction.sheets.json`, a `--programme DOM-123` flag, and playwright and tsx as dev dependencies. A scaffolded site no longer builds until its programme exists and Stages 05 and 06 are done.
