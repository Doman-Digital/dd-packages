# @domandigital/craft

The Doman Digital house craft standard, as numbers.

OKLCh colour ramps that snap to colours you already ship, semantic tokens derived
with measured WCAG **and** APCA contrast, one motion vocabulary shared by CSS and
JS, a base stylesheet, and a scanner that finds the AI look in source and copy.
Zero runtime dependencies.

Read [PRINCIPLES.md](./PRINCIPLES.md) for why each rule is a rule.

## Install

```bash
pnpm add @domandigital/craft
```

## Use

```ts
import { craftTokens } from "@domandigital/craft";

const { css, report, ramps } = craftTokens({
  // Steps you already ship come back byte-identical.
  accent: { 400: "#a78bfa", 500: "#7050f5", 600: "#6e4ce8" },
  bgCanvas: "#04060e",
  bgSurface: "#0b1120",
  bgElevated: "#151c2e",
  textPrimary: "#ecf2ff",
  textSecondary: "#b7c3d9",
  textMuted: "#8e9cb5",
  borderSubtle: "rgba(184, 198, 219, 0.16)",
  borderStrong: "rgba(184, 198, 219, 0.28)",
  success: "#3fb98a",
  warning: "#d6a14a",
  danger: "#e26d6d",
  info: "#5aa7e8",
});

if (report.failures.length > 0) {
  // Fails the house bar (4.5:1 AND |Lc| 60). Surface it; do not ship past it.
  console.warn(report.failures.map((f) => f.note).join("\n"));
}
```

Write `css` to a committed file and import it. Then, once, in your global
stylesheet:

```css
@import "@domandigital/craft/craft.css";
```

`craft.css` needs no build step and works with or without Tailwind.

On Tailwind v4, also import the theme bridge:

```css
@import "@domandigital/craft/craft.tailwind.css";
```

On Tailwind v3, add the preset:

```js
const { tailwindV3Preset } = require("@domandigital/craft");
module.exports = { presets: [tailwindV3Preset()] };
```

## The standard itself

[STANDARD.md](./STANDARD.md) is the twelve-section house standard, every numeric
rule cited, including a section on what is deliberately *not* a rule. Its
canonical numbers are compared against the code on every test run, so the
document cannot drift from what ships.

## Character: finding the AI look

The standard asks whether a surface is well made. [CHARACTER.md](./CHARACTER.md)
asks whether anyone decided how it looks, or whether it is what a model builds
when nobody told it otherwise.

```bash
npx craft scan            # markup, components, stylesheets
npx craft scan --staged   # pre-commit: the git index only
npx craft copy app content
npx craft tells list
```

Every finding names the tell, its generation (1: indigo, Inter, glass; 2: cream,
italic serif, eyebrow chips, bento), the line, and what to do instead. Every
tell ships as a warning. A brand that really is violet declares it, with a
reason, in `art-direction.json`:

```json
{ "exceptions": [{ "tell": "ai-violet", "because": "Violet is on the van, the cards and the fascia." }] }
```

Art direction v2 records the customer's job, a hierarchy for each page type,
and seven expressive tokens, with reasons and evidence. Begin with job
research, then hierarchy, then tokens:

```bash
npx craft direction research --brief "An electrician in Brackley repairing dangerous faults for local households"
npx craft direction init --client "Copper Lane" --brief "<who, where, what they do>"
npx craft direction validate --estate estate.json
npx craft estate add --id copper-lane --direction art-direction.json --estate estate.json
npx craft estate compare --estate estate.json --directions
npx craft direction validate --snapshot http://localhost:3000 --page home --strict
```

A page may also record `confidence`: the widths its decisions were examined at
and the evidence it offers, each with a reason. `craft direction validate`
reports what is observed, inferred or unknown about it, with why it matters and
no score. Nothing in it is required: no evidence kind, portrait, slideshow,
phone button or section order. See [Decision confidence](./CHARACTER.md#decision-confidence).

Feedback on a page is weighed against the visitor. `craft direction review --notes
design-review.json` keeps what was said, the visitor problem under it, what was
proposed, the evidence and the smallest defensible change apart, says how well
each is known (observed, inferred, preference or unknown), and can conclude that
no change is needed. Evidence only reported by an audit or a stakeholder cannot
make a problem observed, and a width nobody looked at stays unknown. See
[Reviewing a proposed change](./CHARACTER.md#reviewing-a-proposed-change).

`--snapshot` accepts saved files and preview or production URLs. Drift fails
with `--strict`; declared estate comparisons stay advisory. Version 1 files
still validate with a warning. See [CHARACTER.md](./CHARACTER.md) for the full
v2 example and the meaning of each layer.

### In CI

```bash
npx craft scan --baseline craft-baseline.json --update-baseline   # once: adopt today's findings
npx craft scan --baseline craft-baseline.json --strict --sarif craft.sarif
npx craft audit --pages https://example.com/sitemap.xml --viewport 390,1440
```

- `--baseline` reports only findings the baseline does not already hold. A
  finding is keyed on its tell, path and excerpt, never its line, so an edit
  above a known finding does not make it new. The output says how many known
  findings it left out.
- `--sarif <file>` writes SARIF 2.1.0 for GitHub code scanning. Findings on a
  rendered page carry the URL, not a file, so code scanning does not show them.
- `--json` output always carries `schemaVersion` (currently 1).
- `--pages` audits every URL in a sitemap (or a sitemap index, one level deep)
  or a file of URLs; `--viewport` audits each at those widths. A page that
  will not load is listed as not measured, and fails `--strict`.

`craft.config.json` in the repo root holds what craft should know about the
repo. `.claude`, `.agents` and `.cursor` are never walked, config or not.

```json
{
  "ignore": ["docs/archive/**", "*.stories.tsx"],
  "copyPaths": ["content", "src/app"],
  "severity": {
    "em-dash": { "level": "block", "because": "This client's style guide bans them outright." }
  }
}
```

A severity change needs a `because`, like an exception. `off` is applied as an
exception, so the report lists what it silenced.

Under `craft copy --gate`, a repo can raise a copy tell but never lower one in
the house blocking tier. A `warn` or `off` for a blocking tell, here or as an
exception in `art-direction.json`, is refused and listed in the report. A
genuine one-off takes `copy-ok` on its line.

### Copy

[COPY.md](./COPY.md) is the house copy standard: the blocking tier, the review
tier, the density tier that reads whole documents, and what to write instead.
`craft copy --gate` applies the house policy, so the blocking tier fails the
run. A test fails if a phrase the standard blocks does not block.

```bash
npx craft copy --gate content   # the house gate: exit 1 on the blocking tier
npx craft copy compare draft.md rewrite.md   # facts a rewrite lost or added
npx craft copy claims content   # every price, figure, date and named source, to check
```

No tell can say whether a figure is true. `craft copy claims` lists each
sentence a reader would take as a checkable fact, marked `sourced` (a source is
named) or `UNSOURCED`, for a person to check against the primary source. It
always exits 0: a checklist, not a verdict.

To write in a chosen register (plain, persuasive, warm, literary), read the
brief before drafting and check a finished document after. See `REGISTERS.md`.

```bash
npx craft register brief warm                  # what to do before drafting
npx craft register check letter.md --as warm   # five paragraphs or more; never fails
```

The same checks run in code:

```ts
import { checkCopy, formatReport, scanSource } from "@domandigital/craft";

const report = scanSource([{ path: "app/page.tsx", text }]);
console.log(formatReport(report, "craft scan"));
```

## The anchor guarantee

Every hex you pass in comes back out unchanged, the same string, byte for byte.
That is what lets a live site adopt this without a single pixel moving. Only the
steps you never picked by hand are generated.

## What it will tell you that you did not ask

`report.failures` lists every text-on-surface pair that clears WCAG AA but misses
the house APCA bar, which is the failure mode a WCAG-only check cannot see. The
accent fork emits its measured ratios as a CSS comment, so the choice is
checkable rather than asserted.

## Build gates folded in from drift-guards

Two checks that lived only in `Doman-Digital/dd-drift-guards` (pinned by git tag
in a few client repos) are part of craft since 0.18.0. The other three guards
there were already here: restraint (`checkRestraint`), reduced motion (a
restraint rule) and art direction (`craft direction`, `craft estate`).

- **`gradientContrast(text, gradient, beneath)`**: text on a CSS gradient, the
  case axe-core and Lighthouse mark "incomplete" and never score. It composites
  the gradient over what sits beneath and scores the text, WCAG and APCA,
  against the worst point. The worst point is sampled along every segment, not
  only at the stops: mid-grey text on a black-to-white gradient clears 4.5:1
  against both ends and is about 1:1 in the middle, which the drift-guards
  version passed. A hard stop (`#000 50%, #fff 50%`) is a jump the browser
  paints without a blend, so it is not sampled across. WCAG defines no method for gradients, so this is craft's
  rule, not a conformance claim.
- **`checkPhotoReview(text, { minScore, required })`**: gates a build on the
  report `halide review --json` wrote. It takes the report's text (null when
  there is none) and never runs halide. One weak image fails the build even
  under a passing average, and a truncated report fails rather than reading as
  "no report".

## The phone-first gate for portals

STANDARD.md section 10 as a gate for an app behind a sign-in, such as a client
portal (portal standard rule 10, DOM-775). create-site's `measure.mjs` and
`mobile-first.mjs` do the same job for a site; a portal's pages need a
signed-in user and fixture data, which only the portal's own Playwright suite
can set up, so the gate comes in two halves.

The portal's suite opens each key route at `PHONE` (375 x 812, touch) and
measures it:

```ts
import { test } from "@playwright/test";
import { PHONE, measurePhone } from "@domandigital/craft/phone";

test.use(PHONE);
for (const route of ["/portal", "/portal/invoices"]) {
  test(`phone first: ${route}`, async ({ page }) => {
    await page.goto(route);
    await measurePhone(page, { route }); // writes phone-first/measured/portal-invoices.json
  });
}
```

Then `craft phone-first --measured phone-first/measured` judges every route,
and the source folders `phone-first.json` names, against the repo's baseline:

- **Static:** a `max-width` media query (any spelling, range syntax too) or a
  Tailwind `max-*:` variant fails. A genuine exception takes
  `mobile-first-ok: <reason>` on its line or the line above, or the whole file
  in `phone-first.json` `exceptions` as `{ "file", "reason" }`. On a Tailwind 3
  app, `/NN` opacity on an arbitrary `var()` colour also fails (check 4 below).
- **Measured at 375px:** the page scrolls sideways (against the layout
  viewport: under mobile emulation `innerWidth` grows with the page, so it
  never shows the scroll), a page with no `width=device-width` viewport meta,
  a target under 44 x 44 (a link inside a sentence is exempt; a field's label
  counts), a text field under 16px or under 48px tall, text under 12px, a
  cut-off `h1`.

`phone-first.baseline.json` lists what a repo already breaks, counted per file
and per route (digits folded, so fixture dates do not split one button into
many). The gate fails on anything the baseline does not list, and on a
baseline that claims more than is there, so it only shrinks: fix a breach and
lower its count in the same PR. `--update-baseline` writes the baseline that
makes the current run pass; run it once when the gate goes in, and after that
only to lower counts. It keeps every entry's `reason`.

### Four checks that hold the portal standard's phone lessons

The causes behind the October 2026 phone fixes are in the portal standard
(`references/phone-faults.md`, DOM-1044). These four make the gate itself
refuse them (DOM-1053).

1. **The baseline only shrinks.** The run compares the baseline with the base
   branch's copy and fails on an entry main does not have, or on a higher
   count. Fix the breach where it is. The one way in is a named exception: an
   entry with a non-empty `reason` (third-party UI that cannot be restyled, a
   destructive-only form). Old baselines, with no `reason`, read as before.
   A branch that left main before main shrank its baseline looks like it added
   entries: merge main.

   ```json
   { "route": "/admin/content", "check": "text", "element": "<p> \"Sign in\"", "count": 14,
     "reason": "Sanity Studio's sign-in dialog, third-party UI" }
   ```

   The base is `origin/main`, or the pull request's target branch when
   `GITHUB_BASE_REF` is set, or `--base <ref>`. The runner has to be able to see
   it: with `actions/checkout`, use `fetch-depth: 0` or run
   `git fetch origin main` first. If the base cannot be seen the gate fails and
   says so; it never skips. It passes without looking when every entry carries a
   `reason`, when the base has no baseline yet (the pull request that brings the
   gate in), and outside a git checkout (it prints a note).

2. **Every route is measured.** With `--measured`, the measured routes are the
   gate's route list. Every page route of the app must be in it. The pages come
   from the Next app folders (`appDir`; left out, any `source` folder called
   `app`) and from `routesManifest`, a built app's
   `app-path-routes-manifest.json`. Route groups, parallel slots, private
   folders and intercepting routes are not pages of their own. A measured route
   covers the page it opens: `/portal/projects/p1?theme=dark` covers
   `/portal/projects/[id]`, and so does the literal label
   `/portal/projects/[id]`; a static sibling such as `/portal/projects/new`
   does not. A page the gate cannot measure (one that only redirects) goes in
   `excludeRoutes`, the only way out, with a reason; `"/admin/*"` takes a prefix
   and everything under it. An entry with no reason, or naming no page, fails.
   When no app folder with pages is found, the run prints that route coverage
   was not checked.

   ```json
   { "source": ["app", "components"],
     "excludeRoutes": [{ "route": "/portal/projects", "reason": "redirects to /portal; measured there" }] }
   ```

3. **Fields are 48px tall.** A text field, select or textarea under 48px fails
   the `field` check ("44px tall, under 48px (use min-h-12)"), matching portal
   standard rule 5. Until now the gate only failed fields under 44px, as
   targets. Configurable: `fieldHeightPx` in `floors`, for `measurePhone`,
   `measureViewports`, `measureSite` and `viewports.json`; the default is 48.

   ```ts
   await measureViewports(page, { route, floors: { fieldHeightPx: 44 } }); // the old gate
   ```

4. **Tailwind 3 `var()` opacity.** Tailwind 3 cannot apply `/NN` opacity to a
   `var()` colour and emits no CSS, so `bg-[var(--bg-1)]/95` leaves a fixed bar
   transparent. On a Tailwind 3 app the source scan fails on
   `var\([^)]*\)\]/[0-9]+`. The version is read per `source` folder from the
   installed `node_modules/tailwindcss`, else the declared range in the nearest
   `package.json`; set `"tailwind": 3` or `4` in `phone-first.json` when that
   cannot find it. Tailwind 4 supports the syntax and is not scanned. It is a
   bug rather than a style, so a `mobile-first-ok` comment does not excuse it;
   a file-level `exceptions` entry still does.

## Every viewport

Fitting at 375 is the floor (STANDARD.md section 10, DOM-787). The
every-viewport measure takes a page through the ladder (320, 375, 390, 430,
landscape 844 x 390, 768, 1024, 1280, 1440, 1920, phone first in order and in
every report) and a width sweep from 320 to 1920 in 16 to 32px steps, resizing
the one loaded page in place:

- **At any width:** sideways scroll, visible text over other visible text, a
  cut-off page title (`h1`), and text under 12px. A failure names the exact
  widths: `(at 320-352, 400)`.
- **On a short phone (375 x 667):** the main action (`mainAction`, a selector,
  global or per route) is on the first screen or pinned; fixed and sticky
  layers together cover at most 25% of the screen; an image is not more than
  2.5 times wider than shown (`oversized`) nor narrower than shown
  (`upscaled`); a field that looks like a phone, email or number uses
  `type="tel"`, `type="email"` or an `inputmode`; a name, email, phone or
  address field carries `autocomplete`; a UK phone number in the text is a
  `tel:` link.
- **On a landscape phone (844 x 390):** header and fixed layers leave at least
  half the height.
- **Page length (phone screens):** page height at 375 x 667 over 667, to the
  footer (lazy images loaded). A phone page has a length budget (the Bellerose
  home page ran 12.7 screens against a target of 6.5). Set one per route or
  route pattern with `screens`; a route over its budget fails the `screens`
  check, and with no budget the count is only reported. Keys are a route
  (`/`), a pattern (`/areas/[town]`), a prefix (`/services/*`, the route and
  everything under it) or `*`; the most specific wins.
- **At 1440 and 1920:** body lines are at most 80 characters (width over the
  `ch` of the element's own font) and no image is stretched past its file.

Each threshold has a house default (`DEFAULT_THRESHOLDS`) and can be
overridden per site or portal.

```ts
import { PHONE, measureViewports } from "@domandigital/craft/phone";

test.use(PHONE);
test(`every viewport: ${route}`, async ({ page }) => {
  await page.goto(route);
  // Resizes this page in place; writes phone-first/measured/<route>.json.
  await measureViewports(page, { route, mainAction: ".hero a", screens: { "/": 6.5, "/services/*": 6 } });
});
```

`result.screens` holds the count, and it is written to the measured file;
`craft viewports` and `craft phone-first --measured` print it for every route
(`phone screens to the footer: / 5.8 of 6.5`). In `viewports.json` the budget is
`"screens": { "/": 6.5, "/services/*": 6 }`; in create-site's
`site.programme.json` it is `measure.screens`.

`measureViewports` works on the page the suite opened and signed in, so a
portal keeps its fixtures. `measureRoute(open, { route, mainAction })` does
both halves for such a page: `open("phone")` and `open("wide")` return the
route opened and signed in, in a `PHONE` and a `DESKTOP` context, and the two
halves are merged and written once (DOM-835). `measureSite(browser, { base, routes })` opens each
route itself, the phone half in a phone context and the wide half in a desktop
one, for a page anyone can open: create-site's `measure.mjs` uses it.
`craft viewports --url <base> --route /` is the same for the command line: it
measures, writes the measured routes, and judges them against the same
`phone-first.baseline.json`. The new checks are baselined like the 375px ones:
existing failures are listed (one line per element and check, with the widths
left out so a failure at one more width is not a new failure), a new failure
fails, and a baseline that claims more than is there fails too.
`craft phone-first --measured` judges the same files, and keeps working on
routes measured only at 375 with `measurePhone`.

## API

| Area | Exports |
| --- | --- |
| Colour space | `hexToOklch`, `oklchToHex`, `toGamut`, `inSrgbGamut`, `inP3Gamut`, `deltaEOk`, `deltaEOkHex` |
| Ramps | `ramp`, `rampFromAnchors`, `RAMP_STEPS`, `LIGHTNESS_CURVE` |
| Contrast | `wcagContrast`, `apcaContrast`, `checkPair`, `gradientContrast`, `gradientStops` |
| Photography | `checkPhotoReview` |
| Semantic | `semantic`, `accentFork` |
| Motion | `EASE`, `EASE_TUPLE`, `DURATION_MS`, `DURATION_S`, `SPRING`, `SCALE`, `exitDuration`, `shouldAnimate` |
| Type | `fluidType`, `fluidClamp`, `typeFeatureTokens`, `HOUSE_TYPE`, `TYPE_STEPS` |
| Space | `fluidSpace`, `sectionRhythm`, `SPACE_STEPS` |
| Density | `densityCss`, `densityTokens`, `DENSITIES` |
| Restraint | `checkRestraint`, `HOUSE_BUDGET` |
| Tailwind | `tailwindV3Preset` (v3), `tailwindV4Theme` / `craft.tailwind.css` (v4) |
| Emit | `craftTokens`, `emitCss`, `motionTokens` |
| Character | `scanSource`, `checkCopy`, `formatReport`, `CATALOGUE`, `CATALOGUE_VERSION`, `catalogueTable`, `runTell`, `tellById` |
| Character colour | `parseColour`, `findColours`, `isAiViolet`, `isCream`, `AI_VIOLET` |
| Character lists | `REFLEX_FONTS_1`, `REFLEX_FONTS_2`, `SHADCN_PRIMITIVES`, `AI_WORDS`, `STOCK_PHRASES`, `REVEAL_LIMIT`, `PILL_LIMIT`, `SHADCN_LIMIT` |

## Licence

Apache-2.0


Design reviews compare proposed carousel purposes through `comparisons`; a shared
widget name no longer proves duplication. A smaller implementation does not
select a better design automatically. Protected staging reviews may reserve
explicitly marked publication assets while reporting `publicationReady: false`.
See CHARACTER.md, “Context and learning from a later result”.

Opening photographs are selected as a rendered sequence: compare their quality and crop before filling a slide count or covering every service. See [Select photographs for their position in the sequence](./CHARACTER.md#select-photographs-for-their-position-in-the-sequence) for the Bellerose follow-up and its limits.
