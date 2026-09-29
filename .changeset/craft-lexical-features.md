---
"@domandigital/craft": minor
---

Lexical and specificity measurement. New exports `lexicalOf`, `vocabulary`, `vocabularyCounts`, `LEXICAL_FEATURES`, `STUDY_WORDS` and the `LexicalFeatures` and `StudyWord` types compute how often a block uses craft's own tell words and the published excess-use words, and how particular it is (names, places, figures, trade nouns). Every study word carries its source paper. Measured against the frozen human baselines and the Claude set, no feature met the ship rule, so no tell is added and `CATALOGUE_VERSION` is unchanged; the result is in `calibration/copy-shape/report-lexical.md`.
