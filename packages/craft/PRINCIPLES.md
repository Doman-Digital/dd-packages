# Why this package exists

Not to make things consistent. Consistency was already achievable, and largely
achieved, by hand. This package exists because the numbers that govern how a
Doman Digital surface looks were written down in three places that never agreed,
and because several of them were wrong in ways nobody could see by reading them.

## The defect

**Three token vocabularies, zero shared numbers.** `packages/ui/tokens/` in the
monorepo, a `:root` block in a client site with no Tailwind at all, and a
Tailwind v3 config in another. Each was internally coherent. None of them shared
a single value with the others, so "the house easing curve" meant three different
curves depending on which repo you were standing in.

**`--ease-emphasized` was byte-identical to `--ease-standard`.** Both
`cubic-bezier(0.2, 0, 0, 1)`. Every component reaching for emphasis got the
standard curve and no emphasis. This is invisible on inspection: the names
differ, the values are 26 characters apart, and nothing fails.

**`--ease-exit` was `cubic-bezier(0.4, 0, 1, 1)`, an ease-*in* curve.** It
starts slow and accelerates out of view. It is the one curve never to use for
UI: a dismissal on an ease-in reads as the interface dragging the thing away from
you rather than getting out of your way.

**A site was stranded at `opacity: 0`.** A reduced-motion block used
`animation: none`. That removes the animation *and* its `forwards` fill, so a
forwards-filled entrance keyframe never applies its end state and the element
keeps the `opacity: 0` from its own base rule. The content was permanently
invisible, for exactly the users who had asked for less motion. Collapsing the
duration to `0.01ms` runs the animation to completion inside a frame instead:
the end state applies, and nothing moves.

**141 classes painting nothing.** `bg-bg3` (48 uses) and `border-border` (93) in
the portal reference Tailwind theme keys that do not exist under v4. They resolve
to nothing and fall through to whatever the base rule said. Adding the missing
keys would not be a fix. It would suddenly paint 48 surfaces nobody designed.

**Two guesses at one accessible accent.** Two client repos each hand-picked a
"legible variant" of the brand accent and wrote the contrast ratio into a
comment. Both were plausible. Neither was re-checked when the accent moved, and
a comment is not a measurement.

## What follows from that

**Anchors are sacred.** Any hex a consuming repo supplies comes back out of a
ramp as the same string, byte for byte. That is the only reason an existing site
can adopt this without a visual diff. Values that already shipped stay literal;
only the steps nobody had picked get computed. The tests assert string identity,
not colour equality, because re-serialising `#7050f5` through a colour space and
back is exactly the kind of "no visible change" that turns out to be visible.

**Derived values carry their measurement.** `accentFork` does not pick a nice
lighter violet. It walks the ramp from the brand end and returns the first step
that actually clears both 4.5:1 and Lc 60 against every background it will sit
on, with the measured ratios emitted as a CSS comment beside the token. When
nothing clears the bar it says so loudly rather than returning the least-bad in
silence.

**Both contrast models, because they disagree and the disagreement matters.**
The portal's shipped `--violet-400` (`#a78bfa`) scores 7.21:1 against the
marketing canvas, comfortably AA, and Lc −49.1, which is under the house bar
for body text. WCAG 2.x is what an audit asks for; APCA is what tracks
readability on dark backgrounds. The house bar is the pair.

**Search from the brand end, not the legible end.** On a dark background every
step lighter than the accent eventually passes a contrast check, so a naive
search returns near-white. The answer that is useful is the *darkest* step that
passes: maximum brand, minimum sufficient contrast.

**Motion is a decision before it is a curve.** The commonest motion defect is
not a wrong easing, it is animating something that should have been instant.
`shouldAnimate` refuses keyboard-triggered motion outright, refuses anything a
user hits a hundred times a day, and always gives a reason, so a "no" is
arguable rather than mysterious.

**Plain custom properties, nothing else.** The consumers do not agree on a
styling engine and are not going to. Custom properties are the only output all
of them can read without a build step. What this package deliberately does not
decide: the styling engine, the motion library, or where the tokens live.

## The tension the ramp has to resolve

An anchor's real lightness and the ramp's lightness curve contradict each other.
`#7050f5` sits at OKLCh L=0.564; `LIGHTNESS_CURVE[500]` is 0.658. Pin the anchor
at 500, generate 600 from the raw curve at 0.586, and step 600 comes out
*lighter* than step 500, a ramp that reverses direction halfway down.

Both properties are required, so neither can be dropped. The curve is warped
instead: a piecewise-linear map pinned at 0 and 1 that passes through
(curve value, actual value) for the anchor. Monotonic by construction, and every
other step keeps its relative position. The anchors define the ramp; the curve
only sets the spacing between them.

## Well made is not the same as decided

A surface can clear every number in the standard and still read as generated.
The craft rules measure quality; they cannot see that the accent, the face and
the section order are the ones a model picks for every brief it knows nothing
about. That is a different question, so it is a different document:
[CHARACTER.md](./CHARACTER.md).

Two things keep it from becoming a taste police. It only ever changes the look,
never the page grammar, because a page that looks typical for its category is
the one visitors trust first. And it never asks for novelty. It asks for a
reason: every expressive choice records where it came from in the client's own
world, and a choice with no reason is the one flagged.

## Decision confidence

The same restraint applies to trust. A page is judged against what this
visitor needs in order to understand the business, believe it and take the
next step: who they are, what worries them, which evidence would settle it, and
what the sensible next action is. That differs between a plumber with a
stopped boiler, a clinic whose patients want to check a register and a salon
whose clients want to see colour work before they book. So Craft asks for the
reasoning, never for a pattern: no required hero, portrait, slideshow, section
order or phone button, and no finding that a design is "less confident". What
it records is what was observed, what is inferred, and what is unknown and needs
the client or a test, and at which widths each was looked at. The phone is
where this is examined first; a finding made there is not assumed to hold on a
desktop. See [CHARACTER.md](./CHARACTER.md#decision-confidence).

The principle is Eunice Ordor's, from a review of a phone layout on 15 October 2026,
and its question is: what does this visitor need to see, understand and believe
before they are comfortable taking the next appropriate action? It adds to the
standards above and replaces none of them. It also sets how a change is chosen:
a stakeholder's observation, the visitor problem under it, the proposed fix and
the evidence are judged apart, and the smallest change that answers the problem
wins. "The existing design is already appropriate" is a result. See
[Reviewing a proposed change](./CHARACTER.md#reviewing-a-proposed-change).

Her review of Doman Digital's own new site (18 and 19 October 2026, 73 notes)
is kept whole in the reviewer corpus, with the founder's rulings of 20 October,
and it adds eleven principles and two tells. The main ones: an open shop is honest
by being precise, never by confessing what it has not done; a summary page
carries the substance; a case line ends on its result; a hero has one button;
and the first screen on a phone belongs to the business. Every later review of
hers feeds craft the same way. See
[Eunice's review of the DD site](./CHARACTER.md#eunices-review-of-the-dd-site-2026-10-19).
