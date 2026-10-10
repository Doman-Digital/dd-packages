# @domandigital/create-site

## 0.6.0

### Minor Changes

- 4f88631: The site programme's gates, as code (DOM-647). A new site gets `scripts/gates/`, lifted from the Doman Digital redesign: the programme issue (Stage 01), `check-direction` against the registered copy, the token generator writing both sides of the sheet, `night-contrast`, the governed-facts check, the copy deck and the null-set check, all run by `prebuild`; `measure` at 1440 and 390; and `deploy:preview`, which sets `PUBLIC_PREVIEW` itself, measures with noindex required and deploys a preview only. With `docs/site-programme.md`, `site.programme.json`, `art-direction.sheets.json`, a `--programme DOM-123` flag, and playwright and tsx as dev dependencies. A scaffolded site no longer builds until its programme exists and Stages 05 and 06 are done.

## 0.5.1

### Patch Changes

- 09b49ac: New sites install `@domandigital/craft` `^0.19.0`, the release whose estate comparison measures ground temperature and section structure.

## 0.5.0

### Minor Changes

- 1c08793: A new site now passes the DD Framework rulebook (`dd doctor`) on the day it is made. The CI workflow pins every action to a commit SHA, runs on the organisation's runner in a private repo (GitHub's in a public one, chosen with the new `--visibility`), and pnpm projects get `minimumReleaseAge` in `pnpm-workspace.yaml` so a release must be a day old before it installs (house packages exempt). Before this, every new site started with SEC-001, CI-001 and SEC-002 findings that become failures on 31 December 2026.
  
  `--check` prints the plan, never prompts, and exits 3 when there is anything to do, a house file that differs from its template included, so CI and the nightly starter job can tell an up-to-date site from a drifted one.
  
  The privacy, cookie, terms and accessibility pages and the cookie banner come over from dd-base (Doman-Digital/dd-library), rewritten to read `site.facts.ts` instead of `{{TOKEN}}` placeholders: a new optional `legal` block holds company number, ICO number, retention, processors, governing law and a review date, and a page leaves out what is null. `launch:check` now fails until the banner is placed and the legal facts every site needs are filled in. The banner stores the choice under the same key dd-base used, offers "Necessary only" and "Accept measurement" with equal weight, and `openCookieSettings()` brings it back.
  
  New sites install `@domandigital/craft` `^0.18.0`, the release that adds `gradientContrast` and `checkPhotoReview`.

## 0.4.0

### Minor Changes

- c77c465: A new site now leaves behind `docs/client-facts.entry.json`: the technology the builder says it uses (host, DNS host, CMS, analytics and tags, error monitoring, email sending), shaped as an entry for Doman Digital's client register. It asks six new optional questions, or reads the same keys from `--answers`. Skipped answers are left out, not guessed; common names are mapped to the register's (`Google Analytics` becomes `ga4`); every tracking tool gets `consent: null` because the builder cannot know when it will run relative to the cookie banner. The entry is a data file, so `--force` never replaces it. The launch checklist gains a line asking for it to be handed over.

### Patch Changes

- ef257c9: New sites install `@domandigital/craft` `^0.17.0`, to follow the craft release that adds `craft register`.

## 0.3.2

### Patch Changes

- 6545c2e: New sites install `@domandigital/craft` at `^0.16.0`, the release that adds `craft calibrate` and `craft null import`.

## 0.3.1

### Patch Changes

- 8b6618b: New sites install `@domandigital/craft@^0.14.0`, the release with `specificity`, the `generic-hero-claim` and `unproven-claim` tells and `craft copy compare`.
- 006c97d: New sites install `@domandigital/craft@^0.15.0`, matching the pending craft minor release.

## 0.3.0

### Minor Changes

- a0724a8: The launch checklist now says, beside each register, what one of its real listings shows of the business's website: a followed link, a nofollow link, the address without a link, or nothing. 12 of the 42 registers were checked on 2026-09-24 this way; the rest say "Not checked" with the reason, usually a CAPTCHA or a bot challenge. `REGISTERS_CHECKED_ON` is gone: entries are checked, the list is not. The RICS entry now points at ricsfirms.com, where its Find a Surveyor listings live.

### Patch Changes

- 72527d6: New sites install `@domandigital/craft@^0.13.0`, the release with the stock component tells and `craft estate compare --component`.

## 0.2.0

### Minor Changes

- f9bc668: Generated sites now check dynamic routes. The route enumerators return `dynamicRoutesOnDisk()` alongside `routesOnDisk()`, the seeded `site.routes.ts` gets a `/prefix/*` policy entry for each dynamic route (Next.js `app/blog/[slug]`, Astro `src/pages/blog/[slug].astro`), and the generated coverage test passes them to seo's `validateCoverage`, so a new dynamic route with no policy fails `seo:check` instead of passing silently.

### Patch Changes

- 3122ba4: New sites install `@domandigital/craft@^0.12.0`, the release where a repo can no longer lower the house blocking tier under `craft copy --gate`.

## 0.1.0

### Minor Changes

- 9bf5c67: New package. `pnpm create @domandigital/site` runs first on a new Next.js or Astro client site: it installs the house packages and writes the files they read. That is the facts file, route policy, backlink register, redirects wired into the framework config, JSON-LD through graph, the designer credit, a press page, the SEO and house-rule tests, and the site's direction, launch checklist and search baseline. It never replaces a data file, refuses cleanly on a project it does not recognise, and reports drift from the house templates on a re-run.
