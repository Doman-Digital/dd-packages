# Retrofit: https://www.chairandblade.co.uk/

**Now:** mixed. 1 of 4 signals raised: tells.

| Signal | Raised | Reading |
|---|---|---|
| tells | yes | 7 distinct design tells: reflex-font, reflex-font-2, intro-cinematic, hero-then-proof, italic-serif-display, marquee, reveal-everywhere |
| typicality | no | score 0.05, not typical of what Claude builds for this brief |
| estate | no | nearest hj at 0.60, no sibling |
| reasons | not measured | not measured: no art-direction.json |

**Done when** `craft report` says *decided*: fewer than three design tells, typicality under 0.10 against this brief's null, no sibling in the estate, and at least five of the seven choices decided with a reason.

## 1. Decide first

- [ ] Write art-direction.json: run craft direction init, then give every choice a reason from the client's world. *(the reason rule)*

## 2. Type

- [ ] Pick the display face from the client's world (signage, packaging, the trade's lettering), record why in art-direction.json, and keep it unique across the estate. *(Reflex font (reflex-font, gen 1); Second-wave reflex font (reflex-font-2, gen 2), in source and on the page; Italic serif display (italic-serif-display, gen 2))*
  - Waits on: deciding **display** in art-direction.json.

## 3. Motion

- [ ] Remove it. Spend the signature moment on something the visitor came for. *(Intro cinematic (intro-cinematic, gen 2); Scrolling marquee (marquee, gen 2); Reveal on every section (reveal-everywhere, gen 1))*
  - Waits on: deciding **signature** in art-direction.json.

## 4. How sections look (not where they sit)

- [ ] Follow the hero with the thing only this business has: the work, the place, the person. Put proof where a doubt arises. *(Hero straight into a trust strip (hero-then-proof, gen 1))*

## 5. Copy

- [ ] Use a full stop, a comma, or a colon. Two sentences are clearer than one sentence with a dash in it. *(Em dash (em-dash), 57 places, first at .claude/brand-voice-guidelines.md:1)*
- [ ] Cut the phrase and start with the point it was introducing. 'Seamless booking' becomes 'Book in three taps'. *(AI phrase (ai-phrase), 2 places, first at .claude/skills/copy-check/SKILL.md:65)*
- [ ] Name the mechanism instead. 'Empower your team' becomes 'Your team can publish without us'. *(A plainer word exists (plainer-word), 4 places, first at .claude/skills/copy-check/SKILL.md:65)*
- [ ] Say the positive claim and drop the contrast. *(Contrastive negation (not-just-but), 1 place, first at .claude/skills/copy-check/SKILL.md:98)*
- [ ] Say what they get: 'We reply within a day and only about your enquiry'. *('No X, no Y' list (no-x-no-y), 1 place, first at app/cookies/page.tsx:30)*
- [ ] Keep the one that lands hardest and cut the rest. 'What is genuinely excellent' reads better as 'what is excellent'. *(Review-tier phrase (review-phrase), 2 places, first at app/terms/page.tsx:42)*
- [ ] Replace the phrase with the fact behind it: a number, a name, a place, a time. *(Stock phrase (stock-phrase), 1 place, first at constants/content.ts:114)*

## Leave alone

Navigation, the order of the sections, where the call to action sits, reading order and legibility. Change the look, never the page grammar. A layout tell above is about how a section looks: the icon tiles, the chip, the strip. The section stays where it is.
