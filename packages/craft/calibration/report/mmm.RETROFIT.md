# Retrofit: https://www.mmm-beauty.co.uk/

**Now:** mixed. 1 of 4 signals raised: tells.

| Signal | Raised | Reading |
|---|---|---|
| tells | yes | 18 distinct design tells: icon-tile-stack, ai-violet, icon-tile-grid, glass-panel, thin-border-wide-shadow, radial-spotlight-glow, shadcn-dump, reflex-font-2, reflex-font, gradient-text, cream-palette, reveal-everywhere, italic-serif-display, grid-background, hero-then-proof, pill-everything, hero-eyebrow-chip, intro-cinematic |
| typicality | no | score 0.05, not typical of what Claude builds for this brief |
| estate | no | nearest rmp at 0.65, no sibling |
| reasons | not measured | not measured: no art-direction.json |

**Done when** `craft report` says *decided*: fewer than three design tells, typicality under 0.10 against this brief's null, no sibling in the estate, and at least five of the seven choices decided with a reason.

## 1. Decide first

- [ ] Write art-direction.json: run craft direction init, then give every choice a reason from the client's world. *(the reason rule)*

## 2. Type

- [ ] Pick the display face from the client's world (signage, packaging, the trade's lettering) and record why in art-direction.json. If this face really is the right one, declare an exception with the reason and the evidence. *(Second-wave reflex font (reflex-font-2, gen 2), in source and on the page; Reflex font (reflex-font, gen 1); Italic serif display (italic-serif-display, gen 2))*
  - Waits on: deciding **display** in art-direction.json.

## 3. Colour

- [ ] Derive the accent from something the client owns (livery, shopfront, product). If violet is the brand, declare it: `{ "tell": "ai-violet", "because": "..." }`. *(Indigo-violet accent (ai-violet, gen 1); Gradient-filled heading (gradient-text, gen 1))*
  - Waits on: deciding **accent** in art-direction.json.
- [ ] Take the ground from the client's material world (paper stock, wall colour, tile). If it really is cream, say why. *(Cream ground (cream-palette, gen 2))*
  - Waits on: deciding **ground** in art-direction.json.

## 4. Shape

- [ ] Delete the primitives nothing imports. Restyle the ones that stay so they belong to this site. *(Stock component dump (shadcn-dump, gen 1); Pills everywhere (pill-everything, gen 1))*
  - Waits on: deciding **shape** in art-direction.json.

## 5. Effects

- [ ] Use the client's own marks, photography or numerals. If an icon earns its place, set it inline with the text. *(Icon in a tinted tile (icon-tile-stack, gen 2); Glass panel (glass-panel, gen 1); Radial glow (radial-spotlight-glow, gen 2), in source and on the page; Graph-paper background (grid-background, gen 2))*
  - Waits on: deciding **motif** in art-direction.json.
- [ ] Pick one: a border that is visible, or a shadow the light source explains. Keep within the four-shadow budget. *(Hairline border, wide shadow (thin-border-wide-shadow, gen 2))*
  - Waits on: deciding **shape** in art-direction.json.

## 6. Motion

- [ ] Keep one gated signature moment per page (STANDARD section 7) and let the rest arrive still. The limit here is 12 per scan. *(Reveal on every section (reveal-everywhere, gen 1); Intro cinematic (intro-cinematic, gen 2))*
  - Waits on: deciding **signature** in art-direction.json.

## 7. How sections look (not where they sit)

- [ ] Follow the hero with the thing only this business has: the work, the place, the person. Put proof where a doubt arises. *(Hero straight into a trust strip (hero-then-proof, gen 1), in source and on the page)*
- [ ] Show the services as the client would: a price list, a menu board, photographs of the work, a sequence. *(Three-column icon-card grid (icon-tile-grid, gen 1))*
- [ ] Drop it. If the fact matters, put it in the headline or the first line of copy. *(Eyebrow chip above the hero (hero-eyebrow-chip, gen 2))*

## 8. Copy

- [ ] Keep the one that lands hardest and cut the rest. 'What is genuinely excellent' reads better as 'what is excellent'. *(Review-tier phrase (review-phrase), 34 places, first at .cursor/plans/mmm_beauty_lighthouse_max-out_f7cfbd44.plan.md:107)*
- [ ] Replace it with the positive fact it hints at, or cut it. *('No X' badge (no-x-badge), 11 places, first at .cursor/plans/simplify_lumi_indexing_to_on-demand_only_f96ac869.plan.md:43)*
- [ ] Replace the phrase with the fact behind it: a number, a name, a place, a time. *(Stock phrase (stock-phrase), 27 places, first at apps/portal/app/account/journey/JourneyClient.tsx:136)*
- [ ] Use a full stop, a comma, or a colon. Two sentences are clearer than one sentence with a dash in it. *(Em dash (em-dash), 465 places, first at apps/portal/app/account/journey/JourneyClient.tsx:163)*
- [ ] Cut the phrase and start with the point it was introducing. 'Seamless booking' becomes 'Book in three taps'. *(AI phrase (ai-phrase), 16 places, first at apps/portal/app/account/loyalty/page.tsx:185)*
- [ ] Say the plain thing. 'Elevate your look' becomes what actually happens: 'Gel that lasts three weeks'. *(AI vocabulary (ai-vocabulary), 37 places, first at apps/portal/app/account/loyalty/page.tsx:273)*
- [ ] Open with the answer. *(Rhetorical question opener (rhetorical-opener), 29 places, first at apps/portal/app/account/page.tsx:310)*
- [ ] Say what is actually true. 'World-class service' becomes 'We answer the phone until 8pm'. 'Reach out' becomes 'get in touch'. *(Buzzword (buzzword), 12 places, first at apps/portal/app/admin/(protected)/customers/page.tsx:405)*
- [ ] Say the positive claim and drop the contrast. *(Contrastive negation (not-just-but), 21 places, first at apps/portal/app/admin/(protected)/money/together/page.tsx:186)*
- [ ] Remove it. Typographic marks are fine: a star for a rating, a middot as a separator, an arrow in a link. *(Emoji in copy (emoji), 327 places, first at apps/portal/components/booking/customerFormTypes.ts:25)*
- [ ] Replace it with the specific thing. 'Innovative solutions' becomes the actual product and what it does. *(Vague word (vague-word), 23 places, first at apps/portal/docs-monorepo/audit/master-audit.md:182)*
- [ ] Write one sentence that says which of the three is true, and how you know. *(Staccato triplet (staccato-triplet), 1 place, first at apps/portal/docs-monorepo/journal-image-style-guide.md:116)*
- [ ] Name the mechanism instead. 'Empower your team' becomes 'Your team can publish without us'. *(A plainer word exists (plainer-word), 6 places, first at apps/portal/lib/assistant/prompt.ts:13)*
- [ ] Say what the place is and where it is. *('Where X meets Y' (where-x-meets-y), 2 places, first at apps/portal/lib/content.ts:102)*
- [ ] Name the action and the outcome: 'Book a 45-minute facial', not 'Experience the difference'. *(Hollow imperative (hollow-imperative), 4 places, first at apps/web/app/policies/cancellations/page.tsx:267)*
- [ ] Say what they get: 'We reply within a day and only about your enquiry'. *('No X, no Y' list (no-x-no-y), 2 places, first at social/launch-pack/CAPTIONS.md:3)*

## Leave alone

Navigation, the order of the sections, where the call to action sits, reading order and legibility. Change the look, never the page grammar. A layout tell above is about how a section looks: the icon tiles, the chip, the strip. The section stays where it is.
