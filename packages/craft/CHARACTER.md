# The character standard

[STANDARD.md](./STANDARD.md) asks whether a surface is well made. This document
asks a second question: **did anyone decide how it looks, or is it the answer a
model gives when nobody told it otherwise?**

A site can pass every craft number and still read as generated. Indigo accent,
Inter, a glass card over the hero, a strip of logos, three icon cards, every
section fading up on scroll. None of those is wrong. Together they say nobody
chose anything.

## Decide the page grammar; never reward strangeness

Section order, the primary action and what leads are decisions with reasons
tied to the visitor's job. A conventional order is allowed and never penalised.
What fails is an order nobody chose. Navigation, legibility and speed remain
the floor in STANDARD.md and the page audit.

Character also comes from the display face, accent, shape, motif and one
signature moment, with evidence from the client's world.

Whether the order gives this visitor what they need to trust the business and
take the next step is the question [Decision confidence](#decision-confidence)
asks. It reads the same hierarchy layer; it is not a second standard.

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

Version 2 of `art-direction.json` records three layers in order:

1. **Job.** What the visitor needs to do, under what pressure, with the
   functional, emotional and social sides shown by reviews, enquiries,
   conversations or search evidence. Quote the customer's words and record
   whether consideration is low, considered or high, with evidence.
2. **Hierarchy.** For each page type, decide the primary action and its
   positions, the section order, what leads and the visitor's journey. Each
   reason must use this client's job. The primary action reason also names the
   consideration level or an objection that explains where the ask sits.
3. **Tokens.** The seven expressive choices (accent, ground, display, body,
   shape, motif, signature), each with evidence from the client's world.

This fictional example is also the executable fixture at
`src/__tests__/fixtures/direction-v2.json`. Its customer quotes are invented
fixture data, not research to reuse for a real client.

```json
{
  "version": 2,
  "client": "Copper Lane Electrical (fictional)",
  "brief": "A local electrician in Brackley repairing dangerous electrical faults for tenants and homeowners.",
  "sources": [
    {
      "id": "review",
      "kind": "review",
      "note": "The socket started sparking tonight. I need the fault fixed today without being overcharged. I want an exact call-out price before I ring. I need to reassure my landlord that the repair is safe."
    },
    {
      "id": "van",
      "kind": "livery",
      "note": "The van carries copper lettering on white panels, with square painted borders.",
      "colours": [
        "#a64720",
        "#ffffff"
      ],
      "lettering": "Square slab lettering and compact supporting text."
    }
  ],
  "job": {
    "statement": {
      "verb": "find",
      "object": "an electrician who can repair a dangerous sparking socket",
      "context": "tonight without being overcharged for the call-out"
    },
    "functional": {
      "value": "The socket started sparking tonight and needs the fault fixed today.",
      "evidence": [
        "review"
      ]
    },
    "emotional": {
      "value": "They worry about being overcharged and want an exact call-out price.",
      "evidence": [
        "review"
      ]
    },
    "social": {
      "value": "They need to reassure their landlord that the repair is safe.",
      "evidence": [
        "review"
      ]
    },
    "consideration": {
      "value": "low",
      "because": "The socket started sparking tonight, leaving minutes to arrange the repair.",
      "evidence": [
        "review"
      ]
    },
    "objections": [
      "being overcharged for the call-out",
      "not knowing whether the repair is safe"
    ],
    "language": [
      "The socket started sparking tonight",
      "I want an exact call-out price before I ring"
    ],
    "evidence": [
      "review"
    ]
  },
  "hierarchy": {
    "home": {
      "primaryAction": {
        "value": "Call for a repair",
        "positions": [
          "hero",
          "footer-cta"
        ],
        "because": "The low consideration job needs a sparking socket repaired tonight, so the call is offered immediately and again after the price."
      },
      "order": [
        {
          "role": "hero",
          "because": "The sparking socket needs repair tonight, so availability comes first."
        },
        {
          "role": "pricing",
          "because": "Callers expect a price before they ring, so pricing comes before asking again."
        },
        {
          "role": "footer-cta",
          "because": "Once the call-out price is clear, they can arrange the socket repair."
        }
      ],
      "lead": {
        "value": "Socket repairs tonight",
        "subordinate": [
          "planned rewires"
        ],
        "because": "The dangerous sparking socket is urgent, so tonight repairs lead ahead of planned rewires."
      },
      "journey": [
        {
          "stage": "reassure",
          "because": "The dangerous socket needs a safe repair, so reassure the tenant first."
        },
        {
          "stage": "act",
          "because": "Once the call-out price is clear, arrange the repair before tonight ends."
        }
      ]
    }
  },
  "choices": {
    "accent": {
      "value": "#a64720",
      "because": "The van carries copper lettering, so the same copper colour marks calls to action.",
      "evidence": [
        "van"
      ]
    },
    "ground": {
      "value": "#ffffff",
      "because": "The van has white panels behind its lettering, so the page ground follows those panels.",
      "evidence": [
        "van"
      ]
    },
    "display": {
      "value": "Roboto Slab",
      "because": "The square slab lettering on the van gives headlines their squared forms.",
      "evidence": [
        "van"
      ]
    },
    "body": {
      "value": "Source Sans 3",
      "because": "The compact supporting text on the van keeps longer details readable at small sizes.",
      "evidence": [
        "van"
      ]
    },
    "shape": {
      "value": "square corners",
      "because": "The painted borders on the van are square, so the buttons keep those corners.",
      "evidence": [
        "van"
      ]
    }
  },
  "exceptions": []
}
```

`craft direction validate` checks each layer and reports its decisions
separately. The job and every declared page hierarchy must be complete, with
at least five of seven tokens decided, before the reason signal can pass in
`craft report`. Version 1 files remain valid with a warning and cannot settle
that signal until their job and hierarchy have been recorded.

A reason needs at least eight words. Token reasons cite a declared source and
mention what it shows; job parts cite customer voice. Hierarchy reasons use
content words from the job. This is a wording check, not a semantic model:
review whether each reason actually explains the decision. Preferences, mood
boards, proposals and category defaults such as "industry standard" or
"a familiar layout" fail. "Callers expect a price before they ring" can pass
when it answers this job's objection about being overcharged.

A `reference` source records its outside category in `category`; a reference
from the client's trade or a competitor's website fails. URL references warn
that their category still needs review. The validator cannot identify a
competitor from an arbitrary URL alone.

Start research with `craft direction research --brief "<who, where, what>"`.
It prints job questions and explicitly forbids descriptions of category
websites or visual inspiration from them. `--visual` adds a separate prompt
for references from outside the category. It does not call a model.

CTA positions are a list: one or repeated asks are both valid. No universal
position, F/Z pattern or fixed hero checklist is imposed. Snapshots measure
vertical section order, not gaze paths; the evidence does not establish a
universal CTA placement rule.

```bash
craft direction init --client "Copper Lane" --brief "<who, where, what>"
craft direction validate --direction art-direction.json
craft estate add --id copper-lane --direction art-direction.json --estate estate.json
craft direction validate --estate estate.json
craft direction validate --snapshot http://localhost:3000 --page home --strict
craft estate compare --estate estate.json --directions
```

`--snapshot` accepts a saved snapshot, staging URL or live URL. It checks the
hierarchy entry selected by `--page` (home by default) against section roles,
and checks token values against the fingerprint. Drift warns; `--strict`
makes drift fail. A snapshot without section roles says order is unmeasured.

Directions can be registered before a site renders. These entries have no
fingerprint and are omitted from rendered comparisons until a snapshot is
added. `--directions` ranks declared pairs and names shared colours, fonts,
shape and order. It is advisory, including under `--strict`, until calibrated;
sharing a conventional order is a prompt to review reasons, not a verdict.
Accent and ground use the rendered comparison's shared thresholds, ΔE_OK
0.06 and 0.03. The calibration notes are in ROADMAP.md.

It also reads the display and body faces against the licence register
(`src/direction/licences.ts`, exported as `licences.json`) and warns on a face
the register does not know, or knows only as capped, per-site or unverified. A
licence warning does not undecide the choice: the reason can be sound and the
face still unlicensed for this client. The register records facts, checked on
the licensor's own page. It is not a shortlist, and nothing proposes from it.

`craft direction init` writes what the site does today with every reason
empty, so the first thing it produces is the list of things nobody decided.
Run on RMP's live home page (2026-09-23) it records Fraunces, Manrope, a cream
ground and pill buttons, three of them on the catalogue, and zero of seven
choices decided.

`craft direction propose` reads the dominant colours off each source's PNG
photo, ranks accent candidates away from the reflex violet band and from the
rest of the estate (`--estate` a folder of snapshots or estate register), and drafts choices.
Every draft reason starts `PROPOSED:`, which validate rejects: a person looks
at the van, agrees the green is the van's green, and says so in their own
words.

The editor schema ships as `@domandigital/craft/art-direction.schema.json`.
A file from phase A that holds only exceptions stays valid.

### Decision confidence

Attributed to Eunice Ordor, Client Relations & Operations at Doman Digital
("Eunice's Lens"). The question it asks of every page:

> What does this visitor need to see, understand and believe before they are
> comfortable taking the next appropriate action?

It sits beside usability, accessibility, visual quality, performance, brand
character and the business's own aims, and replaces none of them. It exists to
improve design judgement, not to make sites alike.

A page should give a visitor what they need to understand the business, trust
it and take the next appropriate step, in an order that follows how they
decide rather than a sequence of stock sections. Craft already records most of
that: the job says who is visiting, what worries them and how long they take;
the hierarchy says what leads, what order, and where the ask sits. Decision
confidence is the reading of those decisions against the visitor, with three
additions to the hierarchy layer and no new layer.

The questions, with where Craft already answers each. They are lenses to look
through, not a checklist or a score, and `evidence` and `identity` below are
the two that cover decision confidence and human accountability:

| | Question | Where it is decided or read |
| --- | --- | --- |
| A | Visitor relevance: does the page meet who this is and what worries them? | `job`, `hierarchy.*.lead`, and the finding that names a worry no decision answers |
| B | Information hierarchy: is related information together, and nothing needed early buried? | `hierarchy.*.order` and `journey` reasons; evidence placed in a section the order lacks |
| C | Evidence and credibility: is what is offered relevant, and does anything show it exists? | `confidence.proof` (kind: work, people, credentials, reviews, experience, outcomes) |
| D | Human identity and accountability, where relevant: can the visitor tell who they would deal with? | `confidence.proof` of kind `people`, in whatever form fits: a name, a register entry, a portrait |
| E | Action clarity: is the next step the one this visitor takes, and does the page offer it? | `hierarchy.*.primaryAction`: call, book, enquire, quote, explore, buy |
| F | Progressive disclosure: essential early, detail when sought, and a signal that the detail exists? | `confidence.proof[].depth`: `first-look` or `on-request` |
| G | Brand personality and contextual fit: does the character come from this business? | The token layer and its evidence, unchanged |
| H | Mobile experience: was it looked at on a phone, and what was not examined? | `confidence.examined` and STANDARD.md section 10 |
| I | Contextual differentiation: does it differ where that helps recognition, clarity, confidence or brand, and only there? | The token layer and `craft estate compare`. Similarity between conventional patterns is not a defect |

`confidence` is optional on each page and records two things the hierarchy did
not: which widths the decisions were looked at (`examined`), and the evidence
the page offers (`proof`). Each item says what it is, which section it sits in,
whether a visitor meets it without looking (`first-look`) or opens it
(`on-request`), and why this visitor needs it. The reason goes through the same
rule as every other reason: eight words, tied to this client's job, and a
default such as "social proof builds trust" fails. Cite a source when one shows
the evidence exists.

```json
"confidence": {
  "examined": ["mobile"],
  "proof": [
    {
      "kind": "work",
      "what": "one photograph of a finished boiler job with the street and date on a card in the shot",
      "position": "hero",
      "depth": "first-look",
      "because": "The visitor wants to see the actual work before letting a stranger into the house, so one finished job is met on the first screen.",
      "evidence": ["jobs"]
    }
  ]
}
```

`craft direction validate` reads it and prints findings after the problems.
Each names the lens, where in the file, what was found, and why it matters to
this visitor, and carries one of three bases:

- **observed**: directly supported by the file or the snapshot. Evidence placed
  in a section the declared order does not have; an ask positioned in a section
  the order lacks.
- **inferred**: a reasonable reading that nobody has checked. Detail held back
  for those who seek it, with nothing of its kind met first, so it may never be
  found. This is a hypothesis, not a rule.
- **unknown**: needs the client or a test. Evidence no source shows exists (a
  planned testimonial, a claimed credential, an outcome nobody has compiled);
  a worry from the job no decision names; a width nobody examined.

Nothing here is a score, a count to push towards zero or a prediction. A
finding says what Craft could and could not establish. A page with no findings
is not "confident", and one with several is not wrong: unknown means ask.

What it deliberately does not do:

- Require any evidence kind. A sole trader, a clinic and a salon rely on
  different evidence, and a page with none recorded validates.
- Require a slideshow, a founder portrait, testimonials above the fold, a
  telephone number, an enquiry form, or any section order. The job decides
  whether the ask is to call, book, enquire, request a quote, explore or
  buy; a clinic whose patients are at work and would rather write is not
  failed for lacking a phone button.
- Treat a conventional page as weaker. Conventional order is allowed with a
  reason, as above.
- Carry a finding between widths. A review of a phone layout is evidence about
  the phone. The desktop and tablet are reported as not examined until
  someone examines them, and the findings are then made there.
- Treat an example claim as a fact. Example copy, a hypothetical years in
  practice or a quote nobody collected is not a source; leave `evidence` empty
  and it is reported as unknown.

Three executable fixtures show one principle giving three answers, in
`src/__tests__/fixtures/confidence/`: a sole-trader plumber (call at once,
the work and the man's name and van on the first screen, no portrait), a
private physiotherapy practice (write rather than ring, registration shown as
text, practitioners by name and specialism with no portraits, an outcomes
summary reported as unknown because nobody has compiled one), and an
appointment-based salon (book beside each stylist's own colour work, a full
gallery on request). They are invented, as the electrician is. None has a
slideshow; two have no phone action; none has a founder portrait; all validate.

#### Where it came from

On 15 October 2026 Eunice reviewed the phone layout of a UK plumbing
business's homepage. She did not review the desktop. Four things came out of
it, and they are kept apart on purpose:

1. **Her observations.** The owner was introduced late. Information about the
   work, services, reviews and the owner felt fragmented. Visitors should be
   able to feel confident without searching. The site could show more
   personality. Trust signals should read as a set.
2. **Her proposed solutions.** A hero slideshow. Removing some project
   captions.
3. **An independent audit's conclusions.** It agreed with the underlying
   concerns, that the owner should be met earlier and credibility shown sooner.
   It did not accept two of the solutions. The site already had a swipeable
   project gallery, so a slideshow would repeat it. The captions were short and
   helped people move through the work. Services were early for a reason: a
   visitor first needs to know the business does their job. Moving the whole
   biography under the hero could make the page worse. It preferred targeted
   changes to a redesign. These were the audit's findings, reported to Craft,
   not measurements Craft took.
4. **This principle.** A stakeholder can be right about the problem and wrong
   about the fix, and the two are judged separately. Nothing from that one
   site is a design law: it is the case Craft's reasoning is tested against.

Craft has no rule for that plumber or any other client. The same reasoning is
tested on a sole trader, a clinic and a salon, and gives a different answer
for each.

### Reviewing a proposed change

`craft direction validate` reads a page's declared decisions. A review is
different: somebody has said something about a page, and Craft has to decide
what follows. `craft direction review --notes design-review.json` weighs the
notes against the visitor's job in `art-direction.json`. For each note it keeps
five things apart:

| | What it is | Held in |
| --- | --- | --- |
| 1 | The observation: what was said or seen, and by whom | `observation`, `raisedBy` |
| 2 | The underlying visitor problem, if there is one | `problem`, `impact` |
| 3 | The proposed solution, from whoever proposed it | `suggested` |
| 4 | The evidence, and what kind it is | `evidence`, `basis` |
| 5 | The smallest defensible improvement | `recommend` |

**How well the problem is known** (`basis`):

- **observed**: something was inspected. A screenshot, rendered behaviour,
  source, a measurement, or what the page says. Evidence that was only
  reported, by an audit, a stakeholder or a customer, can support
  **inferred** at most, however confident it sounds.
- **inferred**: plausible, supported by something reported but not looked at.
- **preference**: taste, or a stakeholder's wish, with no stated cost to the
  visitor. A fact with no visitor impact is also read this way when it is
  inferred, and as polish at most when it is observed.
- **unknown**: cannot be established from what is available. Nothing is
  recommended until it is.

Craft reads the declared basis against the evidence and says when it changed
it, in the note. A claim made at a width nobody looked at stays unknown there:
a review of the phone says nothing about the desktop.

**What the recommendation is worth** (`recommend.class`):

- **confirmed-correction**: fixes an observed defect that costs the visitor
  something. Needs observed evidence and a stated impact.
- **design-hypothesis**: could help, and needs judgement or a check to know.
  Names how it would be checked (`validation`).
- **optional-refinement**: polish. No important visitor problem is addressed.
- **no-change**: the design already does the job. This is a successful result,
  and a review can end on it: "The existing design is already appropriate for
  what was reviewed. No change is recommended." Craft never invents an issue to
  have something to say.

**Minimum effective change.** `recommend.step` is on a ladder, smallest first:
`copy`, `relocate`, `group`, `imagery`, `trust-placement`, `adjust-component`,
`remove-redundancy`, then the structural `restructure` and `new-component`. A
change takes the smallest step that answers the problem. A structural step, or
any addition that costs something (`carousel`, `javascript`, `dependency`,
`animation`, `testimonial`, `cta`, `duplicate-content`), must say which smaller
steps were considered and why none was enough (`smaller`). A small step says why
nothing larger is needed (`whyEnough`).

The rules a review is held to, all checked without a model:

- A suggestion and a recommendation are each held to the same tests, so a
  right observation can come with a suggestion that is not supported. Craft
  then reports it as `supported`, `comparison-needed`, `not-supported` or `not-needed`. The legacy
  `narrower-change-preferred` value remains readable, but a step rank alone no
  longer selects a winner. Compare whether each proposal answers the problem.
- An existing gallery, slideshow or swipeable set prompts a comparison of
  purpose, content and placement. `comparisons` records the exact `existing`
  description, `samePurpose` and `because` on each proposal. A documented
  duplicate should be reused; distinct roles can justify separate components.
  A keyword alone does not establish duplication.
- Removing information needs an observation that it is redundant and a stated
  cost to the visitor. Short useful captions are not redundancy.
- A structural change or an addition needs a problem that is observed, or
  inferred with a stated impact. A preference does not justify it.
- A section the declared order already places with a reason is not moved on a
  preference. Only something observed overrides it.
- Repetition, a long page, a conventional order and a likeness to other sites
  are not defects. They become findings only through a stated cost to this
  visitor.
- A change that depends on a fact or asset nobody has supplied (a register
  number, the owner's own words) is held, and the note says what is
  outstanding. Craft does not write it in, and does not infer a registration,
  a qualification or a regulatory status from its absence or presence.

Impact is a reason like any other: eight words, about this client's job, and
neither a preference ("the client wants it") nor the category's default.

A note in a review:

```json
{
  "id": "owner-late",
  "lens": "identity",
  "observation": "The owner is introduced too far down the page.",
  "raisedBy": "Eunice Ordor (stakeholder), agreed by the independent audit",
  "problem": "A homeowner letting a stranger into the house cannot tell who is coming until well down the page.",
  "basis": "observed",
  "evidence": [
    { "kind": "screenshot", "ref": "captures/home-375.png", "viewport": "mobile" },
    { "kind": "audit", "ref": "independent audit of the phone layout", "viewport": "mobile" }
  ],
  "impact": "A homeowner with a stopped boiler cannot see who is coming into the house, so they may ring someone else or ask before reaching the introduction.",
  "appliesTo": ["mobile"],
  "suggested": { "change": "move the full biography directly below the hero", "step": "restructure" },
  "recommend": {
    "class": "confirmed-correction",
    "change": "show the owner's name and one line about working alone beside the first call button",
    "step": "trust-placement",
    "because": "The visitor's worry is who is coming into the house, so a name and one line answer it where the call is first offered.",
    "whyEnough": "The full biography already serves visitors who want it further down, so only a name and a line need to meet the homeowner early.",
    "requires": [{ "what": "the owner's name and that he works alone and answers the phone", "source": "tom" }]
  }
}
```

The shape is `design-review.schema.json`. The calibration review in
`src/__tests__/fixtures/confidence/calibration-review.json` carries the case
above as a set of notes, against an invented plumber, with the answer Craft
gives to each: the owner met earlier by a name and a line, and not by moving the
biography; credibility earlier as a hypothesis with a check; no second carousel;
the captions left alone; the services left early; no decoration added for
personality; the owner's own words held until he supplies them; the desktop left
unknown. The clinic and salon reviews next to it reach different outcomes for
different reasons: a registration check joined to the profile but held for the
register numbers; a founder biography declined because booking comes first.


#### Context and learning from a later result

The 15 October calibration records the earlier audit's recommendation, not a
permanent verdict. The later Bellerose mobile comparison on 18 October preferred
work photographs followed by a compact owner introduction, then trust and contact.
The useful test is whether each alternative answers the visitor's question.
Considering smaller edits remains required; fewer edits alone do not establish
that the result is better. Keep human approval, observed layout changes and
unmeasured commercial outcomes separate.

For each carousel proposal, `comparisons` contains one entry per relevant existing
component: `{ existing, samePurpose, because }`. Match the existing description
exactly and explain the purpose, content and placement. This validates the
recorded reasoning, not the truth of an aesthetic judgment. Same-purpose
components prompt reuse; missing comparisons request an assessment without
claiming duplication. Review and photo carousels may answer different questions.

Reviews default to publication context. Explicit `context: "protected-staging"`
can proceed when an unsupplied requirement declares `kind: "asset"`, `phase: "publication"` and a
clearly marked `placeholder` description. Other requirements still hold the
change. Every missing item remains in `outstanding`, and `publicationReady`
remains false. This does not authorize publishing a placeholder or inventing a
fact. Record actual asset delivery before assessing publication again.

Save real before/after examples with capture dates, viewport, source commits,
feedback attribution, decisions and validation. Assess the page independently
before reading stakeholder recommendations when possible; if feedback is already
known, record that limitation. A preferred example is useful calibration, not a
universal order, a conversion claim or an exemption from future scrutiny.

#### Select photographs for their position in the sequence

Review every proposed opening photograph at the intended size and crop, in order.
Service coverage alone does not make a photograph suitable for the opening.
Compare clarity, framing, visible completion, distracting surroundings and the
visual standard set by the lead image. A technically sound carousel can still
weaken the page when its later slides are noticeably poorer.

On 18 October 2026, after approving Bellerose's mobile flow, Dmitri pointed out
that the radiator and kitchen-tap slides did not compare with the first bathroom
photograph. The initial selection had favoured showing different services. A
review of the available photographs found that the radiator's unfinished edge
and dust sheet, and the tap's busy surroundings, weakened the opening sequence.
The approved revision kept the bath-and-shower photograph and used the twin-basins
photograph second. The lower captioned project gallery retained its service
coverage. The two bathroom views are not evidence of two separate jobs.

The reusable lesson is to choose the strongest coherent sequence the available
assets support, then let that determine the count. Two strong images can serve
an opening better than three padded for variety; this is not a rule to always
use two images, bathrooms or a carousel. Useful job-record photographs can still
belong beside a service or further down the page. Do not fabricate or retouch
work into completion to fill a slot. Record rejected candidates, the intended
crop, the reason for the choice and the stakeholder response with the rendered
comparison. Here the evidence is visual judgement and an approved preference;
customer behaviour and enquiry effects remain unmeasured.

#### Using it

Generating a page: run `craft direction research`, which asks where the
visitor looks, what would settle it for them and what the next step is, without
assuming a phone, a portrait or any one of them. Write the hierarchy from those
answers, add `confidence` where the page makes decisions about evidence, and run
`craft direction validate`. The findings are the list of what to confirm with
the client or look at before launch.

Reviewing a page or acting on feedback: write each remark as a note (what was
said, what the visitor loses, what was proposed, what was inspected), then run
`craft direction review --notes design-review.json`. Do the changes that come
back as `change`, ask for what is `hold`, find out what is `gather-evidence`,
and leave what is `no-change`. When a note names something that was not
inspected, look before you act on it.

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
craft snapshot https://example.co.uk --scheme dark --out home-dark.json   # a site's dark mode
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
display and body faces, button roundness, reveal density, the effects, the
running order, the rhythm of light and dark bands, and the hero's
composition. `fingerprintDistance` compares two of them, 0 to 1, as a
weighted mean of nine parts. Signals 2 and 3 are both this distance, measured
against different sets.

| Part | Weight | What it measures |
|---|---|---|
| accent | 0.20 | ΔE_OK between the accents over 0.3; 1 when only one site has one |
| type | 0.20 | display face (0.6) and body face (0.4): 0 same family, 0.5 same class, 1 |
| ground | 0.10 | ΔE_OK over 0.15, plus 0.6 of the temperature gap (below) |
| shape | 0.10 | button roundness, 0 square to 0.5 pill |
| motion | 0.05 | share of below-the-fold sections that reveal on scroll |
| effects | 0.10 | 1 minus the Jaccard overlap of the second-look effects |
| layout | 0.10 | edit distance over section roles and geometry (kinds before snapshot v2) |
| rhythm | 0.10 | edit distance over the bands of light, mid and dark, opening counted twice |
| hero | 0.05 | text centred or left, its width, headline class and size, picture side |

Accent and type carry the most because that is where a model's defaults show
first and where a real business has something of its own. Structure (layout,
rhythm and hero) carries a quarter between its three parts, because two sites
that open the same way read as the same site before any colour is compared;
before 0.19 structure was `layout` alone at a tenth and barely moved a score.
A part only one side measures (rhythm and hero on a version 1 fingerprint,
the picture side on a snapshot without image positions) is left out and the
rest are weighed over what remains, so older registers and null models
compare without being re-snapshotted.

**Ground temperature.** ΔE alone files every light neutral page as one
paper: RMP's cream (`oklch(0.96 0.010 82)`) and Bellerose's porcelain
(`#F1F3F4`, `oklch(0.96 0.003 229)`) are ΔE 0.013 apart, a tenth of the
ground scale, and nobody takes them for the same page. A page ground is the
largest area on the page and the eye adapts to it, so a tint far below what
separates two buttons still reads as warm or cool paper. `groundTemperature`
is the chroma over 0.006 (where a tint is unmistakable: cream sits at 0.010,
stone at 0.007), signed by hue: red through yellow is warm, teal through
violet is cool, the greens and magentas between are neither. Warm against
cool adds 0.6 to the ground part, warm against a neutral white 0.3, two warm
papers nothing. Shared grounds are named with it: "cream ground", "cool grey
ground", "warm dark ground", or "warm ground" when one is cream and the other
a warm grey.

**Rhythm** is the page's sequence of light (L 0.75 and over), mid and dark
(under 0.4) bands, each run of same-lightness sections merged: a cream hero,
a white logo strip and a near-black band are light then dark, which is what
a visitor sees. The first three bands are scored once on their own and once
as part of the whole, so the opening counts double. **Hero** compares the
hero section's centring and width, the h1's class and size (an octave, 48px
against 96px, is the whole size distance) and which side of the centre line
its largest picture sits, when the snapshot records image positions (craft
0.19 and later). Shared, they are named "light hero then dark band" and
"left-aligned serif hero, photo right".

Known limit: a computed font family is the family the stylesheet asked for.
A face that failed to load is still reported under its name.

### Stock components (snapshot v2)

A version 2 snapshot names what each section is for (`role`: a CTA band,
pricing, testimonials, an FAQ, a process, features, a team, a contact form)
and how it is laid out (`geometry`: centring, width, balance, its own ground,
its buttons), with the parts that make a component a stock one: badge texts,
round portraits, a carousel, a row of big figures. Six tells read them, and
only them, so a version 1 snapshot never trips one:

- `cta-band-stock`: a centred band on its own colour with one or two buttons.
- `pricing-trio-popular`: three price cards, one badged "Most popular".
- `testimonial-avatar-carousel`: round headshots in a sliding carousel.
- `faq-accordion-closer`: the page ends on a question-and-answer list.
- `stats-row`: three to six big figures in a row (not straight after the
  hero, which is `hero-then-proof`'s finding).
- `centred-everything`: 80% or more of the sections centre their text.

Each fix keeps the component's job (the ask, the prices, the proof, the
answers) and changes how it looks. None removes a section, because the
page's order is the client's, not ours.

These six have rendered paths only (surface `rendered`): no source file shows
a pricing trio reliably. They ship as warnings like every tell, and have not
yet been read against the estate. Snapshot the estate with this build before
any is considered for `block`.

### Imagery and provenance

A snapshot records every picture on the page (`images`): each `img` and
each CSS background large enough to be one, with its source (unwrapped from
an image optimiser such as `/_next/image?url=`), size, position, section and
a role: photo, illustration, icon, avatar or logo. `craft audit` also reads
the first 256 KB of up to 24 of the larger pictures and looks for the IPTC
digital source type that says a trained model made them
(`trainedAlgorithmicMedia` or `compositeWithTrainedAlgorithmicMedia`), in an
XMP packet or a C2PA manifest (Content Credentials). Four tells read them:

- `stock-photo`: a picture from a stock library or placeholder service, by
  its host (Unsplash, Pexels, iStock, Adobe Stock and others) or, when it was
  downloaded and self-hosted, by the library's own file name
  (`shutterstock_1234567890.jpg`, `…-unsplash.jpg`).
- `stock-avatar`: round portraits from a placeholder-face service
  (randomuser.me, Pravatar, DiceBear, generated-face sites) or a stock library.
- `ai-image`: a picture whose own metadata says a model made it.
- `no-real-imagery`: a page of four or more sections with no photograph at
  all, only icons and illustrations.

Provenance only ever counts for. Most pictures carry no metadata, anything
that re-encodes them (a CMS, an image optimiser) strips it, and a PNG can
keep it after the pixels, beyond the bytes read. A picture with no marker is
unknown, not real. `snapshotUrl(url, { provenance: false })` skips the reads.

Snapshots taken before craft recorded images have no `images`, and none of
these tells judges them. There is no `blob-illustration` tell: telling an
abstract blob from a diagram needs an SVG's path data or its pixels, which a
cross-origin picture does not give the page, and no flag case has been proved
reliable. It stays on the list until one is.

### Specificity

A page built from no brief could belong to anyone, because the model had
nothing particular to say. Specificity counts what only this business could
have written: names, places, numbers, prices, dates, contact details, and
the nouns of the trade (`TRADE_NOUNS`, a seed list). Two rules keep the
count honest. A Title Case or shouted line's capitals are not read as names
("Quality You Can Trust" is not a proper noun), and the figures every site
uses ("24/7", "100%", "5-star", "No. 1") are masked before counting. A text
is generic when it has no specific other than trade nouns and fewer than two
of those: one trade noun ("quality plumbing you can trust") is what every
competitor also says.

A snapshot now records the page's text: each section's headings,
paragraphs, list items and quotes (`text`), and what a visitor reads before
scrolling (`firstScreenText`), leaving out navigation, a header without the
headline, footers and the words on buttons and links. Two tells read it:

- `generic-hero-claim`: the home page's first screen names nothing
  particular. Also a copy tell, on a literal `<h1>` and the paragraph under
  it in the home page's source (a root route file such as `app/page.tsx`, a
  top-level `index.html`, or a hero or home component). Every other page's
  headline is a label ("Privacy policy", "Boiler repairs"), not a claim, and
  is not judged.
- `unproven-claim`: a claim of standing ("trusted", "fully qualified",
  "award-winning", "5-star service") with no review, rating, quoted
  testimonial, registration number or accreditation (by name, or as a logo
  whose alt text or file name names it) in its section or the one either
  side.

A brief sharpens the count: its own terms (the business's name, its town,
its trade) are recognised wherever they appear, even opening a sentence or
in a shouted heading. The tells run without one. `craft copy compare <ours>
--competitor <theirs>` uses one, from `--brief`, `art-direction.json` or a
null model's `null.json`, and lists the hero and service sentences on each
page that hold no specific the other page lacks: a town both name, or a
trade noun both use, is shared; the business's name, its prices and its
jobs are its own. It is a measure for a person to read and always exits 0.

The limits, stated so nobody reads more into a pass than is there: a place
in a Title Case heading ("Boiler Repairs In Brackley") is not recognised
without a brief, a headline whose words come from data (`{site.headline}`)
is not read in source, and "specific" means particular, not true. `craft
copy claims` is where a figure gets checked. Snapshots taken before craft
recorded text have none, and neither tell judges them.

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
("Fraunces headline", "no accent", "pill buttons", "cream ground", "light hero
then dark band", "left-aligned serif hero, photo right"), which is where to
start pulling them apart. A sibling is a warning; `--strict` exits 1 on one,
for a pipeline that has decided to hold the line.

A site with a light and a dark mode is two pages to a visitor. `craft
snapshot <url> --scheme light|dark` asks the browser for one scheme
(`prefers-color-scheme`); a site that stores a choice in `localStorage` or on
`<html data-theme>` needs that set instead. Compare each.

`craft direction propose --estate estate.json` reads the register too, so a
proposed accent steers away from one a sibling already uses.

Sites that share one component are rarer than siblings and easier to fix:

```bash
craft estate compare --component cta-band    # every pair's closest CTA bands
craft estate compare --component pricing --json
craft estate compare rmp --component cta-band   # one site against the rest
```

Each pair lists what its two components share ("centred", "1 button", "same
coloured band"), closest first. There is no sibling line for components yet:
it needs a calibration set of real components (see the CTA collection in
`calibration/idiom/cta/` once it exists), so this ranks and names, and judges
nothing. Only sites added with snapshot v2 have components to compare, and
the command says so when fewer than two have the role. `--component` takes
one of `cta-band`, `footer-cta`, `pricing`, `testimonials`, `faq`, `process`,
`features`, `team`, `contact` or `stats`.

With `--null`, `craft audit` also places each of the page's components
against the same role in the null model, the way it places the whole page
(`components` in the JSON). A role needs at least five null pages that have
it. Null models built before snapshot v2 have no components, and the report
says so rather than printing nothing.

## The character report

`craft report` reads one site against everything above and gives a verdict:

```bash
craft report https://www.rmp-electrical.co.uk --repo . --null null/rmp --estate ../estate.json
craft retrofit https://www.rmp-electrical.co.uk --repo . --null null/rmp --estate ../estate.json --out RETROFIT.md
```

| Verdict | When |
|---|---|
| default | Two or more signals raised: three or more design tells, typical of the brief's null, a sibling in the estate, or fewer than five choices decided with a reason. |
| mixed | One raised. |
| decided | None raised, and all four measured. |
| unproven | None raised, but something was not measured. Unverified is never a pass. |

The actions come in the order a retrofit works: decide first, then type,
colour, shape, effects, motion, how sections look, and copy. Where a tell, the
null model and a sibling all point at one choice, they are one action with
three reasons. Sharing a white page or a still one with the null is never
an action: that would reward strangeness.

`craft retrofit` writes the same as a checklist. Each change names the
art-direction choice that settles it, and shows the decided value and its
reason, or says it waits on that decision. It ends with what to leave alone:
navigation, the order of sections, where the call to action sits.

## The house copy rules live here

The house copy standard is [COPY.md](./COPY.md), in this package. Its
blocking tier is carried by ten tells here: `ai-phrase`, `plainer-word`,
`plain-english`, `buzzword`, `negative-reassurance`, `em-dash`, `emoji`,
`not-just-but`, `no-x-no-y` and `no-x-badge`. craft ships every tell as
`warn`; the house policy in `src/character/house.ts` says which fail a commit,
and `craft copy --gate` applies it. `copy-check` in claude-kit is a thin
wrapper that reads the same policy from `craft tells list --json`, so the
lists and the policy exist once, here, with a test per entry. Since catalogue
`2026.09.4` the density tier and four research tells are here too, and since
`2026.09.5` four more, including `chatbot-residue` and `placeholder`. All review.

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
  block hits and low typicality. **First run 2026-09-23: zero block hits, none
  typical**, below.
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

### Human set, 2026-09-23

The references in claude-kit's `reference-set.md`, live home pages, scored as
the AI set is: typicality against all seven null models pooled, and the
design tells on the rendered page. The tenth reference is "any
generated-looking site" and is left out by definition. Snapshots and
`score.mjs` in `calibration/human/`.

| Site | Score | Tells on the page | Flagged |
|---|---|---|---|
| Linear | 0.00 | 7: violet, grid, icon grid, marquee, glow, Inter, hairline shadow | tell-heavy |
| Stripe | 0.00 | 5: violet, blue-to-purple, glass, icon grid, glow | tell-heavy |
| DD | 0.00 | 4: icon grid, pills, glow, Fraunces | tell-heavy |
| animations.dev | 0.00 | 2: marquee, Inter | no |
| Utopia | 0.00 | 2: hero then proof, pills | no |
| APCA (Myndex) | 0.00 | 0 | no |
| rauno.me | 0.01 | 0 | no |
| StarrLuxury | 0.01 | not measured: a preview gate, not the site | |
| candy-aesthetics | 0.05 | not measured: "This preview has ended" | |

- **Zero block hits and none typical**: both targets met. Every score is 0.05
  or under.
- **Three of the seven measured are tell-heavy.** Linear and Stripe are where
  the first-wave look came from: the indigo, the glow, the gradient were
  theirs before they were every model's. The tell list describes them too,
  which is the reason no single signal decides the verdict.
- **The comparison is not like for like.** The null models are small-business
  briefs; these are software and portfolio sites, so a low score is easier to
  reach. A human set of small-business sites nobody generated is the better
  test and is still to find.
- Both house demos had expired or gated previews on the day. They are not
  measured, not clean.

### Calibration tooling, 2026-09-24

`craft calibrate calibration/labels.json` now does what the `score.mjs`
scripts did by hand. `labels.json` lists the set:

- the 20 AI-set pages;
- the seven measured human references, with the two gated previews listed as
  skipped;
- wiredge.studio as the first `ai-looking` page: made by people, and it reads
  as generated.

`calibrate` reports precision and recall per tell and checks targets 1 to 3.
Its rules:

- A hit on an `ai` or `ai-looking` page counts for a tell, and a hit on a
  `human` page counts against it, because a tell detects a look, not a maker.
- Flagged keeps the rule fixed on 2026-09-23: typical against the pooled null,
  or three or more distinct design tells.
- A page it cannot measure is listed by name and counted neither way.

`craft null import` builds a null model from another builder's pages, so the
AI set and the null can include more than Claude. Give each builder the prompt
`craft null prompt` prints, so its pages answer the same brief.

Target 5, the blind test, is a protocol for people, not a command: see
`docs/blind-test.md`.

**First run, 2026-09-29** (`craft calibrate calibration/labels.json --fresh`, Playwright driving a headless Chrome through `CRAFT_CHROMIUM`, every page re-snapshotted on the current snapshot version; results in `calibration/results/2026-09-29/`). Against 140 null pages from 7 briefs:

| Target | Result |
| --- | --- |
| 1. Generated pages get caught | met: 20 of 20 flagged |
| 2. Good human sites don't get caught | met on its definition: 0 block hits, 0 of 6 typical. 3 pages not measured: two preview gates and myndex.com, unreachable from this machine |
| 3. AI-looking sites get caught | met: 1 of 1 (wiredge.studio), one page, so weak evidence |

Read the second row with care. The flagged rule (typical against the null, or three or more distinct design tells) flagged 5 of the 6 measured human sites as tell-heavy, though none is typical and none has a blocking tell. Target 2 as written does not count that. If the rule is meant to say "this looks AI-made", 5 of 6 is a false-positive problem to fix before anything gates on it. It would want a decision on the target, not a quiet threshold change. The set is also small (20 AI, 6 human, 1 AI-looking), all AI pages are Claude's, and 46 of 68 tells never fired on it. Target 4 (the estate) and target 5 (the blind test) are not measured by this command.

**Wider human set, 2026-09-29** (`calibration/results/2026-09-29-wider/`). The human set grew from 6 to 36 measured sites: 20 professionally built well-known sites and 12 live UK small-business sites from the Wayback seed list, plus the original six. The AI and AI-looking sets are unchanged (20 and 1).

| Target | Result |
| --- | --- |
| 1. Generated pages get caught | met: 20 of 20 |
| 2. Good human sites don't get caught | met on its definition: 0 block hits, 0 of 36 typical. 5 not measured (two preview gates, myndex.com unreachable, screwfix.com 403, mubi.com 503) |
| 3. AI-looking sites get caught | met: 1 of 1, still one page |

The caveat from the first run holds and is now firmer. The flagged rule marked **14 of 36 human sites (39%)** as tell-heavy. It needs either a tighter rule or to stop being read as "looks AI-made". No threshold was changed; that is a decision on the target. Per-tell precision on this set also separates the tells that earn their keep from the ones that do not: `icon-tile-grid` 0.17, `generic-hero-claim` 0.14, `marquee` 0.14, `grid-background` 0.20 and `unproven-claim` 0.36 fire more on human sites than on the AI set, while `cream-palette`, `reflex-font-2`, `italic-serif-display` and `pricing-trio-popular` are at 0.93 or better. 42 of 68 tells never fired. The human sites are not a random sample: they are chosen, well-made and mostly large-brand, and the AI pages are all Claude's. `generic-hero-claim` is 0 of 20 on the AI set because the briefs name a business and a place, so the pages open with a specific line ("Exeter's sole traders", "Chandos Road, Redland"), and the tell is right not to fire on them. It is not a home-page bug: after dd-packages #76 made labelled and null pages count as home pages, the same snapshots re-scored on 2026-09-30 give 0 of 20 on the AI set and 7 of 36 on the human set (one more human hit than the 6 above), and the flagged counts are unchanged (20 of 20 AI, 14 of 36 human). Still to do: an AI set from other builders (`craft null import`), and a decision on the flagged rule.

### Character report first read, 2026-09-23

`craft report` on each live snapshot with its repo, its own brief's null and
the register. Reports and retrofit plans are in `calibration/report/`.

| Site | Verdict | Raised | Actions |
|---|---|---|---|
| DD | default | tells (12), typical (0.15), sibling of HJ Beauty | 26 |
| HJ Beauty | default | tells (6), sibling of DD | 18 |
| MMM | mixed | tells (18) | 27 |
| Sensphere | mixed | tells (9) | 18 |
| Chair and Blade | mixed | tells (7) | 11 |
| RMP | mixed | tells (8) | 18 |
| Harrison James | mixed | typical (0.10) | 9 |

No site has an `art-direction.json`, so the reasons are not measured on any of
them and none can be *decided* yet. The first change after deciding is the
same on all seven: the display face. It is the estate's common default, and
the one choice the retrofits (phase G) should settle first. Not yet read by a
person.

### Recalibration on snapshot v2, 2026-09-30

The estate and the seven null models were still on snapshot v1 (the AI set and the human set were re-snapshotted on 2026-09-29). This run moves them to v2 and changes nothing else: the same 140 null pages (each `calibration/null/<name>/pages/`, copied into `<name>-v2/`, so no model was called and the model is not a confound; the original build recorded its model as `default`) were re-snapshotted with `craft null build`, and the seven live home pages were re-snapshotted on 2026-09-30 into `calibration/estate/2026-09-30-v2/` and a new register, `estate/estate-v2.json`. The v1 folders and the 2026-09-23 snapshots are untouched. The `-v2` folders hold `null.json` and `snapshots/` only: their `pages/` are byte-for-byte the v1 pages, so to rebuild copy `<name>/pages/` across and rerun the same `craft null build`. Scoring is `calibration/null/score-v2.mjs` (the same method as `score.mjs`; the AI set is read from the v2 snapshots in `calibration/results/2026-09-29-wider/`). Outputs: `null/results-v2.json`, `null/score-v2.txt`, `null/harvest-v2.txt`, `estate/compare-2026-09-30-v2.txt`. The live sites may have changed since 2026-09-23, so the estate rows also move for that reason.

| Measure | Before (v1) | After (v2) |
|---|---|---|
| Estate typicality against its own brief's null (own): dd, mmm, sensphere, harrison-james, hj-beauty, chair-and-blade, rmp | 0.15, 0.05, 0.00, 0.10, 0.05, 0.05, 0.05 | 0.10, 0.05, 0.00, 0.10, 0.05, 0.05, 0.05 |
| Estate typicality against all seven pooled (same order) | 0.01, 0.00, 0.00, 0.09, 0.00, 0.01, 0.26 | 0.01, 0.00, 0.00, 0.10, 0.00, 0.01, 0.21 |
| Distance to own null (same order) | 0.340, 0.450, 0.503, 0.277, 0.442, 0.361, 0.518 | 0.443, 0.420, 0.530, 0.304, 0.479, 0.381, 0.558 |
| Sibling pairs in the estate (below 0.31) | 1 (dd + hjbeauty, 0.28) | 0 (dd + hjbeauty is now 0.58; closest pair is dd + rmp, 0.48) |
| Null pages flagged when scored against the other six briefs (dd, mmm, sensphere, harrison-james, hj-beauty, chair-and-blade, rmp) | 20, 20, 19, 20, 19, 18, 15 of 20 | 20, 20, 20, 20, 20, 18, 18 of 20 |
| Null pages typical against the other six (same order) | 13, 10, 10, 12, 10, 4, 2 | 14, 8, 9, 13, 6, 7, 3 |
| AI set flagged against the pooled v2 null | 19 of 20 | 20 of 20 (typical 15, tell-heavy 20) |

What moved: the estate is still atypical of what the model builds for its own brief (own typicality 0.10 or lower on all seven), and only RMP Electrical is close to the pooled null (0.21, down from 0.26; its shared traits are a hero eyebrow chip and pill buttons). The one sibling pair, Doman Digital and Harrisons Beauty, is no longer one; the pair that stays closest is Doman Digital and RMP Electrical (0.48). The AI set gained one flagged page (the 20 of 20 the flagged-rule decision records). Because the live sites were not frozen, the estate movement mixes the snapshot version with site changes, and this run cannot separate them.

`craft tells harvest` on the v2 models gives the same three candidates as before (red accent #e77a63, 66 of 140; square shape, 47 of 140; the opening `hero > hero > cards`, 54 of 140) and 40 recurring phrases (the same count as before; the list was not diffed line by line). The only difference is in the already-caught list, which now includes `no-real-imagery` (117 of 140), `hero-eyebrow-chip` (53), `stats-row` (42) and `unproven-claim` (35): tells that came in with snapshot v2 and later phases, which the v1 harvest could not see. Nothing was added to the catalogue, and no tell or threshold changed.

### Direction boards, 2026-10-09: fit before distance

The first visual-direction boards for Doman Digital's own site were built in the hour after `craft null build` finished, with the harvest in front of the session. Every one of the seven choices on all three boards was argued from what the null set did (17 of 20 Fraunces, 20 of 20 cream, 20 of 20 terracotta) and what the estate already had. The reasons were real and each cited a source, and the boards were still wrong in the way that matters: placeholder boxes where the client's interface should have been, a ledger explained in a block beside the proof instead of on it, a legend whose line types only read after their labels, and three headlines where one constant line was needed. A reviewer reading this document caught it in one pass: craft asks for fit with a reason and says never to reward strangeness, and the boards had optimised for distance.

What the tool did and did not do. `null build`, `tells harvest` and the estate register gave the session a precise picture of the default and nothing that said "show the work". `direction validate` would have passed a file whose seven choices cite only `reference`, `estate` and the null, and whose sources hold no `product` or `photo` at all. Those are the two gaps, tracked as a warning pair in Linear (DOM, 9 October).

Rules for a direction board, recorded so the next one starts here:

- **The null is a floor, never the argument.** A choice clears the null set and the estate; its reason comes from the client's world. A reason of the form "the null never picks this" is not a reason.
- **One line of copy, one image, every board.** The headline, subline, routes and the work shown are identical across directions, so the look is the only variable. The headline is checked against every null page before it goes on a board.
- **The work is on the board, large, and real.** A placeholder where the interface should be is a board about a site that does not exist. Use the client's own published interface with its period, and put the responsibility labels on the work: this is run, this is built and connected, this is yours. The ledger explained beside the proof is the weaker form of the ledger shown on it.
- **A legend is learned where it points.** Line types, colours and marks carry meaning only at the moment they point at something; a key read first is a key forgotten.
- **A generated concept image is a composition study.** It can show a layout worth adopting. It is never evidence, never ships, and its headline is checked like any other: the one produced in this review had the null set's own shape.

The board in question is the DD redesign's Stage 05 artefact (DOM-397, CRO-21); v1.1 applied all five.

### Ground temperature and structure, 2026-10-09

Bellerose Plumbing's light mode looked, to the founder, too much like RMP Electrical, and craft gave the pair 0.59 sharing only "grey ground". Bellerose then moved its light page from warm stone (`#EEEDE8`) to cool porcelain (`#F1F3F4`, bellerose-plumbing#32), and craft scored the two Bellerose pages 0.01 apart. Two things were missing: hue barely counts at a ground's chroma, and structure moved the score by a tenth at most. Fingerprint version 3 (DOM-637) adds ground temperature to the ground part, a rhythm part and a hero part, with the weights in *The rendered page* above. Measured on RMP live (2026-10-09) and Bellerose built locally at `c62590c` (stone, before #32) and `47f9d79` (porcelain), each snapshotted with `--scheme light` and `--scheme dark`; snapshots, a copy of the redesign workstream's register and the full tables are in `calibration/estate/2026-10-09-temperature/`. "Before" is craft 0.18.1's distance on the same snapshots.

| Pair | Before | After | Shares after |
|---|---|---|---|
| RMP + Bellerose light on stone | 0.59 (cream ground) | **0.54** | warm ground, left-aligned serif hero, photo right, light hero then dark band |
| RMP + Bellerose light on porcelain | 0.59 (cream ground) | 0.58 | left-aligned serif hero, photo right, light hero then dark band |
| RMP + Bellerose dark (either) | 0.77 | 0.72 | left-aligned serif hero, photo right |
| Bellerose stone light + porcelain light | 0.01 | 0.06 | everything but the ground |
| RMP + RMP | 0.00 | 0.00 | |

Against the register as it stands (stored version 2 fingerprints, not re-added), the stone page's nearest site is RMP (0.54) and the porcelain page's is Harrison James (0.52) with RMP second (0.58): the move away from RMP that the founder made by eye now shows in the numbers, and both Bellerose light pages still share the opening with RMP, which is the next thing to pull apart. Neither pair is a sibling; the faces, the accent and the button shape are their own.

The seven register pairs reshuffle little: Kendall tau 0.83 between the before and after orderings over 21 pairs, the closest pair is still DD + RMP (0.48 to 0.52, now "warm ground" rather than "grey ground"), and no pair crosses the sibling line. Pairs that shared "white ground" and little else move apart by 0.02 to 0.06 as the temperature counts (MMM + Sensphere keep "cool white ground"); Chair and Blade + HJ Beauty move closer (0.74 to 0.66) because both open dark then light. The sibling line measured again on the seven v2 null models is 0.337 with the old distance and 0.339 with the new, so the weights do not move it; `SIBLING_AT` stays at the 0.31 measured on the v1 models in September, and moving it to the v2 line is a separate decision.

## The catalogue

Generated from the package. Run `pnpm --filter @domandigital/craft run docs`
after changing an entry; a test fails until you do.

<!-- craft:catalogue:start -->
Catalogue version `2026.10.2`, 70 tells.

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
| `shadcn-card-stock` | 1 | source | warn | Stock shadcn Card | The registry Card (bg-card, a plain border, rounded-lg or rounded-xl, shadow-sm) is the container every generated page is built from. Left as shipped, every card on the site looks like every other shadcn site's. |
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
| `review-phrase` | 1 | copy | warn | Review-tier phrase | Truly, genuinely, clear, ultimately, 'the single most', 'bar none': normal English once, and a tell when they stack. The house rules keep them for review, never blocking. |
| `sales-tagline` | 1 | copy | warn | Sales tagline | 'So your budget goes where it counts', 'Real results', 'pages that convert': advert lines that sound like a pitch and say nothing a reader can check. |
| `outcome-promise` | 1 | copy | warn | Outcome promise | 'We'll turn that into enquiries', 'once the first areas are working', 'competitors you can outdo': a hoped-for result written as if it were delivered. Rankings and enquiries depend on things nobody controls. |
| `hollow-imperative` | 1 | copy | warn | Hollow imperative | 'Discover', 'Experience', 'Transform your' as the opening verb of a heading or button is a call to action with nothing in it. |
| `rhetorical-opener` | 1 | copy | warn | Rhetorical question opener | 'Looking for...?', 'Tired of...?', 'Ready to...?' opens with the model guessing at the reader instead of telling them something. |
| `em-dash` | 2 | copy | warn | Em dash | Generated copy leans on the em dash to join clauses. House copy does not use it. |
| `emoji` | 1 | copy | warn | Emoji in copy | A sparkle or a rocket beside a heading is decoration a model adds to seem friendly. It dates the page and reads as a social post. |
| `not-just-but` | 2 | copy | warn | Contrastive negation | 'It's not just a haircut, it's an experience', 'dispatched from here, not shipped in': the contrast-and-reveal template is the most recognisable construction in generated copy. |
| `no-x-no-y` | 2 | copy | warn | 'No X, no Y' list | 'No obligation, no spam.' Defining the business by what it is not, itemised, is the same template as contrastive negation. |
| `no-x-badge` | 2 | copy | warn | 'No X' badge | 'No catch.', 'NO JARGON GUIDE': a short standalone 'No X' reads as a slapped-on kicker, and worse when the same one is reused across pieces. |
| `staccato-triplet` | 2 | copy | warn | Staccato triplet | Three fragments in a row ('Fast. Friendly. Local.' or 'No fuss. No jargon. Just results.') is the second wave's favourite rhythm. |
| `where-x-meets-y` | 2 | copy | warn | 'Where X meets Y' | 'Where luxury meets comfort' is a tagline shape that fits every business and so describes none. |
| `chatbot-residue` | 1 | copy | warn | Chatbot residue | 'Certainly! Here's a revised version', 'as an AI language model', a citeturn0search0 token, a link tracked utm_source=chatgpt.com: text that exists only because a chat reply was pasted whole. This is evidence, not style. |
| `prompt-context` | 1 | copy | warn | Prompt context | 'This article uses the attached Perplexity research file as the primary source', 'the attached research is right to say': the model talking about what it was given. A reader of a web page has no attachment. Found 38 times across five live DD articles in 2026-09, none caught by any other tell. |
| `placeholder` | 1 | copy | warn | Unfilled placeholder | '[Insert testimonial]', '[Your Name]', lorem ipsum, TODO_PLACEHOLDER: scaffolding a reader must never see, and the clearest sign a page shipped before anyone read it. |
| `question-reveal` | 2 | copy | warn | Staged reveal | 'The result? Faster growth.', 'What does this mean for you? It means...': the writer asks the reader's question for them and answers it. An infomercial hook, and a favourite of generated copy. |
| `inline-label-list` | 2 | copy | warn | Bold-label bullets | '**Speed:** Faster pages' three times in a row: a short label restated in a few words, the list shape generated copy defaults to. A definition list, with a real explanation after each label, is not this. |
| `ing-tail` | 2 | copy | warn | Empty -ing tail | '..., ensuring peace of mind', '..., highlighting our commitment': a participle tacked on the end that claims significance and names no mechanism. One of the most common shapes in the Wikipedia guide to AI writing. |
| `vague-attribution` | 1 | copy | warn | Unnamed source | 'Studies show', 'experts agree', 'it is widely known': a claim credited to nobody. A reader cannot check it, and the house proof rule forbids a claim nobody can check. |
| `closing-summary` | 1 | copy | warn | Closing summary | 'Overall,', 'In conclusion,', 'In short,': a paragraph that announces it is summing up, then restates what the reader has just read. |
| `false-range` | 1 | copy | warn | False range | 'From first-time buyers to seasoned investors alike' names two ends of no real scale, to sound as if it covers everyone. It describes nobody. |
| `phrase-density` | 2 | copy | warn | Leaned-on phrase | 'Rather than', 'actually', 'That is...' openers, participle triads: each is ordinary English once, and a document that uses one far above its rate has one move and repeats it. |
| `aphorism-density` | 2 | copy | warn | Aphorism cadence | Two clipped sentences alone on a line ('All of this already exists. The job is making it findable.') land once. Closing every section, they are a cadence a reader learns to hear. |
| `contraction-scarcity` | 1 | copy | warn | No contractions | A long document with almost no contractions reads stiff and machine-made. People write 'we're' and 'don't'. |
| `sentence-rhythm` | 2 | copy | warn | Metronomic rhythm | Sentence after sentence of the same length reads generated. A person's sentences run long, then short, then long again. |
| `repeated-sentence` | 1 | copy | warn | Repeated sentence | The same sentence on two pages, or the same nine words lightly edited, is one of the strongest signs a document was assembled rather than written. |
| `heading-shape` | 2 | copy | warn | One heading shape | Headings that all share one shape ('X, and Y', 'X, because Y', 'Keep, rewrite, consolidate, retire') read as a template filled in section by section. |
| `heading-echo` | 2 | copy | warn | Heading echoed | A heading repeated word for word as the first line under it spends the reader's attention twice on the same words. |
| `generic-hero-claim` | 1 | copy + rendered | warn | Headline that fits any business | The first thing a visitor reads on the home page names no place, no person, no price and no job, so it would fit every competitor's site unchanged. A model writes it when it has nothing particular to say. |
| `cta-band-stock` | 1 | rendered | warn | Stock call-to-action band | A full-width coloured band with a centred heading, one line and one or two buttons is what a model closes every section run with. It asks for the booking the same way on every site. |
| `pricing-trio-popular` | 1 | rendered | warn | Three-tier pricing with a popular badge | Three price cards with the middle one badged 'Most popular' is the SaaS pricing page, applied to a plumber or a salon whether or not anyone chose the middle option. |
| `testimonial-avatar-carousel` | 1 | rendered | warn | Avatar testimonial carousel | Round headshots over quotes in a sliding carousel is the stock testimonial block. Most visitors see the first slide only, and stock or AI faces make every quote read as invented. |
| `faq-accordion-closer` | 2 | rendered | warn | FAQ accordion as the closer | Ending the page on a collapsed FAQ, often followed only by a band, is the model's default page ending. The answers a buyer needs are hidden behind clicks at the point they decide. |
| `stats-row` | 1 | rendered | warn | Row of big numbers | Three or four large figures in a row (500+ clients, 98% satisfaction, 10 years) is the stock proof block, and the numbers are often round, unsourced or invented. |
| `centred-everything` | 2 | rendered | warn | Every section centred | When almost every section stacks a centred heading over centred text, the page has no reading line and every block looks like the one before. It is the layout nothing was decided for. |
| `stock-photo` | 1 | rendered | warn | Stock photography | A picture from a stock library is the picture every other site in the trade can use. It shows a job the client did not do, in a kitchen that is not theirs, and a visitor who has seen it before stops believing the rest. |
| `stock-avatar` | 1 | rendered | warn | Stock or placeholder faces | Round portraits from a placeholder-face service or a stock library next to reviews make every quote read as invented, and some of those faces are generated people who do not exist. |
| `ai-image` | 2 | rendered | warn | Generated image | The file itself says a model made it (its XMP or Content Credentials name a trained-model source). A generated picture stands in for work the client did not photograph, and anyone can read the label. |
| `no-real-imagery` | 1 | rendered | warn | No photograph on the page | A page with no photograph at all, only icons and illustrations, is the page a model builds when it has no assets. Icon tiles stand in for the evidence a buyer looks for: the work, the premises, the people. |
| `unproven-claim` | 1 | rendered | warn | Claim with no proof next to it | "Trusted", "fully qualified" and "award-winning" ask the visitor to take the business's word for it. A page built with no reviews and no registration number makes the claim anyway, with nothing beside it. |
<!-- craft:catalogue:end -->

### Decision on the flagged rule (2026-09-30)

Closed without changing the threshold. The rule was fixed before any result was read, and retuning it on the 56 pages it was measured on would break that. "Flagged" is a **look-closer signal**, not a verdict that a site is AI-made: it catches AI pages reliably (20 of 20) and also marks well-made human sites (14 of 36) that share a few common design habits. Nothing gates on it. Any change to the rule or to the five weak tells (`icon-tile-grid`, `generic-hero-claim`, `marquee`, `grid-background`, `unproven-claim`) must be judged on a fresh human set, not this one. Follow-up, not blocking: an AI set from other builders via `craft null import` (v0, Lovable and similar), which needs pages from those builders.
