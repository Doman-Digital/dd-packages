# Design-check roadmap

Where the visual-sameness half of house-style actually stands, phase by
phase. Copy-check needed no roadmap because it grew organically over
months of live incidents; design-check started from a plan instead, so
the plan is worth keeping current rather than letting it go stale the
moment the first phase shipped. Update the status line on each phase as
it moves, don't leave this describing a past state.

Origin: the 2026-09-11 conversation about 21st.dev, Relume, and escaping
the "every AI site looks the same" problem. Full context, including the
course-correction on why this studio doesn't get one fixed font or
colour, lives in `design-rules.md`.

## Phase 0 — Research

**Status: mostly done, one gap remains.**

Two Perplexity passes run, the second specifically asked to re-source
against primary documents rather than commentary. Independently
re-verified afterwards rather than taken on trust — see `design-rules.md`
"Research log" for what upgraded to confirmed (Adam Wathan's indigo-500
tweet, checked myself, genuinely real), what downgraded (the shadcn/Geist
GitHub file citation didn't hold up when checked against the current
repo layout), and what's still an open contradiction (Blaze Type's own
`/license` and `/eula` pages disagree with each other on multi-domain
agency use).

Remaining gap: the "precise/technical" and "premium/editorial" font
buckets are still unsourced. The follow-up prompt for both is sitting in
`design-rules.md` under "Follow-up research needed", ready to paste into
Perplexity, results should get the same independent-verification pass
the first two got, not a straight copy-in.

## Phase 1 — Canonical rules doc

**Status: mostly resolved — most of what was "structural tokens" turned
out to already exist.**

`design-rules.md` exists and is the single source of truth, same doctrine
as `copy-rules.md`. Decided: no fixed house colour or font (an
architecture correction from the first draft, made once the studio's
actual client spread — electrician, beauty studio, barbershop, luxury car
hire, fragrance house — made a single studio identity the wrong model),
icon base is Phosphor, one font bucket (characterful/display) is filled
with three named Velvetyne faces.

2026-09-11, same day: found `@domandigital/craft`, an already-shipped
package in `dd-packages/packages/craft` that generates colour derivation,
type/space scale mechanics, motion, and density, and enforces a
vocabulary restraint budget — most of what this phase was treating as
open decisions. See `design-rules.md`'s "Structural layer:
@domandigital/craft" section. This was not a research gap, it was a
folder I hadn't been pointed at yet.

Still genuinely open: the actual radius and shadow scale values (craft
caps the *count* at ≤4 each via its restraint budget, it doesn't pick
the values) and the two remaining font buckets from Phase 0
(precise/technical, premium/editorial).

## Phase 2 — Enforcement tool

**Status: v1 shipped and tested, not yet run against real repos.**

`design-check.py` implements four BLOCK rules (Tailwind indigo/violet,
the blue-purple gradient tell, the unmodified shadcn card recipe, the
centred-gradient hero) and several WARN rules (gradient-clipped text,
glass-nav combo, font-sans reminder, repeated-recipe density). Verified
with a synthetic test file carrying every tell stacked in, caught all of
them; verified against a file using house-style token names instead of
defaults, came back clean. That is a real test, not a claim, but it is
still one synthetic file, not a corpus. Same caveat copy-check.py needed
before its blocking tier could be trusted: run this against actual client
repos, read every hit, adjust before trusting it to fail a real build.

## Phase 3 — Hook wiring

**Status: done.**

`hooks/pre-commit` runs both copy-check and design-check. The
design-check addition fails loudly (a printed warning, not a silent skip)
if `design-check.py` is missing on a given machine, deliberately fixing
the fail-open pattern that caused the 2026-08-12 copy-check incident,
rather than repeating it in new code. The copy-check block's own
fail-open behaviour was flagged during this work but intentionally left
unpatched, to keep that change scoped to the design-check addition — it's
still open, see `copy-rules.md`'s known issues if this gets picked up
later.

## Phase 4 — Starter primitive kit

**Status: not started. Mostly unblocked now, not fully.**

8 to 12 hand-built components (button, card, nav, hero, footer, input,
badge), built against real spacing/motion/colour values, not
placeholders. Spacing and motion values now exist (craft), colour
derivation now exists (craft), so this no longer needs to wait on
invented numbers for those. Still genuinely blocked on the radius and
shadow scale values and the two remaining font buckets — build the kit
once those land, not before, or it gets rebuilt.

## Phase 5 — Skill wiring

**Status: partial.**

`skill-design/SKILL.md` is written, mirroring the `copy-check` skill.
Two things remain, both outside what this session can reach: add a line
to `~/.claude/CLAUDE.md` pointing at `design-rules.md`, the same way it
already points at `copy-rules.md`; and wire `skill-design` into whichever
mechanism actually loads `copy-check` as a live Claude Code skill on this
machine (a skills directory, a symlink, whatever the real setup is).

## Phase 6 — Baseline sweep

**Status: not started.**

Run `design-check.py --all` across every client repo once Phase 1's
tokens are real, and log the count in `README.md`'s "Baseline when
design-check installed" section the same way copy-check's baseline is
logged: real debt, not noise, with a date. Running it before the tokens
exist would only surface the four already-implemented rules, which is a
legitimate early signal but not the real baseline.

## Phase 7 — Cross-client reuse audit (optional, deliberately last)

**Status: not started, and shouldn't be, until 1 through 6 are running
and paying off.**

Detecting when the same component shape appears in two different client
repos, the visual equivalent of copy-rules.md's "never reuse a sentence
across two clients." This is the genuinely "enterprise-grade" tier of
this system. It's real and useful, and it's also the first thing to cut
if time is short — a two-person studio gets most of the value from
phases 1 to 6 alone. Don't start this out of momentum; start it because
6 is running and this is the next real gap.
