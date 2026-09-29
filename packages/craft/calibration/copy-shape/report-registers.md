# Register separation: human baselines against each other

Measured 2026-09-29 by `scripts/shape/registers.mjs`, 200 bootstrap resamples. Generated; do not edit by hand.

A feature separates two registers when |d| >= 0.8 on the tuning half, the bootstrap bound nearest zero is at least 0.5, and the holdout d has the same sign and |d| >= 0.8.

## Samples

| Register | Source | Tuning | Holdout |
| --- | --- | ---: | ---: |
| business-email | enron | 6000 | 6000 |
| explanatory | hc3-human | 6000 | 6000 |
| institutional | hansard-commons | 6000 | 6000 |
| literary | gutenberg | 6000 | 6000 |
| marketing | wayback-uk-sme | 338 | 372 |

## Features that pass, per register pair

| Pair | Passing features (tuning d / holdout d) |
| --- | --- |
| business-email vs explanatory | `hardPer100` 0.88 / 0.88; `specificsPer100` 0.88 / 0.88 |
| business-email vs institutional | none |
| business-email vs literary | `commasPer100` -1.33 / -1.54; `commasPerSentence` -1.29 / -1.38; `clauseDepth` -1.22 / -1.27; `hardPer100` 0.85 / 0.98; `specificsPer100` 0.84 / 0.96 |
| business-email vs marketing | `pronounOpenerShare` -1.06 / -1.05; `tricolons` -0.97 / -0.84; `coordinationRate` -0.95 / -0.84 |
| explanatory vs institutional | `names` -0.84 / -0.87 |
| explanatory vs literary | `commasPer100` -1.10 / -1.14; `commasPerSentence` -0.94 / -0.92 |
| explanatory vs marketing | `pronounOpenerShare` -1.32 / -1.17; `coordinationRate` -0.85 / -0.83 |
| institutional vs literary | `commasPer100` -1.10 / -1.20; `nominalisationRate` 0.91 / 0.92 |
| institutional vs marketing | `tradePer100` -1.76 / -1.34; `pronounOpenerShare` -1.03 / -1.02; `coordinationRate` -0.99 / -0.93 |
| literary vs marketing | `figures` -1.50 / -2.27; `pronounOpenerShare` -1.28 / -1.21; `coordinationRate` -1.05 / -1.01; `nominalisationRate` -1.01 / -1.07; `commasPer100` 0.98 / 1.14 |

## Profile candidates, per register

A feature is a candidate for a register's profile when it separates that register from at least one other. The band is the tuning half's 10th, 50th and 90th percentile.

### business-email

| Feature | Band (p10 / p50 / p90) | Separates from |
| --- | --- | --- |
| `hardPer100` | 0.00 / 5.97 / 15.38 | explanatory, literary |
| `specificsPer100` | 0.00 / 6.10 / 15.60 | explanatory, literary |
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

## Every pair and feature

| Feature | Pair | d tuning | bound | d holdout | Passes |
| --- | --- | ---: | ---: | ---: | --- |
| `listRate` | business-email vs explanatory | -0.03 | -0.07 | -0.05 | no |
| `listRate` | business-email vs institutional | -0.14 | 0.09 | -0.17 | no |
| `listRate` | business-email vs literary | -0.01 | -0.07 | -0.02 | no |
| `listRate` | business-email vs marketing | -0.62 | 0.31 | -0.54 | no |
| `listRate` | explanatory vs institutional | -0.12 | 0.06 | -0.11 | no |
| `listRate` | explanatory vs literary | 0.02 | -0.07 | 0.03 | no |
| `listRate` | explanatory vs marketing | -0.60 | 0.31 | -0.41 | no |
| `listRate` | institutional vs literary | 0.13 | 0.05 | 0.14 | no |
| `listRate` | institutional vs marketing | -0.36 | 0.13 | -0.26 | no |
| `listRate` | literary vs marketing | -0.63 | 0.30 | -0.49 | no |
| `studyRate` | business-email vs explanatory | -0.03 | 0.00 | -0.02 | no |
| `studyRate` | business-email vs institutional | -0.03 | 0.00 | -0.03 | no |
| `studyRate` | business-email vs literary | -0.03 | 0.00 | -0.05 | no |
| `studyRate` | business-email vs marketing | 0.00 | 0.00 | 0.00 | no |
| `studyRate` | explanatory vs institutional | 0.01 | -0.05 | 0.00 | no |
| `studyRate` | explanatory vs literary | -0.01 | -0.06 | -0.04 | no |
| `studyRate` | explanatory vs marketing | 0.02 | 0.00 | 0.02 | no |
| `studyRate` | institutional vs literary | -0.02 | -0.04 | -0.04 | no |
| `studyRate` | institutional vs marketing | 0.02 | 0.00 | 0.02 | no |
| `studyRate` | literary vs marketing | 0.02 | 0.00 | 0.04 | no |
| `hardPer100` | business-email vs explanatory | 0.88 | 0.80 | 0.88 | yes |
| `hardPer100` | business-email vs institutional | 0.43 | 0.36 | 0.40 | no |
| `hardPer100` | business-email vs literary | 0.85 | 0.78 | 0.98 | yes |
| `hardPer100` | business-email vs marketing | 0.40 | 0.30 | 0.34 | no |
| `hardPer100` | explanatory vs institutional | -0.64 | 0.56 | -0.67 | no |
| `hardPer100` | explanatory vs literary | -0.10 | 0.02 | 0.05 | no |
| `hardPer100` | explanatory vs marketing | -0.52 | 0.34 | -0.62 | no |
| `hardPer100` | institutional vs literary | 0.60 | 0.53 | 0.82 | no |
| `hardPer100` | institutional vs marketing | 0.09 | -0.05 | 0.02 | no |
| `hardPer100` | literary vs marketing | -0.51 | 0.24 | -0.86 | no |
| `tradePer100` | business-email vs explanatory | 0.04 | -0.03 | 0.03 | no |
| `tradePer100` | business-email vs institutional | 0.21 | 0.15 | 0.21 | no |
| `tradePer100` | business-email vs literary | -0.03 | -0.05 | -0.04 | no |
| `tradePer100` | business-email vs marketing | -0.83 | 0.53 | -0.52 | no |
| `tradePer100` | explanatory vs institutional | 0.21 | 0.12 | 0.22 | no |
| `tradePer100` | explanatory vs literary | -0.08 | 0.01 | -0.09 | no |
| `tradePer100` | explanatory vs marketing | -1.08 | 0.67 | -0.69 | no |
| `tradePer100` | institutional vs literary | -0.27 | 0.20 | -0.31 | no |
| `tradePer100` | institutional vs marketing | -1.76 | 1.06 | -1.34 | yes |
| `tradePer100` | literary vs marketing | -0.85 | 0.49 | -0.55 | no |
| `specificsPer100` | business-email vs explanatory | 0.88 | 0.78 | 0.88 | yes |
| `specificsPer100` | business-email vs institutional | 0.45 | 0.38 | 0.42 | no |
| `specificsPer100` | business-email vs literary | 0.84 | 0.77 | 0.96 | yes |
| `specificsPer100` | business-email vs marketing | 0.31 | 0.19 | 0.28 | no |
| `specificsPer100` | explanatory vs institutional | -0.62 | 0.53 | -0.65 | no |
| `specificsPer100` | explanatory vs literary | -0.12 | 0.03 | 0.03 | no |
| `specificsPer100` | explanatory vs marketing | -0.67 | 0.43 | -0.71 | no |
| `specificsPer100` | institutional vs literary | 0.56 | 0.48 | 0.77 | no |
| `specificsPer100` | institutional vs marketing | -0.09 | -0.11 | -0.11 | no |
| `specificsPer100` | literary vs marketing | -0.67 | 0.39 | -0.95 | no |
| `generic` | business-email vs explanatory | -0.62 | 0.56 | -0.61 | no |
| `generic` | business-email vs institutional | 0.16 | 0.08 | 0.17 | no |
| `generic` | business-email vs literary | -0.24 | 0.18 | -0.40 | no |
| `generic` | business-email vs marketing | -0.58 | 0.40 | -0.22 | no |
| `generic` | explanatory vs institutional | 0.78 | 0.70 | 0.78 | no |
| `generic` | explanatory vs literary | 0.38 | 0.30 | 0.21 | no |
| `generic` | explanatory vs marketing | 0.13 | -0.02 | 0.37 | no |
| `generic` | institutional vs literary | -0.40 | 0.33 | -0.56 | no |
| `generic` | institutional vs marketing | -0.88 | 0.59 | -0.46 | no |
| `generic` | literary vs marketing | -0.25 | 0.11 | 0.18 | no |
| `figures` | business-email vs explanatory | 0.22 | 0.14 | 0.16 | no |
| `figures` | business-email vs institutional | 0.17 | 0.10 | 0.11 | no |
| `figures` | business-email vs literary | 0.79 | 0.70 | 0.71 | no |
| `figures` | business-email vs marketing | 0.28 | 0.21 | 0.05 | no |
| `figures` | explanatory vs institutional | -0.06 | -0.01 | -0.07 | no |
| `figures` | explanatory vs literary | 0.57 | 0.51 | 0.57 | no |
| `figures` | explanatory vs marketing | 0.08 | -0.01 | -0.11 | no |
| `figures` | institutional vs literary | 0.72 | 0.67 | 0.73 | no |
| `figures` | institutional vs marketing | 0.15 | 0.08 | -0.05 | no |
| `figures` | literary vs marketing | -1.50 | 0.86 | -2.27 | yes |
| `names` | business-email vs explanatory | 0.46 | 0.33 | 0.47 | no |
| `names` | business-email vs institutional | -0.40 | 0.33 | -0.43 | no |
| `names` | business-email vs literary | 0.24 | 0.14 | 0.47 | no |
| `names` | business-email vs marketing | 0.21 | 0.02 | 0.13 | no |
| `names` | explanatory vs institutional | -0.84 | 0.73 | -0.87 | yes |
| `names` | explanatory vs literary | -0.27 | 0.16 | -0.06 | no |
| `names` | explanatory vs marketing | -0.25 | 0.11 | -0.34 | no |
| `names` | institutional vs literary | 0.65 | 0.55 | 0.91 | no |
| `names` | institutional vs marketing | 0.55 | 0.38 | 0.51 | no |
| `names` | literary vs marketing | -0.01 | -0.18 | -0.38 | no |
| `tricolons` | business-email vs explanatory | -0.32 | 0.25 | -0.33 | no |
| `tricolons` | business-email vs institutional | -0.40 | 0.29 | -0.40 | no |
| `tricolons` | business-email vs literary | -0.59 | 0.52 | -0.62 | no |
| `tricolons` | business-email vs marketing | -0.97 | 0.65 | -0.84 | yes |
| `tricolons` | explanatory vs institutional | -0.07 | -0.03 | -0.07 | no |
| `tricolons` | explanatory vs literary | -0.31 | 0.24 | -0.33 | no |
| `tricolons` | explanatory vs marketing | -0.38 | 0.22 | -0.27 | no |
| `tricolons` | institutional vs literary | -0.24 | 0.15 | -0.26 | no |
| `tricolons` | institutional vs marketing | -0.29 | 0.14 | -0.19 | no |
| `tricolons` | literary vs marketing | -0.01 | -0.11 | 0.09 | no |
| `parallelTriads` | business-email vs explanatory | -0.09 | 0.00 | -0.08 | no |
| `parallelTriads` | business-email vs institutional | -0.15 | 0.09 | -0.17 | no |
| `parallelTriads` | business-email vs literary | -0.17 | 0.10 | -0.18 | no |
| `parallelTriads` | business-email vs marketing | -0.25 | 0.04 | -0.16 | no |
| `parallelTriads` | explanatory vs institutional | -0.07 | -0.00 | -0.10 | no |
| `parallelTriads` | explanatory vs literary | -0.09 | -0.00 | -0.12 | no |
| `parallelTriads` | explanatory vs marketing | -0.06 | -0.07 | -0.01 | no |
| `parallelTriads` | institutional vs literary | -0.02 | -0.06 | -0.01 | no |
| `parallelTriads` | institutional vs marketing | 0.02 | -0.13 | 0.08 | no |
| `parallelTriads` | literary vs marketing | 0.04 | -0.10 | 0.09 | no |
| `stackedConditionals` | business-email vs explanatory | -0.07 | -0.01 | -0.12 | no |
| `stackedConditionals` | business-email vs institutional | -0.05 | -0.01 | -0.07 | no |
| `stackedConditionals` | business-email vs literary | -0.07 | -0.01 | -0.08 | no |
| `stackedConditionals` | business-email vs marketing | -0.01 | -0.07 | 0.06 | no |
| `stackedConditionals` | explanatory vs institutional | 0.02 | -0.08 | 0.06 | no |
| `stackedConditionals` | explanatory vs literary | -0.00 | -0.08 | 0.04 | no |
| `stackedConditionals` | explanatory vs marketing | 0.06 | -0.04 | 0.12 | no |
| `stackedConditionals` | institutional vs literary | -0.02 | -0.07 | -0.01 | no |
| `stackedConditionals` | institutional vs marketing | 0.04 | -0.04 | 0.10 | no |
| `stackedConditionals` | literary vs marketing | 0.06 | -0.07 | 0.10 | no |
| `clauseDepth` | business-email vs explanatory | -0.64 | 0.59 | -0.78 | no |
| `clauseDepth` | business-email vs institutional | -0.68 | 0.61 | -0.84 | no |
| `clauseDepth` | business-email vs literary | -1.22 | 1.14 | -1.27 | yes |
| `clauseDepth` | business-email vs marketing | -0.42 | 0.30 | -0.49 | no |
| `clauseDepth` | explanatory vs institutional | -0.02 | -0.05 | -0.03 | no |
| `clauseDepth` | explanatory vs literary | -0.73 | 0.65 | -0.71 | no |
| `clauseDepth` | explanatory vs marketing | 0.24 | 0.10 | 0.28 | no |
| `clauseDepth` | institutional vs literary | -0.72 | 0.64 | -0.69 | no |
| `clauseDepth` | institutional vs marketing | 0.27 | 0.14 | 0.32 | no |
| `clauseDepth` | literary vs marketing | 0.76 | 0.66 | 0.75 | no |
| `sentenceCv` | business-email vs explanatory | 0.12 | 0.04 | 0.33 | no |
| `sentenceCv` | business-email vs institutional | -0.18 | 0.10 | 0.02 | no |
| `sentenceCv` | business-email vs literary | -0.09 | 0.00 | 0.08 | no |
| `sentenceCv` | business-email vs marketing | 0.38 | 0.22 | 0.55 | no |
| `sentenceCv` | explanatory vs institutional | -0.31 | 0.24 | -0.33 | no |
| `sentenceCv` | explanatory vs literary | -0.21 | 0.12 | -0.26 | no |
| `sentenceCv` | explanatory vs marketing | 0.30 | 0.14 | 0.33 | no |
| `sentenceCv` | institutional vs literary | 0.09 | 0.00 | 0.06 | no |
| `sentenceCv` | institutional vs marketing | 0.56 | 0.42 | 0.61 | no |
| `sentenceCv` | literary vs marketing | 0.46 | 0.30 | 0.52 | no |
| `hedgeRate` | business-email vs explanatory | -0.14 | 0.07 | -0.16 | no |
| `hedgeRate` | business-email vs institutional | 0.13 | 0.03 | 0.14 | no |
| `hedgeRate` | business-email vs literary | -0.10 | 0.03 | -0.05 | no |
| `hedgeRate` | business-email vs marketing | 0.24 | 0.14 | -0.01 | no |
| `hedgeRate` | explanatory vs institutional | 0.30 | 0.24 | 0.32 | no |
| `hedgeRate` | explanatory vs literary | 0.04 | -0.02 | 0.11 | no |
| `hedgeRate` | explanatory vs marketing | 0.39 | 0.31 | 0.15 | no |
| `hedgeRate` | institutional vs literary | -0.26 | 0.15 | -0.21 | no |
| `hedgeRate` | institutional vs marketing | 0.18 | 0.07 | -0.19 | no |
| `hedgeRate` | literary vs marketing | 0.35 | 0.25 | 0.04 | no |
| `hedgedClose` | business-email vs explanatory | -0.13 | 0.06 | -0.11 | no |
| `hedgedClose` | business-email vs institutional | 0.12 | 0.06 | 0.08 | no |
| `hedgedClose` | business-email vs literary | -0.06 | -0.03 | -0.00 | no |
| `hedgedClose` | business-email vs marketing | 0.23 | 0.15 | 0.10 | no |
| `hedgedClose` | explanatory vs institutional | 0.24 | 0.19 | 0.20 | no |
| `hedgedClose` | explanatory vs literary | 0.07 | -0.00 | 0.11 | no |
| `hedgedClose` | explanatory vs marketing | 0.34 | 0.27 | 0.20 | no |
| `hedgedClose` | institutional vs literary | -0.18 | 0.09 | -0.09 | no |
| `hedgedClose` | institutional vs marketing | 0.13 | 0.03 | 0.02 | no |
| `hedgedClose` | literary vs marketing | 0.28 | 0.18 | 0.11 | no |
| `nominalisationRate` | business-email vs explanatory | 0.05 | -0.03 | 0.16 | no |
| `nominalisationRate` | business-email vs institutional | -0.50 | 0.41 | -0.40 | no |
| `nominalisationRate` | business-email vs literary | 0.28 | 0.22 | 0.38 | no |
| `nominalisationRate` | business-email vs marketing | -0.45 | 0.33 | -0.40 | no |
| `nominalisationRate` | explanatory vs institutional | -0.60 | 0.50 | -0.63 | no |
| `nominalisationRate` | explanatory vs literary | 0.26 | 0.16 | 0.26 | no |
| `nominalisationRate` | explanatory vs marketing | -0.59 | 0.42 | -0.69 | no |
| `nominalisationRate` | institutional vs literary | 0.91 | 0.84 | 0.92 | yes |
| `nominalisationRate` | institutional vs marketing | 0.02 | -0.13 | -0.04 | no |
| `nominalisationRate` | literary vs marketing | -1.01 | 0.77 | -1.07 | yes |
| `pronounOpenerShare` | business-email vs explanatory | 0.10 | 0.05 | 0.05 | no |
| `pronounOpenerShare` | business-email vs institutional | -0.04 | -0.03 | -0.03 | no |
| `pronounOpenerShare` | business-email vs literary | 0.11 | 0.03 | 0.10 | no |
| `pronounOpenerShare` | business-email vs marketing | -1.06 | 0.75 | -1.05 | yes |
| `pronounOpenerShare` | explanatory vs institutional | -0.14 | 0.09 | -0.08 | no |
| `pronounOpenerShare` | explanatory vs literary | 0.01 | -0.08 | 0.05 | no |
| `pronounOpenerShare` | explanatory vs marketing | -1.32 | 0.93 | -1.17 | yes |
| `pronounOpenerShare` | institutional vs literary | 0.15 | 0.07 | 0.13 | no |
| `pronounOpenerShare` | institutional vs marketing | -1.03 | 0.72 | -1.02 | yes |
| `pronounOpenerShare` | literary vs marketing | -1.28 | 0.89 | -1.21 | yes |
| `transitionOpenerShare` | business-email vs explanatory | -0.13 | 0.06 | -0.06 | no |
| `transitionOpenerShare` | business-email vs institutional | -0.12 | 0.06 | -0.06 | no |
| `transitionOpenerShare` | business-email vs literary | 0.09 | 0.02 | 0.05 | no |
| `transitionOpenerShare` | business-email vs marketing | -0.17 | -0.04 | 0.01 | no |
| `transitionOpenerShare` | explanatory vs institutional | 0.01 | -0.05 | -0.00 | no |
| `transitionOpenerShare` | explanatory vs literary | 0.23 | 0.17 | 0.10 | no |
| `transitionOpenerShare` | explanatory vs marketing | -0.02 | -0.14 | 0.07 | no |
| `transitionOpenerShare` | institutional vs literary | 0.21 | 0.16 | 0.11 | no |
| `transitionOpenerShare` | institutional vs marketing | -0.03 | -0.14 | 0.07 | no |
| `transitionOpenerShare` | literary vs marketing | -0.35 | 0.08 | -0.03 | no |
| `impersonalOpenerShare` | business-email vs explanatory | -0.43 | 0.35 | -0.44 | no |
| `impersonalOpenerShare` | business-email vs institutional | -0.32 | 0.24 | -0.35 | no |
| `impersonalOpenerShare` | business-email vs literary | -0.11 | 0.04 | -0.09 | no |
| `impersonalOpenerShare` | business-email vs marketing | -0.22 | -0.02 | -0.04 | no |
| `impersonalOpenerShare` | explanatory vs institutional | 0.13 | 0.04 | 0.11 | no |
| `impersonalOpenerShare` | explanatory vs literary | 0.33 | 0.23 | 0.35 | no |
| `impersonalOpenerShare` | explanatory vs marketing | 0.23 | 0.10 | 0.33 | no |
| `impersonalOpenerShare` | institutional vs literary | 0.22 | 0.13 | 0.25 | no |
| `impersonalOpenerShare` | institutional vs marketing | 0.13 | -0.01 | 0.26 | no |
| `impersonalOpenerShare` | literary vs marketing | -0.08 | -0.11 | 0.05 | no |
| `commasPerSentence` | business-email vs explanatory | -0.46 | 0.41 | -0.64 | no |
| `commasPerSentence` | business-email vs institutional | -0.75 | 0.66 | -0.91 | no |
| `commasPerSentence` | business-email vs literary | -1.29 | 1.20 | -1.38 | yes |
| `commasPerSentence` | business-email vs marketing | -0.57 | 0.43 | -0.60 | no |
| `commasPerSentence` | explanatory vs institutional | -0.25 | 0.18 | -0.24 | no |
| `commasPerSentence` | explanatory vs literary | -0.94 | 0.85 | -0.92 | yes |
| `commasPerSentence` | explanatory vs marketing | -0.06 | -0.07 | 0.04 | no |
| `commasPerSentence` | institutional vs literary | -0.76 | 0.68 | -0.76 | no |
| `commasPerSentence` | institutional vs marketing | 0.19 | 0.07 | 0.26 | no |
| `commasPerSentence` | literary vs marketing | 0.74 | 0.64 | 0.77 | no |
| `commasPer100` | business-email vs explanatory | -0.29 | 0.23 | -0.47 | no |
| `commasPer100` | business-email vs institutional | -0.40 | 0.32 | -0.55 | no |
| `commasPer100` | business-email vs literary | -1.33 | 1.25 | -1.54 | yes |
| `commasPer100` | business-email vs marketing | -0.28 | 0.14 | -0.29 | no |
| `commasPer100` | explanatory vs institutional | -0.09 | 0.01 | -0.03 | no |
| `commasPer100` | explanatory vs literary | -1.10 | 1.00 | -1.14 | yes |
| `commasPer100` | explanatory vs marketing | -0.01 | -0.14 | 0.16 | no |
| `commasPer100` | institutional vs literary | -1.10 | 1.02 | -1.20 | yes |
| `commasPer100` | institutional vs marketing | 0.10 | -0.05 | 0.24 | no |
| `commasPer100` | literary vs marketing | 0.98 | 0.89 | 1.14 | yes |
| `participialRate` | business-email vs explanatory | -0.20 | 0.11 | -0.26 | no |
| `participialRate` | business-email vs institutional | -0.18 | 0.10 | -0.26 | no |
| `participialRate` | business-email vs literary | -0.49 | 0.42 | -0.59 | no |
| `participialRate` | business-email vs marketing | -0.45 | 0.24 | -0.63 | no |
| `participialRate` | explanatory vs institutional | 0.03 | -0.04 | 0.02 | no |
| `participialRate` | explanatory vs literary | -0.35 | 0.30 | -0.38 | no |
| `participialRate` | explanatory vs marketing | -0.17 | 0.03 | -0.18 | no |
| `participialRate` | institutional vs literary | -0.37 | 0.30 | -0.40 | no |
| `participialRate` | institutional vs marketing | -0.20 | 0.05 | -0.20 | no |
| `participialRate` | literary vs marketing | 0.19 | 0.10 | 0.21 | no |
| `coordinationRate` | business-email vs explanatory | -0.15 | 0.05 | -0.10 | no |
| `coordinationRate` | business-email vs institutional | -0.12 | 0.03 | -0.07 | no |
| `coordinationRate` | business-email vs literary | -0.03 | -0.05 | 0.03 | no |
| `coordinationRate` | business-email vs marketing | -0.95 | 0.73 | -0.84 | yes |
| `coordinationRate` | explanatory vs institutional | 0.04 | -0.03 | 0.03 | no |
| `coordinationRate` | explanatory vs literary | 0.13 | 0.07 | 0.14 | no |
| `coordinationRate` | explanatory vs marketing | -0.85 | 0.65 | -0.83 | yes |
| `coordinationRate` | institutional vs literary | 0.10 | 0.00 | 0.12 | no |
| `coordinationRate` | institutional vs marketing | -0.99 | 0.77 | -0.93 | yes |
| `coordinationRate` | literary vs marketing | -1.05 | 0.83 | -1.01 | yes |
| `skeletonRepeat` | business-email vs explanatory | -0.25 | 0.19 | -0.33 | no |
| `skeletonRepeat` | business-email vs institutional | -0.36 | 0.27 | -0.45 | no |
| `skeletonRepeat` | business-email vs literary | -0.10 | 0.07 | -0.25 | no |
| `skeletonRepeat` | business-email vs marketing | -0.16 | 0.07 | -0.31 | no |
| `skeletonRepeat` | explanatory vs institutional | -0.08 | -0.04 | -0.08 | no |
| `skeletonRepeat` | explanatory vs literary | 0.16 | 0.07 | 0.08 | no |
| `skeletonRepeat` | explanatory vs marketing | 0.09 | -0.04 | 0.05 | no |
| `skeletonRepeat` | institutional vs literary | 0.28 | 0.16 | 0.17 | no |
| `skeletonRepeat` | institutional vs marketing | 0.19 | -0.00 | 0.14 | no |
| `skeletonRepeat` | literary vs marketing | -0.08 | -0.06 | -0.04 | no |
