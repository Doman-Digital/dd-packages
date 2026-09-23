# Retrofit: https://www.rmp-electrical.co.uk/

**Now:** mixed. 1 of 4 signals raised: tells.

| Signal | Raised | Reading |
|---|---|---|
| tells | yes | 8 distinct design tells: cream-palette, reflex-font-2, hero-then-proof, icon-tile-stack, italic-serif-display, pill-everything, icon-tile-grid, hero-eyebrow-chip |
| typicality | no | score 0.05, not typical of what Claude builds for this brief |
| estate | no | nearest dd at 0.49, no sibling |
| reasons | not measured | not measured: no art-direction.json |

**Done when** `craft report` says *decided*: fewer than three design tells, typicality under 0.10 against this brief's null, no sibling in the estate, and at least five of the seven choices decided with a reason.

## 1. Decide first

- [ ] Write art-direction.json: run craft direction init, then give every choice a reason from the client's world. *(the reason rule)*

## 2. Type

- [ ] Pick the display face from the client's world (signage, packaging, the trade's lettering) and record why in art-direction.json. If this face really is the right one, declare an exception with the reason and the evidence. *(Second-wave reflex font (reflex-font-2, gen 2), in source and on the page; Italic serif display (italic-serif-display, gen 2), in source and on the page)*
  - Waits on: deciding **display** in art-direction.json.

## 3. Colour

- [ ] Take the ground from the client's material world (paper stock, wall colour, tile). If it really is cream, say why. *(Cream ground (cream-palette, gen 2), in source and on the page)*
  - Waits on: deciding **ground** in art-direction.json.

## 4. Shape

- [ ] Choose the shape language on purpose (and record it), then use the pill only where it means something. The limit here is 30 per scan. *(Pills everywhere (pill-everything, gen 1), in source and on the page)*
  - Waits on: deciding **shape** in art-direction.json.

## 5. Effects

- [ ] Use the client's own marks, photography or numerals. If an icon earns its place, set it inline with the text. *(Icon in a tinted tile (icon-tile-stack, gen 2))*
  - Waits on: deciding **motif** in art-direction.json.

## 6. How sections look (not where they sit)

- [ ] Follow the hero with the thing only this business has: the work, the place, the person. Put proof where a doubt arises. *(Hero straight into a trust strip (hero-then-proof, gen 1), in source and on the page)*
- [ ] Show the services as the client would: a price list, a menu board, photographs of the work, a sequence. *(Three-column icon-card grid (icon-tile-grid, gen 1), in source and on the page)*
- [ ] Drop it. If the fact matters, put it in the headline or the first line of copy. *(Eyebrow chip above the hero (hero-eyebrow-chip, gen 2))*

## 7. Copy

- [ ] Open with the answer. *(Rhetorical question opener (rhetorical-opener), 1 place, first at app/guides/[slug]/page.tsx:249)*
- [ ] Use a full stop, a comma, or a colon. Two sentences are clearer than one sentence with a dash in it. *(Em dash (em-dash), 24 places, first at components/sections/ServicesInline.tsx:33)*
- [ ] Say what is actually true. 'World-class service' becomes 'We answer the phone until 8pm'. 'Reach out' becomes 'get in touch'. *(Buzzword (buzzword), 2 places, first at lib/content/service-faqs.ts:110)*
- [ ] Say what they get: 'The price on the quote is the price you pay', 'Cancel any month'. *(Negative reassurance (negative-reassurance), 3 places, first at lib/locations.ts:90)*
- [ ] Keep the one that lands hardest and cut the rest. 'What is genuinely excellent' reads better as 'what is excellent'. *(Review-tier phrase (review-phrase), 6 places, first at lib/locations.ts:445)*
- [ ] Replace it with the positive fact it hints at, or cut it. *('No X' badge (no-x-badge), 10 places, first at lib/sanity/get-homepage-content.ts:211)*
- [ ] Remove it. Typographic marks are fine: a star for a rating, a middot as a separator, an arrow in a link. *(Emoji in copy (emoji), 10 places, first at public/social-media-kit/CHEAT-SHEET.txt:118)*
- [ ] Write one sentence that says which of the three is true, and how you know. *(Staccato triplet (staccato-triplet), 2 places, first at reels/src/BrandOutro.tsx:68)*
- [ ] Say what they get: 'We reply within a day and only about your enquiry'. *('No X, no Y' list (no-x-no-y), 1 place, first at reels/src/data/carousels.ts:92)*
- [ ] Say what the place is and where it is. *('Where X meets Y' (where-x-meets-y), 1 place, first at scripts/create-minor-works-guides.ts:355)*

## Leave alone

Navigation, the order of the sections, where the call to action sits, reading order and legibility. Change the look, never the page grammar. A layout tell above is about how a section looks: the icon tiles, the chip, the strip. The section stays where it is.
