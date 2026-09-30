# Register separation: human baselines against each other

Measured 2026-09-30 by `scripts/shape/registers.mjs`, 200 bootstrap resamples. Generated; do not edit by hand.

A feature separates two registers when |d| >= 0.8 on the tuning half, the bootstrap bound nearest zero is at least 0.5, and the holdout d has the same sign and |d| >= 0.8.

## Samples

| Register | Source | Tuning | Holdout |
| --- | --- | ---: | ---: |
| business-email | enron | 6000 | 6000 |
| explanatory | hc3-human | 6000 | 6000 |
| institutional | hansard-commons | 6000 | 6000 |
| literary | gutenberg | 6000 | 6000 |
| marketing | wayback-uk-sme | 338 | 372 |

## Features that pass, per register pair: blurb

| Pair | Passing features (tuning d / holdout d) |
| --- | --- |
| business-email vs explanatory | `firstPersonPer100` 1.25 / 1.34; `hardPer100` 0.88 / 0.88; `specificsPer100` 0.88 / 0.88 |
| business-email vs institutional | none |
| business-email vs literary | `commasPer100` -1.33 / -1.54; `commasPerSentence` -1.29 / -1.38; `clauseDepth` -1.22 / -1.27; `hardPer100` 0.85 / 0.98; `specificsPer100` 0.84 / 0.96 |
| business-email vs marketing | `pronounOpenerShare` -1.06 / -1.05; `tricolons` -0.97 / -0.84; `coordinationRate` -0.95 / -0.84 |
| explanatory vs institutional | `names` -0.84 / -0.87 |
| explanatory vs literary | `commasPer100` -1.10 / -1.14; `commasPerSentence` -0.94 / -0.92 |
| explanatory vs marketing | `pronounOpenerShare` -1.32 / -1.17; `coordinationRate` -0.85 / -0.83 |
| institutional vs literary | `commasPer100` -1.10 / -1.20; `nominalisationRate` 0.91 / 0.92 |
| institutional vs marketing | `tradePer100` -1.76 / -1.34; `pronounOpenerShare` -1.03 / -1.02; `coordinationRate` -0.99 / -0.93 |
| literary vs marketing | `figures` -1.50 / -2.27; `pronounOpenerShare` -1.28 / -1.21; `coordinationRate` -1.05 / -1.01; `nominalisationRate` -1.01 / -1.07; `commasPer100` 0.98 / 1.14 |

## Profile candidates, per register: blurb

A feature is a candidate for a register's profile when it separates that register from at least one other. The band is the tuning half's 10th, 50th and 90th percentile.

### business-email

| Feature | Band (p10 / p50 / p90) | Separates from |
| --- | --- | --- |
| `hardPer100` | 0.00 / 5.97 / 15.38 | explanatory, literary |
| `specificsPer100` | 0.00 / 6.10 / 15.60 | explanatory, literary |
| `firstPersonPer100` | 0.00 / 5.56 / 11.43 | explanatory |
| `tricolons` | 0.00 / 0.00 / 0.00 | marketing |
| `clauseDepth` | 0.00 / 0.50 / 1.50 | literary |
| `pronounOpenerShare` | 0.00 / 0.00 / 0.33 | marketing |
| `commasPerSentence` | 0.00 / 0.33 / 1.17 | literary |
| `commasPer100` | 0.00 / 2.86 / 7.41 | literary |
| `coordinationRate` | 0.00 / 0.00 / 3.13 | marketing |

### explanatory

| Feature | Band (p10 / p50 / p90) | Separates from |
| --- | --- | --- |
| `hardPer100` | 0.00 / 1.72 / 7.69 | business-email |
| `specificsPer100` | 0.00 / 1.90 / 7.80 | business-email |
| `names` | 0.00 / 1.00 / 4.00 | institutional |
| `firstPersonPer100` | 0.00 / 0.00 / 4.76 | business-email |
| `pronounOpenerShare` | 0.00 / 0.00 / 0.20 | marketing |
| `commasPerSentence` | 0.00 / 0.67 / 1.60 | literary |
| `commasPer100` | 0.00 / 3.85 / 8.11 | literary |
| `coordinationRate` | 0.00 / 0.00 / 2.94 | marketing |

### institutional

| Feature | Band (p10 / p50 / p90) | Separates from |
| --- | --- | --- |
| `tradePer100` | 0.00 / 0.00 / 0.00 | marketing |
| `names` | 1.00 / 3.00 / 7.00 | explanatory |
| `nominalisationRate` | 0.00 / 3.13 / 7.02 | literary |
| `pronounOpenerShare` | 0.00 / 0.00 / 0.29 | marketing |
| `commasPer100` | 1.54 / 4.17 / 7.69 | literary |
| `coordinationRate` | 0.00 / 0.73 / 2.70 | marketing |

### literary

| Feature | Band (p10 / p50 / p90) | Separates from |
| --- | --- | --- |
| `commasPer100` | 3.33 / 7.89 / 13.33 | business-email, explanatory, institutional, marketing |
| `nominalisationRate` | 0.00 / 0.82 / 4.00 | institutional, marketing |
| `commasPerSentence` | 0.50 / 1.50 / 3.33 | business-email, explanatory |
| `hardPer100` | 0.00 / 2.70 / 7.14 | business-email |
| `specificsPer100` | 0.00 / 2.90 / 7.30 | business-email |
| `figures` | 0.00 / 0.00 / 0.00 | marketing |
| `clauseDepth` | 0.60 / 1.75 / 4.00 | business-email |
| `pronounOpenerShare` | 0.00 / 0.00 / 0.20 | marketing |
| `coordinationRate` | 0.00 / 0.00 / 2.78 | marketing |

### marketing

| Feature | Band (p10 / p50 / p90) | Separates from |
| --- | --- | --- |
| `pronounOpenerShare` | 0.00 / 0.00 / 0.67 | business-email, explanatory, institutional, literary |
| `coordinationRate` | 0.00 / 2.08 / 5.06 | business-email, explanatory, institutional, literary |
| `tradePer100` | 0.00 / 0.00 / 2.70 | institutional |
| `figures` | 0.00 / 0.00 / 2.00 | literary |
| `tricolons` | 0.00 / 0.00 / 1.00 | business-email |
| `nominalisationRate` | 0.00 / 2.63 / 7.69 | literary |
| `commasPer100` | 0.00 / 3.70 / 9.09 | literary |

## Features that pass, per register pair: document (5 paragraphs)

| Pair | Passing features (tuning d / holdout d) |
| --- | --- |
| business-email vs explanatory | `firstPersonPer100` 2.91 / 2.95; `hardPer100` 1.99 / 2.00; `specificsPer100` 1.96 / 1.97; `clauseDepth` -1.49 / -1.72; `generic` -1.45 / -1.36; `meanSentenceWords` -1.43 / -1.42; `meanWordLength` -1.42 / -1.25; `commasPerSentence` -1.08 / -1.39; `names` 1.08 / 1.10; `impersonalOpenerShare` -0.90 / -0.99 |
| business-email vs institutional | `commasPerSentence` -1.70 / -2.08; `clauseDepth` -1.57 / -1.94; `nominalisationRate` -1.11 / -0.90; `specificsPer100` 1.01 / 0.91; `hardPer100` 0.99 / 0.89; `names` -0.90 / -1.01; `commasPer100` -0.89 / -1.28; `tricolons` -0.87 / -0.94; `skeletonRepeat` -0.84 / -1.06 |
| business-email vs literary | `commasPer100` -2.94 / -3.49; `commasPerSentence` -2.88 / -3.18; `clauseDepth` -2.78 / -2.98; `hardPer100` 1.93 / 2.18; `specificsPer100` 1.88 / 2.13; `figures` 1.76 / 1.61; `meanSentenceWords` -1.64 / -1.54; `tricolons` -1.32 / -1.38; `participialRate` -1.07 / -1.33 |
| business-email vs marketing | `coordinationRate` -1.77 / -1.60; `pronounOpenerShare` -1.59 / -1.54; `tricolons` -1.30 / -1.27; `tradePer100` -1.19 / -0.91; `commasPerSentence` -1.04 / -0.83; `nominalisationRate` -0.92 / -0.85; `sentenceCv` 0.85 / 1.51 |
| explanatory vs institutional | `names` -1.90 / -2.02; `generic` 1.76 / 1.77; `hardPer100` -1.45 / -1.54; `specificsPer100` -1.38 / -1.48; `nominalisationRate` -1.33 / -1.41 |
| explanatory vs literary | `commasPer100` -2.44 / -2.62; `commasPerSentence` -2.08 / -2.14; `firstPersonPer100` -1.95 / -1.75; `clauseDepth` -1.64 / -1.65; `meanWordLength` 1.48 / 1.45; `figures` 1.30 / 1.26 |
| explanatory vs marketing | `pronounOpenerShare` -1.80 / -1.63; `coordinationRate` -1.54 / -1.46; `tradePer100` -1.29 / -1.01; `specificsPer100` -1.13 / -1.28; `nominalisationRate` -1.07 / -1.23; `hardPer100` -0.89 / -1.12 |
| institutional vs literary | `commasPer100` -2.45 / -2.71; `nominalisationRate` 2.03 / 2.05; `commasPerSentence` -1.68 / -1.72; `figures` 1.65 / 1.61; `clauseDepth` -1.61 / -1.58; `names` 1.45 / 2.05; `hardPer100` 1.37 / 1.84; `specificsPer100` 1.27 / 1.74; `generic` -0.90 / -1.29; `participialRate` -0.82 / -0.90 |
| institutional vs marketing | `coordinationRate` -1.65 / -1.58; `tradePer100` -1.54 / -1.32; `pronounOpenerShare` -1.54 / -1.51; `generic` -1.43 / -0.89; `sentenceCv` 1.27 / 1.55; `names` 1.20 / 1.16 |
| literary vs marketing | `commasPer100` 2.31 / 2.51; `clauseDepth` 2.00 / 1.85; `commasPerSentence` 1.83 / 1.74; `pronounOpenerShare` -1.80 / -1.69; `coordinationRate` -1.79 / -1.76; `nominalisationRate` -1.58 / -1.71; `figures` -1.52 / -1.89; `tradePer100` -1.15 / -0.85; `sentenceCv` 1.04 / 1.34; `specificsPer100` -1.01 / -1.41 |

## Profile candidates, per register: document (5 paragraphs)

A feature is a candidate for a register's profile when it separates that register from at least one other. The band is the tuning half's 10th, 50th and 90th percentile.

### business-email

| Feature | Band (p10 / p50 / p90) | Separates from |
| --- | --- | --- |
| `commasPerSentence` | 0.20 / 0.47 / 0.83 | explanatory, institutional, literary, marketing |
| `hardPer100` | 4.29 / 7.13 / 11.31 | explanatory, institutional, literary |
| `specificsPer100` | 4.22 / 7.34 / 11.46 | explanatory, institutional, literary |
| `tricolons` | 0.00 / 0.00 / 0.20 | institutional, literary, marketing |
| `clauseDepth` | 0.36 / 0.67 / 1.11 | explanatory, institutional, literary |
| `names` | 1.20 / 2.40 / 3.60 | explanatory, institutional |
| `meanSentenceWords` | 11.42 / 14.25 / 17.87 | explanatory, literary |
| `nominalisationRate` | 0.63 / 1.93 / 3.83 | institutional, marketing |
| `commasPer100` | 1.42 / 3.19 / 5.15 | institutional, literary |
| `tradePer100` | 0.00 / 0.00 / 0.59 | marketing |
| `generic` | 0.00 / 0.00 / 0.20 | explanatory |
| `figures` | 0.20 / 0.80 / 1.80 | literary |
| `firstPersonPer100` | 3.72 / 5.97 / 8.38 | explanatory |
| `meanWordLength` | 3.86 / 4.16 / 4.46 | explanatory |
| `sentenceCv` | 0.34 / 0.47 / 0.60 | marketing |
| `pronounOpenerShare` | 0.00 / 0.05 / 0.15 | marketing |
| `impersonalOpenerShare` | 0.00 / 0.00 / 0.07 | explanatory |
| `participialRate` | 0.00 / 0.00 / 0.05 | literary |
| `coordinationRate` | 0.00 / 0.74 / 1.71 | marketing |
| `skeletonRepeat` | 0.00 / 0.02 / 0.06 | institutional |

### explanatory

| Feature | Band (p10 / p50 / p90) | Separates from |
| --- | --- | --- |
| `hardPer100` | 0.99 / 2.62 / 5.17 | business-email, institutional, marketing |
| `specificsPer100` | 1.04 / 2.70 / 5.36 | business-email, institutional, marketing |
| `generic` | 0.00 / 0.40 / 0.60 | business-email, institutional |
| `names` | 0.40 / 1.20 / 2.60 | business-email, institutional |
| `firstPersonPer100` | 0.27 / 1.28 / 3.11 | business-email, literary |
| `meanWordLength` | 4.21 / 4.47 / 4.75 | business-email, literary |
| `clauseDepth` | 0.78 / 1.19 / 1.73 | business-email, literary |
| `nominalisationRate` | 0.77 / 1.82 / 3.42 | institutional, marketing |
| `commasPerSentence` | 0.45 / 0.77 / 1.20 | business-email, literary |
| `tradePer100` | 0.00 / 0.00 / 0.43 | marketing |
| `figures` | 0.00 / 0.40 / 1.40 | literary |
| `meanSentenceWords` | 14.97 / 18.31 / 22.53 | business-email |
| `pronounOpenerShare` | 0.00 / 0.03 / 0.12 | marketing |
| `impersonalOpenerShare` | 0.00 / 0.04 / 0.14 | business-email |
| `commasPer100` | 2.58 / 4.16 / 6.09 | literary |
| `coordinationRate` | 0.32 / 0.97 / 1.86 | marketing |

### institutional

| Feature | Band (p10 / p50 / p90) | Separates from |
| --- | --- | --- |
| `names` | 2.00 / 3.20 / 4.80 | business-email, explanatory, literary, marketing |
| `hardPer100` | 3.41 / 5.14 / 7.30 | business-email, explanatory, literary |
| `specificsPer100` | 3.36 / 5.20 / 7.40 | business-email, explanatory, literary |
| `generic` | 0.00 / 0.00 / 0.20 | explanatory, literary, marketing |
| `nominalisationRate` | 1.99 / 3.39 / 5.01 | business-email, explanatory, literary |
| `clauseDepth` | 0.79 / 1.23 / 1.76 | business-email, literary |
| `commasPerSentence` | 0.61 / 0.96 / 1.38 | business-email, literary |
| `commasPer100` | 3.03 / 4.43 / 5.94 | business-email, literary |
| `tradePer100` | 0.00 / 0.00 / 0.16 | marketing |
| `figures` | 0.00 / 0.60 / 1.40 | literary |
| `tricolons` | 0.00 / 0.20 / 0.60 | business-email |
| `sentenceCv` | 0.39 / 0.51 / 0.64 | marketing |
| `pronounOpenerShare` | 0.00 / 0.05 / 0.16 | marketing |
| `participialRate` | 0.00 / 0.00 / 0.10 | literary |
| `coordinationRate` | 0.32 / 0.95 / 1.75 | marketing |
| `skeletonRepeat` | 0.02 / 0.05 / 0.09 | business-email |

### literary

| Feature | Band (p10 / p50 / p90) | Separates from |
| --- | --- | --- |
| `figures` | 0.00 / 0.00 / 0.00 | business-email, explanatory, institutional, marketing |
| `clauseDepth` | 1.33 / 2.02 / 2.93 | business-email, explanatory, institutional, marketing |
| `commasPerSentence` | 1.07 / 1.67 / 2.44 | business-email, explanatory, institutional, marketing |
| `commasPer100` | 6.00 / 8.10 / 10.59 | business-email, explanatory, institutional, marketing |
| `specificsPer100` | 1.80 / 3.28 / 5.24 | business-email, institutional, marketing |
| `hardPer100` | 1.63 / 3.08 / 5.15 | business-email, institutional |
| `nominalisationRate` | 0.44 / 1.33 / 2.49 | institutional, marketing |
| `participialRate` | 0.00 / 0.07 / 0.20 | business-email, institutional |
| `tradePer100` | 0.00 / 0.00 / 0.51 | marketing |
| `generic` | 0.00 / 0.20 / 0.40 | institutional |
| `names` | 1.00 / 1.80 / 3.00 | institutional |
| `meanSentenceWords` | 15.08 / 20.35 / 27.03 | business-email |
| `firstPersonPer100` | 2.21 / 4.67 / 7.49 | explanatory |
| `meanWordLength` | 3.96 / 4.19 / 4.41 | explanatory |
| `tricolons` | 0.00 / 0.40 / 0.80 | business-email |
| `sentenceCv` | 0.37 / 0.48 / 0.62 | marketing |
| `pronounOpenerShare` | 0.00 / 0.03 / 0.12 | marketing |
| `coordinationRate` | 0.19 / 0.81 / 1.63 | marketing |

### marketing

| Feature | Band (p10 / p50 / p90) | Separates from |
| --- | --- | --- |
| `tradePer100` | 0.00 / 0.59 / 1.51 | business-email, explanatory, institutional, literary |
| `pronounOpenerShare` | 0.07 / 0.21 / 0.40 | business-email, explanatory, institutional, literary |
| `coordinationRate` | 1.09 / 2.24 / 3.47 | business-email, explanatory, institutional, literary |
| `sentenceCv` | 0.27 / 0.38 / 0.52 | business-email, institutional, literary |
| `nominalisationRate` | 1.58 / 3.22 / 5.53 | business-email, explanatory, literary |
| `specificsPer100` | 2.54 / 5.20 / 9.18 | explanatory, literary |
| `commasPerSentence` | 0.40 / 0.80 / 1.35 | business-email, literary |
| `hardPer100` | 1.90 / 4.55 / 8.23 | explanatory |
| `generic` | 0.00 / 0.20 / 0.60 | institutional |
| `figures` | 0.00 / 0.40 / 1.00 | literary |
| `names` | 0.60 / 1.80 / 3.40 | institutional |
| `tricolons` | 0.00 / 0.40 / 0.80 | business-email |
| `clauseDepth` | 0.57 / 0.97 / 1.56 | literary |
| `commasPer100` | 2.17 / 4.09 / 6.43 | literary |

## Every pair and feature

| Level | Feature | Pair | d tuning | bound | d holdout | Passes |
| --- | --- | --- | ---: | ---: | ---: | --- |
| blurb | `listRate` | business-email vs explanatory | -0.03 | -0.06 | -0.05 | no |
| blurb | `listRate` | business-email vs institutional | -0.14 | 0.08 | -0.17 | no |
| blurb | `listRate` | business-email vs literary | -0.01 | -0.07 | -0.02 | no |
| blurb | `listRate` | business-email vs marketing | -0.62 | 0.31 | -0.54 | no |
| blurb | `listRate` | explanatory vs institutional | -0.12 | 0.05 | -0.11 | no |
| blurb | `listRate` | explanatory vs literary | 0.02 | -0.07 | 0.03 | no |
| blurb | `listRate` | explanatory vs marketing | -0.60 | 0.31 | -0.41 | no |
| blurb | `listRate` | institutional vs literary | 0.13 | 0.06 | 0.14 | no |
| blurb | `listRate` | institutional vs marketing | -0.36 | 0.14 | -0.26 | no |
| blurb | `listRate` | literary vs marketing | -0.63 | 0.30 | -0.49 | no |
| blurb | `studyRate` | business-email vs explanatory | -0.03 | 0.00 | -0.02 | no |
| blurb | `studyRate` | business-email vs institutional | -0.03 | 0.00 | -0.03 | no |
| blurb | `studyRate` | business-email vs literary | -0.03 | 0.00 | -0.05 | no |
| blurb | `studyRate` | business-email vs marketing | 0.00 | 0.00 | 0.00 | no |
| blurb | `studyRate` | explanatory vs institutional | 0.01 | -0.05 | 0.00 | no |
| blurb | `studyRate` | explanatory vs literary | -0.01 | -0.05 | -0.04 | no |
| blurb | `studyRate` | explanatory vs marketing | 0.02 | 0.00 | 0.02 | no |
| blurb | `studyRate` | institutional vs literary | -0.02 | -0.05 | -0.04 | no |
| blurb | `studyRate` | institutional vs marketing | 0.02 | 0.00 | 0.02 | no |
| blurb | `studyRate` | literary vs marketing | 0.02 | 0.00 | 0.04 | no |
| blurb | `hardPer100` | business-email vs explanatory | 0.88 | 0.78 | 0.88 | yes |
| blurb | `hardPer100` | business-email vs institutional | 0.43 | 0.37 | 0.40 | no |
| blurb | `hardPer100` | business-email vs literary | 0.85 | 0.78 | 0.98 | yes |
| blurb | `hardPer100` | business-email vs marketing | 0.40 | 0.30 | 0.34 | no |
| blurb | `hardPer100` | explanatory vs institutional | -0.64 | 0.55 | -0.67 | no |
| blurb | `hardPer100` | explanatory vs literary | -0.10 | 0.01 | 0.05 | no |
| blurb | `hardPer100` | explanatory vs marketing | -0.52 | 0.28 | -0.62 | no |
| blurb | `hardPer100` | institutional vs literary | 0.60 | 0.52 | 0.82 | no |
| blurb | `hardPer100` | institutional vs marketing | 0.09 | -0.06 | 0.02 | no |
| blurb | `hardPer100` | literary vs marketing | -0.51 | 0.26 | -0.86 | no |
| blurb | `tradePer100` | business-email vs explanatory | 0.04 | -0.04 | 0.03 | no |
| blurb | `tradePer100` | business-email vs institutional | 0.21 | 0.16 | 0.21 | no |
| blurb | `tradePer100` | business-email vs literary | -0.03 | -0.06 | -0.04 | no |
| blurb | `tradePer100` | business-email vs marketing | -0.83 | 0.55 | -0.52 | no |
| blurb | `tradePer100` | explanatory vs institutional | 0.21 | 0.14 | 0.22 | no |
| blurb | `tradePer100` | explanatory vs literary | -0.08 | 0.01 | -0.09 | no |
| blurb | `tradePer100` | explanatory vs marketing | -1.08 | 0.67 | -0.69 | no |
| blurb | `tradePer100` | institutional vs literary | -0.27 | 0.22 | -0.31 | no |
| blurb | `tradePer100` | institutional vs marketing | -1.76 | 1.05 | -1.34 | yes |
| blurb | `tradePer100` | literary vs marketing | -0.85 | 0.49 | -0.55 | no |
| blurb | `specificsPer100` | business-email vs explanatory | 0.88 | 0.78 | 0.88 | yes |
| blurb | `specificsPer100` | business-email vs institutional | 0.45 | 0.39 | 0.42 | no |
| blurb | `specificsPer100` | business-email vs literary | 0.84 | 0.76 | 0.96 | yes |
| blurb | `specificsPer100` | business-email vs marketing | 0.31 | 0.20 | 0.28 | no |
| blurb | `specificsPer100` | explanatory vs institutional | -0.62 | 0.53 | -0.65 | no |
| blurb | `specificsPer100` | explanatory vs literary | -0.12 | 0.04 | 0.03 | no |
| blurb | `specificsPer100` | explanatory vs marketing | -0.67 | 0.43 | -0.71 | no |
| blurb | `specificsPer100` | institutional vs literary | 0.56 | 0.47 | 0.77 | no |
| blurb | `specificsPer100` | institutional vs marketing | -0.09 | -0.12 | -0.11 | no |
| blurb | `specificsPer100` | literary vs marketing | -0.67 | 0.39 | -0.95 | no |
| blurb | `generic` | business-email vs explanatory | -0.62 | 0.56 | -0.61 | no |
| blurb | `generic` | business-email vs institutional | 0.16 | 0.06 | 0.17 | no |
| blurb | `generic` | business-email vs literary | -0.24 | 0.19 | -0.40 | no |
| blurb | `generic` | business-email vs marketing | -0.58 | 0.38 | -0.22 | no |
| blurb | `generic` | explanatory vs institutional | 0.78 | 0.70 | 0.78 | no |
| blurb | `generic` | explanatory vs literary | 0.38 | 0.28 | 0.21 | no |
| blurb | `generic` | explanatory vs marketing | 0.13 | -0.02 | 0.37 | no |
| blurb | `generic` | institutional vs literary | -0.40 | 0.31 | -0.56 | no |
| blurb | `generic` | institutional vs marketing | -0.88 | 0.59 | -0.46 | no |
| blurb | `generic` | literary vs marketing | -0.25 | 0.10 | 0.18 | no |
| blurb | `figures` | business-email vs explanatory | 0.22 | 0.13 | 0.16 | no |
| blurb | `figures` | business-email vs institutional | 0.17 | 0.10 | 0.11 | no |
| blurb | `figures` | business-email vs literary | 0.79 | 0.72 | 0.71 | no |
| blurb | `figures` | business-email vs marketing | 0.28 | 0.20 | 0.05 | no |
| blurb | `figures` | explanatory vs institutional | -0.06 | -0.02 | -0.07 | no |
| blurb | `figures` | explanatory vs literary | 0.57 | 0.51 | 0.57 | no |
| blurb | `figures` | explanatory vs marketing | 0.08 | -0.02 | -0.11 | no |
| blurb | `figures` | institutional vs literary | 0.72 | 0.68 | 0.73 | no |
| blurb | `figures` | institutional vs marketing | 0.15 | 0.05 | -0.05 | no |
| blurb | `figures` | literary vs marketing | -1.50 | 0.83 | -2.27 | yes |
| blurb | `names` | business-email vs explanatory | 0.46 | 0.35 | 0.47 | no |
| blurb | `names` | business-email vs institutional | -0.40 | 0.33 | -0.43 | no |
| blurb | `names` | business-email vs literary | 0.24 | 0.16 | 0.47 | no |
| blurb | `names` | business-email vs marketing | 0.21 | 0.01 | 0.13 | no |
| blurb | `names` | explanatory vs institutional | -0.84 | 0.72 | -0.87 | yes |
| blurb | `names` | explanatory vs literary | -0.27 | 0.17 | -0.06 | no |
| blurb | `names` | explanatory vs marketing | -0.25 | 0.10 | -0.34 | no |
| blurb | `names` | institutional vs literary | 0.65 | 0.56 | 0.91 | no |
| blurb | `names` | institutional vs marketing | 0.55 | 0.38 | 0.51 | no |
| blurb | `names` | literary vs marketing | -0.01 | -0.17 | -0.38 | no |
| blurb | `meanSentenceWords` | business-email vs explanatory | -0.60 | 0.54 | -0.63 | no |
| blurb | `meanSentenceWords` | business-email vs literary | -0.72 | 0.67 | -0.67 | no |
| blurb | `meanSentenceWords` | explanatory vs literary | -0.26 | 0.18 | -0.19 | no |
| blurb | `contractionsPer100` | business-email vs explanatory | -0.18 | 0.10 | -0.33 | no |
| blurb | `contractionsPer100` | business-email vs literary | 0.21 | 0.09 | -0.01 | no |
| blurb | `contractionsPer100` | explanatory vs literary | 0.40 | 0.29 | 0.28 | no |
| blurb | `youPer100` | business-email vs explanatory | 0.01 | -0.07 | 0.04 | no |
| blurb | `youPer100` | business-email vs literary | 0.17 | 0.10 | 0.20 | no |
| blurb | `youPer100` | explanatory vs literary | 0.16 | 0.07 | 0.16 | no |
| blurb | `firstPersonPer100` | business-email vs explanatory | 1.25 | 1.18 | 1.34 | yes |
| blurb | `firstPersonPer100` | business-email vs literary | 0.26 | 0.21 | 0.37 | no |
| blurb | `firstPersonPer100` | explanatory vs literary | -0.87 | 0.80 | -0.77 | no |
| blurb | `passiveShare` | business-email vs explanatory | -0.27 | 0.21 | -0.37 | no |
| blurb | `passiveShare` | business-email vs literary | -0.20 | 0.16 | -0.29 | no |
| blurb | `passiveShare` | explanatory vs literary | 0.06 | -0.02 | 0.05 | no |
| blurb | `meanWordLength` | business-email vs explanatory | -0.63 | 0.55 | -0.55 | no |
| blurb | `meanWordLength` | business-email vs literary | -0.06 | -0.01 | 0.02 | no |
| blurb | `meanWordLength` | explanatory vs literary | 0.65 | 0.59 | 0.64 | no |
| blurb | `tricolons` | business-email vs explanatory | -0.32 | 0.23 | -0.33 | no |
| blurb | `tricolons` | business-email vs institutional | -0.40 | 0.29 | -0.40 | no |
| blurb | `tricolons` | business-email vs literary | -0.59 | 0.52 | -0.62 | no |
| blurb | `tricolons` | business-email vs marketing | -0.97 | 0.64 | -0.84 | yes |
| blurb | `tricolons` | explanatory vs institutional | -0.07 | -0.05 | -0.07 | no |
| blurb | `tricolons` | explanatory vs literary | -0.31 | 0.22 | -0.33 | no |
| blurb | `tricolons` | explanatory vs marketing | -0.38 | 0.20 | -0.27 | no |
| blurb | `tricolons` | institutional vs literary | -0.24 | 0.16 | -0.26 | no |
| blurb | `tricolons` | institutional vs marketing | -0.29 | 0.13 | -0.19 | no |
| blurb | `tricolons` | literary vs marketing | -0.01 | -0.11 | 0.09 | no |
| blurb | `parallelTriads` | business-email vs explanatory | -0.09 | 0.01 | -0.08 | no |
| blurb | `parallelTriads` | business-email vs institutional | -0.15 | 0.09 | -0.17 | no |
| blurb | `parallelTriads` | business-email vs literary | -0.17 | 0.11 | -0.18 | no |
| blurb | `parallelTriads` | business-email vs marketing | -0.25 | 0.01 | -0.16 | no |
| blurb | `parallelTriads` | explanatory vs institutional | -0.07 | -0.01 | -0.10 | no |
| blurb | `parallelTriads` | explanatory vs literary | -0.09 | 0.01 | -0.12 | no |
| blurb | `parallelTriads` | explanatory vs marketing | -0.06 | -0.06 | -0.01 | no |
| blurb | `parallelTriads` | institutional vs literary | -0.02 | -0.06 | -0.01 | no |
| blurb | `parallelTriads` | institutional vs marketing | 0.02 | -0.15 | 0.08 | no |
| blurb | `parallelTriads` | literary vs marketing | 0.04 | -0.10 | 0.09 | no |
| blurb | `stackedConditionals` | business-email vs explanatory | -0.07 | -0.01 | -0.12 | no |
| blurb | `stackedConditionals` | business-email vs institutional | -0.05 | -0.02 | -0.07 | no |
| blurb | `stackedConditionals` | business-email vs literary | -0.07 | 0.01 | -0.08 | no |
| blurb | `stackedConditionals` | business-email vs marketing | -0.01 | -0.06 | 0.06 | no |
| blurb | `stackedConditionals` | explanatory vs institutional | 0.02 | -0.10 | 0.06 | no |
| blurb | `stackedConditionals` | explanatory vs literary | -0.00 | -0.06 | 0.04 | no |
| blurb | `stackedConditionals` | explanatory vs marketing | 0.06 | -0.04 | 0.12 | no |
| blurb | `stackedConditionals` | institutional vs literary | -0.02 | -0.07 | -0.01 | no |
| blurb | `stackedConditionals` | institutional vs marketing | 0.04 | -0.04 | 0.10 | no |
| blurb | `stackedConditionals` | literary vs marketing | 0.06 | -0.05 | 0.10 | no |
| blurb | `clauseDepth` | business-email vs explanatory | -0.64 | 0.58 | -0.78 | no |
| blurb | `clauseDepth` | business-email vs institutional | -0.68 | 0.61 | -0.84 | no |
| blurb | `clauseDepth` | business-email vs literary | -1.22 | 1.16 | -1.27 | yes |
| blurb | `clauseDepth` | business-email vs marketing | -0.42 | 0.29 | -0.49 | no |
| blurb | `clauseDepth` | explanatory vs institutional | -0.02 | -0.05 | -0.03 | no |
| blurb | `clauseDepth` | explanatory vs literary | -0.73 | 0.64 | -0.71 | no |
| blurb | `clauseDepth` | explanatory vs marketing | 0.24 | 0.12 | 0.28 | no |
| blurb | `clauseDepth` | institutional vs literary | -0.72 | 0.63 | -0.69 | no |
| blurb | `clauseDepth` | institutional vs marketing | 0.27 | 0.14 | 0.32 | no |
| blurb | `clauseDepth` | literary vs marketing | 0.76 | 0.68 | 0.75 | no |
| blurb | `sentenceCv` | business-email vs explanatory | 0.12 | 0.04 | 0.33 | no |
| blurb | `sentenceCv` | business-email vs institutional | -0.18 | 0.11 | 0.02 | no |
| blurb | `sentenceCv` | business-email vs literary | -0.09 | 0.01 | 0.08 | no |
| blurb | `sentenceCv` | business-email vs marketing | 0.38 | 0.20 | 0.55 | no |
| blurb | `sentenceCv` | explanatory vs institutional | -0.31 | 0.23 | -0.33 | no |
| blurb | `sentenceCv` | explanatory vs literary | -0.21 | 0.12 | -0.26 | no |
| blurb | `sentenceCv` | explanatory vs marketing | 0.30 | 0.15 | 0.33 | no |
| blurb | `sentenceCv` | institutional vs literary | 0.09 | 0.00 | 0.06 | no |
| blurb | `sentenceCv` | institutional vs marketing | 0.56 | 0.40 | 0.61 | no |
| blurb | `sentenceCv` | literary vs marketing | 0.46 | 0.30 | 0.52 | no |
| blurb | `hedgeRate` | business-email vs explanatory | -0.14 | 0.09 | -0.16 | no |
| blurb | `hedgeRate` | business-email vs institutional | 0.13 | 0.04 | 0.14 | no |
| blurb | `hedgeRate` | business-email vs literary | -0.10 | 0.03 | -0.05 | no |
| blurb | `hedgeRate` | business-email vs marketing | 0.24 | 0.16 | -0.01 | no |
| blurb | `hedgeRate` | explanatory vs institutional | 0.30 | 0.22 | 0.32 | no |
| blurb | `hedgeRate` | explanatory vs literary | 0.04 | -0.03 | 0.11 | no |
| blurb | `hedgeRate` | explanatory vs marketing | 0.39 | 0.32 | 0.15 | no |
| blurb | `hedgeRate` | institutional vs literary | -0.26 | 0.16 | -0.21 | no |
| blurb | `hedgeRate` | institutional vs marketing | 0.18 | 0.07 | -0.19 | no |
| blurb | `hedgeRate` | literary vs marketing | 0.35 | 0.25 | 0.04 | no |
| blurb | `hedgedClose` | business-email vs explanatory | -0.13 | 0.06 | -0.11 | no |
| blurb | `hedgedClose` | business-email vs institutional | 0.12 | 0.05 | 0.08 | no |
| blurb | `hedgedClose` | business-email vs literary | -0.06 | -0.04 | -0.00 | no |
| blurb | `hedgedClose` | business-email vs marketing | 0.23 | 0.15 | 0.10 | no |
| blurb | `hedgedClose` | explanatory vs institutional | 0.24 | 0.18 | 0.20 | no |
| blurb | `hedgedClose` | explanatory vs literary | 0.07 | 0.01 | 0.11 | no |
| blurb | `hedgedClose` | explanatory vs marketing | 0.34 | 0.27 | 0.20 | no |
| blurb | `hedgedClose` | institutional vs literary | -0.18 | 0.10 | -0.09 | no |
| blurb | `hedgedClose` | institutional vs marketing | 0.13 | 0.04 | 0.02 | no |
| blurb | `hedgedClose` | literary vs marketing | 0.28 | 0.17 | 0.11 | no |
| blurb | `nominalisationRate` | business-email vs explanatory | 0.05 | -0.04 | 0.16 | no |
| blurb | `nominalisationRate` | business-email vs institutional | -0.50 | 0.42 | -0.40 | no |
| blurb | `nominalisationRate` | business-email vs literary | 0.28 | 0.21 | 0.38 | no |
| blurb | `nominalisationRate` | business-email vs marketing | -0.45 | 0.31 | -0.40 | no |
| blurb | `nominalisationRate` | explanatory vs institutional | -0.60 | 0.50 | -0.63 | no |
| blurb | `nominalisationRate` | explanatory vs literary | 0.26 | 0.17 | 0.26 | no |
| blurb | `nominalisationRate` | explanatory vs marketing | -0.59 | 0.44 | -0.69 | no |
| blurb | `nominalisationRate` | institutional vs literary | 0.91 | 0.83 | 0.92 | yes |
| blurb | `nominalisationRate` | institutional vs marketing | 0.02 | -0.13 | -0.04 | no |
| blurb | `nominalisationRate` | literary vs marketing | -1.01 | 0.77 | -1.07 | yes |
| blurb | `pronounOpenerShare` | business-email vs explanatory | 0.10 | 0.02 | 0.05 | no |
| blurb | `pronounOpenerShare` | business-email vs institutional | -0.04 | -0.03 | -0.03 | no |
| blurb | `pronounOpenerShare` | business-email vs literary | 0.11 | 0.03 | 0.10 | no |
| blurb | `pronounOpenerShare` | business-email vs marketing | -1.06 | 0.75 | -1.05 | yes |
| blurb | `pronounOpenerShare` | explanatory vs institutional | -0.14 | 0.09 | -0.08 | no |
| blurb | `pronounOpenerShare` | explanatory vs literary | 0.01 | -0.08 | 0.05 | no |
| blurb | `pronounOpenerShare` | explanatory vs marketing | -1.32 | 0.95 | -1.17 | yes |
| blurb | `pronounOpenerShare` | institutional vs literary | 0.15 | 0.06 | 0.13 | no |
| blurb | `pronounOpenerShare` | institutional vs marketing | -1.03 | 0.71 | -1.02 | yes |
| blurb | `pronounOpenerShare` | literary vs marketing | -1.28 | 0.91 | -1.21 | yes |
| blurb | `transitionOpenerShare` | business-email vs explanatory | -0.13 | 0.05 | -0.06 | no |
| blurb | `transitionOpenerShare` | business-email vs institutional | -0.12 | 0.04 | -0.06 | no |
| blurb | `transitionOpenerShare` | business-email vs literary | 0.09 | 0.02 | 0.05 | no |
| blurb | `transitionOpenerShare` | business-email vs marketing | -0.17 | -0.01 | 0.01 | no |
| blurb | `transitionOpenerShare` | explanatory vs institutional | 0.01 | -0.07 | -0.00 | no |
| blurb | `transitionOpenerShare` | explanatory vs literary | 0.23 | 0.17 | 0.10 | no |
| blurb | `transitionOpenerShare` | explanatory vs marketing | -0.02 | -0.15 | 0.07 | no |
| blurb | `transitionOpenerShare` | institutional vs literary | 0.21 | 0.16 | 0.11 | no |
| blurb | `transitionOpenerShare` | institutional vs marketing | -0.03 | -0.12 | 0.07 | no |
| blurb | `transitionOpenerShare` | literary vs marketing | -0.35 | 0.10 | -0.03 | no |
| blurb | `impersonalOpenerShare` | business-email vs explanatory | -0.43 | 0.35 | -0.44 | no |
| blurb | `impersonalOpenerShare` | business-email vs institutional | -0.32 | 0.24 | -0.35 | no |
| blurb | `impersonalOpenerShare` | business-email vs literary | -0.11 | 0.04 | -0.09 | no |
| blurb | `impersonalOpenerShare` | business-email vs marketing | -0.22 | -0.02 | -0.04 | no |
| blurb | `impersonalOpenerShare` | explanatory vs institutional | 0.13 | 0.04 | 0.11 | no |
| blurb | `impersonalOpenerShare` | explanatory vs literary | 0.33 | 0.25 | 0.35 | no |
| blurb | `impersonalOpenerShare` | explanatory vs marketing | 0.23 | 0.09 | 0.33 | no |
| blurb | `impersonalOpenerShare` | institutional vs literary | 0.22 | 0.15 | 0.25 | no |
| blurb | `impersonalOpenerShare` | institutional vs marketing | 0.13 | -0.03 | 0.26 | no |
| blurb | `impersonalOpenerShare` | literary vs marketing | -0.08 | -0.09 | 0.05 | no |
| blurb | `commasPerSentence` | business-email vs explanatory | -0.46 | 0.40 | -0.64 | no |
| blurb | `commasPerSentence` | business-email vs institutional | -0.75 | 0.66 | -0.91 | no |
| blurb | `commasPerSentence` | business-email vs literary | -1.29 | 1.21 | -1.38 | yes |
| blurb | `commasPerSentence` | business-email vs marketing | -0.57 | 0.41 | -0.60 | no |
| blurb | `commasPerSentence` | explanatory vs institutional | -0.25 | 0.19 | -0.24 | no |
| blurb | `commasPerSentence` | explanatory vs literary | -0.94 | 0.83 | -0.92 | yes |
| blurb | `commasPerSentence` | explanatory vs marketing | -0.06 | -0.06 | 0.04 | no |
| blurb | `commasPerSentence` | institutional vs literary | -0.76 | 0.67 | -0.76 | no |
| blurb | `commasPerSentence` | institutional vs marketing | 0.19 | 0.05 | 0.26 | no |
| blurb | `commasPerSentence` | literary vs marketing | 0.74 | 0.64 | 0.77 | no |
| blurb | `commasPer100` | business-email vs explanatory | -0.29 | 0.22 | -0.47 | no |
| blurb | `commasPer100` | business-email vs institutional | -0.40 | 0.33 | -0.55 | no |
| blurb | `commasPer100` | business-email vs literary | -1.33 | 1.22 | -1.54 | yes |
| blurb | `commasPer100` | business-email vs marketing | -0.28 | 0.15 | -0.29 | no |
| blurb | `commasPer100` | explanatory vs institutional | -0.09 | 0.01 | -0.03 | no |
| blurb | `commasPer100` | explanatory vs literary | -1.10 | 1.00 | -1.14 | yes |
| blurb | `commasPer100` | explanatory vs marketing | -0.01 | -0.14 | 0.16 | no |
| blurb | `commasPer100` | institutional vs literary | -1.10 | 1.02 | -1.20 | yes |
| blurb | `commasPer100` | institutional vs marketing | 0.10 | -0.04 | 0.24 | no |
| blurb | `commasPer100` | literary vs marketing | 0.98 | 0.88 | 1.14 | yes |
| blurb | `participialRate` | business-email vs explanatory | -0.20 | 0.11 | -0.26 | no |
| blurb | `participialRate` | business-email vs institutional | -0.18 | 0.11 | -0.26 | no |
| blurb | `participialRate` | business-email vs literary | -0.49 | 0.42 | -0.59 | no |
| blurb | `participialRate` | business-email vs marketing | -0.45 | 0.25 | -0.63 | no |
| blurb | `participialRate` | explanatory vs institutional | 0.03 | -0.05 | 0.02 | no |
| blurb | `participialRate` | explanatory vs literary | -0.35 | 0.30 | -0.38 | no |
| blurb | `participialRate` | explanatory vs marketing | -0.17 | 0.04 | -0.18 | no |
| blurb | `participialRate` | institutional vs literary | -0.37 | 0.29 | -0.40 | no |
| blurb | `participialRate` | institutional vs marketing | -0.20 | 0.05 | -0.20 | no |
| blurb | `participialRate` | literary vs marketing | 0.19 | 0.10 | 0.21 | no |
| blurb | `coordinationRate` | business-email vs explanatory | -0.15 | 0.06 | -0.10 | no |
| blurb | `coordinationRate` | business-email vs institutional | -0.12 | 0.03 | -0.07 | no |
| blurb | `coordinationRate` | business-email vs literary | -0.03 | -0.04 | 0.03 | no |
| blurb | `coordinationRate` | business-email vs marketing | -0.95 | 0.72 | -0.84 | yes |
| blurb | `coordinationRate` | explanatory vs institutional | 0.04 | -0.04 | 0.03 | no |
| blurb | `coordinationRate` | explanatory vs literary | 0.13 | 0.06 | 0.14 | no |
| blurb | `coordinationRate` | explanatory vs marketing | -0.85 | 0.65 | -0.83 | yes |
| blurb | `coordinationRate` | institutional vs literary | 0.10 | -0.00 | 0.12 | no |
| blurb | `coordinationRate` | institutional vs marketing | -0.99 | 0.78 | -0.93 | yes |
| blurb | `coordinationRate` | literary vs marketing | -1.05 | 0.82 | -1.01 | yes |
| blurb | `skeletonRepeat` | business-email vs explanatory | -0.25 | 0.19 | -0.33 | no |
| blurb | `skeletonRepeat` | business-email vs institutional | -0.36 | 0.27 | -0.45 | no |
| blurb | `skeletonRepeat` | business-email vs literary | -0.10 | 0.07 | -0.25 | no |
| blurb | `skeletonRepeat` | business-email vs marketing | -0.16 | 0.06 | -0.31 | no |
| blurb | `skeletonRepeat` | explanatory vs institutional | -0.08 | -0.03 | -0.08 | no |
| blurb | `skeletonRepeat` | explanatory vs literary | 0.16 | 0.08 | 0.08 | no |
| blurb | `skeletonRepeat` | explanatory vs marketing | 0.09 | -0.04 | 0.05 | no |
| blurb | `skeletonRepeat` | institutional vs literary | 0.28 | 0.18 | 0.17 | no |
| blurb | `skeletonRepeat` | institutional vs marketing | 0.19 | -0.04 | 0.14 | no |
| blurb | `skeletonRepeat` | literary vs marketing | -0.08 | -0.06 | -0.04 | no |
| document (5 paragraphs) | `listRate` | business-email vs explanatory | -0.03 | -0.03 | -0.09 | no |
| document (5 paragraphs) | `listRate` | business-email vs institutional | -0.34 | 0.29 | -0.37 | no |
| document (5 paragraphs) | `listRate` | business-email vs literary | -0.01 | -0.03 | -0.03 | no |
| document (5 paragraphs) | `listRate` | business-email vs marketing | -0.64 | 0.61 | -0.59 | no |
| document (5 paragraphs) | `listRate` | explanatory vs institutional | -0.31 | 0.22 | -0.27 | no |
| document (5 paragraphs) | `listRate` | explanatory vs literary | 0.02 | -0.01 | 0.05 | no |
| document (5 paragraphs) | `listRate` | explanatory vs marketing | -0.63 | 0.59 | -0.54 | no |
| document (5 paragraphs) | `listRate` | institutional vs literary | 0.33 | 0.29 | 0.33 | no |
| document (5 paragraphs) | `listRate` | institutional vs marketing | -0.45 | 0.43 | -0.39 | no |
| document (5 paragraphs) | `listRate` | literary vs marketing | -0.64 | 0.63 | -0.57 | no |
| document (5 paragraphs) | `studyRate` | business-email vs explanatory | -0.06 | 0.03 | -0.05 | no |
| document (5 paragraphs) | `studyRate` | business-email vs institutional | -0.05 | 0.00 | -0.08 | no |
| document (5 paragraphs) | `studyRate` | business-email vs literary | -0.06 | 0.03 | -0.12 | no |
| document (5 paragraphs) | `studyRate` | business-email vs marketing | 0.00 | 0.00 | 0.00 | no |
| document (5 paragraphs) | `studyRate` | explanatory vs institutional | 0.03 | -0.05 | -0.03 | no |
| document (5 paragraphs) | `studyRate` | explanatory vs literary | -0.02 | -0.07 | -0.10 | no |
| document (5 paragraphs) | `studyRate` | explanatory vs marketing | 0.06 | 0.03 | 0.05 | no |
| document (5 paragraphs) | `studyRate` | institutional vs literary | -0.04 | -0.03 | -0.08 | no |
| document (5 paragraphs) | `studyRate` | institutional vs marketing | 0.05 | 0.00 | 0.08 | no |
| document (5 paragraphs) | `studyRate` | literary vs marketing | 0.06 | 0.03 | 0.12 | no |
| document (5 paragraphs) | `hardPer100` | business-email vs explanatory | 1.99 | 1.90 | 2.00 | yes |
| document (5 paragraphs) | `hardPer100` | business-email vs institutional | 0.99 | 0.90 | 0.89 | yes |
| document (5 paragraphs) | `hardPer100` | business-email vs literary | 1.93 | 1.84 | 2.18 | yes |
| document (5 paragraphs) | `hardPer100` | business-email vs marketing | 0.97 | 0.88 | 0.78 | no |
| document (5 paragraphs) | `hardPer100` | explanatory vs institutional | -1.45 | 1.43 | -1.54 | yes |
| document (5 paragraphs) | `hardPer100` | explanatory vs literary | -0.24 | 0.23 | 0.06 | no |
| document (5 paragraphs) | `hardPer100` | explanatory vs marketing | -0.89 | 0.86 | -1.12 | yes |
| document (5 paragraphs) | `hardPer100` | institutional vs literary | 1.37 | 1.32 | 1.84 | yes |
| document (5 paragraphs) | `hardPer100` | institutional vs marketing | 0.17 | 0.12 | 0.04 | no |
| document (5 paragraphs) | `hardPer100` | literary vs marketing | -0.77 | 0.74 | -1.25 | no |
| document (5 paragraphs) | `tradePer100` | business-email vs explanatory | 0.08 | 0.04 | 0.06 | no |
| document (5 paragraphs) | `tradePer100` | business-email vs institutional | 0.49 | 0.45 | 0.47 | no |
| document (5 paragraphs) | `tradePer100` | business-email vs literary | -0.09 | 0.01 | -0.14 | no |
| document (5 paragraphs) | `tradePer100` | business-email vs marketing | -1.19 | 1.11 | -0.91 | yes |
| document (5 paragraphs) | `tradePer100` | explanatory vs institutional | 0.50 | 0.46 | 0.51 | no |
| document (5 paragraphs) | `tradePer100` | explanatory vs literary | -0.19 | 0.12 | -0.23 | no |
| document (5 paragraphs) | `tradePer100` | explanatory vs marketing | -1.29 | 1.23 | -1.01 | yes |
| document (5 paragraphs) | `tradePer100` | institutional vs literary | -0.63 | 0.63 | -0.73 | no |
| document (5 paragraphs) | `tradePer100` | institutional vs marketing | -1.54 | 1.46 | -1.32 | yes |
| document (5 paragraphs) | `tradePer100` | literary vs marketing | -1.15 | 1.09 | -0.85 | yes |
| document (5 paragraphs) | `specificsPer100` | business-email vs explanatory | 1.96 | 1.89 | 1.97 | yes |
| document (5 paragraphs) | `specificsPer100` | business-email vs institutional | 1.01 | 0.98 | 0.91 | yes |
| document (5 paragraphs) | `specificsPer100` | business-email vs literary | 1.88 | 1.82 | 2.13 | yes |
| document (5 paragraphs) | `specificsPer100` | business-email vs marketing | 0.74 | 0.65 | 0.63 | no |
| document (5 paragraphs) | `specificsPer100` | explanatory vs institutional | -1.38 | 1.34 | -1.48 | yes |
| document (5 paragraphs) | `specificsPer100` | explanatory vs literary | -0.27 | 0.24 | 0.03 | no |
| document (5 paragraphs) | `specificsPer100` | explanatory vs marketing | -1.13 | 1.08 | -1.28 | yes |
| document (5 paragraphs) | `specificsPer100` | institutional vs literary | 1.27 | 1.19 | 1.74 | yes |
| document (5 paragraphs) | `specificsPer100` | institutional vs marketing | -0.13 | 0.08 | -0.17 | no |
| document (5 paragraphs) | `specificsPer100` | literary vs marketing | -1.01 | 0.96 | -1.41 | yes |
| document (5 paragraphs) | `generic` | business-email vs explanatory | -1.45 | 1.37 | -1.36 | yes |
| document (5 paragraphs) | `generic` | business-email vs institutional | 0.32 | 0.22 | 0.41 | no |
| document (5 paragraphs) | `generic` | business-email vs literary | -0.59 | 0.54 | -0.89 | no |
| document (5 paragraphs) | `generic` | business-email vs marketing | -1.12 | 1.06 | -0.49 | no |
| document (5 paragraphs) | `generic` | explanatory vs institutional | 1.76 | 1.69 | 1.77 | yes |
| document (5 paragraphs) | `generic` | explanatory vs literary | 0.85 | 0.78 | 0.46 | no |
| document (5 paragraphs) | `generic` | explanatory vs marketing | 0.31 | 0.24 | 0.87 | no |
| document (5 paragraphs) | `generic` | institutional vs literary | -0.90 | 0.85 | -1.29 | yes |
| document (5 paragraphs) | `generic` | institutional vs marketing | -1.43 | 1.35 | -0.89 | yes |
| document (5 paragraphs) | `generic` | literary vs marketing | -0.54 | 0.49 | 0.40 | no |
| document (5 paragraphs) | `figures` | business-email vs explanatory | 0.48 | 0.43 | 0.37 | no |
| document (5 paragraphs) | `figures` | business-email vs institutional | 0.38 | 0.33 | 0.23 | no |
| document (5 paragraphs) | `figures` | business-email vs literary | 1.76 | 1.69 | 1.61 | yes |
| document (5 paragraphs) | `figures` | business-email vs marketing | 0.74 | 0.69 | 0.14 | no |
| document (5 paragraphs) | `figures` | explanatory vs institutional | -0.13 | 0.06 | -0.16 | no |
| document (5 paragraphs) | `figures` | explanatory vs literary | 1.30 | 1.22 | 1.26 | yes |
| document (5 paragraphs) | `figures` | explanatory vs marketing | 0.22 | 0.19 | -0.27 | no |
| document (5 paragraphs) | `figures` | institutional vs literary | 1.65 | 1.55 | 1.61 | yes |
| document (5 paragraphs) | `figures` | institutional vs marketing | 0.39 | 0.32 | -0.11 | no |
| document (5 paragraphs) | `figures` | literary vs marketing | -1.52 | 1.46 | -1.89 | yes |
| document (5 paragraphs) | `names` | business-email vs explanatory | 1.08 | 1.01 | 1.10 | yes |
| document (5 paragraphs) | `names` | business-email vs institutional | -0.90 | 0.80 | -1.01 | yes |
| document (5 paragraphs) | `names` | business-email vs literary | 0.54 | 0.49 | 1.04 | no |
| document (5 paragraphs) | `names` | business-email vs marketing | 0.42 | 0.36 | 0.27 | no |
| document (5 paragraphs) | `names` | explanatory vs institutional | -1.90 | 1.80 | -2.02 | yes |
| document (5 paragraphs) | `names` | explanatory vs literary | -0.62 | 0.52 | -0.20 | no |
| document (5 paragraphs) | `names` | explanatory vs marketing | -0.52 | 0.49 | -0.70 | no |
| document (5 paragraphs) | `names` | institutional vs literary | 1.45 | 1.40 | 2.05 | yes |
| document (5 paragraphs) | `names` | institutional vs marketing | 1.20 | 1.14 | 1.16 | yes |
| document (5 paragraphs) | `names` | literary vs marketing | -0.02 | -0.00 | -0.60 | no |
| document (5 paragraphs) | `meanSentenceWords` | business-email vs explanatory | -1.43 | 1.38 | -1.42 | yes |
| document (5 paragraphs) | `meanSentenceWords` | business-email vs literary | -1.64 | 1.59 | -1.54 | yes |
| document (5 paragraphs) | `meanSentenceWords` | explanatory vs literary | -0.57 | 0.54 | -0.45 | no |
| document (5 paragraphs) | `contractionsPer100` | business-email vs explanatory | -0.41 | 0.39 | -0.81 | no |
| document (5 paragraphs) | `contractionsPer100` | business-email vs literary | 0.43 | 0.39 | -0.11 | no |
| document (5 paragraphs) | `contractionsPer100` | explanatory vs literary | 0.86 | 0.81 | 0.61 | no |
| document (5 paragraphs) | `youPer100` | business-email vs explanatory | 0.04 | -0.02 | 0.08 | no |
| document (5 paragraphs) | `youPer100` | business-email vs literary | 0.40 | 0.35 | 0.47 | no |
| document (5 paragraphs) | `youPer100` | explanatory vs literary | 0.34 | 0.30 | 0.38 | no |
| document (5 paragraphs) | `firstPersonPer100` | business-email vs explanatory | 2.91 | 2.90 | 2.95 | yes |
| document (5 paragraphs) | `firstPersonPer100` | business-email vs literary | 0.65 | 0.57 | 0.82 | no |
| document (5 paragraphs) | `firstPersonPer100` | explanatory vs literary | -1.95 | 1.91 | -1.75 | yes |
| document (5 paragraphs) | `passiveShare` | business-email vs explanatory | -0.63 | 0.55 | -0.84 | no |
| document (5 paragraphs) | `passiveShare` | business-email vs literary | -0.48 | 0.44 | -0.67 | no |
| document (5 paragraphs) | `passiveShare` | explanatory vs literary | 0.11 | 0.08 | 0.13 | no |
| document (5 paragraphs) | `meanWordLength` | business-email vs explanatory | -1.42 | 1.38 | -1.25 | yes |
| document (5 paragraphs) | `meanWordLength` | business-email vs literary | -0.14 | 0.09 | 0.02 | no |
| document (5 paragraphs) | `meanWordLength` | explanatory vs literary | 1.48 | 1.42 | 1.45 | yes |
| document (5 paragraphs) | `tricolons` | business-email vs explanatory | -0.71 | 0.69 | -0.72 | no |
| document (5 paragraphs) | `tricolons` | business-email vs institutional | -0.87 | 0.83 | -0.94 | yes |
| document (5 paragraphs) | `tricolons` | business-email vs literary | -1.32 | 1.25 | -1.38 | yes |
| document (5 paragraphs) | `tricolons` | business-email vs marketing | -1.30 | 1.25 | -1.27 | yes |
| document (5 paragraphs) | `tricolons` | explanatory vs institutional | -0.16 | 0.10 | -0.23 | no |
| document (5 paragraphs) | `tricolons` | explanatory vs literary | -0.70 | 0.65 | -0.73 | no |
| document (5 paragraphs) | `tricolons` | explanatory vs marketing | -0.68 | 0.60 | -0.59 | no |
| document (5 paragraphs) | `tricolons` | institutional vs literary | -0.56 | 0.53 | -0.52 | no |
| document (5 paragraphs) | `tricolons` | institutional vs marketing | -0.53 | 0.50 | -0.36 | no |
| document (5 paragraphs) | `tricolons` | literary vs marketing | 0.02 | 0.03 | 0.16 | no |
| document (5 paragraphs) | `parallelTriads` | business-email vs explanatory | -0.21 | 0.16 | -0.16 | no |
| document (5 paragraphs) | `parallelTriads` | business-email vs institutional | -0.33 | 0.30 | -0.39 | no |
| document (5 paragraphs) | `parallelTriads` | business-email vs literary | -0.37 | 0.34 | -0.36 | no |
| document (5 paragraphs) | `parallelTriads` | business-email vs marketing | -0.35 | 0.31 | -0.18 | no |
| document (5 paragraphs) | `parallelTriads` | explanatory vs institutional | -0.15 | 0.10 | -0.27 | no |
| document (5 paragraphs) | `parallelTriads` | explanatory vs literary | -0.19 | 0.16 | -0.23 | no |
| document (5 paragraphs) | `parallelTriads` | explanatory vs marketing | -0.16 | 0.13 | -0.02 | no |
| document (5 paragraphs) | `parallelTriads` | institutional vs literary | -0.04 | -0.01 | 0.04 | no |
| document (5 paragraphs) | `parallelTriads` | institutional vs marketing | -0.01 | 0.00 | 0.25 | no |
| document (5 paragraphs) | `parallelTriads` | literary vs marketing | 0.03 | -0.03 | 0.21 | no |
| document (5 paragraphs) | `stackedConditionals` | business-email vs explanatory | -0.17 | 0.10 | -0.25 | no |
| document (5 paragraphs) | `stackedConditionals` | business-email vs institutional | -0.16 | 0.10 | -0.12 | no |
| document (5 paragraphs) | `stackedConditionals` | business-email vs literary | -0.16 | 0.12 | -0.16 | no |
| document (5 paragraphs) | `stackedConditionals` | business-email vs marketing | -0.04 | 0.00 | 0.19 | no |
| document (5 paragraphs) | `stackedConditionals` | explanatory vs institutional | 0.01 | -0.05 | 0.14 | no |
| document (5 paragraphs) | `stackedConditionals` | explanatory vs literary | 0.01 | -0.06 | 0.09 | no |
| document (5 paragraphs) | `stackedConditionals` | explanatory vs marketing | 0.13 | 0.08 | 0.37 | no |
| document (5 paragraphs) | `stackedConditionals` | institutional vs literary | 0.00 | -0.05 | -0.05 | no |
| document (5 paragraphs) | `stackedConditionals` | institutional vs marketing | 0.13 | 0.07 | 0.27 | no |
| document (5 paragraphs) | `stackedConditionals` | literary vs marketing | 0.13 | 0.06 | 0.30 | no |
| document (5 paragraphs) | `clauseDepth` | business-email vs explanatory | -1.49 | 1.45 | -1.72 | yes |
| document (5 paragraphs) | `clauseDepth` | business-email vs institutional | -1.57 | 1.50 | -1.94 | yes |
| document (5 paragraphs) | `clauseDepth` | business-email vs literary | -2.78 | 2.70 | -2.98 | yes |
| document (5 paragraphs) | `clauseDepth` | business-email vs marketing | -0.84 | 0.79 | -0.75 | no |
| document (5 paragraphs) | `clauseDepth` | explanatory vs institutional | -0.06 | -0.01 | -0.13 | no |
| document (5 paragraphs) | `clauseDepth` | explanatory vs literary | -1.64 | 1.58 | -1.65 | yes |
| document (5 paragraphs) | `clauseDepth` | explanatory vs marketing | 0.53 | 0.48 | 0.51 | no |
| document (5 paragraphs) | `clauseDepth` | institutional vs literary | -1.61 | 1.53 | -1.58 | yes |
| document (5 paragraphs) | `clauseDepth` | institutional vs marketing | 0.59 | 0.53 | 0.62 | no |
| document (5 paragraphs) | `clauseDepth` | literary vs marketing | 2.00 | 1.93 | 1.85 | yes |
| document (5 paragraphs) | `sentenceCv` | business-email vs explanatory | 0.25 | 0.16 | 0.79 | no |
| document (5 paragraphs) | `sentenceCv` | business-email vs institutional | -0.41 | 0.36 | 0.05 | no |
| document (5 paragraphs) | `sentenceCv` | business-email vs literary | -0.19 | 0.15 | 0.20 | no |
| document (5 paragraphs) | `sentenceCv` | business-email vs marketing | 0.85 | 0.75 | 1.51 | yes |
| document (5 paragraphs) | `sentenceCv` | explanatory vs institutional | -0.67 | 0.61 | -0.79 | no |
| document (5 paragraphs) | `sentenceCv` | explanatory vs literary | -0.45 | 0.37 | -0.60 | no |
| document (5 paragraphs) | `sentenceCv` | explanatory vs marketing | 0.63 | 0.59 | 0.79 | no |
| document (5 paragraphs) | `sentenceCv` | institutional vs literary | 0.21 | 0.17 | 0.15 | no |
| document (5 paragraphs) | `sentenceCv` | institutional vs marketing | 1.27 | 1.21 | 1.55 | yes |
| document (5 paragraphs) | `sentenceCv` | literary vs marketing | 1.04 | 0.94 | 1.34 | yes |
| document (5 paragraphs) | `hedgeRate` | business-email vs explanatory | -0.32 | 0.28 | -0.37 | no |
| document (5 paragraphs) | `hedgeRate` | business-email vs institutional | 0.27 | 0.20 | 0.27 | no |
| document (5 paragraphs) | `hedgeRate` | business-email vs literary | -0.22 | 0.19 | -0.15 | no |
| document (5 paragraphs) | `hedgeRate` | business-email vs marketing | 0.61 | 0.55 | -0.06 | no |
| document (5 paragraphs) | `hedgeRate` | explanatory vs institutional | 0.65 | 0.59 | 0.70 | no |
| document (5 paragraphs) | `hedgeRate` | explanatory vs literary | 0.10 | 0.06 | 0.22 | no |
| document (5 paragraphs) | `hedgeRate` | explanatory vs marketing | 1.01 | 0.97 | 0.28 | no |
| document (5 paragraphs) | `hedgeRate` | institutional vs literary | -0.54 | 0.45 | -0.46 | no |
| document (5 paragraphs) | `hedgeRate` | institutional vs marketing | 0.43 | 0.40 | -0.31 | no |
| document (5 paragraphs) | `hedgeRate` | literary vs marketing | 0.90 | 0.83 | 0.08 | no |
| document (5 paragraphs) | `hedgedClose` | business-email vs explanatory | -0.30 | 0.25 | -0.19 | no |
| document (5 paragraphs) | `hedgedClose` | business-email vs institutional | 0.29 | 0.22 | 0.20 | no |
| document (5 paragraphs) | `hedgedClose` | business-email vs literary | -0.07 | 0.02 | 0.02 | no |
| document (5 paragraphs) | `hedgedClose` | business-email vs marketing | 0.57 | 0.52 | 0.27 | no |
| document (5 paragraphs) | `hedgedClose` | explanatory vs institutional | 0.60 | 0.57 | 0.38 | no |
| document (5 paragraphs) | `hedgedClose` | explanatory vs literary | 0.23 | 0.19 | 0.20 | no |
| document (5 paragraphs) | `hedgedClose` | explanatory vs marketing | 0.89 | 0.85 | 0.45 | no |
| document (5 paragraphs) | `hedgedClose` | institutional vs literary | -0.37 | 0.34 | -0.18 | no |
| document (5 paragraphs) | `hedgedClose` | institutional vs marketing | 0.28 | 0.21 | 0.07 | no |
| document (5 paragraphs) | `hedgedClose` | literary vs marketing | 0.65 | 0.61 | 0.25 | no |
| document (5 paragraphs) | `nominalisationRate` | business-email vs explanatory | 0.11 | 0.02 | 0.34 | no |
| document (5 paragraphs) | `nominalisationRate` | business-email vs institutional | -1.11 | 1.02 | -0.90 | yes |
| document (5 paragraphs) | `nominalisationRate` | business-email vs literary | 0.64 | 0.59 | 0.86 | no |
| document (5 paragraphs) | `nominalisationRate` | business-email vs marketing | -0.92 | 0.83 | -0.85 | yes |
| document (5 paragraphs) | `nominalisationRate` | explanatory vs institutional | -1.33 | 1.28 | -1.41 | yes |
| document (5 paragraphs) | `nominalisationRate` | explanatory vs literary | 0.58 | 0.52 | 0.59 | no |
| document (5 paragraphs) | `nominalisationRate` | explanatory vs marketing | -1.07 | 1.00 | -1.23 | yes |
| document (5 paragraphs) | `nominalisationRate` | institutional vs literary | 2.03 | 1.96 | 2.05 | yes |
| document (5 paragraphs) | `nominalisationRate` | institutional vs marketing | 0.01 | -0.02 | -0.10 | no |
| document (5 paragraphs) | `nominalisationRate` | literary vs marketing | -1.58 | 1.53 | -1.71 | yes |
| document (5 paragraphs) | `pronounOpenerShare` | business-email vs explanatory | 0.24 | 0.16 | 0.12 | no |
| document (5 paragraphs) | `pronounOpenerShare` | business-email vs institutional | -0.09 | 0.04 | -0.05 | no |
| document (5 paragraphs) | `pronounOpenerShare` | business-email vs literary | 0.27 | 0.18 | 0.23 | no |
| document (5 paragraphs) | `pronounOpenerShare` | business-email vs marketing | -1.59 | 1.56 | -1.54 | yes |
| document (5 paragraphs) | `pronounOpenerShare` | explanatory vs institutional | -0.34 | 0.30 | -0.17 | no |
| document (5 paragraphs) | `pronounOpenerShare` | explanatory vs literary | 0.03 | -0.01 | 0.12 | no |
| document (5 paragraphs) | `pronounOpenerShare` | explanatory vs marketing | -1.80 | 1.75 | -1.63 | yes |
| document (5 paragraphs) | `pronounOpenerShare` | institutional vs literary | 0.36 | 0.32 | 0.28 | no |
| document (5 paragraphs) | `pronounOpenerShare` | institutional vs marketing | -1.54 | 1.49 | -1.51 | yes |
| document (5 paragraphs) | `pronounOpenerShare` | literary vs marketing | -1.80 | 1.74 | -1.69 | yes |
| document (5 paragraphs) | `transitionOpenerShare` | business-email vs explanatory | -0.31 | 0.25 | -0.15 | no |
| document (5 paragraphs) | `transitionOpenerShare` | business-email vs institutional | -0.28 | 0.22 | -0.13 | no |
| document (5 paragraphs) | `transitionOpenerShare` | business-email vs literary | 0.24 | 0.17 | 0.08 | no |
| document (5 paragraphs) | `transitionOpenerShare` | business-email vs marketing | -0.23 | 0.21 | 0.06 | no |
| document (5 paragraphs) | `transitionOpenerShare` | explanatory vs institutional | 0.02 | -0.06 | 0.02 | no |
| document (5 paragraphs) | `transitionOpenerShare` | explanatory vs literary | 0.55 | 0.49 | 0.23 | no |
| document (5 paragraphs) | `transitionOpenerShare` | explanatory vs marketing | 0.01 | -0.05 | 0.22 | no |
| document (5 paragraphs) | `transitionOpenerShare` | institutional vs literary | 0.50 | 0.47 | 0.21 | no |
| document (5 paragraphs) | `transitionOpenerShare` | institutional vs marketing | -0.00 | -0.03 | 0.19 | no |
| document (5 paragraphs) | `transitionOpenerShare` | literary vs marketing | -0.39 | 0.38 | -0.02 | no |
| document (5 paragraphs) | `impersonalOpenerShare` | business-email vs explanatory | -0.90 | 0.85 | -0.99 | yes |
| document (5 paragraphs) | `impersonalOpenerShare` | business-email vs institutional | -0.69 | 0.67 | -0.76 | no |
| document (5 paragraphs) | `impersonalOpenerShare` | business-email vs literary | -0.24 | 0.18 | -0.22 | no |
| document (5 paragraphs) | `impersonalOpenerShare` | business-email vs marketing | -0.37 | 0.30 | -0.08 | no |
| document (5 paragraphs) | `impersonalOpenerShare` | explanatory vs institutional | 0.25 | 0.18 | 0.29 | no |
| document (5 paragraphs) | `impersonalOpenerShare` | explanatory vs literary | 0.69 | 0.66 | 0.79 | no |
| document (5 paragraphs) | `impersonalOpenerShare` | explanatory vs marketing | 0.53 | 0.52 | 0.92 | no |
| document (5 paragraphs) | `impersonalOpenerShare` | institutional vs literary | 0.46 | 0.42 | 0.54 | no |
| document (5 paragraphs) | `impersonalOpenerShare` | institutional vs marketing | 0.30 | 0.24 | 0.68 | no |
| document (5 paragraphs) | `impersonalOpenerShare` | literary vs marketing | -0.14 | 0.05 | 0.14 | no |
| document (5 paragraphs) | `commasPerSentence` | business-email vs explanatory | -1.08 | 1.05 | -1.39 | yes |
| document (5 paragraphs) | `commasPerSentence` | business-email vs institutional | -1.70 | 1.64 | -2.08 | yes |
| document (5 paragraphs) | `commasPerSentence` | business-email vs literary | -2.88 | 2.81 | -3.18 | yes |
| document (5 paragraphs) | `commasPerSentence` | business-email vs marketing | -1.04 | 0.97 | -0.83 | yes |
| document (5 paragraphs) | `commasPerSentence` | explanatory vs institutional | -0.57 | 0.50 | -0.60 | no |
| document (5 paragraphs) | `commasPerSentence` | explanatory vs literary | -2.08 | 2.04 | -2.14 | yes |
| document (5 paragraphs) | `commasPerSentence` | explanatory vs marketing | -0.12 | 0.03 | 0.05 | no |
| document (5 paragraphs) | `commasPerSentence` | institutional vs literary | -1.68 | 1.65 | -1.72 | yes |
| document (5 paragraphs) | `commasPerSentence` | institutional vs marketing | 0.37 | 0.30 | 0.45 | no |
| document (5 paragraphs) | `commasPerSentence` | literary vs marketing | 1.83 | 1.77 | 1.74 | yes |
| document (5 paragraphs) | `commasPer100` | business-email vs explanatory | -0.66 | 0.60 | -1.02 | no |
| document (5 paragraphs) | `commasPer100` | business-email vs institutional | -0.89 | 0.84 | -1.28 | yes |
| document (5 paragraphs) | `commasPer100` | business-email vs literary | -2.94 | 2.91 | -3.49 | yes |
| document (5 paragraphs) | `commasPer100` | business-email vs marketing | -0.57 | 0.53 | -0.56 | no |
| document (5 paragraphs) | `commasPer100` | explanatory vs institutional | -0.18 | 0.15 | -0.15 | no |
| document (5 paragraphs) | `commasPer100` | explanatory vs literary | -2.44 | 2.40 | -2.62 | yes |
| document (5 paragraphs) | `commasPer100` | explanatory vs marketing | 0.03 | -0.01 | 0.28 | no |
| document (5 paragraphs) | `commasPer100` | institutional vs literary | -2.45 | 2.41 | -2.71 | yes |
| document (5 paragraphs) | `commasPer100` | institutional vs marketing | 0.20 | 0.17 | 0.42 | no |
| document (5 paragraphs) | `commasPer100` | literary vs marketing | 2.31 | 2.28 | 2.51 | yes |
| document (5 paragraphs) | `participialRate` | business-email vs explanatory | -0.42 | 0.34 | -0.56 | no |
| document (5 paragraphs) | `participialRate` | business-email vs institutional | -0.36 | 0.31 | -0.56 | no |
| document (5 paragraphs) | `participialRate` | business-email vs literary | -1.07 | 1.01 | -1.33 | yes |
| document (5 paragraphs) | `participialRate` | business-email vs marketing | -0.70 | 0.64 | -0.80 | no |
| document (5 paragraphs) | `participialRate` | explanatory vs institutional | 0.06 | -0.02 | 0.01 | no |
| document (5 paragraphs) | `participialRate` | explanatory vs literary | -0.78 | 0.73 | -0.88 | no |
| document (5 paragraphs) | `participialRate` | explanatory vs marketing | -0.34 | 0.28 | -0.35 | no |
| document (5 paragraphs) | `participialRate` | institutional vs literary | -0.82 | 0.77 | -0.90 | yes |
| document (5 paragraphs) | `participialRate` | institutional vs marketing | -0.39 | 0.36 | -0.36 | no |
| document (5 paragraphs) | `participialRate` | literary vs marketing | 0.48 | 0.41 | 0.50 | no |
| document (5 paragraphs) | `coordinationRate` | business-email vs explanatory | -0.34 | 0.28 | -0.25 | no |
| document (5 paragraphs) | `coordinationRate` | business-email vs institutional | -0.27 | 0.22 | -0.15 | no |
| document (5 paragraphs) | `coordinationRate` | business-email vs literary | -0.08 | 0.05 | 0.08 | no |
| document (5 paragraphs) | `coordinationRate` | business-email vs marketing | -1.77 | 1.71 | -1.60 | yes |
| document (5 paragraphs) | `coordinationRate` | explanatory vs institutional | 0.09 | 0.04 | 0.11 | no |
| document (5 paragraphs) | `coordinationRate` | explanatory vs literary | 0.29 | 0.21 | 0.35 | no |
| document (5 paragraphs) | `coordinationRate` | explanatory vs marketing | -1.54 | 1.50 | -1.46 | yes |
| document (5 paragraphs) | `coordinationRate` | institutional vs literary | 0.21 | 0.11 | 0.25 | no |
| document (5 paragraphs) | `coordinationRate` | institutional vs marketing | -1.65 | 1.61 | -1.58 | yes |
| document (5 paragraphs) | `coordinationRate` | literary vs marketing | -1.79 | 1.73 | -1.76 | yes |
| document (5 paragraphs) | `skeletonRepeat` | business-email vs explanatory | -0.61 | 0.56 | -0.74 | no |
| document (5 paragraphs) | `skeletonRepeat` | business-email vs institutional | -0.84 | 0.75 | -1.06 | yes |
| document (5 paragraphs) | `skeletonRepeat` | business-email vs literary | -0.30 | 0.25 | -0.58 | no |
| document (5 paragraphs) | `skeletonRepeat` | business-email vs marketing | -0.39 | 0.32 | -0.63 | no |
| document (5 paragraphs) | `skeletonRepeat` | explanatory vs institutional | -0.14 | 0.09 | -0.25 | no |
| document (5 paragraphs) | `skeletonRepeat` | explanatory vs literary | 0.36 | 0.31 | 0.17 | no |
| document (5 paragraphs) | `skeletonRepeat` | explanatory vs marketing | 0.20 | 0.13 | 0.11 | no |
| document (5 paragraphs) | `skeletonRepeat` | institutional vs literary | 0.56 | 0.51 | 0.43 | no |
| document (5 paragraphs) | `skeletonRepeat` | institutional vs marketing | 0.35 | 0.27 | 0.37 | no |
| document (5 paragraphs) | `skeletonRepeat` | literary vs marketing | -0.13 | 0.08 | -0.05 | no |
