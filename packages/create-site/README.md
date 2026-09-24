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
| `tests/seo/*`, `tests/house.test.ts` | Route coverage, the redirect gate, JSON-LD integrity, the redirect wiring, and the rule that contact details live only in the facts file |
| `docs/HOUSE.md` | The house rules, imported by `CLAUDE.md` (created if missing, otherwise one import line is added) |
| `docs/DIRECTION.md`, `docs/seo-launch-checklist.md`, `docs/seo-baseline.md` | The site's decision and blocked registers, the listings to claim for its sector, and the launch, 90-day, 6-month and 12-month baseline |
| `.github/workflows/seo-check.yml` | Only if the project has no workflows yet |
| `package.json` | `seo:check` and `launch:check` scripts, and the house packages |

It then runs `craft direction init` through the installed craft bin to start
`art-direction.json`, unless one exists.

## What it never does

- Write outside the project, or anything at all when it refuses.
- Replace a data file (`site.facts.ts`, `site.routes.ts`, `links.json`,
  `redirects.json`, `docs/DIRECTION.md`, the checklist, the baseline), even with
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
            [--description "<one or two sentences>"] [--answers <file.json>]
            [--dry-run] [--force] [--skip-install] [--yes] [--help] [--version]
```

`--answers` takes a JSON file with any of `legalName`, `tradingName`,
`siteUrl`, `sector`, `description`, `phone`, `email`, `locality`,
`postalCode`, `serviceAreas`, `registers` (ids from `src/sectors.ts`) and
`previousHosts`.

Exit codes: 0 done, 1 refused (nothing written), 2 usage error.

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

## Upgrading a site

Bump the house package ranges, then run `pnpm create @domandigital/site
--dry-run` in the site to see which house files differ from the current
templates.
