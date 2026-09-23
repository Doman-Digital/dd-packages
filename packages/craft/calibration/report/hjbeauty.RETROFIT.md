# Retrofit: https://www.harrisonsbeauty.com/

**Now:** default. 2 of 4 signals raised: nobody chose how this looks.

| Signal | Raised | Reading |
|---|---|---|
| tells | yes | 6 distinct design tells: hero-then-proof, marquee, glass-panel, reflex-font, reflex-font-2, icon-tile-grid |
| typicality | no | score 0.05, not typical of what Claude builds for this brief |
| estate | yes | sibling of dd (0.28) |
| reasons | not measured | not measured: no art-direction.json |

**Done when** `craft report` says *decided*: fewer than three design tells, typicality under 0.10 against this brief's null, no sibling in the estate, and at least five of the seven choices decided with a reason.

## 1. Decide first

- [ ] Write art-direction.json: run craft direction init, then give every choice a reason from the client's world. *(the reason rule)*

## 2. Type

- [ ] Pick the display face from the client's world (signage, packaging, the trade's lettering), record why in art-direction.json, and keep it unique across the estate. *(Reflex font (reflex-font, gen 1); Second-wave reflex font (reflex-font-2, gen 2), in source and on the page; Differ from dd: both have Fraunces headline (sibling at 0.28))*
  - Waits on: deciding **display** in art-direction.json.

## 3. Colour

- [ ] Differ from dd: both have no accent. *(sibling at 0.28)*
  - Waits on: deciding **accent** in art-direction.json.

## 4. Effects

- [ ] Give text a solid ground, or crop the image so the text sits on a quiet area. *(Glass panel (glass-panel, gen 1))*
  - Waits on: deciding **motif** in art-direction.json.

## 5. Motion

- [ ] Show proof still and in context: one named review, one accreditation, where the doubt arises. *(Scrolling marquee (marquee, gen 2), in source and on the page)*
  - Waits on: deciding **signature** in art-direction.json.

## 6. How sections look (not where they sit)

- [ ] Follow the hero with the thing only this business has: the work, the place, the person. Put proof where a doubt arises. *(Hero straight into a trust strip (hero-then-proof, gen 1))*
- [ ] Show the services as the client would: a price list, a menu board, photographs of the work, a sequence. *(Three-column icon-card grid (icon-tile-grid, gen 1))*

## 7. Copy

- [ ] Use a full stop, a comma, or a colon. Two sentences are clearer than one sentence with a dash in it. *(Em dash (em-dash), 86 places, first at design/redesign-handoff.md:3)*
- [ ] Say the positive claim and drop the contrast. *(Contrastive negation (not-just-but), 7 places, first at design/redesign-handoff.md:114)*
- [ ] Say what is actually true. 'World-class service' becomes 'We answer the phone until 8pm'. 'Reach out' becomes 'get in touch'. *(Buzzword (buzzword), 1 place, first at design/redesign-handoff.md:237)*
- [ ] Cut the phrase and start with the point it was introducing. 'Seamless booking' becomes 'Book in three taps'. *(AI phrase (ai-phrase), 1 place, first at design/redesign-handoff.md:552)*
- [ ] Replace the phrase with the fact behind it: a number, a name, a place, a time. *(Stock phrase (stock-phrase), 2 places, first at design/redesign-handoff.md:649)*
- [ ] Say what they get: 'We reply within a day and only about your enquiry'. *('No X, no Y' list (no-x-no-y), 3 places, first at design/redesign-handoff.md:704)*
- [ ] Write one sentence that says which of the three is true, and how you know. *(Staccato triplet (staccato-triplet), 1 place, first at design/redesign-handoff.md:814)*
- [ ] Replace it with the positive fact it hints at, or cut it. *('No X' badge (no-x-badge), 43 places, first at drizzle/meta/0000_snapshot.json:98)*
- [ ] Remove it. Typographic marks are fine: a star for a rating, a middot as a separator, an arrow in a link. *(Emoji in copy (emoji), 3 places, first at scripts/images-sync.mjs:92)*
- [ ] Keep the one that lands hardest and cut the rest. 'What is genuinely excellent' reads better as 'what is excellent'. *(Review-tier phrase (review-phrase), 5 places, first at src/components/Spotlight.test.ts:41)*
- [ ] Open with the answer. *(Rhetorical question opener (rhetorical-opener), 1 place, first at src/lib/cms/seed-content.ts:462)*

## Leave alone

Navigation, the order of the sections, where the call to action sits, reading order and legibility. Change the look, never the page grammar. A layout tell above is about how a section looks: the icon tiles, the chip, the strip. The section stays where it is.
