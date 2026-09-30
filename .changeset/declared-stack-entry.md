---
"@domandigital/create-site": minor
---

A new site now leaves behind `docs/client-facts.entry.json`: the technology the builder says it uses (host, DNS host, CMS, analytics and tags, error monitoring, email sending), shaped as an entry for Doman Digital's client register. It asks six new optional questions, or reads the same keys from `--answers`. Skipped answers are left out, not guessed; common names are mapped to the register's (`Google Analytics` becomes `ga4`); every tracking tool gets `consent: null` because the builder cannot know when it will run relative to the cookie banner. The entry is a data file, so `--force` never replaces it. The launch checklist gains a line asking for it to be handed over.
