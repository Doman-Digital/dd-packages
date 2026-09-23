# Retrofit: https://www.domandigital.co.uk/

**Now:** default. 3 of 4 signals raised: nobody chose how this looks.

| Signal | Raised | Reading |
|---|---|---|
| tells | yes | 12 distinct design tells: pill-everything, ai-violet, hero-then-proof, reflex-font-2, radial-spotlight-glow, reflex-font, glass-panel, icon-tile-grid, icon-tile-stack, hero-eyebrow-chip, marquee, reveal-everywhere |
| typicality | yes | score 0.15, typical of what Claude builds for this brief |
| estate | yes | sibling of hjbeauty (0.28) |
| reasons | not measured | not measured: no art-direction.json |

**Done when** `craft report` says *decided*: fewer than three design tells, typicality under 0.10 against this brief's null, no sibling in the estate, and at least five of the seven choices decided with a reason.

## 1. Decide first

- [ ] Write art-direction.json: run craft direction init, then give every choice a reason from the client's world. *(the reason rule)*

## 2. Type

- [ ] Pick the display face from the client's world (signage, packaging, the trade's lettering) and record why in art-direction.json. If this face really is the right one, declare an exception with the reason and the evidence. *(Second-wave reflex font (reflex-font-2, gen 2), in source and on the page; Reflex font (reflex-font, gen 1); Move off the model's pick for this brief: display Fraunces (13 of 20 null pages chose it); Differ from hjbeauty: both have Fraunces headline (sibling at 0.28))*
  - Waits on: deciding **display** in art-direction.json.

## 3. Colour

- [ ] Derive the accent from something the client owns (livery, shopfront, product). If violet is the brand, declare it: `{ "tell": "ai-violet", "because": "..." }`. *(Indigo-violet accent (ai-violet, gen 1); Differ from hjbeauty: both have no accent (sibling at 0.28))*
  - Waits on: deciding **accent** in art-direction.json.

## 4. Shape

- [ ] Choose the shape language on purpose (and record it), then use the pill only where it means something. The limit here is 30 per scan. *(Pills everywhere (pill-everything, gen 1), in source and on the page; Move off the model's pick for this brief: shape pill (19 of 20 null pages chose it))*
  - Waits on: deciding **shape** in art-direction.json.

## 5. Effects

- [ ] Light the page with real imagery, or leave the ground flat. *(Radial glow (radial-spotlight-glow, gen 2); Glass panel (glass-panel, gen 1); Icon in a tinted tile (icon-tile-stack, gen 2))*
  - Waits on: deciding **motif** in art-direction.json.

## 6. Motion

- [ ] Show proof still and in context: one named review, one accreditation, where the doubt arises. *(Scrolling marquee (marquee, gen 2); Reveal on every section (reveal-everywhere, gen 1))*
  - Waits on: deciding **signature** in art-direction.json.

## 7. How sections look (not where they sit)

- [ ] Show the services as the client would: a price list, a menu board, photographs of the work, a sequence. *(Three-column icon-card grid (icon-tile-grid, gen 1), in source and on the page)*
- [ ] Follow the hero with the thing only this business has: the work, the place, the person. Put proof where a doubt arises. *(Hero straight into a trust strip (hero-then-proof, gen 1))*
- [ ] Drop it. If the fact matters, put it in the headline or the first line of copy. *(Eyebrow chip above the hero (hero-eyebrow-chip, gen 2))*

## 8. Copy

- [ ] Use a full stop, a comma, or a colon. Two sentences are clearer than one sentence with a dash in it. *(Em dash (em-dash), 505 places, first at .agents/skills/posthog-integration-nextjs-app-router/references/identify-users.md:7)*
- [ ] Keep the one that lands hardest and cut the rest. 'What is genuinely excellent' reads better as 'what is excellent'. *(Review-tier phrase (review-phrase), 46 places, first at .claude/agents/cco.md:10)*
- [ ] Cut the phrase and start with the point it was introducing. 'Seamless booking' becomes 'Book in three taps'. *(AI phrase (ai-phrase), 4 places, first at .claude/agents/cco.md:17)*
- [ ] Say the positive claim and drop the contrast. *(Contrastive negation (not-just-but), 28 places, first at .claude/agents/cco.md:17)*
- [ ] Name the mechanism instead. 'Empower your team' becomes 'Your team can publish without us'. *(A plainer word exists (plainer-word), 13 places, first at .claude/agents/cco.md:17)*
- [ ] Replace it with the specific thing. 'Innovative solutions' becomes the actual product and what it does. *(Vague word (vague-word), 34 places, first at .claude/agents/cmo.md:15)*
- [ ] Say what they get: 'We reply within a day and only about your enquiry'. *('No X, no Y' list (no-x-no-y), 6 places, first at .claude/agents/cmo.md:19)*
- [ ] Open with the answer. *(Rhetorical question opener (rhetorical-opener), 22 places, first at apps/marketing/app/client-preview/page.tsx:208)*
- [ ] Say the plain thing. 'Elevate your look' becomes what actually happens: 'Gel that lasts three weeks'. *(AI vocabulary (ai-vocabulary), 29 places, first at apps/marketing/app/pricing/managed/page.tsx:197)*
- [ ] Replace the phrase with the fact behind it: a number, a name, a place, a time. *(Stock phrase (stock-phrase), 8 places, first at apps/marketing/components/FAQ.stories.tsx:11)*
- [ ] Name the action and the outcome: 'Book a 45-minute facial', not 'Experience the difference'. *(Hollow imperative (hollow-imperative), 4 places, first at apps/marketing/content/blogPosts.ts:215)*
- [ ] Say what is actually true. 'World-class service' becomes 'We answer the phone until 8pm'. 'Reach out' becomes 'get in touch'. *(Buzzword (buzzword), 17 places, first at apps/marketing/content/google-reviews.md:65)*
- [ ] Remove it. Typographic marks are fine: a star for a rating, a middot as a separator, an arrow in a link. *(Emoji in copy (emoji), 15 places, first at apps/marketing/content/google-reviews.md:101)*
- [ ] Write one sentence that says which of the three is true, and how you know. *(Staccato triplet (staccato-triplet), 5 places, first at apps/marketing/content/resources/google-ads-for-tradespeople.md:92)*
- [ ] Replace it with the positive fact it hints at, or cut it. *('No X' badge (no-x-badge), 21 places, first at apps/marketing/lib/review/checks/business-profile.ts:44)*
- [ ] Say what they get: 'The price on the quote is the price you pay', 'Cancel any month'. *(Negative reassurance (negative-reassurance), 4 places, first at apps/marketing/scripts/seed-sanity.ts:127)*
- [ ] Use the house replacement, 'properly explained', or drop the claim and let the copy show it. *('Plain English' (plain-english), 1 place, first at apps/marketing/studio/schemas/documents/jargonTerm.ts:20)*

## Leave alone

Navigation, the order of the sections, where the call to action sits, reading order and legibility. Change the look, never the page grammar. A layout tell above is about how a section looks: the icon tiles, the chip, the strip. The section stays where it is.
