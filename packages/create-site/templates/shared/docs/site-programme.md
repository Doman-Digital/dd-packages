# The site programme

Every Doman Digital site is made, or rearchitected, in ten stages. The process
ran first on the Doman Digital redesign (DOM-392, stages DOM-393 to DOM-402)
and was made the house way on 10 October 2026 (DOM-647). It is held in place by
structure and by code, never by memory:

- **In Linear**, the "Site programme" template on the DOM team opens the
  programme issue with the ten stages as its children. A parent with an open
  child cannot be closed (the nightly enforcer reopens it), so a site cannot
  be finished with a stage skipped. The `new-client-build` skill opens it
  first and will not scaffold before Stage 05 is accepted.
- **In this repo**, the gates under `scripts/gates/` run before every build
  and before every preview deploy. A gate that fails stops the build and names
  its stage.

This file is a house file: `create-site --check` reports it when it differs
from the template. The site's own answers live in `site.programme.json`,
`art-direction.json` and `art-direction.sheets.json`, which are never
replaced.

## Working rules

- Every stage has a deliverable, a review and a recorded exit decision.
- One rendered artefact per stage exit.
- Decisions go to a register, never a chat.
- Governed facts are imported, never retyped.
- The live site is untouched until Stage 09.
- Phone first, at every stage from 03: designed at 375px, built with the phone
  as the base styles and `min-width` for wider layouts, measured at 375
  before any wider width, and reviewed from the phone capture first
  (`STANDARD.md` section 10 in `@domandigital/craft`, DOM-772).
- A gate is a script that blocks the build, never a reminder
  (`docs/ops/time-tracking.md` in Doman-Digital for why: the one control that
  needed a person to start it was never used once).

A stage issue moves to Done only with its deliverable linked and its exit
acceptance recorded on the issue: the artefact and version, the evidence and
its limits, the reviewer, the decision and date. Creating the issue or drafting
a file is not acceptance.

## The ten stages and their gates

| Stage | Deliverable | Exit | Gate in code |
| --- | --- | --- | --- |
| 01 Brief, scope and evidence constraints | The agreed brief, scope and exclusions, the evidence and claim inventory, success measures, owners and reviewers | A named person agrees the brief and scope; missing claims have owners and safe placeholders | `site.programme.json` names the programme issue |
| 02 Page roles, buyer journeys and the content model | Sitemap and page-role map, route register, journey maps, the call-to-action contract, the code and CMS ownership map | Each journey reaches a fitting next step; no orphan page or unrecorded removal | `site.routes.ts` and `tests/seo/coverage.test.ts` (every page on disk has a policy) |
| 03 Low-fidelity wireframes, phone first | A versioned wireframe set covering every page family at 375px first, then the desktop derived from it, annotated with evidence, destination and holds | Hierarchy and journey coverage accepted on the phone set first; missing proof is an obvious placeholder | None: wireframes are reviewed, not built |
| 04 Validate the prototype and iterate the journeys | Test tasks, the synthetic buyer panel's run, then human sessions; findings and a revised wireframe version | Critical task failures fixed and rechecked; the approved wireframe version is named | The buyer panel (`packages/buyer-panel` in dd-packages) run on the prototype; its report linked on the issue |
| 05 Visual direction, argued from evidence and measured | `art-direction.json`: the job, a hierarchy per page type and the seven choices with their reasons; the night side in `art-direction.sheets.json`; the accent test | The human choice and its reason recorded on the issue; no value adopted because an earlier pack showed it | `check-direction.mjs`, `tokens.mjs`, `night-contrast.mjs` |
| 06 Detailed pages, content and the component system | The real app on a preview, every page family, the copy deck through the gates, built phone first and measured at every viewport, from 375 up, with the width sweep | Design and content accepted at an exact version, from the phone captures first; no invented price or claim in the deck | `facts.mjs`, `copy-deck.mjs`, `null-check.mjs`, `mobile-first.mjs`, `measure.mjs`, `deploy-preview.mjs` |
| 07 Implementation and content migration plan | Slices, the file and CMS ownership manifest, the route, SEO and redirect plan, tests per slice, release and rollback outline | A named reviewer accepts the plan and the first slice | `redirects.json` and `tests/seo/redirects.test.ts` |
| 08 Build the approved slices and verify rendered drafts | Reviewed PRs, protected CMS drafts, rendered previews, slice-level checks | Every slice matches the accepted design or has a recorded deviation | Every gate above, on every build and every preview |
| 09 QA across every journey, and the release decision | The acceptance report across every page family and journey; a named go or no-go | No release-critical defect open; residual risks accepted by the right person | `launch:check`, `craft direction validate --snapshot <preview> --strict`; the live domain is attached here and nowhere earlier |
| 10 Launch safely, measure, record what was learned | Release record, rollback reference, live checks, the observation-window review, lessons | Live checks pass; follow-ups have owners; the learning is recorded | `docs/seo-baseline.md` at 90 days, 6 and 12 months |

## The gates

Run in this order by `scripts/gates/prebuild.mjs` before every build. The first
failure stops the build.

| Gate | Stage | Reads | Fails when |
| --- | --- | --- | --- |
| `check-direction.mjs` | 05 | `art-direction.json`, the registered copy named in `site.programme.json` | the file is missing, craft finds it invalid, a layer is undecided, or it differs from the registered copy in the craft estate |
| `tokens.mjs` | 05 | `art-direction.json`, `art-direction.sheets.json` | a day or night value is still null, or the night side has no reason. Writes the token stylesheet (`paths.tokens`), both sides of the sheet |
| `night-contrast.mjs` | 05 | the token stylesheet | a text pair falls under 4.5:1 by day or by night |
| `facts.mjs` | 06 | the site's source (`paths.source`) and the deck | a price, response target, minimum term or notice period is typed rather than read from `site.facts.ts` or a generated facts file. Runs `facts.importer` first when one is named |
| `copy-deck.mjs --check` | 06 | the deck (`paths.deck`) | the deck is missing or empty, or the rendered deck (`paths.deckMarkdown`) is not current |
| `null-check.mjs` | 06 | the rendered deck, the null harvest (`nullCheck.harvest`) | a phrase the null builds kept writing is in the deck without a reason under `nullCheck.justified`. Skips when the harvest is not on the machine |
| `mobile-first.mjs` | 06 | the site's source (`paths.source`, and `src`, `app`, `components` and `styles` when present) | a `max-width` media query (or `width <` range syntax) or a Tailwind `max-*:` variant is written without a recorded exception: `mobile-first-ok: <reason>` on its line or the line above, or the file in `mobileFirst.exceptions` with a reason. An exception with no reason fails |

Run around a running build:

| Gate | Stage | Fails when |
| --- | --- | --- |
| `measure.mjs` | 06 | measured with craft's measure (`@domandigital/craft/phone`) at every viewport, phone first: the ladder 320, 375, 390, 430, landscape 844 x 390, 768, 1024, 1280, 1440, 1920, and a width sweep from 320 to 1920 in 16 to 32px steps. A page in `measure.pages` does not answer; at any width it scrolls sideways, has visible text over other text, has a cut-off page title or text under `measure.minFontPx`; on a phone, a link, button, field or summary is under 44 x 44 CSS px (a link inside a sentence is exempt) or a text field is set under 16px; on a short phone (375 x 667), the main action in `measure.mainAction` is below the first screen and not pinned, fixed and sticky layers cover more than a quarter of the screen, an image is more than about 2.5 times wider than it is shown or is stretched past its file, a phone, email or number field has the wrong keyboard, a name, email or address field has no autocomplete, or a UK phone number in the text is not a `tel:` link; on a landscape phone, header and fixed layers cover more than half the height; at 1440 and 1920, body lines run past 80 characters or an image is stretched; a label in `measure.labels` leaves its container or covers a label or copy; with `--preview`, a page has no noindex. A failure names the widths it happens at |
| `deploy-preview.mjs` | 06 to 08 | the build, the measurement or the host's config refuses it (a route, a custom domain or `--prod`). Sets `PUBLIC_PREVIEW=1` and `NEXT_PUBLIC_PREVIEW=1` itself |

The site reads `PUBLIC_PREVIEW` (Astro, `import.meta.env.PUBLIC_PREVIEW`) or
`NEXT_PUBLIC_PREVIEW` (Next) to add `<meta name="robots" content="noindex">`
and to hold anything that must not run on a preview, such as a live form
handler. The measurement fails a preview that does not.

## The governed-facts importer

`site.facts.ts` is the governed source for the business's own facts, and pages
import it. When a figure is governed somewhere else (a price list in another
repo, a contract schedule), the site gets an importer: a script that reads the
governed modules and writes `src/generated/facts.json` before every build,
named in `site.programme.json` as `facts.importer`. The pages read the
generated file and nothing else, so a price on the site is always the price
the governed file holds. `apps/site/scripts/facts.ts` in Doman-Digital is the
worked example: it imports `docs/brand-facts.json` and the marketing app's
pricing modules and writes the facts the redesign renders.

## site.programme.json

| Key | What it is |
| --- | --- |
| `issue` | The programme issue in Linear (`DOM-123`) |
| `registeredDirection` | The direction's registered copy in the craft estate, usually `~/dd-ops/<site>/art-direction.json`; null until registered |
| `paths` | Where the token stylesheet, the deck, the rendered deck and the null-check report live, and the source folders `facts.mjs` reads |
| `measure` | `pages`, `minFontPx` (12), `labels` (`{ "selector": ".label", "within": ".screen" }` or null), `port`, `mainAction` (a CSS selector for the page's main action, or `{ "/": ".hero a", "*": "a.book" }` per page; not checked when absent), `thresholds` (override a house default: `maxLayerShare` 0.25, `landscapeMaxLayerShare` 0.5, `oversizeRatio` 2.5, `upscaleRatio` 1, `maxLineCh` 80, `overlapShare` 0.4, `minImagePx` 32), `sweep` (`{ "step": 16, "wideStep": 32 }`, or `false` to measure the ladder only), `baseline` (a file of known failures, craft's phone-first baseline format; `node scripts/gates/measure.mjs --serve --update-baseline` writes it, and it only shrinks) |
| `nullCheck` | `harvest` (a path, `~/` allowed) and `justified` (phrase to reason) |
| `facts` | `importer`: the site's importer script, or null |
| `mobileFirst` | `exceptions`: the files allowed a `max-width` query or `max-*:` variant, each `{ "file": "src/styles/print.css", "reason": "..." }` |
| `preview` | `host`: `cloudflare` or `vercel`, or null to find it from the config |
