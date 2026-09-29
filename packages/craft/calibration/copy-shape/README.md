# Copy shape calibration, version 1

This is measurement tooling and preliminary research. It adds no tell to the
catalogue or house policy. The founder's blurb produces three shape diagnostics
(parallel triad, stacked conditional and hedged close); those are observations,
not calibrated findings in `craft copy` yet.

The frozen human files contain numerical feature vectors and page-type tags,
with metadata about extraction. They contain no corpus prose or email headers.
`baseline-sha256.json` records their hashes. Writers are split between tuning
and holdout before reservoir sampling. New extraction or features require a
new versioned baseline rather than replacement of these files.

| Register | Source | Retained blurbs |
| --- | --- | ---: |
| Business email | Enron sent folders, pre-2003 | 12,000 |
| Explanatory answers | HC3 human answers | 12,000 |
| UK institutional | Hansard Commons, pre-2021 | 12,000 |
| Literary | Gutenberg | 12,000 |
| Marketing and service | Wayback UK SME pages, pre-2021 | 715 |

The Wayback run used 224 DMOZ domains and read 380 pages. Usable blurbs came
from 150 domains, split into 338 tuning and 377 holdout observations. Page
types: 194 home, 347 about and 174 services. It reached a reported peak of
96 MB. Other readers reached at most 166 MB in the recorded run. The completed
Enron archive and Wayback HTML cache were deleted after extracting statistics.

Generation is complete: 30 fictional briefs, five genres and three Claude
models, 450 originals and 450 edit passes, plus the 1,083 legacy blurbs.

`report.md` and `report.json` were measured with 300 bootstrap resamples. They
include matched effect sizes, stratified d and AUC intervals, holdout false
positive rates and an edit-survival table. Intervals bootstrap paragraphs,
not writer clusters. The sampling and interval methods need review before
interpreting borderline effects as strong evidence.

Result (2026-09-29, 300 resamples, generation complete): no feature passes the
ship rule, so no tell is added to the catalogue, house policy or claude-kit.
This is a negative result and it stands. Why:

- Best register-matched effects are d 0.5 to 0.7 (tricolons, clause depth,
  sentence CV, shape stack), under the 0.8 bar, and lower bounds under 0.5.
- Effects differ by model and genre. Opus tricolons reach d 0.95, Sonnet
  email is 0.04, cta-block is negative. The legacy sample often has the
  opposite sign.
- The all-register 5% false-positive gate (literary and Hansard are
  comma-heavy) leaves thresholds catching 0 to 13% of AI blurbs.
- The edit pass ("sound more human") does not remove the tricolon effect
  but shrinks sentence CV and coordination.

The diagnostics stay available (`shapeOf`, `shapeMoves`) and are not enforced.
Reopening needs a new feature set or a new baseline version, not a looser gate.

To resume from the craft package directory after model access returns:

```bash
corepack pnpm build
node scripts/shape/generate.mjs --provider claude --parallel 4
node scripts/shape/measure.mjs --boot 300
```

Generation is resumable and now returns a failing exit code for incomplete
runs. Missing OpenAI or Gemini keys produce explicit errors; those providers
also need models configured in `briefs.json` before use.

Verification: 847 non-browser tests, typecheck and build passed. The purity
test covers the exported feature functions. The existing DD content pack copy
gate did not pass: its nine Doman Digital data files have 19 pre-existing
blocking findings. No shape rule was involved, and this change does not edit
that content or relax the gate.

Work remaining for Phase P (superseded by the result above): complete generation, rerun measurement, review
survivors, add only accepted tells with independent flag/pass fixtures,
document their review tier, then bump the catalogue and update claude-kit.
If no feature passes, publish the negative result and keep the diagnostics
separate from copy enforcement.

## Lexical and specificity follow-up (2026-09-29)

`scripts/shape/measure.mjs --lexical` measures word and specificity features
(`src/character/lexical.ts`) on the same AI set and on new frozen lexical
baselines (`human/*-lexical-v1.json`; counts only, no text). Report:
`report-lexical.md`. Result: no feature ships, and no tell is added.

- craft's own tell-word rate: d 0.28 against marketing and 0.07 against email;
  the published "delve"-era words (Juzek and Ward) appear in 0% of current
  Claude blurbs. Models change what they over-use between generations, so a
  word list is a dated measurement, not a fact about models.
- Specificity does not separate the sets. AI blurbs are not less specific
  than small-business copy (the `generic` flag is *more* common in human
  marketing copy, d -0.86) and use more trade nouns. Caveat: the briefs give
  the model concrete details; a vague brief would test something else.
- Closest word: "tailored to your", in 5.6% of matched AI blurbs and 0.6% of
  human marketing blurbs (limit 0.5%). Not adopted.
- The matched-register table in the report shows what each threshold would
  catch if only the matched register had to hold at 5%. The best is
  `tradePer100` at 10% (marketing) with 2.4% false positives, too weak to
  ship. The 5% all-register rule was not changed.
