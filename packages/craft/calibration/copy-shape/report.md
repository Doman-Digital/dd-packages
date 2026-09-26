# Shape features: human baselines against AI copy

Measured 2026-09-26 by `scripts/shape/measure.mjs`, 300 bootstrap resamples. Generated from `report.json`; do not edit by hand.

Generation: 113/450 original/edit pairs complete. Preliminary report: no feature can ship until generation is complete.

## Samples (blurb-sized paragraphs)

| Side | Set | Blurbs |
| --- | --- | ---: |
| human | business-email | 12000 |
| human | literary | 12000 |
| human | institutional | 12000 |
| human | explanatory | 12000 |
| human | marketing | 715 |
| AI | claude-opus-5-5 | 186 |
| AI | legacy-2026-09-23 | 1083 |
| AI | edited ("sound more human") | 186 |

## Every feature

Effect sizes are register-matched: service-blurb, booking-description, cta-block against marketing; enquiry-reply, internal-email against business-email. d with its 95% bootstrap interval. The threshold is the loosest at which no human register's tuning half, of any kind, trips more than 5%. TPR is the share of matched AI blurbs it catches; *edited* is after the edit pass.

| Feature | Direction | d marketing [95% CI] | d business-email [95% CI] | edited d marketing | edited d business-email | Legacy d | Threshold | Worst holdout FP | TPR | TPR edited | Ships |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `tricolons` | higher in AI | 0.95 [0.66, 1.25] | 1.05 [0.52, 1.45] | 0.74 | 1.42 | -0.14 | 3 | 1.5% | 3.8% | 5.9% | no: generation incomplete: 113/450 original/edit pairs; sign differs by model, genre or on the legacy sample |
| `parallelTriads` | higher in AI | 0.39 [0.07, 0.69] | 0.39 [-0.06, 0.99] | 0.37 | 0.64 | 0.05 | 1 | 2.0% | 4.8% | 5.4% | no: generation incomplete: 113/450 original/edit pairs; marketing: |d| 0.39 < 0.8; marketing: lower bound 0.07 < 0.5; business-email: |d| 0.39 < 0.8; business-email: lower bound -0.06 < 0.5; sign differs by model, genre or on the legacy sample |
| `stackedConditionals` | lower in AI | -0.09 [-0.14, 0.00] | -0.07 [-0.09, -0.05] | -0.09 | 0.08 | -0.03 | – | – | – | – | no: generation incomplete: 113/450 original/edit pairs; marketing: |d| 0.09 < 0.8; marketing: lower bound 0.00 < 0.5; business-email: |d| 0.07 < 0.8; business-email: lower bound 0.05 < 0.5; sign differs by model, genre or on the legacy sample; no threshold keeps every human register at 5% or less |
| `clauseDepth` | higher in AI | 0.78 [0.51, 0.98] | 1.16 [0.91, 1.45] | 0.57 | 1.36 | -0.04 | 5.25 | 4.5% | 0.0% | 0.0% | no: generation incomplete: 113/450 original/edit pairs; marketing: |d| 0.78 < 0.8; sign differs by model, genre or on the legacy sample |
| `sentenceCv` | lower in AI | -0.59 [-0.91, -0.31] | -0.28 [-0.51, -0.06] | 0.00 | -0.11 | 0.68 | 0.116 | 4.1% | 14.8% | 3.9% | no: generation incomplete: 113/450 original/edit pairs; marketing: |d| 0.59 < 0.8; marketing: lower bound 0.31 < 0.5; business-email: |d| 0.28 < 0.8; business-email: lower bound 0.06 < 0.5; sign differs by model, genre or on the legacy sample |
| `hedgeRate` | mixed | -0.13 [-0.27, 0.03] | 0.29 [0.03, 0.53] | 0.01 | 0.14 | 0.16 | 3.125 | 5.0% | 5.4% | 2.7% | no: generation incomplete: 113/450 original/edit pairs; marketing: |d| 0.13 < 0.8; marketing: lower bound -0.03 < 0.5; business-email: |d| 0.29 < 0.8; business-email: lower bound 0.03 < 0.5; sign differs between registers; a holdout half trips above 5% |
| `hedgedClose` | mixed | -0.23 [-0.35, -0.08] | 0.54 [0.31, 0.83] | 0.18 | 0.44 | 0.14 | – | – | – | – | no: generation incomplete: 113/450 original/edit pairs; marketing: |d| 0.23 < 0.8; marketing: lower bound 0.08 < 0.5; business-email: |d| 0.54 < 0.8; business-email: lower bound 0.31 < 0.5; sign differs between registers; no threshold keeps every human register at 5% or less |
| `nominalisationRate` | lower in AI | -0.29 [-0.48, -0.14] | -0.11 [-0.29, 0.08] | -0.71 | -0.34 | -0.32 | – | – | – | – | no: generation incomplete: 113/450 original/edit pairs; marketing: |d| 0.29 < 0.8; marketing: lower bound 0.14 < 0.5; business-email: |d| 0.11 < 0.8; business-email: lower bound -0.08 < 0.5; sign differs by model, genre or on the legacy sample; no threshold keeps every human register at 5% or less |
| `pronounOpenerShare` | mixed | -0.07 [-0.31, 0.15] | 0.82 [0.55, 1.15] | 0.22 | 0.81 | -0.15 | – | – | – | – | no: generation incomplete: 113/450 original/edit pairs; marketing: |d| 0.07 < 0.8; marketing: lower bound -0.15 < 0.5; sign differs between registers; no threshold keeps every human register at 5% or less |
| `transitionOpenerShare` | lower in AI | -0.18 [-0.24, -0.12] | -0.14 [-0.16, -0.12] | -0.19 | -0.14 | -0.34 | – | – | – | – | no: generation incomplete: 113/450 original/edit pairs; marketing: |d| 0.18 < 0.8; marketing: lower bound 0.12 < 0.5; business-email: |d| 0.14 < 0.8; business-email: lower bound 0.12 < 0.5; sign differs by model, genre or on the legacy sample; no threshold keeps every human register at 5% or less |
| `impersonalOpenerShare` | lower in AI | -0.12 [-0.29, 0.09] | -0.20 [-0.21, -0.18] | 0.32 | -0.02 | -0.10 | – | – | – | – | no: generation incomplete: 113/450 original/edit pairs; marketing: |d| 0.12 < 0.8; marketing: lower bound -0.09 < 0.5; business-email: |d| 0.20 < 0.8; business-email: lower bound 0.18 < 0.5; sign differs by model, genre or on the legacy sample; no threshold keeps every human register at 5% or less |
| `commasPerSentence` | higher in AI | 0.87 [0.57, 1.07] | 1.05 [0.81, 1.34] | 0.54 | 1.19 | -0.04 | 4.25 | 4.7% | 0.0% | 0.0% | no: generation incomplete: 113/450 original/edit pairs; sign differs by model, genre or on the legacy sample |
| `commasPer100` | higher in AI | 0.93 [0.67, 1.15] | 1.01 [0.73, 1.21] | 0.79 | 1.05 | 0.31 | 15.385 | 5.5% | 1.1% | 0.0% | no: generation incomplete: 113/450 original/edit pairs; sign differs by model, genre or on the legacy sample; a holdout half trips above 5% |
| `participialRate` | higher in AI | 0.40 [0.13, 0.70] | 0.66 [0.21, 1.20] | 0.04 | 0.54 | -0.07 | 0.667 | 1.8% | 2.7% | 1.1% | no: generation incomplete: 113/450 original/edit pairs; marketing: |d| 0.40 < 0.8; marketing: lower bound 0.13 < 0.5; business-email: |d| 0.66 < 0.8; business-email: lower bound 0.21 < 0.5; sign differs by model, genre or on the legacy sample |
| `coordinationRate` | higher in AI | 0.37 [0.17, 0.63] | 0.68 [0.39, 0.90] | -0.12 | 0.50 | -0.24 | 6.383 | 5.3% | 5.9% | 2.7% | no: generation incomplete: 113/450 original/edit pairs; marketing: |d| 0.37 < 0.8; marketing: lower bound 0.17 < 0.5; business-email: |d| 0.68 < 0.8; business-email: lower bound 0.39 < 0.5; sign differs by model, genre or on the legacy sample; a holdout half trips above 5% |
| `skeletonRepeat` | lower in AI | -0.21 [-0.35, -0.10] | -0.24 [-0.32, -0.15] | -0.26 | -0.20 | -0.47 | – | – | – | – | no: generation incomplete: 113/450 original/edit pairs; marketing: |d| 0.21 < 0.8; marketing: lower bound 0.10 < 0.5; business-email: |d| 0.24 < 0.8; business-email: lower bound 0.15 < 0.5; sign differs by model, genre or on the legacy sample; no threshold keeps every human register at 5% or less; experimental: reported, never shipped |
| `shapeStack` | higher in AI | 0.75 [0.44, 1.02] | 0.98 [0.69, 1.28] | 0.70 | 1.06 | -0.04 | 3 | 2.0% | 1.6% | 2.2% | no: generation incomplete: 113/450 original/edit pairs; marketing: |d| 0.75 < 0.8; marketing: lower bound 0.44 < 0.5; sign differs by model, genre or on the legacy sample |

## By model and genre (d against the matched register)

| Feature | Model / register | d |
| --- | --- | ---: |
| `tricolons` | claude-opus-5-5 / marketing | 0.95 |
| `tricolons` | claude-opus-5-5 / business-email | 1.05 |
| `tricolons` | service-blurb | 1.47 |
| `tricolons` | booking-description | 1.41 |
| `tricolons` | cta-block | 0.06 |
| `tricolons` | enquiry-reply | 1.05 |
| `tricolons` | internal-email | – |
| `parallelTriads` | claude-opus-5-5 / marketing | 0.39 |
| `parallelTriads` | claude-opus-5-5 / business-email | 0.39 |
| `parallelTriads` | service-blurb | 0.38 |
| `parallelTriads` | booking-description | 0.38 |
| `parallelTriads` | cta-block | 0.61 |
| `parallelTriads` | enquiry-reply | 0.39 |
| `parallelTriads` | internal-email | – |
| `stackedConditionals` | claude-opus-5-5 / marketing | -0.09 |
| `stackedConditionals` | claude-opus-5-5 / business-email | -0.07 |
| `stackedConditionals` | service-blurb | -0.08 |
| `stackedConditionals` | booking-description | -0.08 |
| `stackedConditionals` | cta-block | -0.08 |
| `stackedConditionals` | enquiry-reply | -0.07 |
| `stackedConditionals` | internal-email | – |
| `clauseDepth` | claude-opus-5-5 / marketing | 0.78 |
| `clauseDepth` | claude-opus-5-5 / business-email | 1.16 |
| `clauseDepth` | service-blurb | 1.07 |
| `clauseDepth` | booking-description | 1.00 |
| `clauseDepth` | cta-block | 0.19 |
| `clauseDepth` | enquiry-reply | 1.16 |
| `clauseDepth` | internal-email | – |
| `sentenceCv` | claude-opus-5-5 / marketing | -0.59 |
| `sentenceCv` | claude-opus-5-5 / business-email | -0.28 |
| `sentenceCv` | service-blurb | -0.83 |
| `sentenceCv` | booking-description | -0.41 |
| `sentenceCv` | cta-block | – |
| `sentenceCv` | enquiry-reply | -0.28 |
| `sentenceCv` | internal-email | – |
| `hedgeRate` | claude-opus-5-5 / marketing | -0.13 |
| `hedgeRate` | claude-opus-5-5 / business-email | 0.29 |
| `hedgeRate` | service-blurb | -0.28 |
| `hedgeRate` | booking-description | 0.16 |
| `hedgeRate` | cta-block | -0.28 |
| `hedgeRate` | enquiry-reply | 0.29 |
| `hedgeRate` | internal-email | – |
| `hedgedClose` | claude-opus-5-5 / marketing | -0.23 |
| `hedgedClose` | claude-opus-5-5 / business-email | 0.54 |
| `hedgedClose` | service-blurb | -0.11 |
| `hedgedClose` | booking-description | -0.22 |
| `hedgedClose` | cta-block | -0.34 |
| `hedgedClose` | enquiry-reply | 0.54 |
| `hedgedClose` | internal-email | – |
| `nominalisationRate` | claude-opus-5-5 / marketing | -0.29 |
| `nominalisationRate` | claude-opus-5-5 / business-email | -0.11 |
| `nominalisationRate` | service-blurb | -0.20 |
| `nominalisationRate` | booking-description | -0.08 |
| `nominalisationRate` | cta-block | -0.58 |
| `nominalisationRate` | enquiry-reply | -0.11 |
| `nominalisationRate` | internal-email | – |
| `pronounOpenerShare` | claude-opus-5-5 / marketing | -0.07 |
| `pronounOpenerShare` | claude-opus-5-5 / business-email | 0.82 |
| `pronounOpenerShare` | service-blurb | -0.19 |
| `pronounOpenerShare` | booking-description | 0.64 |
| `pronounOpenerShare` | cta-block | -0.67 |
| `pronounOpenerShare` | enquiry-reply | 0.82 |
| `pronounOpenerShare` | internal-email | – |
| `transitionOpenerShare` | claude-opus-5-5 / marketing | -0.18 |
| `transitionOpenerShare` | claude-opus-5-5 / business-email | -0.14 |
| `transitionOpenerShare` | service-blurb | -0.17 |
| `transitionOpenerShare` | booking-description | -0.17 |
| `transitionOpenerShare` | cta-block | -0.17 |
| `transitionOpenerShare` | enquiry-reply | -0.14 |
| `transitionOpenerShare` | internal-email | – |
| `impersonalOpenerShare` | claude-opus-5-5 / marketing | -0.12 |
| `impersonalOpenerShare` | claude-opus-5-5 / business-email | -0.20 |
| `impersonalOpenerShare` | service-blurb | -0.27 |
| `impersonalOpenerShare` | booking-description | 0.17 |
| `impersonalOpenerShare` | cta-block | -0.27 |
| `impersonalOpenerShare` | enquiry-reply | -0.20 |
| `impersonalOpenerShare` | internal-email | – |
| `commasPerSentence` | claude-opus-5-5 / marketing | 0.87 |
| `commasPerSentence` | claude-opus-5-5 / business-email | 1.05 |
| `commasPerSentence` | service-blurb | 1.17 |
| `commasPerSentence` | booking-description | 1.04 |
| `commasPerSentence` | cta-block | 0.30 |
| `commasPerSentence` | enquiry-reply | 1.05 |
| `commasPerSentence` | internal-email | – |
| `commasPer100` | claude-opus-5-5 / marketing | 0.93 |
| `commasPer100` | claude-opus-5-5 / business-email | 1.01 |
| `commasPer100` | service-blurb | 1.18 |
| `commasPer100` | booking-description | 1.00 |
| `commasPer100` | cta-block | 0.51 |
| `commasPer100` | enquiry-reply | 1.01 |
| `commasPer100` | internal-email | – |
| `participialRate` | claude-opus-5-5 / marketing | 0.40 |
| `participialRate` | claude-opus-5-5 / business-email | 0.66 |
| `participialRate` | service-blurb | 1.09 |
| `participialRate` | booking-description | 0.32 |
| `participialRate` | cta-block | -0.23 |
| `participialRate` | enquiry-reply | 0.66 |
| `participialRate` | internal-email | – |
| `coordinationRate` | claude-opus-5-5 / marketing | 0.37 |
| `coordinationRate` | claude-opus-5-5 / business-email | 0.68 |
| `coordinationRate` | service-blurb | 0.62 |
| `coordinationRate` | booking-description | -0.09 |
| `coordinationRate` | cta-block | 0.57 |
| `coordinationRate` | enquiry-reply | 0.68 |
| `coordinationRate` | internal-email | – |
| `skeletonRepeat` | claude-opus-5-5 / marketing | -0.21 |
| `skeletonRepeat` | claude-opus-5-5 / business-email | -0.24 |
| `skeletonRepeat` | service-blurb | -0.05 |
| `skeletonRepeat` | booking-description | -0.13 |
| `skeletonRepeat` | cta-block | -0.43 |
| `skeletonRepeat` | enquiry-reply | -0.24 |
| `skeletonRepeat` | internal-email | – |
| `shapeStack` | claude-opus-5-5 / marketing | 0.75 |
| `shapeStack` | claude-opus-5-5 / business-email | 0.98 |
| `shapeStack` | service-blurb | 1.50 |
| `shapeStack` | booking-description | 0.90 |
| `shapeStack` | cta-block | -0.13 |
| `shapeStack` | enquiry-reply | 0.98 |
| `shapeStack` | internal-email | – |

## By human register (d, all fresh AI against that register)

| Feature | business-email | literary | institutional | explanatory | marketing |
| --- | ---: | ---: | ---: | ---: | ---: |
| `tricolons` | 1.98 | 0.49 | 0.91 | 1.04 | 0.44 |
| `parallelTriads` | 0.80 | 0.19 | 0.23 | 0.40 | 0.21 |
| `stackedConditionals` | -0.07 | -0.11 | -0.10 | -0.11 | -0.10 |
| `clauseDepth` | 1.27 | -0.34 | 0.43 | 0.43 | 0.68 |
| `sentenceCv` | -0.65 | -0.73 | -0.83 | -0.60 | -0.28 |
| `hedgeRate` | 0.00 | -0.10 | 0.17 | -0.14 | 0.31 |
| `hedgedClose` | 0.10 | 0.03 | 0.23 | -0.03 | 0.37 |
| `nominalisationRate` | -0.00 | 0.36 | -0.53 | 0.05 | -0.41 |
| `pronounOpenerShare` | 0.90 | 1.12 | 0.86 | 1.16 | -0.12 |
| `transitionOpenerShare` | -0.14 | -0.09 | -0.21 | -0.22 | -0.20 |
| `impersonalOpenerShare` | -0.09 | -0.17 | -0.32 | -0.38 | -0.23 |
| `commasPerSentence` | 1.41 | -0.33 | 0.51 | 0.76 | 0.59 |
| `commasPer100` | 1.14 | -0.28 | 1.01 | 0.91 | 0.79 |
| `participialRate` | 0.91 | -0.00 | 0.56 | 0.50 | 0.23 |
| `coordinationRate` | 1.06 | 1.17 | 1.13 | 0.96 | 0.07 |
| `skeletonRepeat` | -0.16 | -0.29 | -0.55 | -0.38 | -0.31 |
| `shapeStack` | 1.16 | 0.24 | 0.72 | 0.57 | 0.58 |

## Stratified d and AUC intervals

AUC is P(AI > human), with ties shared; values below 0.5 indicate lower values in AI. These are paragraph-level bootstrap intervals, not writer-level intervals.

| Feature | Stratum | d [95% CI] | AUC [95% CI] |
| --- | --- | --- | --- |
| `tricolons` | claude-opus-5-5 / marketing | 0.95 [0.66, 1.26] | 0.73 [0.66, 0.78] |
| `tricolons` | claude-opus-5-5 / business-email | 1.05 [0.54, 1.49] | 0.62 [0.56, 0.66] |
| `tricolons` | service-blurb | 1.47 [1.03, 1.98] | 0.83 [0.77, 0.89] |
| `tricolons` | booking-description | 1.41 [0.95, 2.05] | 0.81 [0.73, 0.88] |
| `tricolons` | cta-block | 0.06 [-0.24, 0.38] | 0.54 [0.46, 0.63] |
| `tricolons` | enquiry-reply | 1.05 [0.56, 1.45] | 0.62 [0.56, 0.66] |
| `tricolons` | internal-email | – [–, –] | – [–, –] |
| `tricolons` | business-email | 1.98 [1.50, 2.12] | 0.72 [0.68, 0.75] |
| `tricolons` | literary | 0.49 [0.26, 0.62] | 0.61 [0.57, 0.64] |
| `tricolons` | institutional | 0.91 [0.62, 1.06] | 0.66 [0.62, 0.69] |
| `tricolons` | explanatory | 1.04 [0.71, 1.22] | 0.67 [0.63, 0.70] |
| `tricolons` | marketing | 0.44 [0.23, 0.61] | 0.61 [0.56, 0.65] |
| `parallelTriads` | claude-opus-5-5 / marketing | 0.39 [0.09, 0.67] | 0.53 [0.51, 0.56] |
| `parallelTriads` | claude-opus-5-5 / business-email | 0.39 [-0.05, 0.92] | 0.51 [0.50, 0.52] |
| `parallelTriads` | service-blurb | 0.38 [-0.17, 0.96] | 0.53 [0.49, 0.57] |
| `parallelTriads` | booking-description | 0.38 [-0.17, 0.94] | 0.53 [0.49, 0.56] |
| `parallelTriads` | cta-block | 0.61 [-0.13, 1.21] | 0.54 [0.49, 0.60] |
| `parallelTriads` | enquiry-reply | 0.39 [-0.05, 0.99] | 0.51 [0.50, 0.52] |
| `parallelTriads` | internal-email | – [–, –] | – [–, –] |
| `parallelTriads` | business-email | 0.80 [0.29, 1.21] | 0.52 [0.51, 0.54] |
| `parallelTriads` | literary | 0.19 [-0.01, 0.47] | 0.51 [0.50, 0.54] |
| `parallelTriads` | institutional | 0.23 [0.01, 0.53] | 0.52 [0.50, 0.54] |
| `parallelTriads` | explanatory | 0.40 [0.11, 0.80] | 0.52 [0.51, 0.54] |
| `parallelTriads` | marketing | 0.21 [-0.01, 0.42] | 0.52 [0.50, 0.54] |
| `stackedConditionals` | claude-opus-5-5 / marketing | -0.09 [-0.14, 0.00] | 0.50 [0.49, 0.50] |
| `stackedConditionals` | claude-opus-5-5 / business-email | -0.07 [-0.08, -0.05] | 0.50 [0.50, 0.50] |
| `stackedConditionals` | service-blurb | -0.08 [-0.13, 0.00] | 0.50 [0.49, 0.50] |
| `stackedConditionals` | booking-description | -0.08 [-0.13, 0.00] | 0.50 [0.49, 0.50] |
| `stackedConditionals` | cta-block | -0.08 [-0.13, 0.00] | 0.50 [0.49, 0.50] |
| `stackedConditionals` | enquiry-reply | -0.07 [-0.09, -0.05] | 0.50 [0.50, 0.50] |
| `stackedConditionals` | internal-email | – [–, –] | – [–, –] |
| `stackedConditionals` | business-email | -0.07 [-0.09, -0.05] | 0.50 [0.50, 0.50] |
| `stackedConditionals` | literary | -0.11 [-0.13, -0.09] | 0.49 [0.49, 0.50] |
| `stackedConditionals` | institutional | -0.10 [-0.13, -0.09] | 0.49 [0.49, 0.50] |
| `stackedConditionals` | explanatory | -0.11 [-0.12, -0.09] | 0.49 [0.49, 0.50] |
| `stackedConditionals` | marketing | -0.10 [-0.15, 0.00] | 0.50 [0.49, 0.50] |
| `clauseDepth` | claude-opus-5-5 / marketing | 0.78 [0.54, 1.01] | 0.77 [0.71, 0.82] |
| `clauseDepth` | claude-opus-5-5 / business-email | 1.16 [0.93, 1.45] | 0.78 [0.73, 0.82] |
| `clauseDepth` | service-blurb | 1.07 [0.74, 1.41] | 0.84 [0.78, 0.89] |
| `clauseDepth` | booking-description | 1.00 [0.70, 1.28] | 0.85 [0.79, 0.90] |
| `clauseDepth` | cta-block | 0.19 [-0.09, 0.42] | 0.61 [0.51, 0.69] |
| `clauseDepth` | enquiry-reply | 1.16 [0.92, 1.44] | 0.78 [0.72, 0.82] |
| `clauseDepth` | internal-email | – [–, –] | – [–, –] |
| `clauseDepth` | business-email | 1.27 [1.11, 1.47] | 0.82 [0.79, 0.84] |
| `clauseDepth` | literary | -0.34 [-0.43, -0.26] | 0.42 [0.39, 0.45] |
| `clauseDepth` | institutional | 0.43 [0.27, 0.54] | 0.65 [0.61, 0.69] |
| `clauseDepth` | explanatory | 0.43 [0.29, 0.54] | 0.65 [0.61, 0.68] |
| `clauseDepth` | marketing | 0.68 [0.44, 0.87] | 0.72 [0.67, 0.77] |
| `sentenceCv` | claude-opus-5-5 / marketing | -0.59 [-0.93, -0.29] | 0.32 [0.23, 0.41] |
| `sentenceCv` | claude-opus-5-5 / business-email | -0.28 [-0.53, -0.03] | 0.43 [0.35, 0.50] |
| `sentenceCv` | service-blurb | -0.83 [-1.14, -0.59] | 0.24 [0.15, 0.33] |
| `sentenceCv` | booking-description | -0.41 [-0.78, -0.01] | 0.38 [0.27, 0.51] |
| `sentenceCv` | cta-block | – [–, –] | – [–, –] |
| `sentenceCv` | enquiry-reply | -0.28 [-0.52, -0.03] | 0.43 [0.36, 0.51] |
| `sentenceCv` | internal-email | – [–, –] | – [–, –] |
| `sentenceCv` | business-email | -0.65 [-0.82, -0.50] | 0.32 [0.27, 0.37] |
| `sentenceCv` | literary | -0.73 [-0.89, -0.56] | 0.30 [0.25, 0.35] |
| `sentenceCv` | institutional | -0.83 [-0.99, -0.64] | 0.27 [0.23, 0.32] |
| `sentenceCv` | explanatory | -0.60 [-0.76, -0.38] | 0.34 [0.29, 0.40] |
| `sentenceCv` | marketing | -0.28 [-0.50, -0.04] | 0.42 [0.35, 0.50] |
| `hedgeRate` | claude-opus-5-5 / marketing | -0.13 [-0.27, 0.02] | 0.50 [0.47, 0.53] |
| `hedgeRate` | claude-opus-5-5 / business-email | 0.29 [0.05, 0.54] | 0.55 [0.51, 0.59] |
| `hedgeRate` | service-blurb | -0.28 [-0.33, -0.23] | 0.46 [0.45, 0.47] |
| `hedgeRate` | booking-description | 0.16 [-0.11, 0.52] | 0.57 [0.50, 0.64] |
| `hedgeRate` | cta-block | -0.28 [-0.34, -0.23] | 0.46 [0.44, 0.47] |
| `hedgeRate` | enquiry-reply | 0.29 [0.02, 0.53] | 0.55 [0.50, 0.59] |
| `hedgeRate` | internal-email | – [–, –] | – [–, –] |
| `hedgeRate` | business-email | 0.00 [-0.17, 0.19] | 0.50 [0.46, 0.53] |
| `hedgeRate` | literary | -0.10 [-0.27, 0.05] | 0.45 [0.41, 0.49] |
| `hedgeRate` | institutional | 0.17 [-0.10, 0.42] | 0.50 [0.45, 0.53] |
| `hedgeRate` | explanatory | -0.14 [-0.31, 0.01] | 0.44 [0.40, 0.47] |
| `hedgeRate` | marketing | 0.31 [0.12, 0.50] | 0.55 [0.52, 0.58] |
| `hedgedClose` | claude-opus-5-5 / marketing | -0.23 [-0.36, -0.02] | 0.47 [0.45, 0.50] |
| `hedgedClose` | claude-opus-5-5 / business-email | 0.54 [0.32, 0.82] | 0.61 [0.56, 0.66] |
| `hedgedClose` | service-blurb | -0.11 [-0.38, 0.23] | 0.48 [0.44, 0.54] |
| `hedgedClose` | booking-description | -0.22 [-0.38, -0.00] | 0.47 [0.44, 0.50] |
| `hedgedClose` | cta-block | -0.34 [-0.40, -0.29] | 0.45 [0.44, 0.46] |
| `hedgedClose` | enquiry-reply | 0.54 [0.30, 0.83] | 0.61 [0.56, 0.66] |
| `hedgedClose` | internal-email | – [–, –] | – [–, –] |
| `hedgedClose` | business-email | 0.10 [-0.08, 0.23] | 0.52 [0.48, 0.55] |
| `hedgedClose` | literary | 0.03 [-0.11, 0.21] | 0.51 [0.48, 0.54] |
| `hedgedClose` | institutional | 0.23 [0.05, 0.39] | 0.54 [0.51, 0.57] |
| `hedgedClose` | explanatory | -0.03 [-0.20, 0.08] | 0.49 [0.46, 0.52] |
| `hedgedClose` | marketing | 0.37 [0.18, 0.51] | 0.56 [0.53, 0.59] |
| `nominalisationRate` | claude-opus-5-5 / marketing | -0.29 [-0.43, -0.16] | 0.44 [0.39, 0.49] |
| `nominalisationRate` | claude-opus-5-5 / business-email | -0.11 [-0.31, 0.07] | 0.46 [0.41, 0.52] |
| `nominalisationRate` | service-blurb | -0.20 [-0.46, 0.04] | 0.46 [0.36, 0.54] |
| `nominalisationRate` | booking-description | -0.08 [-0.32, 0.18] | 0.52 [0.43, 0.61] |
| `nominalisationRate` | cta-block | -0.58 [-0.76, -0.42] | 0.33 [0.25, 0.40] |
| `nominalisationRate` | enquiry-reply | -0.11 [-0.31, 0.08] | 0.46 [0.40, 0.51] |
| `nominalisationRate` | internal-email | – [–, –] | – [–, –] |
| `nominalisationRate` | business-email | -0.00 [-0.08, 0.11] | 0.52 [0.49, 0.55] |
| `nominalisationRate` | literary | 0.36 [0.23, 0.53] | 0.57 [0.54, 0.61] |
| `nominalisationRate` | institutional | -0.53 [-0.62, -0.40] | 0.33 [0.31, 0.37] |
| `nominalisationRate` | explanatory | 0.05 [-0.06, 0.20] | 0.51 [0.47, 0.55] |
| `nominalisationRate` | marketing | -0.41 [-0.55, -0.28] | 0.39 [0.34, 0.43] |
| `pronounOpenerShare` | claude-opus-5-5 / marketing | -0.07 [-0.31, 0.14] | 0.50 [0.43, 0.56] |
| `pronounOpenerShare` | claude-opus-5-5 / business-email | 0.82 [0.52, 1.14] | 0.63 [0.58, 0.67] |
| `pronounOpenerShare` | service-blurb | -0.19 [-0.42, 0.12] | 0.47 [0.40, 0.56] |
| `pronounOpenerShare` | booking-description | 0.64 [0.35, 0.94] | 0.71 [0.63, 0.78] |
| `pronounOpenerShare` | cta-block | -0.67 [-0.83, -0.51] | 0.32 [0.27, 0.37] |
| `pronounOpenerShare` | enquiry-reply | 0.82 [0.51, 1.18] | 0.63 [0.58, 0.68] |
| `pronounOpenerShare` | internal-email | – [–, –] | – [–, –] |
| `pronounOpenerShare` | business-email | 0.90 [0.64, 1.18] | 0.65 [0.62, 0.69] |
| `pronounOpenerShare` | literary | 1.12 [0.89, 1.47] | 0.67 [0.64, 0.71] |
| `pronounOpenerShare` | institutional | 0.86 [0.67, 1.14] | 0.64 [0.61, 0.69] |
| `pronounOpenerShare` | explanatory | 1.16 [0.92, 1.51] | 0.66 [0.63, 0.71] |
| `pronounOpenerShare` | marketing | -0.12 [-0.29, 0.05] | 0.48 [0.44, 0.53] |
| `transitionOpenerShare` | claude-opus-5-5 / marketing | -0.18 [-0.24, -0.13] | 0.49 [0.47, 0.49] |
| `transitionOpenerShare` | claude-opus-5-5 / business-email | -0.14 [-0.16, -0.12] | 0.49 [0.49, 0.49] |
| `transitionOpenerShare` | service-blurb | -0.17 [-0.22, -0.11] | 0.49 [0.48, 0.49] |
| `transitionOpenerShare` | booking-description | -0.17 [-0.22, -0.11] | 0.49 [0.48, 0.49] |
| `transitionOpenerShare` | cta-block | -0.17 [-0.21, -0.11] | 0.49 [0.48, 0.49] |
| `transitionOpenerShare` | enquiry-reply | -0.14 [-0.16, -0.12] | 0.49 [0.49, 0.49] |
| `transitionOpenerShare` | internal-email | – [–, –] | – [–, –] |
| `transitionOpenerShare` | business-email | -0.14 [-0.16, -0.12] | 0.49 [0.49, 0.49] |
| `transitionOpenerShare` | literary | -0.09 [-0.11, -0.07] | 0.49 [0.49, 0.50] |
| `transitionOpenerShare` | institutional | -0.21 [-0.24, -0.20] | 0.48 [0.47, 0.48] |
| `transitionOpenerShare` | explanatory | -0.22 [-0.25, -0.21] | 0.47 [0.47, 0.48] |
| `transitionOpenerShare` | marketing | -0.20 [-0.25, -0.13] | 0.49 [0.48, 0.49] |
| `impersonalOpenerShare` | claude-opus-5-5 / marketing | -0.12 [-0.28, 0.07] | 0.49 [0.46, 0.52] |
| `impersonalOpenerShare` | claude-opus-5-5 / business-email | -0.20 [-0.22, -0.18] | 0.48 [0.47, 0.48] |
| `impersonalOpenerShare` | service-blurb | -0.27 [-0.34, -0.19] | 0.46 [0.45, 0.48] |
| `impersonalOpenerShare` | booking-description | 0.17 [-0.20, 0.62] | 0.53 [0.47, 0.60] |
| `impersonalOpenerShare` | cta-block | -0.27 [-0.34, -0.20] | 0.46 [0.44, 0.48] |
| `impersonalOpenerShare` | enquiry-reply | -0.20 [-0.21, -0.18] | 0.48 [0.48, 0.48] |
| `impersonalOpenerShare` | internal-email | – [–, –] | – [–, –] |
| `impersonalOpenerShare` | business-email | -0.09 [-0.19, 0.02] | 0.49 [0.48, 0.50] |
| `impersonalOpenerShare` | literary | -0.17 [-0.26, -0.08] | 0.48 [0.46, 0.48] |
| `impersonalOpenerShare` | institutional | -0.32 [-0.38, -0.25] | 0.43 [0.42, 0.45] |
| `impersonalOpenerShare` | explanatory | -0.38 [-0.44, -0.32] | 0.41 [0.40, 0.43] |
| `impersonalOpenerShare` | marketing | -0.23 [-0.33, -0.09] | 0.47 [0.45, 0.49] |
| `commasPerSentence` | claude-opus-5-5 / marketing | 0.87 [0.57, 1.06] | 0.79 [0.74, 0.83] |
| `commasPerSentence` | claude-opus-5-5 / business-email | 1.05 [0.80, 1.35] | 0.76 [0.71, 0.80] |
| `commasPerSentence` | service-blurb | 1.17 [0.82, 1.52] | 0.86 [0.82, 0.90] |
| `commasPerSentence` | booking-description | 1.04 [0.73, 1.32] | 0.86 [0.80, 0.90] |
| `commasPerSentence` | cta-block | 0.30 [0.02, 0.55] | 0.65 [0.56, 0.72] |
| `commasPerSentence` | enquiry-reply | 1.05 [0.78, 1.35] | 0.76 [0.71, 0.80] |
| `commasPerSentence` | internal-email | – [–, –] | – [–, –] |
| `commasPerSentence` | business-email | 1.41 [1.19, 1.63] | 0.83 [0.80, 0.85] |
| `commasPerSentence` | literary | -0.33 [-0.43, -0.25] | 0.42 [0.39, 0.46] |
| `commasPerSentence` | institutional | 0.51 [0.33, 0.64] | 0.65 [0.61, 0.69] |
| `commasPerSentence` | explanatory | 0.76 [0.56, 0.88] | 0.72 [0.68, 0.75] |
| `commasPerSentence` | marketing | 0.59 [0.42, 0.72] | 0.71 [0.67, 0.74] |
| `commasPer100` | claude-opus-5-5 / marketing | 0.93 [0.71, 1.17] | 0.79 [0.74, 0.84] |
| `commasPer100` | claude-opus-5-5 / business-email | 1.01 [0.78, 1.21] | 0.77 [0.72, 0.81] |
| `commasPer100` | service-blurb | 1.18 [0.88, 1.50] | 0.85 [0.80, 0.89] |
| `commasPer100` | booking-description | 1.00 [0.77, 1.26] | 0.84 [0.78, 0.87] |
| `commasPer100` | cta-block | 0.51 [0.17, 0.81] | 0.67 [0.57, 0.76] |
| `commasPer100` | enquiry-reply | 1.01 [0.77, 1.18] | 0.77 [0.71, 0.81] |
| `commasPer100` | internal-email | – [–, –] | – [–, –] |
| `commasPer100` | business-email | 1.14 [0.98, 1.30] | 0.81 [0.78, 0.83] |
| `commasPer100` | literary | -0.28 [-0.42, -0.18] | 0.42 [0.38, 0.46] |
| `commasPer100` | institutional | 1.01 [0.80, 1.15] | 0.74 [0.71, 0.78] |
| `commasPer100` | explanatory | 0.91 [0.71, 1.01] | 0.75 [0.72, 0.78] |
| `commasPer100` | marketing | 0.79 [0.58, 0.96] | 0.74 [0.70, 0.78] |
| `participialRate` | claude-opus-5-5 / marketing | 0.40 [0.12, 0.67] | 0.58 [0.53, 0.63] |
| `participialRate` | claude-opus-5-5 / business-email | 0.66 [0.25, 1.19] | 0.54 [0.51, 0.59] |
| `participialRate` | service-blurb | 1.09 [0.64, 1.72] | 0.71 [0.63, 0.80] |
| `participialRate` | booking-description | 0.32 [-0.08, 0.81] | 0.57 [0.50, 0.65] |
| `participialRate` | cta-block | -0.23 [-0.39, 0.15] | 0.46 [0.43, 0.52] |
| `participialRate` | enquiry-reply | 0.66 [0.22, 1.22] | 0.54 [0.51, 0.59] |
| `participialRate` | internal-email | – [–, –] | – [–, –] |
| `participialRate` | business-email | 0.91 [0.57, 1.22] | 0.58 [0.55, 0.61] |
| `participialRate` | literary | -0.00 [-0.13, 0.13] | 0.50 [0.47, 0.52] |
| `participialRate` | institutional | 0.56 [0.31, 0.81] | 0.56 [0.53, 0.59] |
| `participialRate` | explanatory | 0.50 [0.29, 0.74] | 0.56 [0.53, 0.58] |
| `participialRate` | marketing | 0.23 [-0.01, 0.38] | 0.54 [0.51, 0.57] |
| `coordinationRate` | claude-opus-5-5 / marketing | 0.37 [0.17, 0.63] | 0.60 [0.54, 0.67] |
| `coordinationRate` | claude-opus-5-5 / business-email | 0.68 [0.39, 0.89] | 0.64 [0.58, 0.68] |
| `coordinationRate` | service-blurb | 0.62 [0.24, 1.03] | 0.66 [0.57, 0.76] |
| `coordinationRate` | booking-description | -0.09 [-0.32, 0.26] | 0.48 [0.40, 0.59] |
| `coordinationRate` | cta-block | 0.57 [0.19, 1.05] | 0.65 [0.55, 0.76] |
| `coordinationRate` | enquiry-reply | 0.68 [0.38, 0.90] | 0.64 [0.58, 0.68] |
| `coordinationRate` | internal-email | – [–, –] | – [–, –] |
| `coordinationRate` | business-email | 1.06 [0.85, 1.31] | 0.72 [0.69, 0.76] |
| `coordinationRate` | literary | 1.17 [0.90, 1.39] | 0.72 [0.68, 0.75] |
| `coordinationRate` | institutional | 1.13 [0.88, 1.36] | 0.70 [0.66, 0.74] |
| `coordinationRate` | explanatory | 0.96 [0.75, 1.18] | 0.69 [0.65, 0.73] |
| `coordinationRate` | marketing | 0.07 [-0.03, 0.30] | 0.52 [0.49, 0.58] |
| `skeletonRepeat` | claude-opus-5-5 / marketing | -0.21 [-0.35, -0.10] | 0.48 [0.41, 0.52] |
| `skeletonRepeat` | claude-opus-5-5 / business-email | -0.24 [-0.32, -0.14] | 0.44 [0.41, 0.47] |
| `skeletonRepeat` | service-blurb | -0.05 [-0.27, 0.24] | 0.53 [0.45, 0.61] |
| `skeletonRepeat` | booking-description | -0.13 [-0.31, 0.07] | 0.54 [0.45, 0.62] |
| `skeletonRepeat` | cta-block | -0.43 [-0.57, -0.35] | 0.36 [0.33, 0.40] |
| `skeletonRepeat` | enquiry-reply | -0.24 [-0.32, -0.15] | 0.44 [0.41, 0.47] |
| `skeletonRepeat` | internal-email | – [–, –] | – [–, –] |
| `skeletonRepeat` | business-email | -0.16 [-0.22, -0.06] | 0.48 [0.46, 0.52] |
| `skeletonRepeat` | literary | -0.29 [-0.39, -0.21] | 0.41 [0.38, 0.44] |
| `skeletonRepeat` | institutional | -0.55 [-0.64, -0.45] | 0.31 [0.29, 0.35] |
| `skeletonRepeat` | explanatory | -0.38 [-0.47, -0.31] | 0.38 [0.34, 0.41] |
| `skeletonRepeat` | marketing | -0.31 [-0.43, -0.22] | 0.44 [0.40, 0.47] |
| `shapeStack` | claude-opus-5-5 / marketing | 0.75 [0.50, 0.97] | 0.69 [0.63, 0.74] |
| `shapeStack` | claude-opus-5-5 / business-email | 0.98 [0.68, 1.29] | 0.70 [0.65, 0.75] |
| `shapeStack` | service-blurb | 1.50 [1.16, 1.86] | 0.84 [0.78, 0.88] |
| `shapeStack` | booking-description | 0.90 [0.61, 1.24] | 0.74 [0.67, 0.80] |
| `shapeStack` | cta-block | -0.13 [-0.43, 0.21] | 0.48 [0.39, 0.56] |
| `shapeStack` | enquiry-reply | 0.98 [0.68, 1.30] | 0.70 [0.65, 0.75] |
| `shapeStack` | internal-email | – [–, –] | – [–, –] |
| `shapeStack` | business-email | 1.16 [0.92, 1.30] | 0.73 [0.69, 0.76] |
| `shapeStack` | literary | 0.24 [0.08, 0.36] | 0.57 [0.53, 0.61] |
| `shapeStack` | institutional | 0.72 [0.53, 0.87] | 0.68 [0.63, 0.71] |
| `shapeStack` | explanatory | 0.57 [0.36, 0.72] | 0.65 [0.60, 0.68] |
| `shapeStack` | marketing | 0.58 [0.37, 0.76] | 0.65 [0.60, 0.69] |

## Edit survival

| Feature | Original TPR | After edit TPR |
| --- | ---: | ---: |
| `tricolons` | 3.8% | 5.9% |
| `parallelTriads` | 4.8% | 5.4% |
| `stackedConditionals` | – | – |
| `clauseDepth` | 0.0% | 0.0% |
| `sentenceCv` | 14.8% | 3.9% |
| `hedgeRate` | 5.4% | 2.7% |
| `hedgedClose` | – | – |
| `nominalisationRate` | – | – |
| `pronounOpenerShare` | – | – |
| `transitionOpenerShare` | – | – |
| `impersonalOpenerShare` | – | – |
| `commasPerSentence` | 0.0% | 0.0% |
| `commasPer100` | 1.1% | 0.0% |
| `participialRate` | 2.7% | 1.1% |
| `coordinationRate` | 5.9% | 2.7% |
| `skeletonRepeat` | – | – |
| `shapeStack` | 1.6% | 2.2% |

