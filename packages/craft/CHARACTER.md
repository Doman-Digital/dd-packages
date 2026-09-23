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
| 1. Known tells | Does it use a choice on the catalogue below? | **Shipped** (source and copy). Rendered checks arrive with the snapshot. |
| 2. Counterfactual typicality | Would Claude have built this anyway, for this brief? | Planned. About 20 `claude -p` runs per brief; distance from those answers. |
| 3. Distance from the estate | Does it look like the agency's other sites? | Planned. The agency's biggest tell is its clients looking like siblings. |

**The reason rule.** Every expressive choice records a `because`, with evidence
from the client's real world: the shopfront, the van, the trade's own look, the
place, the materials. A token with no reason is a default. This is the part that
adds character rather than only removing tells. It lives in `art-direction.json`.

## Tells are tagged by generation

| Gen | What it is |
| --- | --- |
| 1 | The first wave: indigo, blue-to-purple gradients, Inter, glass, three icon cards. |
| 2 | What models moved to once the first wave was named: cream grounds and italic serifs, eyebrow chips, bento grids, marquees, intro cinematics. |
| 3 | Whatever the harvester finds next. |

A report counts findings by generation, so it can say *which* wave a site was
built in, not only that it has tells.

## Every tell ships as a warning

Nothing blocks until its hits across the estate have been read by a person and
the rule tuned against them. A rule that blocks on day one gets switched off by
day three. `--strict` fails on any finding, for a surface that has been
cleaned and should stay clean.

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
  flagged as typical or tell-heavy. *Not yet run.*
- **Human set** (the ten references in claude-kit's `reference-set.md`): zero
  block hits and low typicality. *Not yet run.*
- **Estate baseline** (all seven client repos and live URLs): every hit read by
  a person before any rule blocks. *Not yet run.*

A first read of one internal repo (dd-library, 157 source files, 2026-09-22)
found Inter Tight and Fraunces in the base template, 21 scroll reveals and 31
pills, and one false positive: Tailwind's `amber-50`, the stock warning-notice
fill, read as a cream page ground. That rule now matches named cream tokens and
measured colour only.

## The catalogue

Generated from the package. Run `pnpm --filter @domandigital/craft run docs`
after changing an entry; a test fails until you do.

<!-- craft:catalogue:start -->
Catalogue version `2026.09.2`, 39 tells.

| Id | Gen | Surface | Severity | Tell | Why it is a default |
| --- | --- | --- | --- | --- | --- |
| `reflex-font` | 1 | source | warn | Reflex font | Inter, Roboto, Poppins and friends are what a model sets when nothing in the brief names a face. Every site in the estate ships one. |
| `reflex-font-2` | 2 | source | warn | Second-wave reflex font | Ban Inter and a model reaches for Inter Tight, DM Sans, Manrope, Space Grotesk or an Instrument/Fraunces serif. A swap inside the reflex list is not a decision. |
| `ai-violet` | 1 | source | warn | Indigo-violet accent | Tailwind's indigo and violet are the accent a model picks for any brand it knows nothing about. Hue is read in OKLCh, so a hex violet is caught as well as a class name. |
| `blue-purple-gradient` | 1 | source | warn | Blue-to-purple gradient | The first-wave hero background. It says 'software product' on a plumber's site. |
| `gradient-text` | 1 | source | warn | Gradient-filled heading | Gradient text is the model's way of making a heading look designed without deciding what it should look like. |
| `glass-panel` | 1 | source | warn | Glass panel | A translucent blurred card over a busy background is the stock way to put text on a hero image. It costs contrast and says nothing about the client. |
| `hero-then-proof` | 1 | source | warn | Hero straight into a trust strip | Six of seven estate sites go hero, then logos or stats. It is the landing-page template's order, not the client's story. |
| `icon-tile-grid` | 1 | source | warn | Three-column icon-card grid | Three cards, each an icon, a heading and two lines, is what a model builds for any list of services. |
| `reveal-everywhere` | 1 | source | warn | Reveal on every section | When every block fades up on scroll, the motion stops meaning anything and the page feels slow. MMM had 70, DD 40, sen-sphere 27. |
| `pill-everything` | 1 | source | warn | Pills everywhere | rounded-full on every button, badge and tag is the framework's friendliest default. MMM had 162, DD 125. A shape used everywhere is not a shape language. |
| `shadcn-dump` | 1 | source | warn | Stock component dump | A generator exports the whole shadcn/ui kit whether the site uses it or not. Rise & Bloom ships a full set under its own book, vine and petal assets. |
| `cream-palette` | 2 | source | warn | Cream ground | Once white-and-violet was named, models moved to a warm off-white: parchment, linen, oat. It reads as 'tasteful' in the same way everywhere. |
| `italic-serif-display` | 2 | source | warn | Italic serif display | A serif heading with one italic word ('Beauty, reimagined') is the second wave's signature move. |
| `hero-eyebrow-chip` | 2 | source | warn | Eyebrow chip above the hero | A small bordered pill ('New · Now booking') above the headline is in almost every generated hero. |
| `icon-tile-stack` | 2 | source | warn | Icon in a tinted tile | A library icon in a soft rounded square, stacked above a heading, is the stock card header. |
| `bento-grid` | 2 | source | warn | Bento grid | Mixed-size tiles in a grid became the default 'features' layout of the second wave. |
| `radial-spotlight-glow` | 2 | source | warn | Radial glow | A soft blurred blob or radial spotlight behind the hero is atmosphere without a subject. |
| `grid-background` | 2 | source | warn | Graph-paper background | A faint 1px line or dot grid behind the hero is the developer-tool look, borrowed by everyone. |
| `marquee` | 2 | source | warn | Scrolling marquee | An endless strip of logos or words is the second wave's trust strip. It moves so it looks alive. |
| `thin-border-wide-shadow` | 2 | source | warn | Hairline border, wide shadow | A near-invisible border under a large soft shadow is the stock 'elevated card'. |
| `intro-cinematic` | 2 | source | warn | Intro cinematic | A logo animation that runs before the page is something a model adds to make a site feel premium. Three estate sites open with one. It delays the page for every visitor. |
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
