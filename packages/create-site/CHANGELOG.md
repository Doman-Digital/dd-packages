# @domandigital/create-site

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
