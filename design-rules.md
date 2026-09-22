# House visual rules

**Canonical. Every repo, every client build, every Claude session.**
Referenced, never copied — if you find these values pasted into a repo,
delete the copy and link here instead.

Enforced mechanically by `design-check.py` (see README for how it is wired
in). Same doctrine as `copy-rules.md`: one rule set, one place, every
project, a machine check in front of it so it does not depend on anyone
remembering to apply it.

## Why

Client work gets the same "does this read as templated" test the copy does.
No single item below is unique to AI output — real designers use Tailwind's
palette and rounded cards too. The signal is the same as with copy:
**stacking**. One default is a coincidence. Five on one page, or the same
recipe repeated identically across two different client sites, is a
registry component pasted in unexamined.

Concrete trigger: the 21st.dev / Relume conversation, 2026-09-11. 21st.dev
is a registry of shadcn/ui-based components every AI coding tool (Claude,
Cursor, v0, Lovable) draws from, which is the actual mechanism behind
"every AI site looks the same" — thousands of builders pulling the same
shelf, prompting the same tools, landing on the same Tailwind defaults.

## Research log

**2026-09-11, Perplexity pass.** Full prompt and answer kept in the project
record. Source quality is mixed — several cited domains (sailop.com,
overlayqa.com, aiskill.market, downloadicons.com and similar) read as
programmatic SEO content, not primary research, and Perplexity itself
flagged two gaps outright: no confirmed GBP pricing for Blaze Type or
Power Type's agency tiers, and "Tunera" font names it couldn't verify.
Treat the findings below as **directionally right, independently
corroborated by a separate non-Perplexity pass the same day** (dev.to,
Anna Arteeva, Alan West's Tailwind-indigo piece), not as individually
gospel. Re-verify pricing before buying anything.

Confirmed, cross-corroborated tells worth encoding as rules: the
blue-to-indigo/purple gradient hero background, Tailwind's `indigo`/
`violet` palette as brand colour, `rounded-xl`/`rounded-2xl` +
`shadow-sm`/`shadow-md` as the universal card recipe, Lucide as the
dominant icon default across v0/Bolt/Lovable/shadcn (ahead of Heroicons
and Font Awesome), and Inter **and Geist** both as recognisable default
faces — Geist matters because it's Vercel's own font, shipped by
shadcn's docs and v0 (also Vercel), so reaching for it isn't a neutral
choice, it's the same closed loop as reaching for Inter.

**2026-09-11, second pass, asked Perplexity to re-source against primary
documents, then independently re-checked its highest-stakes claims myself
rather than taking its own "confirmed" grading at face value.** Results:

- **Adam Wathan's indigo-500 tweet: genuinely confirmed**, by me, not just
  by Perplexity. I searched independently and the quote and tweet
  (x.com/adamwathan/status/1953510802159219096, 2025-08-07) are real and
  match verbatim: "I'd like to formally apologize for making every button
  in Tailwind UI `bg-indigo-500` five years ago, leading to every AI
  generated UI on earth also being indigo." This is now gospel-tier for
  real, from the person who made the original decision.
- **shadcn defaulting to Geist: still not independently pinned down by
  me.** Perplexity cited a specific `tailwind.config.cjs` path; when I
  tried to verify it directly on GitHub, the repo has since moved to a
  monorepo layout (`apps/v4`, no flat `tailwind.config.cjs` at the cited
  path), so I couldn't confirm that exact file. That doesn't mean the
  underlying claim is false — Geist-as-shadcn/v0-default is independently
  plausible and the "avoid Inter and Geist both" rule holds regardless,
  since it's justified by the closed-loop argument on its own merits —
  but don't repeat "confirmed against shadcn's source code" as a fact
  without checking the current repo yourself first.
- **Blaze Type: a real contradiction, not resolved.** Perplexity said
  "unlimited domains, headcount-only pricing, confirmed from their EULA."
  When I fetched Blaze Type's own `/license` and `/eula` pages myself, I
  got materially different answers from the two pages: `/license` says
  "across as many domains as you need... no per-domain pricing, no
  pageview caps," while `/eula` describes agencies buying tiered
  "1 website / 2 websites... 10 websites" allowances and requires
  purchasing "in the name and on behalf of" each client, at the
  advertised price, not marked up. That's not a small discrepancy. Get
  this in writing from Blaze Type directly, specifically asking "can one
  company licence, bought by our agency, cover unlimited unrelated client
  domains, and can we resell it as part of a project fee," before
  building a client font decision on it.
- **Power Type Foundry: unverified by me.** Their license pages didn't
  return usable content on a direct fetch (likely JS-rendered). Perplexity's
  own downgrade — 10-domain cap on the Super License, not truly unlimited
  — is the only version to trust until someone opens the actual page.
- Grilli Type's exact pricing, the "best sites of 2026" examples, and
  Tunera's specific typeface names all remain exactly as caveated in the
  Perplexity pass: real sources exist, the specific numbers/names don't
  meet primary-source bar yet. Velvetyne's three named faces (Basteleur,
  Gulax, Le Murmure) hold at gospel-tier, independently corroborated
  across two separate research passes now.

**2026-09-11, third pass — wrong repo, real correction.** All of the
above was built without knowing `dd-packages/packages/craft` already
existed: a shipped, versioned, tested `@domandigital/craft` npm package
(Apache-2.0, zero deps) that generates and enforces most of the
"structural tokens" section below. It was not researched into existence
here, it was found. Read in full: README, PRINCIPLES, STANDARD.md, the
changelog, and every source file (OKLCh colour, contrast, ramp, semantic,
motion tokens/decide, css emit/tailwind adapters, type scale/features,
space scale, density, restraint budget checker). See "Structural layer:
@domandigital/craft" below for what that changes in this file. Nothing
in the font-licensing or icon-base research above is affected — craft
explicitly disclaims typography choice and brand voice as out of scope
(STANDARD.md section 10), so that work stands as-is.

## Structural layer: @domandigital/craft

Colour derivation, type/space scales, motion, density, and a vocabulary
budget checker are not "DECISION NEEDED" anymore. They're a shipped
package: `@domandigital/craft` in `dd-packages/packages/craft`. Full
spec in its `STANDARD.md` (11 sections, machine-checked against the
actual code on every test run, so the doc can't drift from what ships).

What it does that this file was trying to invent from scratch:

- **Colour.** `ramp()` / `rampFromAnchors()` build full 11-step OKLCh
  ramps from a client's own anchor colour, returning that anchor
  byte-identical. `accentFork()` picks the accessible variant by walking
  the ramp from the brand end and measuring real WCAG 2.x (4.5:1) *and*
  APCA-W3 (|Lc| 60) contrast — both bars, because they can disagree — and
  emits the measured ratio as a CSS comment instead of a guessed
  "lighter shade." This is the actual implementation of the "no fixed
  house palette, but a documented structural shape" idea below. Use it
  rather than re-deriving it by hand.
- **Type and space mechanics.** `fluidType()` / `fluidSpace()` /
  `sectionRhythm()` give fluid `clamp()` scales (always with a `rem`
  term, so 200% zoom still works per WCAG 1.4.4), pinnable so an
  existing site's sizes don't move on adoption. This is sizing and
  rhythm only — it does not choose a typeface. Font selection stays this
  file's job; see the wardrobe below.
- **Motion.** `EASE` / `EASE_TUPLE` / `DURATION_MS` are fixed house
  numbers, one vocabulary shared by CSS and JS: press 120ms, tooltip
  150ms, dropdown 200ms, modal 300ms, drawer 400ms, reveal 500ms,
  stagger 60ms; exits always run at 0.75x their entrance;
  `shouldAnimate()` refuses keyboard-triggered and >100-uses/day
  interactions outright. No decision left to make here.
- **Density.** Three named row densities on a 4px grid (32/40/48px),
  set once via `[data-density]`.
- **Restraint budget.** `checkRestraint()` parses compiled CSS and
  enforces numeric ceilings on a project's *own* vocabulary: ≤10 font
  sizes (+≤3 relative/em-or-% sizes counted separately), ≤3 weights,
  ≤2 families, ≤4 radii, ≤4 shadows, accent hues clustered within 15°,
  UI durations ≤300ms.

What this does **not** replace: `design-check.py`'s job in this repo is
detecting known *external* AI-tool signatures (Tailwind's indigo-500,
the blue-purple gradient, the stock shadcn card recipe) by pattern-
matching source. Craft's restraint checker measures a project's own
accumulated vocabulary against its own budget — it has no idea what
Tailwind's defaults are and was never meant to. These are two different
checks, both worth running, neither one covering the other. Font and
icon selection (below) are also untouched — craft is explicit that
typography choice and brand voice are out of scope (STANDARD.md §10).

## Course correction: no single house font or house colour

The original draft of this file assumed one fixed brand palette and one
signature typeface for the whole studio, the same way a single-product
company would. That's wrong for this business. Doman Digital builds for
completely unrelated verticals in parallel — an electrician, a beauty
studio, a barbershop, a luxury car hire firm, a financial planner, a
fragrance house. A single "Doman Digital signature font" recognisable
across all of them would make every client's site look like a house style
belonging to the agency, not to the client — which is a different flavour
of the exact problem this file exists to solve. A discerning viewer
noticing the same avant-garde French display face on an electrician's
site and a fragrance house's site is its own tell.

So the tokens below split into two kinds: **structural tokens**, which are
genuinely universal and safe to fix once (spacing, radius, shadow,
motion, icon base), and **expressive tokens**, which are per-client
decisions made from a small pre-vetted house shortlist rather than either
one fixed studio identity or an unconstrained free-for-all that drifts
back to Inter and Tailwind indigo out of habit.

## Tokens

- **Colour — no fixed house palette, derivation resolved.** Each client
  project still picks its own primary/accent away from the banned hue
  band (see Blocking tier: the Tailwind blue/indigo/violet/purple
  200–290° range). What used to be DECISION NEEDED — the ramp shape and
  contrast floor every client's colour gets slotted into — is now
  `@domandigital/craft`'s job: 11-step OKLCh ramps, anchor preserved
  byte-identical, `accentFork()` for the accessible variant against both
  WCAG and APCA. See "Structural layer" above.
- **Type — a 3-pairing house wardrobe, not one font.** Pick from this
  shortlist per client, never Inter/Geist/Manrope/Poppins as a default
  fallback:
  - *Characterful/display bucket — DECIDED.* Velvetyne Type Foundry
    (French non-profit, SIL OFL, free direct download, no seat count —
    velvetyne.fr). Confirmed candidates: **Basteleur** (display serif,
    high-contrast, incunabula-inspired), **Gulax** (display sans, tall
    angular letterforms), **Le Murmure** (display sans, high-contrast
    flamboyant capitals, originally commissioned for an agency). Pick one
    of these three for a client whose brand can carry real character
    (hospitality, beauty, luxury, creative services). OFL means the same
    family is redistributable across unlimited client domains for free,
    licence notice retained.
  - *Precise/technical bucket — NOT YET SOURCED.* For trades, finance,
    B2B (RMP Electrical, Dunhams, InvestWizz-adjacent work). Needs its
    own research pass rather than a guess — Inter's whole problem is that
    it's the "safe technical choice" everyone reaches for, so this bucket
    needs the same OFL/flat-fee scrutiny as the display bucket got, not a
    shortcut. Follow-up prompt below.
  - *Premium/editorial bucket — NOT YET SOURCED.* For luxury and
    hospitality clients (Starr Luxury Cars, Project Aroma). Same
    follow-up prompt covers this.
  - Foundries worth a direct conversation, for when a client's brand
    genuinely warrants a paid face the OFL shortlist can't cover: **Blaze
    Type** (priced by company headcount from €40 minimum) and **Power
    Type Foundry**'s Super License (self-hosted webfonts, Super License
    tier caps at 10 domains, not unlimited). Neither is a settled
    decision — see the second research-log entry above: Blaze Type's own
    published pages contradict each other on whether one licence covers
    unlimited unrelated client domains or a tiered "N websites" cap, and
    Power Type's actual license terms haven't been independently
    confirmed by anyone on this at all yet. Get both in writing, framed
    explicitly as "we're an agency buying on behalf of many unrelated
    client domains," before using either for a client build. **Grilli
    Type ruled out**: real flat-fee multi-site licensing exists but
    starts around $10,000 (~£7,900) per style, unconfirmed on a primary
    page and priced for agencies far larger than this one regardless.
- **Spacing scale — resolved by @domandigital/craft.** `fluidSpace()` /
  `sectionRhythm()` give fluid `clamp()` steps (3xs–3xl plus one-up
  pairs) and three section-rhythm sizes, not Tailwind's default 4px
  ramp used verbatim. Adopt directly; pin any values a live site already
  ships via the `pin` option so nothing shifts on adoption.
- **Radius scale** — still DECISION NEEDED, but now bounded: craft's
  restraint budget caps a surface at ≤4 distinct radii. Pick 2–4 actual
  values (not `rounded-xl`/`rounded-2xl` on every surface by default,
  the single most-cited universal tell in the research above); craft
  measures whether the count is held to, it doesn't generate the values.
- **Shadow scale** — same status as radius: DECISION NEEDED on the
  actual values, capped at ≤4 by the same restraint budget. Not
  `shadow-sm`/`shadow-md` on every card by default.
- **Motion — resolved by @domandigital/craft.** `EASE` / `DURATION_MS`
  are fixed house numbers already (see "Structural layer" above). No
  decision left to make.
- **Icon base — DECIDED: Phosphor.** MIT licence, no attribution
  required, safe to redistribute in unlimited client projects, 9,000+
  icons across six weights, large enough to restyle into something
  house-specific rather than reused verbatim. Confirmed by research as
  distinct from the dominant default (Lucide, used by v0/Bolt/Lovable/
  shadcn) and from Heroicons (Replit's default). Tabler (5,900+, MIT,
  single consistent stroke) and Iconoir (1,600+, MIT, leaner) are
  acceptable alternatives if Phosphor's six weights turn out to be more
  than needed. Restyle the ~15-20 icons actually reused on every build to
  a house stroke weight and corner radius; enumerate that set after three
  client builds, not in the abstract now.

## Follow-up research needed

Two font buckets above are still open. Use a narrower version of the
original prompt rather than guessing:

```
I need 2 real, current SIL Open Font License (OFL) typefaces (or flat-fee
non-metered indie foundry faces cleared for agency/multi-client-site use)
for each of two categories, distinct from anything in Google Fonts' most
popular list and distinct from Inter, Geist, Manrope, Poppins, Space
Grotesk and Archivo:

1. A "precise/technical" sans suited to trades, finance and B2B client
   sites (needs to read as competent and trustworthy, not playful).
2. A "premium/editorial" serif or sans suited to luxury and hospitality
   client sites (needs to read as considered and expensive, not corporate).

For each, name the foundry/source, confirm the exact licence and whether
it explicitly permits agency use across multiple unrelated client domains,
and give a direct download or purchase link. Cite sources.
```

## Blocking tier

A single hit fails the check. Not judgment calls — these are the specific,
named defaults that AI page-builders and component registries reach for
first when nothing else has been decided.

- **Tailwind's default indigo/violet palette as a primary or accent
  colour.** `bg-indigo-500` through `bg-indigo-700`, `text-indigo-*`,
  `bg-violet-*`, `border-indigo-*`, `ring-indigo-*`, anywhere but a rough
  internal draft.
- **The blue-to-purple/indigo/pink brand gradient**, the single
  most-cited tell in the 2026-09-11 research (documented across a
  47-site teardown as present in "nearly every" AI-generated landing
  page): `bg-gradient-to-r from-blue-... to-indigo-...`, `from-blue-...
  to-purple-...`, or any two-stop gradient combining `blue`/`purple`/
  `pink`/`fuchsia` shades, sitting in the 200–290° hue band. This is
  separate from the plain indigo/violet rule above because it fires even
  when neither stop is literally named `indigo` or `violet`.
- **The stock shadcn/ui Card recipe, unmodified**: `rounded-xl shadow-sm
  border p-6` (or the `rounded-lg shadow-md` variant) with no house radius
  or shadow token present in the same class list. The rule is not "never
  use a rounded card" — it's "never ship the registry default untouched."
- **The canonical AI hero shape**: a full-width centred section
  (`text-center` + `mx-auto`) combined with a gradient background utility
  (`bg-gradient-to-*`), on the first hero section of a page. One page can
  have a centred section, or a gradient, without it being a hit — the
  combination on the entry hero is the tell.

`design-check.py` implements these four mechanically today. The rest of
this file — font-default detection, icon consistency, cross-client layout
reuse — is not yet automatable from a class string alone and is a human
review item until the tool grows to cover it, the same way `copy-check.py`
only grew its density tier after two live misses. Don't read "the checker
is silent on X" as "X is fine."

## Review tier

Printed, never blocks. One instance is a legitimate choice; the same shape
reused identically is the tell — the visual equivalent of copy-rules.md's
"never reuse a sentence across two clients."

- **Gradient-clipped headline text** (`bg-clip-text` combined with a
  gradient utility) — a specific tell called out in the research, but a
  legitimate technique often enough that it stays a warning, not a block.
- Three or more elements in one file sharing one exact `rounded-* shadow-*
  p-*` combination with zero variation anywhere on the page.
- `font-sans` used with no house font configured in that project's
  Tailwind config — can't be verified from a class string alone, so this
  prints as a reminder to check, not a confirmed hit.
- `backdrop-blur-md` on a nav element combined with any of the blocking
  hits above — legitimate on its own, part of the recognised "glass nav"
  pattern when it stacks with the rest.
- A layout that is 100% centred, single-column, vertically stacked
  sections top to bottom, with no asymmetry, no grid break, no offset
  element anywhere on the page. The research names the fuller version of
  this pattern precisely: centred hero with one CTA, immediately followed
  by an `lg:grid-cols-3` feature grid (icon + heading + one-line copy per
  card), then a pricing table with a highlighted middle tier, then a
  testimonial strip with synthetic avatars, then a greyscale logo cloud,
  then a closing CTA. `grid-cols-3` alone is far too common a legitimate
  pattern to block on; it's the full sequence, in this order, that is the
  tell, and a per-file regex can't see page-level section order — a human
  read against this checklist is the check until this tool's
  `--cross`/structural mode exists.
- The exact same component shape (same tag structure, same class-string
  fingerprint) appearing in two different client repos. Not yet
  mechanically checked across repos — a quarterly manual pass until this
  tool grows a `--cross` mode.

## Escape hatches

Same mechanism as copy-check, deliberately — one discipline, two domains.

- `design-ok` on the line above, for a one-off (a client's own existing
  brand happens to be a shade of indigo, say — that is their brand, not a
  default).
- `.designauditignore` in the repo root, gitignore-style globs.
- `.nodesigncheck` to opt a whole repo out.
- `git commit --no-verify` in an emergency.

Reaching for these often enough means a token is wrong or missing, not
that the rule is wrong. Fix it here, not repo by repo.

## Baseline

Not measured yet. Run `design-check.py --all` across every client repo once
this ships, and log the count here the way `copy-rules.md`'s baseline is
logged — real debt, not noise, with a date attached.
