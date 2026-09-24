# Roadmap: craft finds and removes the AI look

The one roadmap for this work. It moved here from claude-kit on 2026-09-23 so
it lives beside the code it describes. The design standard is `CHARACTER.md`,
the copy standard is `COPY.md`.

Update this file in the same PR that moves a phase.

## Phases

| Phase | What | Status |
| --- | --- | --- |
| A | Tell catalogue, `craft scan`, `craft copy`, `craft tells list`; copy-check as a wrapper; the hook runs `craft scan --staged` | Merged: dd-packages #15 and #17, claude-kit #6. |
| B | Snapshot, rendered detectors, fingerprint, `craft audit` | Merged: dd-packages #18. |
| C | `art-direction.json` schema, the reason rule, `craft direction init\|validate\|propose` | Merged: dd-packages #19. |
| D | Counterfactual null model (`claude -p`, about 20 runs a brief), `craft tells harvest` | Merged: dd-packages #21. |
| E | Estate register, `craft estate add\|compare` | Merged: dd-packages #22. |
| F | Character report, `craft retrofit`, the character skill, trawl and drift-guards switches | Merged: dd-packages #23, drift-guards #4, trawl #6, claude-kit #8. |
| G | Retrofits, one session per site | Done, outside this repo, 2026-09-24. Results are tracked in Linear. The art direction they feed is being written; J waits on it. |
| H | The copy standard: `COPY.md` in craft, `craft copy --gate` and the house policy in `house.ts`, the density tier, eight research tells, the `craft copy compare` preservation gate, the copy-check skill rebuilt, and `@domandigital/sanity-copy` for the Studio | Merged: dd-packages #24 and #26, claude-kit #10 and #11. `sanity-copy` in review; installing it in the DD Studio waits on its first npm release. Runs alongside G and does not block it. |
| I | Enterprise foundation: `craft.config.json` (ignore globs, `copyPaths`, severity changes with a reason), `--baseline`/`--update-baseline`, `--sarif`, `schemaVersion` on every `--json`, `craft audit --pages` and `--viewport`; `.claude`, `.agents` and `.cursor` never walked | In review. |
| J | `craft direction build` (tokens from decided choices), `craft brief` (instructions for an agent), `craft loop` (build, audit, change list), and the skill | Waiting on the art direction. Released by the first two or three decided `art-direction.json` files. |
| K | Snapshot v2: section roles (CTA band, footer CTA, pricing, testimonials, FAQ, process, features, team, contact), per-section geometry and page rhythm, screenshot measures (colourfulness, edge density, symmetry), a v1 reader, fingerprint v2 | In review. `kind` keeps its v1 meaning and `role` is new, so no tell and no calibrated typicality moves until the null models and the estate are re-snapshotted. **Recalibration is not done**: re-snapshot `calibration/estate`, the AI set and the null models, then record typicality before and after in `CHARACTER.md`. |
| L | Component-level sameness: component fingerprints, `craft estate compare --component`, per-component typicality, six rendered tells (`cta-band-stock`, `pricing-trio-popular`, `testimonial-avatar-carousel`, `faq-accordion-closer`, `stats-row`, `centred-everything`) | In review. Rendered tells get their own surface (`rendered`), proved on fixture snapshots and on a real render. **No sibling line for components yet**: it needs 30 to 50 CTA.gallery examples snapshotted into `calibration/idiom/cta/` (run locally), and the null models rebuilt on snapshot v2 before per-component typicality says anything. |
| M | Imagery and provenance: every image in the snapshot, an XMP/C2PA byte scan for AI-generated media, `stock-photo`, `ai-image`, `stock-avatar`, `no-real-imagery` | Planned. The `imagery` choice key in `art-direction.json` waits on the art direction. |
| N | Specificity: `specificity(text, brief)`, `generic-hero-claim`, proof in context, `craft copy compare --competitor` | Planned. |
| O | `@domandigital/craft-judge`: a vision-model second opinion, advisory only | Later, once K to N are stable. |

## Waiting on the art direction

Listed so they are not lost, and not built until the art direction exists:

- Phase J, all of it.
- The `imagery` choice key in `art-direction.json` (Phase M's other parts do
  not wait).
- Any change to `SOURCE_KINDS` (for example, screenshots of delivered work).
- Version 2 of the `art-direction.json` schema.
- An `icons` choice key. Until then a site records its icon set as a source,
  and the licence register (`src/direction/licences.ts`) holds what each set
  allows. No house icon set: one set across every client is the estate
  sameness `CHARACTER.md` warns about.

Each is released by what the first decided sites could not express in
version 1 of the schema.

## Rules that hold for every phase

- Every tell ships as `warn`. The house copy gate (`house.ts`) blocks only the
  blocking tier of `COPY.md`. Moving any other tell to `block` needs its estate
  hits read by a person, the baseline recorded here, and the tests updated in
  the same change.
- Every catalogue entry has a flag case per detection path and a pass case,
  each proved on its own. A copy tell's pass case is real persuasive copy: a
  tell that fires on good sales copy does not ship.
- Change the look, never the page grammar. Never reward strangeness.
- craft stays zero-dependency. Anything needing a browser goes in a separate
  entry with an optional peer dependency.
- Word lists go stale as models change. When a new model generation ships,
  re-run the null models and `craft tells harvest`, and record the date here.

## What blocks a commit

The house policy is `src/character/house.ts`: ten copy tells make up the
blocking tier of `COPY.md`, and `craft copy --gate` fails on any of them.
`copy-check` in claude-kit reads the same policy from `craft tells list
--json`. `src/__tests__/copy-doc.test.ts` fails if a phrase in the blocking
tier does not block, or if a copy tell is not written up in `COPY.md`.

## Candidates for the blocking tier

- None open. **`chatbot-residue` moved to `block` on 2026-09-24.** Its estate
  hits were read by a person: 10 citation runs and 5 entity markers in one
  live DD article, 15 of 15 real, zero false alarms on the 160 generated
  pages and the human set. The article was fixed and every claim a token had
  backed was sourced, corrected or cut.

## Not built yet, on purpose

- Document metrics as diagnostics (sentence-length spread, MATTR, trigram
  repetition, bullet share), shown against a house corpus by document type.
  Worth building once there is a corpus of real proposals to compare against;
  without one, a number has nothing to mean.
- Semantic comparison of an introduction with its conclusion. Needs a model,
  and craft stays zero-dependency.

## Baselines to read before anything blocks

- DD live Sanity content, 2026-09-23: `sanity-copy` over all 137 published
  documents of project `6xogwbpo`. Two house-rule findings (a "No proof" card
  title on the homepage; "disciplined, not complicated" in an article) and 154
  worth a look. **Ten `chatbot-residue` findings in one live article**,
  `website-builder-vs-freelancer-vs-agency`: ChatGPT citation tokens pasted in
  whole, rendering on domandigital.co.uk. The first live proof for that tell.
  The run also tuned four tells (catalogue `2026.09.6`): 7 of 7 placeholder
  hits were templates in quotes, and 57 of 68 label-list hits were definition
  lists, all now passing.

- DD review tier read by a person, 2026-09-24: all 144 "worth a look"
  findings over the 137 live documents. Real: vague-attribution 36 of 37
  (uncited statistics; one "until the data proves" is a conditional),
  review-phrase 13 of 13, ai-vocabulary 4 of 4, phrase-density 30 of 30,
  contraction-scarcity 12 of 12 (AI-drafted articles, 0 to 4 contractions in
  4,000 words), repeated-sentence 25 of 27 (2 were footnotes repeating a
  source title), staccato-triplet 3 of 4 (1 crossed a paragraph break), ing-tail
  2 of 3 (1 was a list of tasks). Noise: inline-label-list 0 of 11 (price
  bands, click-through rates by position, named directories, a decision tree,
  numbered steps). All four noisy tells tuned (catalogue `2026.09.8`), each
  with the real hit as a pass fixture. The read also found a tell no rule had:
  **`prompt-context`**, the model naming its inputs ("the attached Perplexity
  research file"), 24 hits in five live articles, all real. New, so `review`;
  a candidate for `block` once measured on proposals, where "the attached
  research" can be honest.

- `shadcn-card-stock`, added 2026-09-24 from the 2026-09-11 research: not
  yet measured on the estate. The estate snapshots in `calibration/estate`
  are rendered pages, and this tell reads source, so it needs a scan of the
  client repos themselves. Read every hit before trusting the count.

Recorded with dates in `CHARACTER.md` under Calibration once run.

- Copy, 2026-09-23: old copy-check against craft on 2,570 files across seven
  client repos. 193 old findings; every one that is visitor copy is still found.
- Signal 2, 2026-09-23: seven null models of 20 pages each. The AI set, 20
  unseen briefs, was 19 of 20 flagged (target 90%). Against their own brief,
  DD (0.15) and Harrison James (0.10) are typical; the other five are not.
- Human set, 2026-09-23: the reference set's live pages, zero block hits,
  none typical. Linear, Stripe and DD are tell-heavy; two house demos were
  expired previews and are not measured.
- Signal 3, 2026-09-23: one sibling pair in 21, DD and HJ Beauty (0.28).
- Character report, 2026-09-23: two sites *default*, five *mixed*, none
  *decided* because no site has an `art-direction.json`. The first change on
  all seven is the display face.
- Design tells on the estate, 2026-09-23: `craft scan` on all seven client
  repos and `craft audit` on all seven live sites. Table in `CHARACTER.md`,
  snapshots in `calibration/estate/2026-09-23/`. Not yet read by a person.
- Phase H tells on the AI pages, 2026-09-23: the 160 generated pages under
  `calibration/` (20 AI-set, 140 null model). `repeated-sentence` 82 hits on 25
  pages, every one read and real: one page carries its whole body twice, and
  most others reuse a hero line in the footer. `phrase-density` 41 hits on 38
  pages, mostly "actually" and "genuinely" inside generated testimonials.
  `chatbot-residue`, `placeholder`, `question-reveal` and `inline-label-list`:
  zero hits, so zero false positives on this set. The other nine: zero hits, because they are built for long documents
  (proposals, emails, articles) and these are landing pages. **Not yet measured
  on long-form or on the estate.** Run the estate sweep before any of them is
  considered for `block`.
