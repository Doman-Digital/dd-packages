# @domandigital/create-site

The first thing that runs on a new Doman Digital client site. It installs the
house packages and writes the per-site files they read, so every build starts
on the same foundation before a single page is designed.

```bash
pnpm create next-app@latest acme && cd acme
pnpm create @domandigital/site

# or Astro
pnpm create astro@latest acme && cd acme
pnpm create @domandigital/site
```

With npm, flags go after `--`, or npm keeps them for itself:
`npm create @domandigital/site@latest -- --dry-run`.

## Thin scaffold, fat packages

It copies no package code into the site. Logic lives in
`@domandigital/graph`, `@domandigital/seo` and `@domandigital/craft`, installed
at a version range; the site only gets the files those packages read. A site
upgrades by bumping packages. A template repo copied once drifts from the day
it is copied, which is the failure this exists to avoid.

## What it writes

| File | What it is |
| --- | --- |
| `site.facts.ts` | The only source of the business's name, contact details, places, accreditations and profiles. Unknown is `null`, never a placeholder |
| `site.routes.ts` | Every page's indexing policy, keyword targets and internal links, seeded from the pages already on disk |
| `links.json` | The backlink register: links the business has earned. It has no status for asks |
| `redirects.json` | Every moved URL, read by `next.config` or `astro.config` |
| `lib/graph/site-adapter.ts`, `lib/graph/page-graph.ts` | `site.facts.ts` mapped onto `@domandigital/graph`, and one JSON-LD graph per page. Only live profiles become `sameAs`; only checked accreditations reach search engines |
| `components/JsonLd`, `components/DesignerCredit` | The JSON-LD script, and the credit: "Website by Doman Digital", linking to the homepage, `rel="nofollow"` |
| `/press`, `/resources` | A press page built from the data files, and a noindex home for the site's linkable assets |
| `/privacy`, `/cookies`, `/terms`, `/accessibility` | The legal pages from dd-base (Doman-Digital/dd-library), reading the `legal` block of `site.facts.ts`. A null fact is left off the page, never shown as a placeholder |
| `components/CookieBanner`, `components/WebAnalytics`, `lib/consent.ts`, `lib/web-analytics.ts`, `lib/legal.ts` | The cookie banner with a settings view (necessary only, or measurement as well, with equal weight), and a Visit statistics switch that is on by default and kept apart from them. `getConsent()` for anything that sets a non-essential cookie, `getStatistics()` and `<WebAnalytics />` for the Cloudflare Web Analytics beacon, which loads for every visitor unless they switch Visit statistics off. `openCookieSettings()` to change the choice, and the legal facts with defaults. The token goes in `site.facts.ts`. The rule is `docs/web-analytics.md` in claude-kit |
| `tests/seo/*`, `tests/house.test.ts` | Route coverage, the redirect gate, JSON-LD integrity, the redirect wiring, and the rule that contact details live only in the facts file |
| `docs/HOUSE.md` | The house rules, imported by `CLAUDE.md` (created if missing, otherwise one import line is added) |
| `docs/DIRECTION.md`, `docs/seo-launch-checklist.md`, `docs/seo-baseline.md` | The site's decision and blocked registers, the listings to claim for its sector, and the launch, 90-day, 6-month and 12-month baseline |
| `docs/client-facts.entry.json` | The technology the builder says the site uses, as an entry for Doman Digital's client register. It records what the builder declared, so every tracking tool has `consent: null` until someone fills it in from what the site does. Skipped answers are simply absent |
| `.github/workflows/seo-check.yml` | Only if the project has no workflows yet. Written to pass `dd doctor`: actions pinned to a commit SHA, the runner chosen by `--visibility`, a timeout and a concurrency group |
| `pnpm-workspace.yaml` | pnpm projects: `minimumReleaseAge: 1440` (house packages exempt), added to the file create-next-app writes, or a new one. A project's own value is kept |
| `scripts/gates/*`, `docs/site-programme.md` | The site programme's gates and the process they belong to: see below |
| `site.programme.json`, `art-direction.sheets.json` | The site's answers to the gates (the programme issue, paths, pages to measure, the null harvest, the preview host), and both sides of the sheet beyond the direction's own ground and accent. Unknown is `null` |
| `package.json` | `seo:check`, `launch:check`, `prebuild`, `tokens`, `deck`, `measure` and `deploy:preview` scripts, and the house packages |

It then runs `craft direction init` through the installed craft bin to start
`art-direction.json`, unless one exists.

## The site programme

Every site is made in ten stages (`docs/site-programme.md`, decided on
10 October 2026 in DOM-647 after the Doman Digital redesign, DOM-392). The
programme lives in Linear, opened from the "Site programme" template; the
scaffold carries its gates as code, lifted from `apps/site/scripts` in
Doman-Digital. `prebuild` runs them in stage order and the first failure stops
the build:

| Gate | Stage | Stops the build when |
| --- | --- | --- |
| programme issue | 01 | `site.programme.json` names no Linear issue (`--programme DOM-123`) |
| `check-direction.mjs` | 05 | `art-direction.json` is missing, invalid, undecided, or differs from its registered copy in the craft estate |
| `tokens.mjs` | 05 | a day or night value is null. Writes the token stylesheet, both sides of the sheet |
| `night-contrast.mjs` | 05 | a text pair is under 4.5:1 by day or by night |
| `facts.mjs` | 06 | a price, term or response target is typed instead of imported from the facts |
| `copy-deck.mjs --check` | 06 | the copy deck is missing, empty or not rendered |
| `null-check.mjs` | 06 | the deck carries a phrase the null builds kept writing, without a reason |
| `mobile-first.mjs` | 06 | the source has a `max-width` media query or a Tailwind `max-*:` variant with no recorded exception: the phone is the base layout |

`pnpm measure` serves the last build and measures it at every viewport, phone
first, with craft's measure (`@domandigital/craft/phone`, the one the portal
gates use): the ladder 320, 375, 390, 430, landscape 844 x 390, 768, 1024,
1280, 1440 and 1920, and a sweep from 320 to 1920 in 16 to 32px steps. At any
width it fails on sideways scroll, on text over other text, on a cut-off page
title, on text under 12px and on a label outside its container; on a phone, on
a target under 44px and a form field set under 16px; on a short phone (375 x
667), on a main action below the first screen (`measure.mainAction`), fixed
layers over a quarter of the screen, images far larger than they are shown or
stretched, a phone, email or number field with the wrong keyboard or no
autocomplete, a phone number that is not a `tel:` link, and a page longer than
its `measure.screens` budget (phone screens to the footer, page height over 667;
printed for every page even with no budget); in landscape, on
fixed layers over half the height; at 1440 and 1920, on body lines over 80
characters. `measure.baseline` lists known failures so they stay visible.
`pnpm deploy:preview` is the only deploy: it sets `PUBLIC_PREVIEW` itself,
builds, measures with noindex required, and deploys a preview to Cloudflare;
it refuses `--prod` and public custom domains. A private custom staging
address is allowed only when the exact hostname and Worker are registered
in the merged DD Access registry, the live Access policy allows only the
registered DD reviewers for 24 hours, and both Worker preview URLs are
disabled. So a site made
with create-site cannot build until its programme exists and Stages 05 and 06
are done, and cannot reach a URL unmeasured.

For private staging, register the gate with `dd-access-gate` first and apply
it before the first upload. Set `preview.protected` in `site.programme.json`
with `gateKey`, `workerName`, `hostname`, `accountId`, `appName`, `teamDomain`,
`reviewerGroupId` and `probePaths` (the root, a real page and a real asset).
The hostname must start with `staging.`. The Wrangler JSON or JSONC config
must name that exact Worker and account, set `workers_dev: false` and
`preview_urls: false`, and contain only one route:
`{ "pattern": "staging.example.com", "custom_domain": true }`.
Named Wrangler environments are refused for this path.

The guard reads `config/access-gates.json` from `origin/main` in
`~/GitHub/dd-agent-kit`, so another session's local kit edits cannot change
the approved policy. Fetch that repo when adopting a new gate. Missing
registry data or a failed Cloudflare read stops deployment. The guard uses
the existing `cf` login, checks every page of Access apps, groups and identity
providers, refuses overlapping apps and bypass rules, and repeats the check
immediately before uploading. After upload it checks the live Worker URL
settings and anonymous redirects for all probe paths. A failed final check
means the upload happened but the preview is not ready to share.

The gate scripts are house files, identical on every site and reported by
`--check` when they drift. Everything that differs between sites is in
`site.programme.json`.

## Starting is mandatory: the programme gate, the label and handover

A real run first asks `dd-programme gate DOM-123 --stage 05`, so nothing is scaffolded before the
programme has accepted Stage 05. If the gate fails, or `dd-programme` is not installed, the run is refused and writes
nothing. `--no-gate` (or `DD_CREATE_SITE_NO_GATE=1`, which the nightly starter job uses) skips it; the label records the skip.

`.dd/site-start.json` says how the site was started: `mode` (`programme` or `handover`), the programme issue, the
gate result, and for a handover the reason and the visible pieces added. It describes; it is not the proof. The proof is
`create-site --check` passing, which the estate sweep in dd-repo-registry runs against every site, in any GitHub account.

A site copied in from a client's live build is started with:

```bash
create-site --handover --reason "client's existing Astro site, copied in" --programme DOM-123
```

It adds the invisible layers only: the facts file, routes, redirects, JSON-LD, the SEO tests and the gates. It keeps the client's
look and copy. The build then blocks on `facts.mjs`, reports `check-direction.mjs` and `mobile-first.mjs` without stopping, and skips tokens,
night contrast, the copy deck and the null check. Nothing a visitor can see is added until the founder says yes for that site; then
re-run with `--with credit,consent,analytics,legal,press,resources` for the pieces agreed. `--check` reads the mode from the label.
Capture the live site's claims with `dd-claims` before anything else changes.

## What it never does

- Write outside the project, or anything at all when it refuses.
- Replace a data file (`site.facts.ts`, `site.routes.ts`, `links.json`,
  `redirects.json`, `docs/DIRECTION.md`, the checklist, the baseline,
  `site.programme.json`, `art-direction.sheets.json`), even with
  `--force`. Delete one to regenerate it.
- Replace a house template file that differs, unless `--force`. Without it,
  the difference is reported: a re-run is also a drift report.
- Guess at a framework config it does not recognise. It prints what to add,
  and `tests/seo/config.test.ts` fails until someone does.
- Invent an answer. With `--yes` or no terminal, a missing required answer is
  an error that names the flag.

## Flags

```
create-site [dir] [--client <legal name>] [--trading-name <name>]
            [--site-url <https://...>] [--sector trades|beauty|clinics|professional]
            [--description "<one or two sentences>"] [--programme DOM-123]
            [--answers <file.json>] [--handover --reason "<why>" [--with <pieces>]] [--no-gate]
            [--visibility private|public] [--dry-run] [--check] [--force]
            [--skip-install] [--yes] [--help] [--version]
```

`--visibility` is the GitHub repo's (default `private`). A private repo's
workflow runs on `${{ vars.CI_RUNNER || 'ubuntu-latest' }}`; a public one on
`ubuntu-latest`, because a fork's pull request must never reach the
self-hosted runners.

`--check` is `--dry-run` for CI: it never prompts and exits 3 when there is
work to do, including a house file that differs from its template. Give it the
same answers the site was made with (`--answers`).

`--answers` takes a JSON file with any of `legalName`, `tradingName`,
`siteUrl`, `sector`, `description`, `phone`, `email`, `locality`,
`postalCode`, `serviceAreas`, `registers` (ids from `src/sectors.ts`) and
`previousHosts`, `programme` (the Linear issue, like `--programme`), and the
declared technology: `host` (`cloudflare` also becomes the preview
host in `site.programme.json`), `dns`, `cms`,
`analytics` (a list, e.g. `["ga4", "gtm", "posthog"]`), `errorMonitoring` and
`emailSending` (a list). Each can be skipped, and a skipped one is left out of
`docs/client-facts.entry.json`, never filled with a guess. Common names are
mapped to the register's (`Google Analytics` becomes `ga4`); anything that
cannot be a register name (lowercase letters, digits, dots, hyphens) stops the
run with exit code 2 before anything is written.

Exit codes: 0 done, 1 refused (nothing written), 2 usage error, 3 `--check`
found work to do.

## Supported projects

Next.js with the App Router (`app/` or `src/app/`) and Astro (`src/pages/`),
both TypeScript. The package manager comes from the lockfile, then
`packageManager` in `package.json`, then whatever ran the command.

On Astro with static output, redirects are meta-refresh pages rather than
301s. For a migration, deploy with a host adapter or add host-level redirects;
the launch checklist says so.

## The sector register list

`src/sectors.ts` lists the UK registers and directories each sector can claim.
Each entry records what a real listing shows of the business's website
(`followed`, `nofollow`, `shown-unlinked` or `not-shown`), the date someone
opened one, and a note naming the listing or saying why none could be read.
An entry nobody has checked has `website: null`, and the generated checklist
says "Not checked" beside it, with the reason. A test refuses a status without
a date and a date without a status.

On 2026-09-24, 12 of the 42 entries were checked by rendering a listing in a
browser. Most of the rest sit behind a CAPTCHA or a bot challenge, or have no
single register. They need a person with a browser.

## Passing the rulebook

A site made by `dd new` (Doman-Digital/dd-ci-standards) runs create-next-app,
then this, then `dd adopt`, and `dd doctor` is clean: nothing failing, nothing
warning, nothing exempt. The nightly starter job (`.github/workflows/starters.yml`
in dd-packages) makes a starter from scratch the same way every night, builds
it and runs `dd doctor` on it, so a rule the templates stop meeting is in Slack
the next morning.

## Upgrading a site

Bump the house package ranges, then run `pnpm create @domandigital/site
--dry-run` in the site to see which house files differ from the current
templates.
