# The character standard

[STANDARD.md](./STANDARD.md) asks whether a surface is well made. This document
asks a second question: **did anyone decide how it looks, or is it the answer a
model gives when nobody told it otherwise?**

A site can pass every craft number and still read as generated. Indigo accent,
Inter, a glass card over the hero, a strip of logos, three icon cards, every
section fading up on scroll. None of those is wrong. Together they say nobody
chose anything.

## Change the look, not the page grammar

First impressions favour pages that look typical for their category (Tuch et
al., 2012). So this standard **never rewards strangeness**. Navigation, where
the call to action sits, reading order and legibility stay conventional. They
remain the job of STANDARD.md and the page audit.

Character goes into the surface: the display face, the accent, the shape
language, the motif, the one signature moment. That is where a model's defaults
show, and where a real business has something of its own to draw on.

## Three signals, and a reason behind every choice

Any fixed list of tells goes stale. Ban Inter and a model moves to Space
Grotesk. So the list is one signal of three, and the other two keep working as
model defaults move.

| Signal | Question | Status |
| --- | --- | --- |
| 1. Known tells | Does it use a choice on the catalogue below? | **Shipped**: source, copy, and on the rendered page for 18 tells (`craft audit`). |
| 2. Counterfactual typicality | Would Claude have built this anyway, for this brief? | **Shipped**: `craft null build` generates about 20 pages from the brief; `craft audit --null` scores a page against them. |
| 3. Distance from the estate | Does it look like the agency's other sites? | **Shipped**: `craft estate add` fingerprints each shipped site into `estate.json`; `craft estate compare` marks siblings. The agency's biggest tell is its clients looking like each other. |

**The reason rule.** Every expressive choice records a `because`, with evidence
from the client's real world: the shopfront, the van, the trade's own look, the
place, the materials. A token with no reason is a default. This is the part that
adds character rather than only removing tells. It lives in `art-direction.json`.

## Tells are tagged by generation

| Gen | What it is |
| --- | --- |
| 1 | The first wave: indigo, blue-to-purple gradients, Inter, glass, three icon cards. |
| 2 | What models moved to once the first wave was named: cream grounds and italic serifs, eyebrow chips, bento grids, marquees, intro cinematics. |
| 3 | Whatever `craft tells harvest` finds next in the null models, once a person has read it. |

A report counts findings by generation, so it can say *which* wave a site was
built in, not only that it has tells.

## Every tell ships as a warning

Nothing blocks until its hits across the estate have been read by a person and
the rule tuned against them. A rule that blocks on day one gets switched off by
day three. `--strict` fails on any finding, for a surface that has been
cleaned and should stay clean.

## Declaring the direction

`art-direction.json` at the site root records the seven expressive choices
(accent, ground, display face, body face, shape, motif, signature moment), the
sources in the client's world they come from, and why. Layout and navigation
are not choices here: they stay conventional.

```json
{
  "version": 1,
  "client": "RMP Electrical",
  "brief": "A two-person electrical contractor in Brackley doing rewires and EV chargers.",
  "sources": [
    { "id": "van", "kind": "livery", "note": "The Transit van, bottle green with cream sign-writing.", "path": "brand/van.png" }
  ],
  "choices": {
    "accent": {
      "value": "#1f4d3a",
      "because": "The bottle green is the van's own paint, and the van is what people in Brackley recognise.",
      "evidence": ["van"]
    }
  }
}
```

`craft direction validate` applies the reason rule. A choice is decided only
when its reason is at least a sentence, cites a declared source, and mentions
what that source shows (naming only the colour does not count). It rejects a
preference ("the client likes it"), a mood board (two or more of modern,
clean, premium, elegant and the rest), and a value on the tell catalogue
without an exception carrying the same reason. Given a snapshot, it warns
where the page does not show what the file declares.

`craft direction init` writes what the site does today with every reason
empty, so the first thing it produces is the list of things nobody decided.
Run on RMP's live home page (2026-09-23) it records Fraunces, Manrope, a cream
ground and pill buttons, three of them on the catalogue, and zero of seven
choices decided.

`craft direction propose` reads the dominant colours off each source's PNG
photo, ranks accent candidates away from the reflex violet band and from the
rest of the estate (`--estate` a folder of snapshots), and drafts choices.
Every draft reason starts `PROPOSED:`, which validate rejects: a person looks
at the van, agrees the green is the van's green, and says so in their own
words.

The editor schema ships as `@domandigital/craft/art-direction.schema.json`.
A file from phase A that holds only exceptions stays valid.

## Declaring an exception

Doman Digital's own brand is violet. A hue rule with no way to say so flags the
agency's own site on every commit. So an exception is declared, with its reason,
in `art-direction.json` at the site root:

```json
{
  "exceptions": [
    {
      "tell": "ai-violet",
      "because": "Violet has been the Doman Digital mark since 2019: the van, the cards, the signage.",
      "evidence": "brand/van-livery.jpg"
    }
  ]
}
```

An exception with no `because`, or one shorter than a sentence, is not applied
and is reported. An applied exception is still listed in every report with the
count it silenced, so it stays visible.

## Using it

```bash
craft scan                 # markup, components and stylesheets under .
craft scan --staged        # the git index, for a pre-commit hook
craft copy app content     # the prose a visitor reads
craft tells list           # the catalogue this build judges against
craft audit https://example.co.uk --repo .   # the rendered page and its source, one report
craft snapshot https://example.co.uk --out home.json
```

`--json` gives the full report. Exit code is 0 on warnings, 1 on a block (or
any finding under `--strict`), 2 on a usage error.

`scan` reads classes the way Tailwind does: `className="..."`, the literals
inside `cn()`, `clsx()` and `twMerge()`, and each `cva()` variant separately.
It reads colour in hex, `rgb()`, `hsl()` and `oklch()`, in raw CSS, Tailwind v4
`@theme` blocks and arbitrary values, and judges hue in OKLCh. A framework's
own palette definitions are ignored: a colour counts when a site uses it, not
when the framework defines it.

`copy` reads Markdown outside code, text between tags (including text that
runs into an expression, such as a label followed by `{count}`), string literals that
read as sentences, and the text inside HTML held in a string, such as an email
template. Short strings are read too, for the tells that fit in a label: an em
dash, an emoji, a "No catch." badge. Comments are never copy. It reads `.json`
and `.jsonl`, so a Sanity export can be checked a document per line. It skips
READMEs, changelogs and `_`-prefixed folders when walking a directory, because
those are for the people who build the site.

A real person's own words, a review or a testimonial, must never be edited to
pass. Mark the line, or the line above it, with `copy-ok` or `craft-ok`. Marked
findings are listed in every report with where they are, never hidden. The
same markers work for `craft scan`.

## The rendered page

`craft audit` opens the page in Chromium, waits five seconds, and records what
a visitor gets as a snapshot: the faces that set the text and the headline,
the colours by painted area, the buttons' shape, the sections in running
order and which ones wait for a scroll, and the effects (glass, glows,
marquees, an intro that covers the page at load). The same tells then judge
it, so a report can say "Inter in source and on the page", or catch the
violet a CMS sets that no source file names.

It needs Playwright, as an optional peer dependency: `npm i -D playwright`.
The core import never loads a browser. A saved snapshot can be judged again
anywhere with `craft audit home.json`. `HTTPS_PROXY` is honoured, and a
`localhost` or `NO_PROXY` host is reached directly.

Every audit also prints a **fingerprint**: accent and ground in OKLCh, the
display and body faces, button roundness, reveal density, the effects and the
running order. `fingerprintDistance` compares two of them, 0 to 1, weighted
towards accent and type. Signals 2 and 3 are both this distance, measured
against different sets.

Known limit: a computed font family is the family the stylesheet asked for.
A face that failed to load is still reported under its name.

## The counterfactual

A list of tells goes stale; the model does not. So signal 2 asks the model
directly: given this brief and nothing else, what would you build?

```bash
craft null build --brief "RMP Electrical, electricians based in Uxbridge ..." --out null/rmp
craft audit https://www.rmp-electrical.co.uk --null null/rmp
```

`null build` runs `claude -p` about 20 times (`--runs`), from an empty folder
with no tools, settings, skills or MCP servers, so each page is what the model
builds from the brief alone. The prompt is recorded in `null.json` and says
nothing about how the page should look. Each page is rendered, snapshotted and
fingerprinted like any other. A reply that is a note instead of a page is kept
as `NN.reply.txt` and generated again. The build is resumable: run the same
command to fill in anything that failed. `--brief` can come from
`art-direction.json` with `--direction`.

**Typicality** is a page's mean fingerprint distance to its three nearest null
pages, ranked against the same measure for every null page against the
others. A score of 0.40 means 40% of the model's own pages sit further from
the rest than this one does. A page is typical at 0.10 or above, so a page the
model built is flagged nine times in ten by construction, and the threshold
comes from the model's own spread rather than a number picked here. The report
lists what the page shares with most of the null ("display Inter, 14 of 20"),
which is where to start changing it.

**The harvest** reads null models the other way round. `craft tells harvest
calibration/null` lists the choices that recur across the null pages (faces,
accent families, grounds, button shapes, openings, phrases) and says which
tell already catches each. The ones nothing catches are the candidates for
generation 3. A phrase has to turn up across more than one brief, so a trade's
own words do not count, and navigation labels, form labels and the legal footer
are left out as page grammar. Nothing is added to the catalogue automatically:
a candidate becomes a tell with a flag case and a pass case like every other.

Known limits: a user-level `CLAUDE.md` on the machine that builds the null
still reaches the model. The null is only as current as its build date; rebuild
it when the model changes.

## The estate

The agency's biggest tell is not on any one site. It is its clients looking
like each other. `estate.json` holds one fingerprint per shipped site:

```bash
craft estate add https://www.rmp-electrical.co.uk --id rmp --client "RMP Electrical"
craft estate compare            # every pair, closest first
craft estate compare rmp        # one site against the rest
craft estate compare https://staging.example.test   # a new build before it ships
```

**Siblings** are two sites closer together than two pages Claude builds for
the same brief usually are: the median of that distance over the null models,
0.31 on 2026-09-23 (`--null` measures it again from any null models given).
If a barber and an electrician look more alike than two drafts of one barber,
neither look was chosen. The report says what the pair shares in plain words
("Fraunces headline", "no accent", "pill buttons"), which is where to start
pulling them apart. A sibling is a warning; `--strict` exits 1 on one, for a
pipeline that has decided to hold the line.

`craft direction propose --estate estate.json` reads the register too, so a
proposed accent steers away from one a sibling already uses.

## The house copy rules live here

Since catalogue `2026.09.2` the rule lists of claude-kit's
`house-style/copy-rules.md` are carried by tells in this catalogue:
`ai-phrase`, `plainer-word`, `plain-english`, `buzzword`,
`negative-reassurance`, `em-dash`, `emoji`, `not-just-but`, `no-x-no-y` and
`no-x-badge` are its blocking tier; `review-phrase` and `vague-word` its review
tier. craft ships all of them as `warn`. `copy-check` in claude-kit is a thin
wrapper over `craft copy --json` and decides which tells fail a commit, so the
lists exist once, here, with a test per entry.

The swap was checked against the old checker on 2,570 files across the seven
client repos (2026-09-23). The old checker found 193 issues, craft finds every
one of them that is visitor copy. The rest, 29, were the old checker reading
code comments, asset keys (`brows-hero-seamless`), a regex that strips em
dashes, and three words (`truly`, `genuinely`, `deeply`) that the house rules
keep in the review tier and the old list had drifted into blocking. Four real
misses in craft were fixed on the way: em dashes in JSX text next to an
expression, a lone dash placeholder in a table cell, prose inside HTML held in
a string, and the contrastive negation in a live welcome email that is the
reason that rule exists.

## Calibration

The targets, recorded here with the date once each has been run:

- **AI set** (pages generated by `claude -p` from about 20 briefs): 90% or more
  flagged as typical or tell-heavy. **First run 2026-09-23: 19 of 20 (95%)**, below.
- **Human set** (the ten references in claude-kit's `reference-set.md`): zero
  block hits and low typicality. *Not yet run.*
- **Estate baseline** (all seven client repos and live URLs): every hit read by
  a person before any rule blocks. **First run 2026-09-23**, below.

A first read of one internal repo (dd-library, 157 source files, 2026-09-22)
found Inter Tight and Fraunces in the base template, 21 scroll reveals and 31
pills, and one false positive: Tailwind's `amber-50`, the stock warning-notice
fill, read as a cream page ground. That rule now matches named cream tokens and
measured colour only.

### Estate baseline, 2026-09-23

`craft scan` over each repo and `craft audit` on each live home page at
1440 x 900. Snapshots and the table are in `calibration/estate/2026-09-23/`.
Cells read *source findings / R if seen on the rendered page*. Nothing here
blocks; it is for a person to read.

| Tell | DD | MMM | Sensphere | Harrison James | HJ Beauty | Chair and Blade | RMP |
|---|---|---|---|---|---|---|---|
| `reflex-font` | 15 / · | 2 / · | 3 / R | 2 / R | 2 / · | 1 / · |  |
| `reflex-font-2` | 7 / R | 34 / R | 2 / · | 1 / R | 3 / R | 4 / R | 12 / R |
| `ai-violet` | 36 / · | 9 / · | 18 / R |  |  |  |  |
| `gradient-text` |  | 2 / · |  |  |  |  |  |
| `glass-panel` | 9 / · | 45 / · | 13 / · |  | 1 / · |  |  |
| `hero-then-proof` | 9 / · | 1 / R | · / R |  | 1 / · | 1 / · | 2 / R |
| `icon-tile-grid` | 1 / R | 9 / · | · / R |  | · / R |  | 1 / R |
| `reveal-everywhere` | 1 / · | 1 / · |  |  |  | · / R |  |
| `pill-everything` | 1 / R | 1 / · | 1 / · |  |  |  | 1 / R |
| `shadcn-dump` |  | 1 / · |  |  |  |  |  |
| `cream-palette` |  | 3 / · |  |  |  |  | 18 / R |
| `italic-serif-display` |  | 4 / · |  |  |  | 8 / · | 1 / R |
| `hero-eyebrow-chip` | 1 / · | 1 / · |  |  |  |  | · / R |
| `icon-tile-stack` | 1 / · | 93 / · | 4 / · |  |  |  | 18 / · |
| `radial-spotlight-glow` | 6 / R | 14 / R | 5 / R |  |  |  |  |
| `grid-background` |  | 2 / · |  |  |  |  |  |
| `marquee` | 1 / · |  |  |  | 3 / R | · / R |  |
| `thin-border-wide-shadow` |  | 2 / · | 4 / R |  |  |  |  |
| `intro-cinematic` |  | · / R |  |  |  | 2 / · |  |

What it shows:

- **The three survey findings reproduce where they can.** Sensphere's violet
  is found in source (18) and on its buttons; MMM's intro, glows and glass are
  in source and its intro and glows on the page; MMM reveals 60% of the
  sections below its fold on scroll, all three of them, one short of the
  four the rendered rule needs, and its source is over the reveal limit. Rise & Bloom's glass
  hero and icon grid could not be checked: that repo is not attached to this
  session.
- **Every site ships a reflex face.** Twelve of fourteen site-face pairs are
  on one of the two lists. Fraunces sets the headline on DD, HJ Beauty and RMP.
- **DD and RMP were read as the closest pair** (0.46) on the first run, with
  a green accent in common. DD's "green" was its floating WhatsApp button,
  48px square, the only saturated paint on a near-black and white page. The
  fingerprint now needs a panel's worth of area before a painted colour
  counts as the accent. The corrected pairs are under *The estate*, below.
- **DD's violet is its brand.** Its 36 source hits wait for the exception in
  its `art-direction.json`.

False positives found and fixed in this run:

- `glass-panel` on the page fired on five of seven sites. Every one was a
  sticky or fixed nav bar with a blurred background, which is ordinary chrome.
  The rendered path now ignores anything in a `header` or `nav`, fixed or
  sticky, and anything smaller than a panel.
- `next/font` and CSS-variable family names (`__Inter_d65c78`,
  `cormorantGaramond`) are now read back to the face's name, or every Next.js
  site would have passed the font tells.

- The rendered reveal check read only a section and its direct children.
  Found through the null models (below): a reveal on the cards two levels
  down read as a still page. It now reads the text blocks inside a section
  too, ignoring anything fixed. Re-run the same day: Chair and Blade, which
  has a `RevealWrapper`, now shows `reveal-everywhere` on the page (six of
  nine sections below the fold).

Not yet read by a person: the source counts for `icon-tile-stack` (MMM 93)
and `glass-panel` (MMM 45) look high and are the first to check.

### Signal 2 first read, 2026-09-23

Seven null models, one per estate brief, 20 pages each (140 pages), built
with `craft null build` from the briefs in `calibration/briefs.json`. Eight
replies were notes instead of pages and were generated again (kept as
`*.reply.txt`). Everything is in `calibration/null/`; `score.mjs` reproduces
the numbers and writes `results.json`.

**AI set.** Twenty briefs the null never saw (a dentist, a bakery, a
landscaper and so on), one page each, scored against all 140 null pages.
Flagged means typical (0.10 or above) or tell-heavy (three or more distinct
design tells), a rule fixed before any result was read.

| | Pages | Share |
|---|---|---|
| Flagged | 19 of 20 | 95% (target 90%) |
| Typical on its own | 13 of 20 | 65% |
| Tell-heavy on its own | 16 of 20 | 80% |

The one miss is the landscaper: dark forest green on a cream ground,
Cormorant Garamond over Karla, square buttons. Two tells (`cream-palette`,
`reflex-font-2`), one short of tell-heavy, and a score of 0.01 against the
pooled null because no estate brief is a garden business. Neither signal alone reaches the
target; together they do, which is the reason for having more than one.

**The model's look depends on the brief.** Each brief's null pages scored
against the other six briefs' pages are typical only 2 to 13 times in 20.
A barber and an electrician get different pages. So a site is scored against
the null built from its own brief, and pooling briefs is a weaker test.

**The estate against its own brief's null.** Score, then what it shares with
most of the null.

| Site | Score | Typical | Shares with the null |
|---|---|---|---|
| DD | 0.15 | yes | pill buttons (19 of 20), Fraunces headline (13 of 20) |
| Harrison James | 0.10 | yes, at the line | Inter body (18 of 20), yellow accent (16 of 20), white ground |
| MMM | 0.05 | no | white ground, radial glow (13 of 20), Cormorant Garamond (9 of 20) |
| HJ Beauty | 0.05 | no | white ground, Fraunces (5 of 20), marquee (5 of 20) |
| Chair and Blade | 0.05 | no | square buttons (18 of 20), Bebas Neue (9 of 20), dark ground |
| RMP | 0.05 | no | eyebrow chip (14 of 20), Manrope body |
| Sensphere | 0.00 | no | radial glow (10 of 20), Inter body |

Read with care: "not typical" says the site is not what Claude builds from
the brief today. It does not say the site was decided. Sensphere scores 0.00
and still carries five catalogue tells on the page, violet among them: Claude
no longer builds that look for this brief, but it is still a known tell. That
is what signal 1 is for. DD and Harrison James are the
two a model would most nearly have built unprompted.

**The harvest** (`calibration/null/harvest.txt`). No face outside the two
reflex lists is chosen by a quarter of the null pages, so the font lists still
cover what the model picks today: Inter 69 of 140, Fraunces 51, Poppins 36.
The catalogue tells the model still produces most: `reflex-font-2` 103 of
140, `glass-panel` 100, `reflex-font` 94, `cream-palette` 81,
`pill-everything` 79. Candidates nothing catches yet, for a person to read:

- A coral or terracotta accent (around `#e77a63`): 66 of 140, five briefs.
- Phrases across five or more briefs: "done properly" (33 pages, six briefs),
  "exactly what" (27, all seven), "who actually" (24, five), "within one
  working day" (32, five), "rather than" (27, six).
- The opening "hero > hero > cards" (54 of 140) is how the section reader
  splits a nav band from the hero, not a model habit. Not a candidate.

`glass-panel` at 100 of 140 includes source hits on blurred sticky navs, the
same false positive fixed on the rendered path. The source rule needs the same
fix before that count means anything.

### Signal 3 first read, 2026-09-23

`craft estate add` on the seven live snapshots, then `craft estate compare
--null calibration/null/*` (the line measured again: 0.31). Register and output
in `calibration/estate/`.

| Pair | Distance | Shares |
|---|---|---|
| DD + HJ Beauty | **0.28, siblings** | no accent, Fraunces headline, no reveals |
| DD + RMP | 0.49 | Fraunces headline, grey ground, pill buttons |
| Harrison James + Sensphere | 0.50 | white ground, square buttons, no reveals |
| HJ Beauty + RMP | 0.56 | Fraunces headline |
| Chair and Blade + anything | 0.60 to 0.86 | at most a marquee (with HJ Beauty) |

One sibling pair in twenty-one, and it is the agency's own site with one of
its clients: the same Fraunces headline over a near-black and white page with
no colour of its own. Fraunces sets the headline on three of the seven. Chair
and Blade shares nothing with anyone but a marquee. Not yet read by a person.

## The catalogue

Generated from the package. Run `pnpm --filter @domandigital/craft run docs`
after changing an entry; a test fails until you do.

<!-- craft:catalogue:start -->
Catalogue version `2026.09.3`, 39 tells.

| Id | Gen | Surface | Severity | Tell | Why it is a default |
| --- | --- | --- | --- | --- | --- |
| `reflex-font` | 1 | source + rendered | warn | Reflex font | Inter, Roboto, Poppins and friends are what a model sets when nothing in the brief names a face. Every site in the estate ships one. |
| `reflex-font-2` | 2 | source + rendered | warn | Second-wave reflex font | Ban Inter and a model reaches for Inter Tight, DM Sans, Manrope, Space Grotesk or an Instrument/Fraunces serif. A swap inside the reflex list is not a decision. |
| `ai-violet` | 1 | source + rendered | warn | Indigo-violet accent | Tailwind's indigo and violet are the accent a model picks for any brand it knows nothing about. Hue is read in OKLCh, so a hex violet is caught as well as a class name. |
| `blue-purple-gradient` | 1 | source + rendered | warn | Blue-to-purple gradient | The first-wave hero background. It says 'software product' on a plumber's site. |
| `gradient-text` | 1 | source + rendered | warn | Gradient-filled heading | Gradient text is the model's way of making a heading look designed without deciding what it should look like. |
| `glass-panel` | 1 | source + rendered | warn | Glass panel | A translucent blurred card over a busy background is the stock way to put text on a hero image. It costs contrast and says nothing about the client. |
| `hero-then-proof` | 1 | source + rendered | warn | Hero straight into a trust strip | Six of seven estate sites go hero, then logos or stats. It is the landing-page template's order, not the client's story. |
| `icon-tile-grid` | 1 | source + rendered | warn | Three-column icon-card grid | Three cards, each an icon, a heading and two lines, is what a model builds for any list of services. |
| `reveal-everywhere` | 1 | source + rendered | warn | Reveal on every section | When every block fades up on scroll, the motion stops meaning anything and the page feels slow. MMM had 70, DD 40, sen-sphere 27. |
| `pill-everything` | 1 | source + rendered | warn | Pills everywhere | rounded-full on every button, badge and tag is the framework's friendliest default. MMM had 162, DD 125. A shape used everywhere is not a shape language. |
| `shadcn-dump` | 1 | source | warn | Stock component dump | A generator exports the whole shadcn/ui kit whether the site uses it or not. Rise & Bloom ships a full set under its own book, vine and petal assets. |
| `cream-palette` | 2 | source + rendered | warn | Cream ground | Once white-and-violet was named, models moved to a warm off-white: parchment, linen, oat. It reads as 'tasteful' in the same way everywhere. |
| `italic-serif-display` | 2 | source + rendered | warn | Italic serif display | A serif heading with one italic word ('Beauty, reimagined') is the second wave's signature move. |
| `hero-eyebrow-chip` | 2 | source + rendered | warn | Eyebrow chip above the hero | A small bordered pill ('New · Now booking') above the headline is in almost every generated hero. |
| `icon-tile-stack` | 2 | source | warn | Icon in a tinted tile | A library icon in a soft rounded square, stacked above a heading, is the stock card header. |
| `bento-grid` | 2 | source | warn | Bento grid | Mixed-size tiles in a grid became the default 'features' layout of the second wave. |
| `radial-spotlight-glow` | 2 | source + rendered | warn | Radial glow | A soft blurred blob or radial spotlight behind the hero is atmosphere without a subject. |
| `grid-background` | 2 | source + rendered | warn | Graph-paper background | A faint 1px line or dot grid behind the hero is the developer-tool look, borrowed by everyone. |
| `marquee` | 2 | source + rendered | warn | Scrolling marquee | An endless strip of logos or words is the second wave's trust strip. It moves so it looks alive. |
| `thin-border-wide-shadow` | 2 | source + rendered | warn | Hairline border, wide shadow | A near-invisible border under a large soft shadow is the stock 'elevated card'. |
| `intro-cinematic` | 2 | source + rendered | warn | Intro cinematic | A logo animation that runs before the page is something a model adds to make a site feel premium. Three estate sites open with one. It delays the page for every visitor. |
| `ai-vocabulary` | 1 | copy | warn | AI vocabulary | Tapestry, elevate, nestled, unparalleled: words that appear in generated copy far more than in anything a business owner writes. |
| `stock-phrase` | 1 | copy | warn | Stock phrase | Phrases every generated services page uses. They fill space where a fact should be. |
| `ai-phrase` | 1 | copy | warn | AI phrase | Let's dive in, here's the thing, at its core, seamless, rest assured: the phrase list of the house copy rules. A reader has seen each one in a thousand generated pages. |
| `plainer-word` | 1 | copy | warn | A plainer word exists | Empower, leverage, harness, delve: each stands in for a plainer verb, and the swap is a reliable sign nobody chose the word. |
| `plain-english` | 2 | copy | warn | 'Plain English' | Told to avoid jargon, a model announces that it is avoiding jargon. 'Explained plainly' swaps a synonym and keeps the tell. |
| `buzzword` | 1 | copy | warn | Buzzword | Cutting-edge, world-class, reach out, turnkey: corporate filler older than any model, and still the first thing a model writes about a business it knows nothing about. |
| `negative-reassurance` | 1 | copy | warn | Negative reassurance | 'No hidden fees', 'no surprises', 'never locked in' reassure by naming the fear, and plant it in a reader who did not have it. |
| `vague-word` | 1 | copy | warn | Vague word | Innovative, scalable, end-to-end, solutions: each can be true, and each is used where the writer had nothing specific to say. |
| `review-phrase` | 1 | copy | warn | Review-tier phrase | Truly, genuinely, ultimately, 'the single most', 'bar none': normal English once, and a tell when they stack. The house rules keep them for review, never blocking. |
| `hollow-imperative` | 1 | copy | warn | Hollow imperative | 'Discover', 'Experience', 'Transform your' as the opening verb of a heading or button is a call to action with nothing in it. |
| `rhetorical-opener` | 1 | copy | warn | Rhetorical question opener | 'Looking for...?', 'Tired of...?', 'Ready to...?' opens with the model guessing at the reader instead of telling them something. |
| `em-dash` | 2 | copy | warn | Em dash | Generated copy leans on the em dash to join clauses. House copy does not use it. |
| `emoji` | 1 | copy | warn | Emoji in copy | A sparkle or a rocket beside a heading is decoration a model adds to seem friendly. It dates the page and reads as a social post. |
| `not-just-but` | 2 | copy | warn | Contrastive negation | 'It's not just a haircut, it's an experience', 'dispatched from here, not shipped in': the contrast-and-reveal template is the most recognisable construction in generated copy. |
| `no-x-no-y` | 2 | copy | warn | 'No X, no Y' list | 'No obligation, no spam.' Defining the business by what it is not, itemised, is the same template as contrastive negation. |
| `no-x-badge` | 2 | copy | warn | 'No X' badge | 'No catch.', 'NO JARGON GUIDE': a short standalone 'No X' reads as a slapped-on kicker, and worse when the same one is reused across pieces. |
| `staccato-triplet` | 2 | copy | warn | Staccato triplet | Three fragments in a row ('Fast. Friendly. Local.' or 'No fuss. No jargon. Just results.') is the second wave's favourite rhythm. |
| `where-x-meets-y` | 2 | copy | warn | 'Where X meets Y' | 'Where luxury meets comfort' is a tagline shape that fits every business and so describes none. |
<!-- craft:catalogue:end -->
