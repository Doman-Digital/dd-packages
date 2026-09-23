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
| G | Retrofits, one session per site | Ready to start. Each site's checklist is in `calibration/report/`. |
| H | The copy standard: `COPY.md` in craft, `craft copy --gate` and the house policy in `house.ts`, the density tier, eight research tells (including `chatbot-residue` and `placeholder`), the `craft copy compare` preservation gate, the copy-check skill rebuilt | Standard, gate, density tier and first four research tells merged: dd-packages #24, claude-kit #10. Residue, placeholders and `craft copy compare` in review. Runs alongside G and does not block it. |

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

- **`chatbot-residue`**, first. It is evidence of a pasted chat reply, not a
  matter of style, and the research treats it as an error on first
  occurrence. Zero hits on the 160 generated pages. Read its hits on the
  estate, then move it to `block` in `house.ts` and `COPY.md` together.

## Not built yet, on purpose

- Document metrics as diagnostics (sentence-length spread, MATTR, trigram
  repetition, bullet share), shown against a house corpus by document type.
  Worth building once there is a corpus of real proposals to compare against;
  without one, a number has nothing to mean.
- Semantic comparison of an introduction with its conclusion. Needs a model,
  and craft stays zero-dependency.

## Baselines to read before anything blocks

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
