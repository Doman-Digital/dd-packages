# Retrofit: https://sensphere.co.uk/

**Now:** mixed. 1 of 4 signals raised: tells.

| Signal | Raised | Reading |
|---|---|---|
| tells | yes | 9 distinct design tells: reflex-font, glass-panel, pill-everything, ai-violet, radial-spotlight-glow, thin-border-wide-shadow, icon-tile-stack, reflex-font-2, icon-tile-grid |
| typicality | no | score 0.00, not typical of what Claude builds for this brief |
| estate | no | nearest hj at 0.50, no sibling |
| reasons | not measured | not measured: no art-direction.json |

**Done when** `craft report` says *decided*: fewer than three design tells, typicality under 0.10 against this brief's null, no sibling in the estate, and at least five of the seven choices decided with a reason.

## 1. Decide first

- [ ] Write art-direction.json: run craft direction init, then give every choice a reason from the client's world. *(the reason rule)*

## 2. Type

- [ ] Pick the display face from the client's world (signage, packaging, the trade's lettering), record why in art-direction.json, and keep it unique across the estate. *(Reflex font (reflex-font, gen 1), in source and on the page; Second-wave reflex font (reflex-font-2, gen 2))*
  - Waits on: deciding **display** in art-direction.json.

## 3. Colour

- [ ] Derive the accent from something the client owns (livery, shopfront, product). If violet is the brand, declare it: `{ "tell": "ai-violet", "because": "..." }`. *(Indigo-violet accent (ai-violet, gen 1), in source and on the page)*
  - Waits on: deciding **accent** in art-direction.json.

## 4. Shape

- [ ] Choose the shape language on purpose (and record it), then use the pill only where it means something. The limit here is 30 per scan. *(Pills everywhere (pill-everything, gen 1))*
  - Waits on: deciding **shape** in art-direction.json.

## 5. Effects

- [ ] Give text a solid ground, or crop the image so the text sits on a quiet area. *(Glass panel (glass-panel, gen 1); Radial glow (radial-spotlight-glow, gen 2), in source and on the page; Icon in a tinted tile (icon-tile-stack, gen 2))*
  - Waits on: deciding **motif** in art-direction.json.
- [ ] Pick one: a border that is visible, or a shadow the light source explains. Keep within the four-shadow budget. *(Hairline border, wide shadow (thin-border-wide-shadow, gen 2), in source and on the page)*
  - Waits on: deciding **shape** in art-direction.json.

## 6. How sections look (not where they sit)

- [ ] Show the services as the client would: a price list, a menu board, photographs of the work, a sequence. *(Three-column icon-card grid (icon-tile-grid, gen 1))*

## 7. Copy

- [ ] Use a full stop, a comma, or a colon. Two sentences are clearer than one sentence with a dash in it. *(Em dash (em-dash), 72 places, first at apps/portal/scripts/parity-test-db.ts:141)*
- [ ] Say the plain thing. 'Elevate your look' becomes what actually happens: 'Gel that lasts three weeks'. *(AI vocabulary (ai-vocabulary), 28 places, first at apps/portal/src/app/admin/(protected)/customers/[clientId]/clinical/clinical-vault-manager.tsx:56)*
- [ ] Name the action and the outcome: 'Book a 45-minute facial', not 'Experience the difference'. *(Hollow imperative (hollow-imperative), 3 places, first at apps/portal/src/app/admin/(protected)/customers/[clientId]/page.tsx:452)*
- [ ] Say the positive claim and drop the contrast. *(Contrastive negation (not-just-but), 12 places, first at apps/portal/src/app/admin/(protected)/referrals/actions.test.ts:137)*
- [ ] Replace the phrase with the fact behind it: a number, a name, a place, a time. *(Stock phrase (stock-phrase), 2 places, first at apps/portal/src/app/portal/(protected)/portal-dashboard-body.tsx:278)*
- [ ] Keep the one that lands hardest and cut the rest. 'What is genuinely excellent' reads better as 'what is excellent'. *(Review-tier phrase (review-phrase), 8 places, first at apps/web/src/app/[locale]/complaints/actions.test.ts:100)*
- [ ] Open with the answer. *(Rhetorical question opener (rhetorical-opener), 8 places, first at apps/web/src/app/[locale]/resources/[slug]/page.tsx:206)*
- [ ] Replace it with the positive fact it hints at, or cut it. *('No X' badge (no-x-badge), 4 places, first at apps/web/src/lib/email.test.ts:433)*
- [ ] Say what they get: 'We reply within a day and only about your enquiry'. *('No X, no Y' list (no-x-no-y), 2 places, first at scripts/guards/portal-route-contract.mjs:191)*
- [ ] Say what is actually true. 'World-class service' becomes 'We answer the phone until 8pm'. 'Reach out' becomes 'get in touch'. *(Buzzword (buzzword), 1 place, first at scripts/populate-sanity-content.ts:59)*
- [ ] Remove it. Typographic marks are fine: a star for a rating, a middot as a separator, an arrow in a link. *(Emoji in copy (emoji), 4 places, first at Social/SEN-Sphere-Instagram-Launch/CAPTIONS.md:10)*

## Leave alone

Navigation, the order of the sections, where the call to action sits, reading order and legibility. Change the look, never the page grammar. A layout tell above is about how a section looks: the icon tiles, the chip, the strip. The section stays where it is.
