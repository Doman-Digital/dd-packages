# Shape features: human baselines against AI copy

Measured 2026-09-28 by `scripts/shape/measure.mjs`, 300 bootstrap resamples. Generated from `report.json`; do not edit by hand.

Generation: 450/450 original/edit pairs complete. Complete.

## Samples (blurb-sized paragraphs)

| Side | Set | Blurbs |
| --- | --- | ---: |
| human | business-email | 12000 |
| human | literary | 12000 |
| human | institutional | 12000 |
| human | explanatory | 12000 |
| human | marketing | 715 |
| AI | claude-haiku-4-5-20251001 | 189 |
| AI | claude-opus-5-5 | 274 |
| AI | claude-sonnet-5 | 161 |
| AI | legacy-2026-09-23 | 1083 |
| AI | edited ("sound more human") | 648 |

## Every feature

Effect sizes are register-matched: service-blurb, booking-description, cta-block against marketing; enquiry-reply, internal-email against business-email. d with its 95% bootstrap interval. The threshold is the loosest at which no human register's tuning half, of any kind, trips more than 5%. TPR is the share of matched AI blurbs it catches; *edited* is after the edit pass.

| Feature | Direction | d marketing [95% CI] | d business-email [95% CI] | edited d marketing | edited d business-email | Legacy d | Threshold | Worst holdout FP | TPR | TPR edited | Ships |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `tricolons` | higher in AI | 0.66 [0.53, 0.80] | 0.56 [0.33, 0.64] | 0.52 | 0.59 | -0.14 | 3 | 1.5% | 2.4% | 3.1% | no: marketing: |d| 0.66 < 0.8; business-email: |d| 0.56 < 0.8; business-email: lower bound 0.33 < 0.5; sign differs by model, genre or on the legacy sample |
| `parallelTriads` | higher in AI | 0.21 [0.06, 0.33] | 0.23 [0.04, 0.44] | 0.24 | 0.13 | 0.05 | 1 | 2.0% | 3.0% | 2.9% | no: marketing: |d| 0.21 < 0.8; marketing: lower bound 0.06 < 0.5; business-email: |d| 0.23 < 0.8; business-email: lower bound 0.04 < 0.5; sign differs by model, genre or on the legacy sample |
| `stackedConditionals` | higher in AI | 0.06 [-0.10, 0.18] | 0.00 [-0.08, 0.17] | 0.08 | 0.00 | -0.03 | 1 | 1.4% | 0.8% | 0.9% | no: marketing: |d| 0.06 < 0.8; marketing: lower bound -0.10 < 0.5; business-email: |d| 0.00 < 0.8; business-email: lower bound -0.08 < 0.5; sign differs by model, genre or on the legacy sample |
| `clauseDepth` | higher in AI | 0.47 [0.24, 0.65] | 0.71 [0.59, 0.84] | 0.44 | 0.75 | -0.04 | 5.25 | 4.5% | 0.2% | 0.2% | no: marketing: |d| 0.47 < 0.8; marketing: lower bound 0.24 < 0.5; business-email: |d| 0.71 < 0.8; sign differs by model, genre or on the legacy sample |
| `sentenceCv` | lower in AI | -0.67 [-0.86, -0.47] | -0.47 [-0.63, -0.33] | -0.11 | -0.38 | 0.68 | 0.116 | 4.1% | 13.3% | 6.9% | no: marketing: |d| 0.67 < 0.8; marketing: lower bound 0.47 < 0.5; business-email: |d| 0.47 < 0.8; business-email: lower bound 0.33 < 0.5; sign differs by model, genre or on the legacy sample |
| `hedgeRate` | mixed | -0.05 [-0.20, 0.05] | 0.63 [0.45, 0.75] | 0.05 | 0.41 | 0.16 | 3.125 | 5.0% | 7.1% | 6.8% | no: marketing: |d| 0.05 < 0.8; marketing: lower bound -0.05 < 0.5; business-email: |d| 0.63 < 0.8; business-email: lower bound 0.45 < 0.5; sign differs between registers; a holdout half trips above 5% |
| `hedgedClose` | mixed | -0.10 [-0.27, 0.03] | 0.50 [0.39, 0.58] | 0.11 | 0.37 | 0.14 | – | – | – | – | no: marketing: |d| 0.10 < 0.8; marketing: lower bound -0.03 < 0.5; business-email: |d| 0.50 < 0.8; business-email: lower bound 0.39 < 0.5; sign differs between registers; no threshold keeps every human register at 5% or less |
| `nominalisationRate` | mixed | 0.03 [-0.13, 0.18] | -0.18 [-0.24, -0.09] | -0.65 | -0.40 | -0.32 | 10.417 | 5.6% | 1.1% | 0.2% | no: marketing: |d| 0.03 < 0.8; marketing: lower bound -0.13 < 0.5; business-email: |d| 0.18 < 0.8; business-email: lower bound 0.09 < 0.5; sign differs between registers; a holdout half trips above 5% |
| `pronounOpenerShare` | higher in AI | 0.00 [-0.17, 0.17] | 0.31 [0.19, 0.46] | 0.24 | 0.19 | -0.15 | – | – | – | – | no: marketing: |d| 0.00 < 0.8; marketing: lower bound -0.17 < 0.5; business-email: |d| 0.31 < 0.8; business-email: lower bound 0.19 < 0.5; sign differs by model, genre or on the legacy sample; no threshold keeps every human register at 5% or less |
| `transitionOpenerShare` | lower in AI | -0.22 [-0.28, -0.14] | -0.14 [-0.17, -0.13] | -0.22 | -0.14 | -0.34 | – | – | – | – | no: marketing: |d| 0.22 < 0.8; marketing: lower bound 0.14 < 0.5; business-email: |d| 0.14 < 0.8; business-email: lower bound 0.13 < 0.5; no threshold keeps every human register at 5% or less |
| `impersonalOpenerShare` | lower in AI | -0.17 [-0.33, 0.03] | -0.12 [-0.19, -0.04] | 0.08 | -0.03 | -0.10 | – | – | – | – | no: marketing: |d| 0.17 < 0.8; marketing: lower bound -0.03 < 0.5; business-email: |d| 0.12 < 0.8; business-email: lower bound 0.04 < 0.5; sign differs by model, genre or on the legacy sample; no threshold keeps every human register at 5% or less |
| `commasPerSentence` | higher in AI | 0.57 [0.34, 0.73] | 0.63 [0.48, 0.76] | 0.42 | 0.62 | -0.04 | 4.25 | 4.7% | 0.3% | 0.3% | no: marketing: |d| 0.57 < 0.8; marketing: lower bound 0.34 < 0.5; business-email: |d| 0.63 < 0.8; business-email: lower bound 0.48 < 0.5; sign differs by model, genre or on the legacy sample |
| `commasPer100` | higher in AI | 0.70 [0.47, 0.88] | 0.48 [0.35, 0.57] | 0.66 | 0.52 | 0.31 | 15.385 | 5.5% | 0.8% | 0.8% | no: marketing: |d| 0.70 < 0.8; marketing: lower bound 0.47 < 0.5; business-email: |d| 0.48 < 0.8; business-email: lower bound 0.35 < 0.5; sign differs by model, genre or on the legacy sample; a holdout half trips above 5% |
| `participialRate` | higher in AI | 0.27 [0.14, 0.41] | 0.26 [0.10, 0.41] | 0.06 | 0.20 | -0.07 | 0.667 | 1.8% | 1.9% | 1.2% | no: marketing: |d| 0.27 < 0.8; marketing: lower bound 0.14 < 0.5; business-email: |d| 0.26 < 0.8; business-email: lower bound 0.10 < 0.5; sign differs by model, genre or on the legacy sample |
| `coordinationRate` | higher in AI | 0.51 [0.41, 0.68] | 0.47 [0.31, 0.61] | 0.08 | 0.33 | -0.24 | 6.383 | 5.3% | 5.1% | 1.9% | no: marketing: |d| 0.51 < 0.8; marketing: lower bound 0.41 < 0.5; business-email: |d| 0.47 < 0.8; business-email: lower bound 0.31 < 0.5; sign differs by model, genre or on the legacy sample; a holdout half trips above 5% |
| `skeletonRepeat` | mixed | -0.01 [-0.17, 0.12] | 0.15 [0.04, 0.28] | -0.31 | 0.03 | -0.47 | 0.2 | 5.0% | 5.8% | 2.9% | no: marketing: |d| 0.01 < 0.8; marketing: lower bound -0.12 < 0.5; business-email: |d| 0.15 < 0.8; business-email: lower bound 0.04 < 0.5; sign differs between registers; a holdout half trips above 5%; experimental: reported, never shipped |
| `shapeStack` | higher in AI | 0.56 [0.39, 0.69] | 0.68 [0.54, 0.78] | 0.50 | 0.58 | -0.04 | 3 | 2.0% | 1.3% | 1.2% | no: marketing: |d| 0.56 < 0.8; marketing: lower bound 0.39 < 0.5; business-email: |d| 0.68 < 0.8; sign differs by model, genre or on the legacy sample |

## By model and genre (d against the matched register)

| Feature | Model / register | d |
| --- | --- | ---: |
| `tricolons` | claude-haiku-4-5-20251001 / marketing | 0.44 |
| `tricolons` | claude-haiku-4-5-20251001 / business-email | 0.38 |
| `tricolons` | claude-opus-5-5 / marketing | 0.95 |
| `tricolons` | claude-opus-5-5 / business-email | 0.88 |
| `tricolons` | claude-sonnet-5 / marketing | 0.76 |
| `tricolons` | claude-sonnet-5 / business-email | 0.04 |
| `tricolons` | service-blurb | 1.24 |
| `tricolons` | booking-description | 0.98 |
| `tricolons` | cta-block | -0.11 |
| `tricolons` | enquiry-reply | 0.86 |
| `tricolons` | internal-email | 0.12 |
| `parallelTriads` | claude-haiku-4-5-20251001 / marketing | 0.06 |
| `parallelTriads` | claude-haiku-4-5-20251001 / business-email | 0.38 |
| `parallelTriads` | claude-opus-5-5 / marketing | 0.39 |
| `parallelTriads` | claude-opus-5-5 / business-email | 0.19 |
| `parallelTriads` | claude-sonnet-5 / marketing | 0.27 |
| `parallelTriads` | claude-sonnet-5 / business-email | 0.26 |
| `parallelTriads` | service-blurb | 0.33 |
| `parallelTriads` | booking-description | 0.21 |
| `parallelTriads` | cta-block | 0.21 |
| `parallelTriads` | enquiry-reply | 0.41 |
| `parallelTriads` | internal-email | -0.05 |
| `stackedConditionals` | claude-haiku-4-5-20251001 / marketing | -0.09 |
| `stackedConditionals` | claude-haiku-4-5-20251001 / business-email | 0.06 |
| `stackedConditionals` | claude-opus-5-5 / marketing | -0.09 |
| `stackedConditionals` | claude-opus-5-5 / business-email | 0.00 |
| `stackedConditionals` | claude-sonnet-5 / marketing | 0.26 |
| `stackedConditionals` | claude-sonnet-5 / business-email | -0.07 |
| `stackedConditionals` | service-blurb | -0.09 |
| `stackedConditionals` | booking-description | 0.06 |
| `stackedConditionals` | cta-block | 0.17 |
| `stackedConditionals` | enquiry-reply | -0.01 |
| `stackedConditionals` | internal-email | 0.02 |
| `clauseDepth` | claude-haiku-4-5-20251001 / marketing | 0.02 |
| `clauseDepth` | claude-haiku-4-5-20251001 / business-email | 0.32 |
| `clauseDepth` | claude-opus-5-5 / marketing | 0.78 |
| `clauseDepth` | claude-opus-5-5 / business-email | 0.94 |
| `clauseDepth` | claude-sonnet-5 / marketing | 0.57 |
| `clauseDepth` | claude-sonnet-5 / business-email | 0.71 |
| `clauseDepth` | service-blurb | 0.81 |
| `clauseDepth` | booking-description | 0.70 |
| `clauseDepth` | cta-block | -0.13 |
| `clauseDepth` | enquiry-reply | 1.09 |
| `clauseDepth` | internal-email | 0.14 |
| `sentenceCv` | claude-haiku-4-5-20251001 / marketing | -0.59 |
| `sentenceCv` | claude-haiku-4-5-20251001 / business-email | -0.80 |
| `sentenceCv` | claude-opus-5-5 / marketing | -0.59 |
| `sentenceCv` | claude-opus-5-5 / business-email | -0.37 |
| `sentenceCv` | claude-sonnet-5 / marketing | -0.71 |
| `sentenceCv` | claude-sonnet-5 / business-email | -0.46 |
| `sentenceCv` | service-blurb | -1.03 |
| `sentenceCv` | booking-description | -0.43 |
| `sentenceCv` | cta-block | -0.24 |
| `sentenceCv` | enquiry-reply | -0.32 |
| `sentenceCv` | internal-email | -0.67 |
| `hedgeRate` | claude-haiku-4-5-20251001 / marketing | -0.09 |
| `hedgeRate` | claude-haiku-4-5-20251001 / business-email | 0.84 |
| `hedgeRate` | claude-opus-5-5 / marketing | -0.13 |
| `hedgeRate` | claude-opus-5-5 / business-email | 0.33 |
| `hedgeRate` | claude-sonnet-5 / marketing | 0.08 |
| `hedgeRate` | claude-sonnet-5 / business-email | 1.20 |
| `hedgeRate` | service-blurb | -0.27 |
| `hedgeRate` | booking-description | 0.30 |
| `hedgeRate` | cta-block | -0.21 |
| `hedgeRate` | enquiry-reply | 0.67 |
| `hedgeRate` | internal-email | 0.60 |
| `hedgedClose` | claude-haiku-4-5-20251001 / marketing | -0.11 |
| `hedgedClose` | claude-haiku-4-5-20251001 / business-email | 0.42 |
| `hedgedClose` | claude-opus-5-5 / marketing | -0.23 |
| `hedgedClose` | claude-opus-5-5 / business-email | 0.51 |
| `hedgedClose` | claude-sonnet-5 / marketing | 0.04 |
| `hedgedClose` | claude-sonnet-5 / business-email | 0.60 |
| `hedgedClose` | service-blurb | -0.19 |
| `hedgedClose` | booking-description | 0.15 |
| `hedgedClose` | cta-block | -0.28 |
| `hedgedClose` | enquiry-reply | 0.42 |
| `hedgedClose` | internal-email | 0.63 |
| `nominalisationRate` | claude-haiku-4-5-20251001 / marketing | 0.45 |
| `nominalisationRate` | claude-haiku-4-5-20251001 / business-email | -0.00 |
| `nominalisationRate` | claude-opus-5-5 / marketing | -0.29 |
| `nominalisationRate` | claude-opus-5-5 / business-email | -0.27 |
| `nominalisationRate` | claude-sonnet-5 / marketing | -0.08 |
| `nominalisationRate` | claude-sonnet-5 / business-email | -0.20 |
| `nominalisationRate` | service-blurb | 0.07 |
| `nominalisationRate` | booking-description | 0.30 |
| `nominalisationRate` | cta-block | -0.29 |
| `nominalisationRate` | enquiry-reply | -0.02 |
| `nominalisationRate` | internal-email | -0.43 |
| `pronounOpenerShare` | claude-haiku-4-5-20251001 / marketing | 0.03 |
| `pronounOpenerShare` | claude-haiku-4-5-20251001 / business-email | 0.39 |
| `pronounOpenerShare` | claude-opus-5-5 / marketing | -0.07 |
| `pronounOpenerShare` | claude-opus-5-5 / business-email | 0.43 |
| `pronounOpenerShare` | claude-sonnet-5 / marketing | 0.04 |
| `pronounOpenerShare` | claude-sonnet-5 / business-email | -0.10 |
| `pronounOpenerShare` | service-blurb | 0.00 |
| `pronounOpenerShare` | booking-description | 0.51 |
| `pronounOpenerShare` | cta-block | -0.51 |
| `pronounOpenerShare` | enquiry-reply | 0.66 |
| `pronounOpenerShare` | internal-email | -0.25 |
| `transitionOpenerShare` | claude-haiku-4-5-20251001 / marketing | -0.18 |
| `transitionOpenerShare` | claude-haiku-4-5-20251001 / business-email | -0.14 |
| `transitionOpenerShare` | claude-opus-5-5 / marketing | -0.18 |
| `transitionOpenerShare` | claude-opus-5-5 / business-email | -0.14 |
| `transitionOpenerShare` | claude-sonnet-5 / marketing | -0.18 |
| `transitionOpenerShare` | claude-sonnet-5 / business-email | -0.14 |
| `transitionOpenerShare` | service-blurb | -0.18 |
| `transitionOpenerShare` | booking-description | -0.18 |
| `transitionOpenerShare` | cta-block | -0.18 |
| `transitionOpenerShare` | enquiry-reply | -0.14 |
| `transitionOpenerShare` | internal-email | -0.14 |
| `impersonalOpenerShare` | claude-haiku-4-5-20251001 / marketing | -0.29 |
| `impersonalOpenerShare` | claude-haiku-4-5-20251001 / business-email | -0.15 |
| `impersonalOpenerShare` | claude-opus-5-5 / marketing | -0.12 |
| `impersonalOpenerShare` | claude-opus-5-5 / business-email | -0.07 |
| `impersonalOpenerShare` | claude-sonnet-5 / marketing | -0.04 |
| `impersonalOpenerShare` | claude-sonnet-5 / business-email | -0.20 |
| `impersonalOpenerShare` | service-blurb | -0.29 |
| `impersonalOpenerShare` | booking-description | 0.10 |
| `impersonalOpenerShare` | cta-block | -0.29 |
| `impersonalOpenerShare` | enquiry-reply | -0.17 |
| `impersonalOpenerShare` | internal-email | -0.04 |
| `commasPerSentence` | claude-haiku-4-5-20251001 / marketing | 0.14 |
| `commasPerSentence` | claude-haiku-4-5-20251001 / business-email | 0.30 |
| `commasPerSentence` | claude-opus-5-5 / marketing | 0.87 |
| `commasPerSentence` | claude-opus-5-5 / business-email | 0.75 |
| `commasPerSentence` | claude-sonnet-5 / marketing | 0.63 |
| `commasPerSentence` | claude-sonnet-5 / business-email | 0.84 |
| `commasPerSentence` | service-blurb | 0.93 |
| `commasPerSentence` | booking-description | 0.75 |
| `commasPerSentence` | cta-block | -0.04 |
| `commasPerSentence` | enquiry-reply | 1.11 |
| `commasPerSentence` | internal-email | -0.10 |
| `commasPer100` | claude-haiku-4-5-20251001 / marketing | 0.25 |
| `commasPer100` | claude-haiku-4-5-20251001 / business-email | 0.06 |
| `commasPer100` | claude-opus-5-5 / marketing | 0.93 |
| `commasPer100` | claude-opus-5-5 / business-email | 0.67 |
| `commasPer100` | claude-sonnet-5 / marketing | 0.86 |
| `commasPer100` | claude-sonnet-5 / business-email | 0.61 |
| `commasPer100` | service-blurb | 1.03 |
| `commasPer100` | booking-description | 0.85 |
| `commasPer100` | cta-block | 0.18 |
| `commasPer100` | enquiry-reply | 0.94 |
| `commasPer100` | internal-email | -0.23 |
| `participialRate` | claude-haiku-4-5-20251001 / marketing | 0.22 |
| `participialRate` | claude-haiku-4-5-20251001 / business-email | 0.10 |
| `participialRate` | claude-opus-5-5 / marketing | 0.40 |
| `participialRate` | claude-opus-5-5 / business-email | 0.40 |
| `participialRate` | claude-sonnet-5 / marketing | 0.23 |
| `participialRate` | claude-sonnet-5 / business-email | 0.12 |
| `participialRate` | service-blurb | 0.86 |
| `participialRate` | booking-description | 0.11 |
| `participialRate` | cta-block | -0.22 |
| `participialRate` | enquiry-reply | 0.52 |
| `participialRate` | internal-email | -0.17 |
| `coordinationRate` | claude-haiku-4-5-20251001 / marketing | 0.70 |
| `coordinationRate` | claude-haiku-4-5-20251001 / business-email | 0.44 |
| `coordinationRate` | claude-opus-5-5 / marketing | 0.37 |
| `coordinationRate` | claude-opus-5-5 / business-email | 0.64 |
| `coordinationRate` | claude-sonnet-5 / marketing | 0.46 |
| `coordinationRate` | claude-sonnet-5 / business-email | 0.08 |
| `coordinationRate` | service-blurb | 0.64 |
| `coordinationRate` | booking-description | 0.24 |
| `coordinationRate` | cta-block | 0.64 |
| `coordinationRate` | enquiry-reply | 0.61 |
| `coordinationRate` | internal-email | 0.26 |
| `skeletonRepeat` | claude-haiku-4-5-20251001 / marketing | 0.24 |
| `skeletonRepeat` | claude-haiku-4-5-20251001 / business-email | 0.08 |
| `skeletonRepeat` | claude-opus-5-5 / marketing | -0.21 |
| `skeletonRepeat` | claude-opus-5-5 / business-email | 0.16 |
| `skeletonRepeat` | claude-sonnet-5 / marketing | -0.09 |
| `skeletonRepeat` | claude-sonnet-5 / business-email | 0.23 |
| `skeletonRepeat` | service-blurb | 0.09 |
| `skeletonRepeat` | booking-description | 0.11 |
| `skeletonRepeat` | cta-block | -0.25 |
| `skeletonRepeat` | enquiry-reply | -0.23 |
| `skeletonRepeat` | internal-email | 0.72 |
| `shapeStack` | claude-haiku-4-5-20251001 / marketing | 0.39 |
| `shapeStack` | claude-haiku-4-5-20251001 / business-email | 0.50 |
| `shapeStack` | claude-opus-5-5 / marketing | 0.75 |
| `shapeStack` | claude-opus-5-5 / business-email | 0.88 |
| `shapeStack` | claude-sonnet-5 / marketing | 0.63 |
| `shapeStack` | claude-sonnet-5 / business-email | 0.47 |
| `shapeStack` | service-blurb | 1.20 |
| `shapeStack` | booking-description | 0.79 |
| `shapeStack` | cta-block | -0.21 |
| `shapeStack` | enquiry-reply | 0.83 |
| `shapeStack` | internal-email | 0.47 |

## By human register (d, all fresh AI against that register)

| Feature | business-email | literary | institutional | explanatory | marketing |
| --- | ---: | ---: | ---: | ---: | ---: |
| `tricolons` | 1.25 | 0.22 | 0.54 | 0.64 | 0.19 |
| `parallelTriads` | 0.42 | 0.07 | 0.10 | 0.21 | 0.10 |
| `stackedConditionals` | 0.04 | -0.04 | -0.02 | -0.04 | 0.02 |
| `clauseDepth` | 0.83 | -0.57 | 0.07 | 0.09 | 0.34 |
| `sentenceCv` | -0.75 | -0.82 | -0.93 | -0.70 | -0.41 |
| `hedgeRate` | 0.25 | 0.16 | 0.50 | 0.11 | 0.47 |
| `hedgedClose` | 0.16 | 0.09 | 0.29 | 0.02 | 0.39 |
| `nominalisationRate` | 0.11 | 0.52 | -0.41 | 0.18 | -0.33 |
| `pronounOpenerShare` | 0.64 | 0.81 | 0.61 | 0.83 | -0.27 |
| `transitionOpenerShare` | -0.15 | -0.10 | -0.22 | -0.23 | -0.28 |
| `impersonalOpenerShare` | -0.07 | -0.15 | -0.32 | -0.39 | -0.25 |
| `commasPerSentence` | 0.93 | -0.57 | 0.12 | 0.37 | 0.27 |
| `commasPer100` | 0.71 | -0.63 | 0.44 | 0.46 | 0.39 |
| `participialRate` | 0.53 | -0.15 | 0.29 | 0.25 | 0.06 |
| `coordinationRate` | 0.95 | 1.04 | 0.98 | 0.85 | 0.02 |
| `skeletonRepeat` | 0.15 | 0.06 | -0.21 | -0.10 | -0.01 |
| `shapeStack` | 0.87 | 0.06 | 0.49 | 0.36 | 0.35 |

## Stratified d and AUC intervals

AUC is P(AI > human), with ties shared; values below 0.5 indicate lower values in AI. These are paragraph-level bootstrap intervals, not writer-level intervals.

| Feature | Stratum | d [95% CI] | AUC [95% CI] |
| --- | --- | --- | --- |
| `tricolons` | claude-haiku-4-5-20251001 / marketing | 0.44 [0.19, 0.67] | 0.60 [0.54, 0.66] |
| `tricolons` | claude-haiku-4-5-20251001 / business-email | 0.38 [0.12, 0.69] | 0.55 [0.51, 0.58] |
| `tricolons` | claude-opus-5-5 / marketing | 0.95 [0.65, 1.28] | 0.73 [0.66, 0.78] |
| `tricolons` | claude-opus-5-5 / business-email | 0.88 [0.55, 1.14] | 0.61 [0.57, 0.64] |
| `tricolons` | claude-sonnet-5 / marketing | 0.76 [0.46, 1.04] | 0.68 [0.61, 0.73] |
| `tricolons` | claude-sonnet-5 / business-email | 0.04 [-0.18, 0.35] | 0.50 [0.47, 0.54] |
| `tricolons` | service-blurb | 1.24 [0.97, 1.54] | 0.78 [0.73, 0.83] |
| `tricolons` | booking-description | 0.98 [0.70, 1.22] | 0.73 [0.67, 0.78] |
| `tricolons` | cta-block | -0.11 [-0.29, 0.10] | 0.49 [0.44, 0.55] |
| `tricolons` | enquiry-reply | 0.86 [0.50, 1.04] | 0.61 [0.56, 0.63] |
| `tricolons` | internal-email | 0.12 [-0.11, 0.27] | 0.52 [0.49, 0.54] |
| `tricolons` | business-email | 1.25 [0.99, 1.21] | 0.66 [0.64, 0.67] |
| `tricolons` | literary | 0.22 [0.09, 0.25] | 0.55 [0.53, 0.56] |
| `tricolons` | institutional | 0.54 [0.40, 0.59] | 0.60 [0.57, 0.61] |
| `tricolons` | explanatory | 0.64 [0.49, 0.70] | 0.61 [0.59, 0.62] |
| `tricolons` | marketing | 0.19 [0.08, 0.29] | 0.54 [0.52, 0.57] |
| `parallelTriads` | claude-haiku-4-5-20251001 / marketing | 0.06 [-0.17, 0.27] | 0.50 [0.49, 0.52] |
| `parallelTriads` | claude-haiku-4-5-20251001 / business-email | 0.38 [-0.06, 0.92] | 0.51 [0.50, 0.52] |
| `parallelTriads` | claude-opus-5-5 / marketing | 0.39 [0.06, 0.67] | 0.53 [0.50, 0.56] |
| `parallelTriads` | claude-opus-5-5 / business-email | 0.19 [-0.05, 0.61] | 0.50 [0.50, 0.52] |
| `parallelTriads` | claude-sonnet-5 / marketing | 0.27 [-0.03, 0.52] | 0.52 [0.50, 0.54] |
| `parallelTriads` | claude-sonnet-5 / business-email | 0.26 [-0.06, 0.87] | 0.51 [0.50, 0.52] |
| `parallelTriads` | service-blurb | 0.33 [0.02, 0.62] | 0.53 [0.50, 0.56] |
| `parallelTriads` | booking-description | 0.21 [-0.14, 0.51] | 0.51 [0.49, 0.54] |
| `parallelTriads` | cta-block | 0.21 [-0.13, 0.52] | 0.52 [0.49, 0.54] |
| `parallelTriads` | enquiry-reply | 0.41 [0.08, 0.71] | 0.51 [0.50, 0.52] |
| `parallelTriads` | internal-email | -0.05 [-0.06, -0.02] | 0.50 [0.50, 0.50] |
| `parallelTriads` | business-email | 0.42 [0.21, 0.49] | 0.51 [0.51, 0.52] |
| `parallelTriads` | literary | 0.07 [-0.03, 0.17] | 0.51 [0.50, 0.51] |
| `parallelTriads` | institutional | 0.10 [-0.01, 0.18] | 0.51 [0.50, 0.51] |
| `parallelTriads` | explanatory | 0.21 [0.03, 0.31] | 0.51 [0.50, 0.52] |
| `parallelTriads` | marketing | 0.10 [-0.03, 0.19] | 0.51 [0.50, 0.51] |
| `stackedConditionals` | claude-haiku-4-5-20251001 / marketing | -0.09 [-0.14, 0.00] | 0.50 [0.49, 0.50] |
| `stackedConditionals` | claude-haiku-4-5-20251001 / business-email | 0.06 [-0.08, 0.39] | 0.50 [0.50, 0.51] |
| `stackedConditionals` | claude-opus-5-5 / marketing | -0.09 [-0.14, 0.00] | 0.50 [0.49, 0.50] |
| `stackedConditionals` | claude-opus-5-5 / business-email | 0.00 [-0.08, 0.26] | 0.50 [0.50, 0.51] |
| `stackedConditionals` | claude-sonnet-5 / marketing | 0.26 [-0.03, 0.53] | 0.51 [0.50, 0.54] |
| `stackedConditionals` | claude-sonnet-5 / business-email | -0.07 [-0.08, -0.05] | 0.50 [0.50, 0.50] |
| `stackedConditionals` | service-blurb | -0.09 [-0.14, 0.00] | 0.50 [0.49, 0.50] |
| `stackedConditionals` | booking-description | 0.06 [-0.12, 0.32] | 0.50 [0.49, 0.52] |
| `stackedConditionals` | cta-block | 0.17 [-0.11, 0.41] | 0.51 [0.50, 0.53] |
| `stackedConditionals` | enquiry-reply | -0.01 [-0.08, 0.16] | 0.50 [0.50, 0.51] |
| `stackedConditionals` | internal-email | 0.02 [-0.08, 0.29] | 0.50 [0.50, 0.51] |
| `stackedConditionals` | business-email | 0.04 [-0.04, 0.16] | 0.50 [0.50, 0.51] |
| `stackedConditionals` | literary | -0.04 [-0.09, 0.03] | 0.50 [0.49, 0.50] |
| `stackedConditionals` | institutional | -0.02 [-0.08, 0.04] | 0.50 [0.50, 0.50] |
| `stackedConditionals` | explanatory | -0.04 [-0.09, 0.03] | 0.50 [0.50, 0.50] |
| `stackedConditionals` | marketing | 0.02 [-0.11, 0.11] | 0.50 [0.50, 0.50] |
| `clauseDepth` | claude-haiku-4-5-20251001 / marketing | 0.02 [-0.18, 0.18] | 0.55 [0.47, 0.60] |
| `clauseDepth` | claude-haiku-4-5-20251001 / business-email | 0.32 [0.12, 0.57] | 0.58 [0.52, 0.64] |
| `clauseDepth` | claude-opus-5-5 / marketing | 0.78 [0.51, 0.98] | 0.77 [0.71, 0.81] |
| `clauseDepth` | claude-opus-5-5 / business-email | 0.94 [0.80, 1.11] | 0.75 [0.73, 0.78] |
| `clauseDepth` | claude-sonnet-5 / marketing | 0.57 [0.31, 0.78] | 0.70 [0.64, 0.75] |
| `clauseDepth` | claude-sonnet-5 / business-email | 0.71 [0.43, 1.01] | 0.67 [0.60, 0.74] |
| `clauseDepth` | service-blurb | 0.81 [0.56, 1.09] | 0.77 [0.72, 0.81] |
| `clauseDepth` | booking-description | 0.70 [0.45, 0.89] | 0.76 [0.71, 0.81] |
| `clauseDepth` | cta-block | -0.13 [-0.31, 0.03] | 0.48 [0.43, 0.54] |
| `clauseDepth` | enquiry-reply | 1.09 [0.86, 1.24] | 0.75 [0.71, 0.78] |
| `clauseDepth` | internal-email | 0.14 [0.03, 0.24] | 0.59 [0.55, 0.62] |
| `clauseDepth` | business-email | 0.83 [0.74, 0.93] | 0.73 [0.71, 0.75] |
| `clauseDepth` | literary | -0.57 [-0.63, -0.52] | 0.33 [0.31, 0.35] |
| `clauseDepth` | institutional | 0.07 [-0.01, 0.13] | 0.53 [0.51, 0.55] |
| `clauseDepth` | explanatory | 0.09 [0.01, 0.14] | 0.54 [0.52, 0.56] |
| `clauseDepth` | marketing | 0.34 [0.21, 0.46] | 0.62 [0.59, 0.65] |
| `sentenceCv` | claude-haiku-4-5-20251001 / marketing | -0.59 [-0.77, -0.37] | 0.33 [0.28, 0.40] |
| `sentenceCv` | claude-haiku-4-5-20251001 / business-email | -0.80 [-1.10, -0.52] | 0.27 [0.18, 0.36] |
| `sentenceCv` | claude-opus-5-5 / marketing | -0.59 [-0.90, -0.30] | 0.32 [0.23, 0.41] |
| `sentenceCv` | claude-opus-5-5 / business-email | -0.37 [-0.54, -0.19] | 0.40 [0.35, 0.45] |
| `sentenceCv` | claude-sonnet-5 / marketing | -0.71 [-0.99, -0.46] | 0.29 [0.21, 0.38] |
| `sentenceCv` | claude-sonnet-5 / business-email | -0.46 [-0.80, -0.11] | 0.37 [0.25, 0.48] |
| `sentenceCv` | service-blurb | -1.03 [-1.25, -0.81] | 0.21 [0.16, 0.27] |
| `sentenceCv` | booking-description | -0.43 [-0.60, -0.15] | 0.38 [0.33, 0.47] |
| `sentenceCv` | cta-block | -0.24 [-0.52, 0.10] | 0.45 [0.35, 0.57] |
| `sentenceCv` | enquiry-reply | -0.32 [-0.51, -0.14] | 0.42 [0.36, 0.48] |
| `sentenceCv` | internal-email | -0.67 [-0.86, -0.47] | 0.30 [0.24, 0.37] |
| `sentenceCv` | business-email | -0.75 [-0.82, -0.65] | 0.29 [0.26, 0.32] |
| `sentenceCv` | literary | -0.82 [-0.91, -0.72] | 0.26 [0.23, 0.30] |
| `sentenceCv` | institutional | -0.93 [-1.04, -0.83] | 0.24 [0.21, 0.27] |
| `sentenceCv` | explanatory | -0.70 [-0.78, -0.56] | 0.30 [0.27, 0.34] |
| `sentenceCv` | marketing | -0.41 [-0.61, -0.22] | 0.39 [0.34, 0.45] |
| `hedgeRate` | claude-haiku-4-5-20251001 / marketing | -0.09 [-0.25, 0.05] | 0.50 [0.47, 0.52] |
| `hedgeRate` | claude-haiku-4-5-20251001 / business-email | 0.84 [0.54, 1.23] | 0.65 [0.60, 0.71] |
| `hedgeRate` | claude-opus-5-5 / marketing | -0.13 [-0.26, 0.00] | 0.50 [0.47, 0.52] |
| `hedgeRate` | claude-opus-5-5 / business-email | 0.33 [0.08, 0.48] | 0.56 [0.52, 0.59] |
| `hedgeRate` | claude-sonnet-5 / marketing | 0.08 [-0.11, 0.30] | 0.52 [0.49, 0.56] |
| `hedgeRate` | claude-sonnet-5 / business-email | 1.20 [0.89, 1.55] | 0.74 [0.69, 0.80] |
| `hedgeRate` | service-blurb | -0.27 [-0.35, -0.20] | 0.46 [0.45, 0.48] |
| `hedgeRate` | booking-description | 0.30 [0.05, 0.54] | 0.58 [0.53, 0.62] |
| `hedgeRate` | cta-block | -0.21 [-0.33, -0.11] | 0.47 [0.45, 0.49] |
| `hedgeRate` | enquiry-reply | 0.67 [0.46, 0.86] | 0.62 [0.58, 0.65] |
| `hedgeRate` | internal-email | 0.60 [0.40, 0.82] | 0.63 [0.59, 0.67] |
| `hedgeRate` | business-email | 0.25 [0.13, 0.37] | 0.55 [0.52, 0.57] |
| `hedgeRate` | literary | 0.16 [0.05, 0.26] | 0.51 [0.48, 0.53] |
| `hedgeRate` | institutional | 0.50 [0.33, 0.59] | 0.55 [0.52, 0.57] |
| `hedgeRate` | explanatory | 0.11 [0.01, 0.21] | 0.50 [0.47, 0.51] |
| `hedgeRate` | marketing | 0.47 [0.35, 0.55] | 0.60 [0.57, 0.62] |
| `hedgedClose` | claude-haiku-4-5-20251001 / marketing | -0.11 [-0.30, 0.09] | 0.48 [0.45, 0.51] |
| `hedgedClose` | claude-haiku-4-5-20251001 / business-email | 0.42 [0.16, 0.66] | 0.58 [0.53, 0.63] |
| `hedgedClose` | claude-opus-5-5 / marketing | -0.23 [-0.39, 0.01] | 0.47 [0.44, 0.50] |
| `hedgedClose` | claude-opus-5-5 / business-email | 0.51 [0.31, 0.65] | 0.60 [0.56, 0.63] |
| `hedgedClose` | claude-sonnet-5 / marketing | 0.04 [-0.18, 0.30] | 0.51 [0.47, 0.54] |
| `hedgedClose` | claude-sonnet-5 / business-email | 0.60 [0.22, 0.87] | 0.62 [0.54, 0.67] |
| `hedgedClose` | service-blurb | -0.19 [-0.35, -0.01] | 0.47 [0.45, 0.50] |
| `hedgedClose` | booking-description | 0.15 [-0.13, 0.39] | 0.52 [0.48, 0.56] |
| `hedgedClose` | cta-block | -0.28 [-0.40, -0.14] | 0.46 [0.44, 0.48] |
| `hedgedClose` | enquiry-reply | 0.42 [0.27, 0.56] | 0.58 [0.56, 0.61] |
| `hedgedClose` | internal-email | 0.63 [0.40, 0.83] | 0.62 [0.58, 0.66] |
| `hedgedClose` | business-email | 0.16 [0.06, 0.24] | 0.53 [0.51, 0.55] |
| `hedgedClose` | literary | 0.09 [0.02, 0.21] | 0.52 [0.50, 0.54] |
| `hedgedClose` | institutional | 0.29 [0.21, 0.41] | 0.55 [0.54, 0.58] |
| `hedgedClose` | explanatory | 0.02 [-0.06, 0.12] | 0.51 [0.49, 0.53] |
| `hedgedClose` | marketing | 0.39 [0.28, 0.49] | 0.58 [0.55, 0.60] |
| `nominalisationRate` | claude-haiku-4-5-20251001 / marketing | 0.45 [0.23, 0.70] | 0.68 [0.62, 0.73] |
| `nominalisationRate` | claude-haiku-4-5-20251001 / business-email | -0.00 [-0.15, 0.21] | 0.52 [0.47, 0.57] |
| `nominalisationRate` | claude-opus-5-5 / marketing | -0.29 [-0.42, -0.17] | 0.44 [0.39, 0.48] |
| `nominalisationRate` | claude-opus-5-5 / business-email | -0.27 [-0.39, -0.15] | 0.42 [0.38, 0.45] |
| `nominalisationRate` | claude-sonnet-5 / marketing | -0.08 [-0.26, 0.08] | 0.51 [0.45, 0.56] |
| `nominalisationRate` | claude-sonnet-5 / business-email | -0.20 [-0.38, 0.02] | 0.43 [0.39, 0.49] |
| `nominalisationRate` | service-blurb | 0.07 [-0.09, 0.23] | 0.56 [0.51, 0.61] |
| `nominalisationRate` | booking-description | 0.30 [0.12, 0.48] | 0.64 [0.58, 0.68] |
| `nominalisationRate` | cta-block | -0.29 [-0.44, -0.12] | 0.43 [0.38, 0.48] |
| `nominalisationRate` | enquiry-reply | -0.02 [-0.15, 0.12] | 0.50 [0.46, 0.53] |
| `nominalisationRate` | internal-email | -0.43 [-0.51, -0.34] | 0.37 [0.35, 0.41] |
| `nominalisationRate` | business-email | 0.11 [0.06, 0.21] | 0.55 [0.53, 0.58] |
| `nominalisationRate` | literary | 0.52 [0.43, 0.64] | 0.60 [0.58, 0.63] |
| `nominalisationRate` | institutional | -0.41 [-0.45, -0.29] | 0.37 [0.36, 0.40] |
| `nominalisationRate` | explanatory | 0.18 [0.12, 0.30] | 0.54 [0.52, 0.57] |
| `nominalisationRate` | marketing | -0.33 [-0.42, -0.18] | 0.42 [0.39, 0.46] |
| `pronounOpenerShare` | claude-haiku-4-5-20251001 / marketing | 0.03 [-0.17, 0.24] | 0.55 [0.48, 0.60] |
| `pronounOpenerShare` | claude-haiku-4-5-20251001 / business-email | 0.39 [0.07, 0.66] | 0.53 [0.48, 0.57] |
| `pronounOpenerShare` | claude-opus-5-5 / marketing | -0.07 [-0.33, 0.14] | 0.50 [0.43, 0.56] |
| `pronounOpenerShare` | claude-opus-5-5 / business-email | 0.43 [0.25, 0.70] | 0.56 [0.54, 0.61] |
| `pronounOpenerShare` | claude-sonnet-5 / marketing | 0.04 [-0.16, 0.25] | 0.54 [0.48, 0.60] |
| `pronounOpenerShare` | claude-sonnet-5 / business-email | -0.10 [-0.28, 0.11] | 0.48 [0.44, 0.51] |
| `pronounOpenerShare` | service-blurb | 0.00 [-0.17, 0.22] | 0.54 [0.48, 0.60] |
| `pronounOpenerShare` | booking-description | 0.51 [0.31, 0.73] | 0.68 [0.62, 0.73] |
| `pronounOpenerShare` | cta-block | -0.51 [-0.68, -0.35] | 0.37 [0.33, 0.42] |
| `pronounOpenerShare` | enquiry-reply | 0.66 [0.47, 0.88] | 0.60 [0.57, 0.64] |
| `pronounOpenerShare` | internal-email | -0.25 [-0.34, -0.11] | 0.44 [0.43, 0.47] |
| `pronounOpenerShare` | business-email | 0.64 [0.48, 0.74] | 0.62 [0.59, 0.64] |
| `pronounOpenerShare` | literary | 0.81 [0.67, 0.94] | 0.64 [0.61, 0.66] |
| `pronounOpenerShare` | institutional | 0.61 [0.46, 0.71] | 0.61 [0.58, 0.63] |
| `pronounOpenerShare` | explanatory | 0.83 [0.66, 0.93] | 0.63 [0.61, 0.65] |
| `pronounOpenerShare` | marketing | -0.27 [-0.44, -0.12] | 0.45 [0.41, 0.49] |
| `transitionOpenerShare` | claude-haiku-4-5-20251001 / marketing | -0.18 [-0.24, -0.12] | 0.49 [0.48, 0.49] |
| `transitionOpenerShare` | claude-haiku-4-5-20251001 / business-email | -0.14 [-0.16, -0.12] | 0.49 [0.49, 0.49] |
| `transitionOpenerShare` | claude-opus-5-5 / marketing | -0.18 [-0.23, -0.12] | 0.49 [0.48, 0.49] |
| `transitionOpenerShare` | claude-opus-5-5 / business-email | -0.14 [-0.16, -0.12] | 0.49 [0.49, 0.49] |
| `transitionOpenerShare` | claude-sonnet-5 / marketing | -0.18 [-0.24, -0.13] | 0.49 [0.48, 0.49] |
| `transitionOpenerShare` | claude-sonnet-5 / business-email | -0.14 [-0.16, -0.12] | 0.49 [0.49, 0.49] |
| `transitionOpenerShare` | service-blurb | -0.18 [-0.23, -0.12] | 0.49 [0.48, 0.49] |
| `transitionOpenerShare` | booking-description | -0.18 [-0.24, -0.12] | 0.49 [0.48, 0.49] |
| `transitionOpenerShare` | cta-block | -0.18 [-0.23, -0.12] | 0.49 [0.48, 0.49] |
| `transitionOpenerShare` | enquiry-reply | -0.14 [-0.16, -0.12] | 0.49 [0.49, 0.49] |
| `transitionOpenerShare` | internal-email | -0.14 [-0.16, -0.12] | 0.49 [0.49, 0.49] |
| `transitionOpenerShare` | business-email | -0.15 [-0.17, -0.13] | 0.49 [0.49, 0.49] |
| `transitionOpenerShare` | literary | -0.10 [-0.12, -0.08] | 0.49 [0.49, 0.50] |
| `transitionOpenerShare` | institutional | -0.22 [-0.25, -0.21] | 0.48 [0.47, 0.48] |
| `transitionOpenerShare` | explanatory | -0.23 [-0.26, -0.22] | 0.47 [0.47, 0.48] |
| `transitionOpenerShare` | marketing | -0.28 [-0.36, -0.18] | 0.49 [0.48, 0.49] |
| `impersonalOpenerShare` | claude-haiku-4-5-20251001 / marketing | -0.29 [-0.37, -0.21] | 0.46 [0.45, 0.48] |
| `impersonalOpenerShare` | claude-haiku-4-5-20251001 / business-email | -0.15 [-0.21, -0.01] | 0.48 [0.48, 0.50] |
| `impersonalOpenerShare` | claude-opus-5-5 / marketing | -0.12 [-0.28, 0.08] | 0.49 [0.46, 0.51] |
| `impersonalOpenerShare` | claude-opus-5-5 / business-email | -0.07 [-0.18, 0.06] | 0.49 [0.48, 0.51] |
| `impersonalOpenerShare` | claude-sonnet-5 / marketing | -0.04 [-0.21, 0.20] | 0.50 [0.47, 0.54] |
| `impersonalOpenerShare` | claude-sonnet-5 / business-email | -0.20 [-0.21, -0.18] | 0.48 [0.48, 0.48] |
| `impersonalOpenerShare` | service-blurb | -0.29 [-0.37, -0.21] | 0.46 [0.45, 0.48] |
| `impersonalOpenerShare` | booking-description | 0.10 [-0.12, 0.36] | 0.52 [0.49, 0.56] |
| `impersonalOpenerShare` | cta-block | -0.29 [-0.37, -0.21] | 0.46 [0.45, 0.48] |
| `impersonalOpenerShare` | enquiry-reply | -0.17 [-0.21, -0.12] | 0.48 [0.48, 0.49] |
| `impersonalOpenerShare` | internal-email | -0.04 [-0.19, 0.09] | 0.49 [0.48, 0.51] |
| `impersonalOpenerShare` | business-email | -0.07 [-0.14, -0.00] | 0.49 [0.49, 0.50] |
| `impersonalOpenerShare` | literary | -0.15 [-0.20, -0.10] | 0.48 [0.47, 0.48] |
| `impersonalOpenerShare` | institutional | -0.32 [-0.36, -0.28] | 0.44 [0.43, 0.44] |
| `impersonalOpenerShare` | explanatory | -0.39 [-0.41, -0.33] | 0.42 [0.41, 0.43] |
| `impersonalOpenerShare` | marketing | -0.25 [-0.38, -0.06] | 0.48 [0.46, 0.50] |
| `commasPerSentence` | claude-haiku-4-5-20251001 / marketing | 0.14 [-0.05, 0.29] | 0.60 [0.53, 0.64] |
| `commasPerSentence` | claude-haiku-4-5-20251001 / business-email | 0.30 [0.11, 0.62] | 0.54 [0.49, 0.61] |
| `commasPerSentence` | claude-opus-5-5 / marketing | 0.87 [0.58, 1.07] | 0.79 [0.74, 0.84] |
| `commasPerSentence` | claude-opus-5-5 / business-email | 0.75 [0.60, 0.95] | 0.71 [0.68, 0.74] |
| `commasPerSentence` | claude-sonnet-5 / marketing | 0.63 [0.39, 0.87] | 0.73 [0.68, 0.78] |
| `commasPerSentence` | claude-sonnet-5 / business-email | 0.84 [0.47, 1.22] | 0.69 [0.63, 0.76] |
| `commasPerSentence` | service-blurb | 0.93 [0.63, 1.21] | 0.81 [0.76, 0.85] |
| `commasPerSentence` | booking-description | 0.75 [0.50, 0.97] | 0.78 [0.72, 0.81] |
| `commasPerSentence` | cta-block | -0.04 [-0.21, 0.10] | 0.53 [0.46, 0.58] |
| `commasPerSentence` | enquiry-reply | 1.11 [0.87, 1.26] | 0.76 [0.72, 0.77] |
| `commasPerSentence` | internal-email | -0.10 [-0.23, -0.01] | 0.51 [0.46, 0.55] |
| `commasPerSentence` | business-email | 0.93 [0.81, 1.06] | 0.73 [0.71, 0.75] |
| `commasPerSentence` | literary | -0.57 [-0.63, -0.53] | 0.33 [0.31, 0.35] |
| `commasPerSentence` | institutional | 0.12 [0.03, 0.18] | 0.53 [0.50, 0.55] |
| `commasPerSentence` | explanatory | 0.37 [0.27, 0.44] | 0.60 [0.58, 0.62] |
| `commasPerSentence` | marketing | 0.27 [0.14, 0.38] | 0.60 [0.57, 0.63] |
| `commasPer100` | claude-haiku-4-5-20251001 / marketing | 0.25 [0.05, 0.46] | 0.62 [0.55, 0.68] |
| `commasPer100` | claude-haiku-4-5-20251001 / business-email | 0.06 [-0.11, 0.30] | 0.50 [0.46, 0.56] |
| `commasPer100` | claude-opus-5-5 / marketing | 0.93 [0.62, 1.12] | 0.79 [0.73, 0.83] |
| `commasPer100` | claude-opus-5-5 / business-email | 0.67 [0.53, 0.81] | 0.70 [0.67, 0.73] |
| `commasPer100` | claude-sonnet-5 / marketing | 0.86 [0.63, 1.12] | 0.77 [0.71, 0.81] |
| `commasPer100` | claude-sonnet-5 / business-email | 0.61 [0.33, 0.84] | 0.65 [0.59, 0.70] |
| `commasPer100` | service-blurb | 1.03 [0.81, 1.26] | 0.81 [0.77, 0.85] |
| `commasPer100` | booking-description | 0.85 [0.63, 1.05] | 0.78 [0.73, 0.82] |
| `commasPer100` | cta-block | 0.18 [-0.02, 0.42] | 0.58 [0.51, 0.64] |
| `commasPer100` | enquiry-reply | 0.94 [0.72, 1.04] | 0.75 [0.71, 0.76] |
| `commasPer100` | internal-email | -0.23 [-0.34, -0.14] | 0.45 [0.41, 0.48] |
| `commasPer100` | business-email | 0.71 [0.61, 0.77] | 0.70 [0.68, 0.72] |
| `commasPer100` | literary | -0.63 [-0.71, -0.59] | 0.32 [0.30, 0.33] |
| `commasPer100` | institutional | 0.44 [0.34, 0.51] | 0.60 [0.57, 0.62] |
| `commasPer100` | explanatory | 0.46 [0.36, 0.50] | 0.62 [0.60, 0.64] |
| `commasPer100` | marketing | 0.39 [0.27, 0.52] | 0.63 [0.60, 0.67] |
| `participialRate` | claude-haiku-4-5-20251001 / marketing | 0.22 [0.01, 0.44] | 0.55 [0.51, 0.59] |
| `participialRate` | claude-haiku-4-5-20251001 / business-email | 0.10 [-0.12, 0.50] | 0.50 [0.48, 0.54] |
| `participialRate` | claude-opus-5-5 / marketing | 0.40 [0.12, 0.67] | 0.58 [0.54, 0.63] |
| `participialRate` | claude-opus-5-5 / business-email | 0.40 [0.13, 0.69] | 0.53 [0.51, 0.55] |
| `participialRate` | claude-sonnet-5 / marketing | 0.23 [0.01, 0.48] | 0.55 [0.51, 0.59] |
| `participialRate` | claude-sonnet-5 / business-email | 0.12 [-0.10, 0.38] | 0.51 [0.49, 0.53] |
| `participialRate` | service-blurb | 0.86 [0.63, 1.19] | 0.68 [0.63, 0.73] |
| `participialRate` | booking-description | 0.11 [-0.10, 0.32] | 0.54 [0.49, 0.58] |
| `participialRate` | cta-block | -0.22 [-0.38, -0.04] | 0.47 [0.44, 0.49] |
| `participialRate` | enquiry-reply | 0.52 [0.22, 0.80] | 0.54 [0.51, 0.56] |
| `participialRate` | internal-email | -0.17 [-0.19, -0.14] | 0.48 [0.48, 0.49] |
| `participialRate` | business-email | 0.53 [0.38, 0.63] | 0.55 [0.54, 0.57] |
| `participialRate` | literary | -0.15 [-0.20, -0.09] | 0.47 [0.45, 0.48] |
| `participialRate` | institutional | 0.29 [0.18, 0.39] | 0.53 [0.52, 0.54] |
| `participialRate` | explanatory | 0.25 [0.15, 0.35] | 0.52 [0.51, 0.54] |
| `participialRate` | marketing | 0.06 [-0.03, 0.16] | 0.51 [0.50, 0.53] |
| `coordinationRate` | claude-haiku-4-5-20251001 / marketing | 0.70 [0.49, 1.01] | 0.69 [0.63, 0.75] |
| `coordinationRate` | claude-haiku-4-5-20251001 / business-email | 0.44 [0.13, 0.73] | 0.58 [0.52, 0.63] |
| `coordinationRate` | claude-opus-5-5 / marketing | 0.37 [0.16, 0.61] | 0.60 [0.54, 0.66] |
| `coordinationRate` | claude-opus-5-5 / business-email | 0.64 [0.42, 0.84] | 0.65 [0.60, 0.68] |
| `coordinationRate` | claude-sonnet-5 / marketing | 0.46 [0.27, 0.67] | 0.63 [0.58, 0.69] |
| `coordinationRate` | claude-sonnet-5 / business-email | 0.08 [-0.09, 0.34] | 0.52 [0.48, 0.57] |
| `coordinationRate` | service-blurb | 0.64 [0.48, 0.97] | 0.68 [0.62, 0.75] |
| `coordinationRate` | booking-description | 0.24 [0.07, 0.53] | 0.58 [0.52, 0.65] |
| `coordinationRate` | cta-block | 0.64 [0.38, 0.89] | 0.66 [0.60, 0.72] |
| `coordinationRate` | enquiry-reply | 0.61 [0.44, 0.79] | 0.64 [0.60, 0.67] |
| `coordinationRate` | internal-email | 0.26 [0.04, 0.50] | 0.55 [0.51, 0.60] |
| `coordinationRate` | business-email | 0.95 [0.80, 1.08] | 0.71 [0.69, 0.73] |
| `coordinationRate` | literary | 1.04 [0.89, 1.10] | 0.69 [0.67, 0.71] |
| `coordinationRate` | institutional | 0.98 [0.85, 1.04] | 0.67 [0.65, 0.69] |
| `coordinationRate` | explanatory | 0.85 [0.73, 0.91] | 0.67 [0.65, 0.69] |
| `coordinationRate` | marketing | 0.02 [-0.10, 0.13] | 0.50 [0.47, 0.53] |
| `skeletonRepeat` | claude-haiku-4-5-20251001 / marketing | 0.24 [0.00, 0.53] | 0.59 [0.53, 0.64] |
| `skeletonRepeat` | claude-haiku-4-5-20251001 / business-email | 0.08 [-0.10, 0.35] | 0.49 [0.46, 0.54] |
| `skeletonRepeat` | claude-opus-5-5 / marketing | -0.21 [-0.35, -0.10] | 0.48 [0.43, 0.53] |
| `skeletonRepeat` | claude-opus-5-5 / business-email | 0.16 [-0.02, 0.35] | 0.50 [0.47, 0.54] |
| `skeletonRepeat` | claude-sonnet-5 / marketing | -0.09 [-0.25, 0.15] | 0.49 [0.44, 0.55] |
| `skeletonRepeat` | claude-sonnet-5 / business-email | 0.23 [-0.05, 0.51] | 0.54 [0.47, 0.61] |
| `skeletonRepeat` | service-blurb | 0.09 [-0.08, 0.35] | 0.56 [0.52, 0.63] |
| `skeletonRepeat` | booking-description | 0.11 [-0.08, 0.34] | 0.57 [0.51, 0.62] |
| `skeletonRepeat` | cta-block | -0.25 [-0.41, -0.09] | 0.42 [0.37, 0.46] |
| `skeletonRepeat` | enquiry-reply | -0.23 [-0.28, -0.14] | 0.44 [0.43, 0.47] |
| `skeletonRepeat` | internal-email | 0.72 [0.40, 1.02] | 0.61 [0.55, 0.66] |
| `skeletonRepeat` | business-email | 0.15 [0.08, 0.26] | 0.53 [0.52, 0.55] |
| `skeletonRepeat` | literary | 0.06 [-0.06, 0.14] | 0.47 [0.45, 0.49] |
| `skeletonRepeat` | institutional | -0.21 [-0.31, -0.10] | 0.38 [0.36, 0.41] |
| `skeletonRepeat` | explanatory | -0.10 [-0.19, -0.04] | 0.44 [0.42, 0.46] |
| `skeletonRepeat` | marketing | -0.01 [-0.15, 0.14] | 0.49 [0.47, 0.52] |
| `shapeStack` | claude-haiku-4-5-20251001 / marketing | 0.39 [0.14, 0.61] | 0.60 [0.54, 0.65] |
| `shapeStack` | claude-haiku-4-5-20251001 / business-email | 0.50 [0.25, 0.75] | 0.60 [0.55, 0.66] |
| `shapeStack` | claude-opus-5-5 / marketing | 0.75 [0.43, 1.01] | 0.69 [0.61, 0.75] |
| `shapeStack` | claude-opus-5-5 / business-email | 0.88 [0.62, 1.05] | 0.67 [0.62, 0.70] |
| `shapeStack` | claude-sonnet-5 / marketing | 0.63 [0.36, 0.86] | 0.65 [0.58, 0.70] |
| `shapeStack` | claude-sonnet-5 / business-email | 0.47 [0.12, 0.74] | 0.60 [0.53, 0.66] |
| `shapeStack` | service-blurb | 1.20 [0.97, 1.46] | 0.78 [0.74, 0.83] |
| `shapeStack` | booking-description | 0.79 [0.51, 0.99] | 0.70 [0.64, 0.74] |
| `shapeStack` | cta-block | -0.21 [-0.43, 0.01] | 0.44 [0.39, 0.49] |
| `shapeStack` | enquiry-reply | 0.83 [0.63, 0.95] | 0.66 [0.63, 0.69] |
| `shapeStack` | internal-email | 0.47 [0.23, 0.68] | 0.59 [0.54, 0.64] |
| `shapeStack` | business-email | 0.87 [0.73, 0.90] | 0.67 [0.65, 0.69] |
| `shapeStack` | literary | 0.06 [-0.03, 0.13] | 0.52 [0.50, 0.54] |
| `shapeStack` | institutional | 0.49 [0.39, 0.56] | 0.62 [0.59, 0.63] |
| `shapeStack` | explanatory | 0.36 [0.25, 0.42] | 0.59 [0.56, 0.61] |
| `shapeStack` | marketing | 0.35 [0.24, 0.44] | 0.59 [0.56, 0.62] |

## Edit survival

| Feature | Original TPR | After edit TPR |
| --- | ---: | ---: |
| `tricolons` | 2.4% | 3.1% |
| `parallelTriads` | 3.0% | 2.9% |
| `stackedConditionals` | 0.8% | 0.9% |
| `clauseDepth` | 0.2% | 0.2% |
| `sentenceCv` | 13.3% | 6.9% |
| `hedgeRate` | 7.1% | 6.8% |
| `hedgedClose` | – | – |
| `nominalisationRate` | 1.1% | 0.2% |
| `pronounOpenerShare` | – | – |
| `transitionOpenerShare` | – | – |
| `impersonalOpenerShare` | – | – |
| `commasPerSentence` | 0.3% | 0.3% |
| `commasPer100` | 0.8% | 0.8% |
| `participialRate` | 1.9% | 1.2% |
| `coordinationRate` | 5.1% | 1.9% |
| `skeletonRepeat` | 5.8% | 2.9% |
| `shapeStack` | 1.3% | 1.2% |

