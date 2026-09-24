# The house copy standard

**Canonical.** Every client repo, every session, every piece of outbound
writing. This file ships in `@domandigital/craft`, next to the tells that
enforce it. Anything else claiming to be the copy rules is a copy: link here.

- The rules are this file.
- The detectors are craft's copy tells: `craft tells list` shows every one,
  with why it is a default and what to do instead.
- The house policy, which tells fail a commit, is `src/character/house.ts`.
  `craft copy --gate` applies it. `copy-check` in claude-kit is a thin wrapper
  over that, and the pre-commit hook runs it.

## Why

A reader who has seen a thousand generated pages recognises one in a line.
None of the patterns below is AI-only, and people use all of them. The signal
is **stacking**: one is plausible, three on a page reads as machine output.

What makes copy read as written by a person is not the absence of tells. It is
the presence of facts: a place, a time, a number, a name, who does the work.
The rules below remove the defaults; the writing directives say what to put in
their place.

## Blocking tier

A single hit fails the check. These are not judgment calls.

- **Em dashes.** Use a full stop, a comma, a colon or a middot. En dashes for
  genuine ranges (`Monday–Saturday`, `9am–5pm`) are correct and stay.
- **Emoji** in shipped copy. Typographic marks are fine: `★` for a rating, `·`
  as a separator, `→` in a link.
- **Contrastive negation as a template**, in every form:
  - copular: "It's not a website, it's a growth engine"
  - verbal: "I don't teach the treatment you'd choose: I teach the standard"
  - "not just X" / "not merely" / "not simply" / "more than just"
  - "X isn't a job, it's art"
  - "less about X, more about Y"
  - parallel participle: "shipped from here, not imported from Seoul". Both
    sides must be real participles, so "cosmetics, not medicines" (a plain
    factual contrast) passes.
- **A "No X" claim as the whole string.** "NO JARGON GUIDE", "No catch." A
  short standalone "No X" reads as a slapped-on badge. Empty-state and error
  text is exempt ("No results found", "No bookings yet"), as is anything under
  a signed-in route (`/admin/`, `/portal/`, `/dashboard/`).
- **"No X, no Y" as a list**, anywhere in a sentence. "No obligation, no
  spam." Defining the business by what it is not, itemised.
- **Chatbot residue.** "Certainly! Here's a revised version", "as an AI
  language model", "let me know if you'd like me to", ChatGPT citation tokens
  and entity markers, links tracked `utm_source=chatgpt.com`. This is not
  style: it is proof a chat reply was pasted in whole. Remove it, then source
  or cut any claim a citation token was backing. Never re-cite from memory.
- The phrase list: `let's dive in`, `let's unpack`, `let's break this down`,
  `here's the thing`, `it's important to note`, `at its core`,
  `the key takeaway`, `the reality is`, `the truth is`,
  `in today's rapidly evolving…`, `increasingly digital`,
  `whether you're a X or a Y`, `seamless(ly)`, `unlock your…`,
  `meaningful impact`, `foster collaboration`, `empower`, `leverage`,
  `harness`, `delve`, `a comprehensive guide to`, `plain English`.

Also blocking: `in the event that`, `at no additional cost to you`, `rest
assured`, `it is worth noting that`, `when it comes to`, `we've got you
covered`, `dive into`, `unlock the power`, `look no further`.

**Buzzwords**: synergy, cutting-edge, best-in-class, best of breed,
world-class, state of the art, game-changer, paradigm shift, mission-critical,
low-hanging fruit, move the needle, circle back, touch base, reach out (use
"get in touch"), value-add, robust, turnkey, holistic, disruptive.

**Negative reassurance**: `no risk`, `never locked in`, `nothing goes wrong`,
`no hidden fees`, `never pay`, `without the hassle`, `no surprises`. Do not
name a fear and deny it. Say what they get: "The price on the quote is the
price you pay", not "no hidden fees".

`empower`, `leverage` and `harness` block because a plainer word almost always
exists. Name the mechanism: "Your team can publish without us", not "we
empower your team".

`plain English` has one house replacement: **"properly explained"**.
"Explained plainly" swaps a synonym and keeps the tell.

## Review tier

Printed, never blocks. One is normal English; several stacked is not. Only a
person reading decides which instance earns its place.

| Tell | What it catches |
| --- | --- |
| `review-phrase` | truly, genuinely, deeply, ultimately, great question, absolutely, one-size-fits-all, and superlative over-claiming: "the single most", "by far the most", "hands down the", "arguably the best", "bar none" |
| `ai-vocabulary` | tapestry, testament, realm, elevate, nestled, meticulous, unparalleled, moreover; and underscore, showcasing, pivotal, measured 10 to 14 times over-used in post-2022 text |
| `stock-phrase` | to the next level, one-stop shop, we pride ourselves, passionate about, peace of mind, "so here's", a journey used as a metaphor |
| `hollow-imperative` | Discover, Experience, Transform, Elevate as the opening verb of a heading or button |
| `rhetorical-opener` | "Looking for...?", "Tired of...?", "Ready to...?" |
| `staccato-triplet` | "Fast. Friendly. Local." |
| `where-x-meets-y` | "Where luxury meets comfort" |
| `ing-tail` | "..., ensuring peace of mind", "..., highlighting our commitment": significance claimed, no mechanism |
| `vague-attribution` | "studies show", "experts agree", "it is widely known": a claim credited to nobody |
| `closing-summary` | "Overall,", "In conclusion,", "In short," opening a paragraph that restates what came before |
| `false-range` | "from first-time buyers to seasoned investors alike", "everyone from students to retirees" |
| `vague-word` | innovative, scalable, end-to-end, streamline, solutions. Reported only when a file is named outright |
| `question-reveal` | "The result? Twice the bookings.", "What does this mean for you? It means...": a staged reveal |
| `inline-label-list` | three or more bullets in a row opening "**Label:**", where the label repeats the line |
| `prompt-context` | "This article uses the attached Perplexity research file as the primary source", "the attached research is right to say", "the attached brief asks": the model naming what it was given. A web page has no attachment. **Zero in anything published** |
| `placeholder` | "[Insert client name]", lorem ipsum, `TODO_PLACEHOLDER`. Fine in a draft commit; **zero in anything delivered** |

### Style is not evidence

Most tells here are house style: they make copy generic, whoever wrote it. The
research is clear that an em dash, a rule of three or a rhetorical question
proves nothing about authorship, and em dash rates even run in opposite
directions between models. Only chatbot residue, in the blocking tier, is evidence that a chat reply
was pasted. Report findings as an editorial diagnosis ("three benefit claims
lack a mechanism; two stock phrases recur"), never as a score or an
accusation.

Two more review patterns no regex can separate from honest English, so they
are for the read-through only:

- **Trailing contrastive negation**: "Real Square data, not a vanity metric."
  The same shape is how a genuine disclaimer is written ("general information,
  not a recommendation").
- **Abstract noun triads** with no concrete referent: "clarity, consistency,
  confidence".

## Density tier

Review only, never blocks. Every rule above fires on one line read in
isolation. These fire on a **rate**: each instance is legitimate English, and
only the count gives it away. They read documents (Markdown, MDX, text, HTML)
of 400 words or more, and the allowed count is a floor plus a rate per 1,000
words, so a proposal is not held to a landing page's limit.

Why they exist: a 30-page client proposal passed every per-line rule clean.
A person then found "rather than" 54 times in 10,500 words, no contractions,
one sentence pasted onto two pages, a heading repeated as its own first line,
and an italic one-liner closing almost every page.

| Tell | Fires above |
| --- | --- |
| `phrase-density` | "rather than" (4, +0.9 per 1,000 words), "instead of" (4, +0.7), "actually" (2, +0.35), "properly" (3, +0.4), "genuinely" (1, +0.2), "the single ...est" (1, +0.15), "That is / This is" openers (4, +0.7), "Every" openers (4, +0.6), "Worth noting" openers (3, +0.5), negation-led openers "None of / Not one / Nothing" (5, +1), participle triads "researched, written and referenced" (3, +0.6) |
| `aphorism-density` | two clipped sentences alone on a line, "It already exists. The job is making it findable." (5, +1.2) |
| `contraction-scarcity` | under one contraction per 1,000 words, in 800+ words. Formal legal pages are the deliberate exception |
| `sentence-rhythm` | sentence lengths that barely vary: spread (standard deviation over mean) under 0.42 across 40+ sentences |
| `repeated-sentence` | a sentence of nine words or more appearing twice, or two sentences sharing a nine-word run |
| `heading-shape` | headings sharing one shape: "X, and Y", "X, because Y", a bare comma list (3, +0.5) |
| `heading-echo` | a heading of four words or more repeated as the first words under it |

The fix is never to delete every instance. Keep the ones that land hardest and
vary the rest. That is why a density finding prints a count and an example,
not a line to go and edit.

## Writing directives

These are what to do, not what to avoid. Read them **before** drafting. Do not
read the tell lists before drafting: naming a phrase to avoid puts it in the
writer's head, and it comes out anyway. Check against the lists afterwards.

- **Lead with the fact.** A place, a time, a number, a name. "Gas Safe
  registered since 2009. Same-day callouts in Brackley." beats "Trusted local
  experts".
- **Concrete nouns beat abstractions.** "Rated 5.0 from 58 reviews" beats
  "trusted by the community".
- **Name the mechanism.** Not "hassle-free booking", but "Book in three taps.
  We confirm by text within the hour."
- **Persuade with something checkable.** Sales copy has to sell, and
  enthusiasm is allowed. Persuasion backed by a fact passes; persuasion with no
  fact behind it is the tell.
- **Concise, scannable, objective.** In usability testing, cutting word count,
  making text scannable and dropping promotional tone each helped, and all
  three together roughly doubled usability (Nielsen Norman Group).
- **Vary sentence length.** Some long, some short, some flat. Uniform rhythm
  reads generated, and so does uniform wit.
- **Use contractions** where you would in speech. Formal legal pages are the
  exception.
- **If the sentence would read the same with a competitor's name in it**, cut
  it or make it specific.
- **Never reuse a sentence across two clients.** Templated language across
  clients is a stronger tell than any phrase.
- **Never open with a thesis-statement negation.** "This is a working build,
  not a mockup." Judge by function: if the sentence exists only for the
  contrast, cut it.
- **Compliance hedging must not eat the sell.** Put trial design and caveats
  where substantiation belongs (an evidence section, an ingredients panel, a
  footnote). In the selling paragraph, name the claim and stop.
- **End each major section with one action sentence**: what to do next.
  "Book a call to see if we're a fit."

## Register: British and professional

The tool cannot grade register; a person does. British spelling and phrasing
(colour, organise, licence as a noun, centre, towards, enquiries). Professional
and confident, never matey: no over-familiar asides ("with me nowhere near
it"), no American idiom ("shallow wins", "looks busy"), no "honestly" as an
intensifier. Do not change a brand name, domain or legal entity wording.

## Word limits

| Element | Limit |
| --- | --- |
| H1 | 10 words |
| Subhead | 24 words |
| Paragraph | 2 sentences |
| Bullet | 7 words |

Hyphenated compounds count as one word. Not automated.

## Proof rule

- **No invented results, testimonials, logos, certifications or numbers.
  Ever.**
- Every proof point comes from the project's own proof source (a proofs or
  reviews file, the CMS, the client). If one is missing, write
  `TODO_PLACEHOLDER: <the exact field needed>` and say so. Never fill it.
- A quotation under a named person must be theirs. Copy drafted for someone,
  in quote marks with their job title beneath it, is a fabricated attribution.
- **Every price, figure, date and named source is checked against its primary
  source before it ships.** `craft copy claims <paths>` lists them, each marked
  sourced or UNSOURCED. A claim is sourced, corrected or cut, never re-cited
  from memory. The copy check cannot do this part: a false figure in clean
  prose passes every tell.

## CTA rule

- One primary CTA label site-wide on commercial pages, in the form **action +
  outcome**: "Book a free strategy call".
- The secondary CTA is the same everywhere it appears.
- Labels and links come from the project's config, never retyped per page.

## Never edit to pass: quoted words

**A real person's own words are exempt from every rule here.** Reviews,
testimonials, a practitioner's bio, a quote from the client. Editing them to
pass an audit falsifies a quotation, which is far worse than an em dash. Mark
the line `copy-ok` or add the file to `.copyauditignore`, and leave it as they
said it.

**Owner-editable copy is advised on, never overridden.** Where a client types
their own words into a CMS, report what the check finds and tell them. Copy
that ships from the repo is ours to fix; copy the owner typed is theirs.

## Rendered social assets: no raw links

A carousel slide, Story, Reel or caption never shows a raw URL: no `https://`,
no `www.`, no path. Show a bare domain (`RMP-ELECTRICAL.CO.UK`) or a plain
call to action ("Link in bio"). Keep the full address in source data and let
the render step transform it. craft cannot enforce this, because raw URLs are
legitimate almost everywhere else in a repo. The social generator's own render
gate enforces it, before its first render ships.

## Suppressing a finding

For genuine exceptions only, and the reason matters more than the mechanism:

- `copy-ok` (or `craft-ok`) on the line or the line above: a one-off. Listed
  in every report, never hidden.
- `.copyauditignore` at the repo root: globs, matched on the repo-relative
  path and the bare filename.
- `.nocopycheck` at the repo root: skips the repo.
- An `exceptions` entry in `art-direction.json`, with a `because` of at least
  a sentence.

Reaching for these more than occasionally means a rule is miscalibrated. Fix
it here and in craft, not in forty repos.

## Rewriting without losing facts

A rewrite that removes every tell and drops the price is worse than the
draft. Before handing over any rewrite, compare it with the original:

```bash
craft copy compare original.md rewrite.md
```

It lists every protected fact (prices, numbers, dates, times, phone numbers,
emails, links, postcodes, names) the rewrite **lost**, and every one it
**added**. Exit 1 if either list is not empty. Restore a lost fact or say why
it went; source an added fact or remove it, because an unsourced number is an
invented one.

## Changing a rule

1. Edit this file.
2. Add or change the tell in `src/character/tells/`, with a flag fixture per
   detection path and a pass fixture that is real persuasive copy. A tell that
   fires on good sales copy does not ship.
3. Place it in `src/character/house.ts`. New tells start as `review`. A tell
   moves to `block` only after its hits across the estate have been read by a
   person and the baseline is recorded in `ROADMAP.md`.
4. `pnpm --filter @domandigital/craft test`. The binding test fails if a
   phrase in this file's blocking tier does not block.
