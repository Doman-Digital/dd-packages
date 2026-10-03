---
"@domandigital/create-site": minor
---

A new site now passes the DD Framework rulebook (`dd doctor`) on the day it is made. The CI workflow pins every action to a commit SHA, runs on the organisation's runner in a private repo (GitHub's in a public one, chosen with the new `--visibility`), and pnpm projects get `minimumReleaseAge` in `pnpm-workspace.yaml` so a release must be a day old before it installs (house packages exempt). Before this, every new site started with SEC-001, CI-001 and SEC-002 findings that become failures on 31 December 2026.

`--check` prints the plan, never prompts, and exits 3 when there is anything to do, a house file that differs from its template included, so CI and the nightly starter job can tell an up-to-date site from a drifted one.

The privacy, cookie, terms and accessibility pages and the cookie banner come over from dd-base (Doman-Digital/dd-library), rewritten to read `site.facts.ts` instead of `{{TOKEN}}` placeholders: a new optional `legal` block holds company number, ICO number, retention, processors, governing law and a review date, and a page leaves out what is null. `launch:check` now fails until the banner is placed and the legal facts every site needs are filled in. The banner stores the choice under the same key dd-base used, offers "Necessary only" and "Accept measurement" with equal weight, and `openCookieSettings()` brings it back.
