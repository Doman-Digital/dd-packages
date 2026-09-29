# Lexical and specificity features: human baselines against AI copy

Measured 2026-09-29 by `scripts/shape/measure.mjs`, 300 bootstrap resamples. Generated from `report-lexical.json`; do not edit by hand.

Generation: 450/450 original/edit pairs complete. Complete.

## Samples (blurb-sized paragraphs)

| Side | Set | Blurbs |
| --- | --- | ---: |
| human | business-email | 12000 |
| human | literary | 12000 |
| human | institutional | 12000 |
| human | explanatory | 12000 |
| human | marketing | 710 |
| AI | claude-haiku-4-5-20251001 | 189 |
| AI | claude-opus-5-5 | 274 |
| AI | claude-sonnet-5 | 161 |
| AI | legacy-2026-09-23 | 1083 |
| AI | edited ("sound more human") | 648 |

## Every feature

Effect sizes are register-matched: service-blurb, booking-description, cta-block against marketing; enquiry-reply, internal-email against business-email. d with its 95% bootstrap interval. The threshold is the loosest at which no human register's tuning half, of any kind, trips more than 5%. TPR is the share of matched AI blurbs it catches; *edited* is after the edit pass.

| Feature | Direction | d marketing [95% CI] | d business-email [95% CI] | edited d marketing | edited d business-email | Legacy d | Threshold | Worst holdout FP | TPR | TPR edited | Ships |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `listRate` | higher in AI | 0.28 [0.15, 0.45] | 0.07 [-0.07, 0.28] | -0.06 | 0.24 | -0.34 | 1.695 | 3.2% | 2.7% | 2.3% | no: marketing: |d| 0.28 < 0.8; marketing: lower bound 0.15 < 0.5; business-email: |d| 0.07 < 0.8; business-email: lower bound -0.07 < 0.5; sign differs by model, genre or on the legacy sample |
| `studyRate` | higher in AI | 0.13 [0.00, 0.21] | 0.22 [0.00, 0.32] | 0.00 | 0.22 | 0.00 | – | – | – | – | no: marketing: |d| 0.13 < 0.8; marketing: lower bound 0.00 < 0.5; business-email: |d| 0.22 < 0.8; business-email: lower bound 0.00 < 0.5; sign differs by model, genre or on the legacy sample; no threshold keeps every human register at 5% or less |
| `hardPer100` | lower in AI | -0.30 [-0.45, -0.15] | -0.46 [-0.53, -0.38] | -0.43 | -0.34 | -0.18 | – | – | – | – | no: marketing: |d| 0.30 < 0.8; marketing: lower bound 0.15 < 0.5; business-email: |d| 0.46 < 0.8; business-email: lower bound 0.38 < 0.5; no threshold keeps every human register at 5% or less |
| `tradePer100` | higher in AI | 0.51 [0.34, 0.68] | 0.96 [0.63, 1.09] | 0.41 | 0.99 | 0.24 | 3.774 | 2.4% | 9.1% | 9.1% | no: marketing: |d| 0.51 < 0.8; marketing: lower bound 0.34 < 0.5 |
| `specificsPer100` | lower in AI | -0.11 [-0.26, 0.05] | -0.34 [-0.43, -0.25] | -0.26 | -0.22 | -0.08 | – | – | – | – | no: marketing: |d| 0.11 < 0.8; marketing: lower bound -0.05 < 0.5; business-email: |d| 0.34 < 0.8; business-email: lower bound 0.25 < 0.5; sign differs by model, genre or on the legacy sample; no threshold keeps every human register at 5% or less |
| `generic` | mixed | -0.86 [-0.99, -0.74] | 0.53 [0.45, 0.73] | -0.68 | 0.43 | 0.12 | – | – | – | – | no: business-email: |d| 0.53 < 0.8; business-email: lower bound 0.45 < 0.5; sign differs between registers; no threshold keeps every human register at 5% or less |
| `figures` | lower in AI | -0.50 [-0.63, -0.40] | -0.16 [-0.25, -0.07] | -0.52 | -0.17 | -0.44 | – | – | – | – | no: marketing: |d| 0.50 < 0.8; marketing: lower bound 0.40 < 0.5; business-email: |d| 0.16 < 0.8; business-email: lower bound 0.07 < 0.5; no threshold keeps every human register at 5% or less |
| `names` | lower in AI | -0.02 [-0.18, 0.16] | -0.41 [-0.50, -0.33] | -0.10 | -0.41 | -0.55 | – | – | – | – | no: marketing: |d| 0.02 < 0.8; marketing: lower bound -0.16 < 0.5; business-email: |d| 0.41 < 0.8; business-email: lower bound 0.33 < 0.5; sign differs by model, genre or on the legacy sample; no threshold keeps every human register at 5% or less |

## By model and genre (d against the matched register)

| Feature | Model / register | d |
| --- | --- | ---: |
| `listRate` | claude-haiku-4-5-20251001 / marketing | 0.80 |
| `listRate` | claude-haiku-4-5-20251001 / business-email | 0.40 |
| `listRate` | claude-opus-5-5 / marketing | -0.07 |
| `listRate` | claude-opus-5-5 / business-email | -0.07 |
| `listRate` | claude-sonnet-5 / marketing | 0.09 |
| `listRate` | claude-sonnet-5 / business-email | -0.07 |
| `listRate` | service-blurb | 0.51 |
| `listRate` | booking-description | 0.19 |
| `listRate` | cta-block | 0.19 |
| `listRate` | enquiry-reply | 0.05 |
| `listRate` | internal-email | 0.09 |
| `studyRate` | claude-haiku-4-5-20251001 / marketing | 0.33 |
| `studyRate` | claude-haiku-4-5-20251001 / business-email | 0.79 |
| `studyRate` | claude-opus-5-5 / marketing | 0.00 |
| `studyRate` | claude-opus-5-5 / business-email | 0.00 |
| `studyRate` | claude-sonnet-5 / marketing | 0.00 |
| `studyRate` | claude-sonnet-5 / business-email | 0.00 |
| `studyRate` | service-blurb | 0.23 |
| `studyRate` | booking-description | 0.23 |
| `studyRate` | cta-block | 0.00 |
| `studyRate` | enquiry-reply | 0.37 |
| `studyRate` | internal-email | 0.00 |
| `hardPer100` | claude-haiku-4-5-20251001 / marketing | -0.37 |
| `hardPer100` | claude-haiku-4-5-20251001 / business-email | -0.61 |
| `hardPer100` | claude-opus-5-5 / marketing | -0.23 |
| `hardPer100` | claude-opus-5-5 / business-email | -0.38 |
| `hardPer100` | claude-sonnet-5 / marketing | -0.18 |
| `hardPer100` | claude-sonnet-5 / business-email | -0.42 |
| `hardPer100` | service-blurb | -0.30 |
| `hardPer100` | booking-description | -0.35 |
| `hardPer100` | cta-block | -0.11 |
| `hardPer100` | enquiry-reply | -0.65 |
| `hardPer100` | internal-email | -0.16 |
| `tradePer100` | claude-haiku-4-5-20251001 / marketing | 0.50 |
| `tradePer100` | claude-haiku-4-5-20251001 / business-email | 0.99 |
| `tradePer100` | claude-opus-5-5 / marketing | 0.61 |
| `tradePer100` | claude-opus-5-5 / business-email | 1.02 |
| `tradePer100` | claude-sonnet-5 / marketing | 0.56 |
| `tradePer100` | claude-sonnet-5 / business-email | 1.26 |
| `tradePer100` | service-blurb | 0.77 |
| `tradePer100` | booking-description | 0.44 |
| `tradePer100` | cta-block | 0.46 |
| `tradePer100` | enquiry-reply | 1.18 |
| `tradePer100` | internal-email | 0.77 |
| `specificsPer100` | claude-haiku-4-5-20251001 / marketing | -0.23 |
| `specificsPer100` | claude-haiku-4-5-20251001 / business-email | -0.50 |
| `specificsPer100` | claude-opus-5-5 / marketing | -0.05 |
| `specificsPer100` | claude-opus-5-5 / business-email | -0.27 |
| `specificsPer100` | claude-sonnet-5 / marketing | -0.02 |
| `specificsPer100` | claude-sonnet-5 / business-email | -0.29 |
| `specificsPer100` | service-blurb | -0.08 |
| `specificsPer100` | booking-description | -0.24 |
| `specificsPer100` | cta-block | 0.02 |
| `specificsPer100` | enquiry-reply | -0.51 |
| `specificsPer100` | internal-email | -0.08 |
| `generic` | claude-haiku-4-5-20251001 / marketing | -0.72 |
| `generic` | claude-haiku-4-5-20251001 / business-email | 1.01 |
| `generic` | claude-opus-5-5 / marketing | -0.72 |
| `generic` | claude-opus-5-5 / business-email | 0.36 |
| `generic` | claude-sonnet-5 / marketing | -0.75 |
| `generic` | claude-sonnet-5 / business-email | 0.38 |
| `generic` | service-blurb | -0.75 |
| `generic` | booking-description | -0.75 |
| `generic` | cta-block | -0.68 |
| `generic` | enquiry-reply | 0.67 |
| `generic` | internal-email | 0.35 |
| `figures` | claude-haiku-4-5-20251001 / marketing | -0.50 |
| `figures` | claude-haiku-4-5-20251001 / business-email | -0.34 |
| `figures` | claude-opus-5-5 / marketing | -0.45 |
| `figures` | claude-opus-5-5 / business-email | -0.07 |
| `figures` | claude-sonnet-5 / marketing | -0.35 |
| `figures` | claude-sonnet-5 / business-email | -0.16 |
| `figures` | service-blurb | -0.55 |
| `figures` | booking-description | -0.24 |
| `figures` | cta-block | -0.53 |
| `figures` | enquiry-reply | -0.03 |
| `figures` | internal-email | -0.36 |
| `names` | claude-haiku-4-5-20251001 / marketing | -0.06 |
| `names` | claude-haiku-4-5-20251001 / business-email | -0.56 |
| `names` | claude-opus-5-5 / marketing | 0.04 |
| `names` | claude-opus-5-5 / business-email | -0.35 |
| `names` | claude-sonnet-5 / marketing | -0.03 |
| `names` | claude-sonnet-5 / business-email | -0.38 |
| `names` | service-blurb | 0.15 |
| `names` | booking-description | -0.05 |
| `names` | cta-block | -0.14 |
| `names` | enquiry-reply | -0.80 |
| `names` | internal-email | 0.17 |

## By human register (d, all fresh AI against that register)

| Feature | business-email | literary | institutional | explanatory | marketing |
| --- | ---: | ---: | ---: | ---: | ---: |
| `listRate` | 0.63 | 0.64 | 0.39 | 0.61 | 0.02 |
| `studyRate` | 0.22 | 0.09 | 0.15 | 0.14 | 0.08 |
| `hardPer100` | -0.54 | 0.29 | -0.31 | 0.33 | -0.17 |
| `tradePer100` | 1.21 | 1.23 | 1.80 | 1.41 | 0.26 |
| `specificsPer100` | -0.37 | 0.59 | 0.00 | 0.60 | -0.07 |
| `generic` | 0.16 | -0.09 | 0.37 | -0.43 | -0.34 |
| `figures` | -0.32 | 0.96 | -0.20 | -0.12 | -0.05 |
| `names` | -0.34 | -0.14 | -0.68 | 0.13 | -0.13 |

## Stratified d and AUC intervals

AUC is P(AI > human), with ties shared; values below 0.5 indicate lower values in AI. These are paragraph-level bootstrap intervals, not writer-level intervals.

| Feature | Stratum | d [95% CI] | AUC [95% CI] |
| --- | --- | --- | --- |
| `listRate` | claude-haiku-4-5-20251001 / marketing | 0.80 [0.50, 1.21] | 0.67 [0.62, 0.73] |
| `listRate` | claude-haiku-4-5-20251001 / business-email | 0.40 [-0.06, 1.07] | 0.51 [0.50, 0.53] |
| `listRate` | claude-opus-5-5 / marketing | -0.07 [-0.21, 0.14] | 0.50 [0.48, 0.54] |
| `listRate` | claude-opus-5-5 / business-email | -0.07 [-0.09, -0.05] | 0.50 [0.50, 0.50] |
| `listRate` | claude-sonnet-5 / marketing | 0.09 [-0.13, 0.32] | 0.52 [0.49, 0.55] |
| `listRate` | claude-sonnet-5 / business-email | -0.07 [-0.09, -0.05] | 0.50 [0.50, 0.50] |
| `listRate` | service-blurb | 0.51 [0.25, 0.82] | 0.62 [0.57, 0.67] |
| `listRate` | booking-description | 0.19 [-0.01, 0.49] | 0.56 [0.52, 0.60] |
| `listRate` | cta-block | 0.19 [-0.14, 0.48] | 0.52 [0.48, 0.55] |
| `listRate` | enquiry-reply | 0.05 [-0.08, 0.27] | 0.50 [0.50, 0.51] |
| `listRate` | internal-email | 0.09 [-0.08, 0.45] | 0.50 [0.50, 0.51] |
| `listRate` | business-email | 0.63 [0.46, 0.78] | 0.54 [0.53, 0.55] |
| `listRate` | literary | 0.64 [0.43, 0.71] | 0.54 [0.53, 0.55] |
| `listRate` | institutional | 0.39 [0.25, 0.47] | 0.53 [0.52, 0.54] |
| `listRate` | explanatory | 0.61 [0.44, 0.73] | 0.54 [0.53, 0.55] |
| `listRate` | marketing | 0.02 [-0.10, 0.16] | 0.51 [0.50, 0.53] |
| `studyRate` | claude-haiku-4-5-20251001 / marketing | 0.33 [0.00, 0.53] | 0.51 [0.50, 0.53] |
| `studyRate` | claude-haiku-4-5-20251001 / business-email | 0.79 [0.00, 1.32] | 0.51 [0.50, 0.52] |
| `studyRate` | claude-opus-5-5 / marketing | 0.00 [0.00, 0.00] | 0.50 [0.50, 0.50] |
| `studyRate` | claude-opus-5-5 / business-email | 0.00 [0.00, 0.00] | 0.50 [0.50, 0.50] |
| `studyRate` | claude-sonnet-5 / marketing | 0.00 [0.00, 0.00] | 0.50 [0.50, 0.50] |
| `studyRate` | claude-sonnet-5 / business-email | 0.00 [0.00, 0.00] | 0.50 [0.50, 0.50] |
| `studyRate` | service-blurb | 0.23 [0.00, 0.40] | 0.51 [0.50, 0.52] |
| `studyRate` | booking-description | 0.23 [0.00, 0.47] | 0.51 [0.50, 0.52] |
| `studyRate` | cta-block | 0.00 [0.00, 0.00] | 0.50 [0.50, 0.50] |
| `studyRate` | enquiry-reply | 0.37 [0.00, 0.61] | 0.50 [0.50, 0.51] |
| `studyRate` | internal-email | 0.00 [0.00, 0.00] | 0.50 [0.50, 0.50] |
| `studyRate` | business-email | 0.22 [0.00, 0.30] | 0.50 [0.50, 0.51] |
| `studyRate` | literary | 0.09 [-0.02, 0.30] | 0.50 [0.50, 0.51] |
| `studyRate` | institutional | 0.15 [0.00, 0.29] | 0.50 [0.50, 0.51] |
| `studyRate` | explanatory | 0.14 [-0.02, 0.28] | 0.50 [0.50, 0.51] |
| `studyRate` | marketing | 0.08 [0.00, 0.14] | 0.50 [0.50, 0.51] |
| `hardPer100` | claude-haiku-4-5-20251001 / marketing | -0.37 [-0.48, -0.22] | 0.48 [0.43, 0.55] |
| `hardPer100` | claude-haiku-4-5-20251001 / business-email | -0.61 [-0.74, -0.46] | 0.29 [0.24, 0.34] |
| `hardPer100` | claude-opus-5-5 / marketing | -0.23 [-0.35, -0.08] | 0.54 [0.47, 0.60] |
| `hardPer100` | claude-opus-5-5 / business-email | -0.38 [-0.50, -0.27] | 0.38 [0.34, 0.42] |
| `hardPer100` | claude-sonnet-5 / marketing | -0.18 [-0.32, 0.00] | 0.55 [0.49, 0.62] |
| `hardPer100` | claude-sonnet-5 / business-email | -0.42 [-0.58, -0.33] | 0.37 [0.30, 0.42] |
| `hardPer100` | service-blurb | -0.30 [-0.40, -0.18] | 0.51 [0.46, 0.57] |
| `hardPer100` | booking-description | -0.35 [-0.48, -0.22] | 0.49 [0.42, 0.55] |
| `hardPer100` | cta-block | -0.11 [-0.23, 0.04] | 0.57 [0.51, 0.63] |
| `hardPer100` | enquiry-reply | -0.65 [-0.72, -0.57] | 0.28 [0.25, 0.30] |
| `hardPer100` | internal-email | -0.16 [-0.32, -0.06] | 0.47 [0.41, 0.52] |
| `hardPer100` | business-email | -0.54 [-0.59, -0.50] | 0.32 [0.31, 0.34] |
| `hardPer100` | literary | 0.29 [0.18, 0.38] | 0.57 [0.55, 0.59] |
| `hardPer100` | institutional | -0.31 [-0.40, -0.24] | 0.39 [0.36, 0.41] |
| `hardPer100` | explanatory | 0.33 [0.26, 0.42] | 0.63 [0.61, 0.65] |
| `hardPer100` | marketing | -0.17 [-0.26, 0.02] | 0.51 [0.48, 0.56] |
| `tradePer100` | claude-haiku-4-5-20251001 / marketing | 0.50 [0.28, 0.88] | 0.64 [0.59, 0.72] |
| `tradePer100` | claude-haiku-4-5-20251001 / business-email | 0.99 [0.55, 1.39] | 0.59 [0.55, 0.62] |
| `tradePer100` | claude-opus-5-5 / marketing | 0.61 [0.28, 0.90] | 0.63 [0.56, 0.68] |
| `tradePer100` | claude-opus-5-5 / business-email | 1.02 [0.67, 1.28] | 0.61 [0.58, 0.64] |
| `tradePer100` | claude-sonnet-5 / marketing | 0.56 [0.34, 0.89] | 0.63 [0.57, 0.70] |
| `tradePer100` | claude-sonnet-5 / business-email | 1.26 [0.65, 1.86] | 0.62 [0.57, 0.68] |
| `tradePer100` | service-blurb | 0.77 [0.55, 1.12] | 0.69 [0.65, 0.76] |
| `tradePer100` | booking-description | 0.44 [0.25, 0.73] | 0.64 [0.60, 0.70] |
| `tradePer100` | cta-block | 0.46 [0.22, 0.78] | 0.56 [0.52, 0.62] |
| `tradePer100` | enquiry-reply | 1.18 [0.84, 1.40] | 0.61 [0.58, 0.64] |
| `tradePer100` | internal-email | 0.77 [0.45, 1.05] | 0.59 [0.56, 0.62] |
| `tradePer100` | business-email | 1.21 [0.99, 1.18] | 0.66 [0.65, 0.68] |
| `tradePer100` | literary | 1.23 [0.94, 1.24] | 0.65 [0.63, 0.67] |
| `tradePer100` | institutional | 1.80 [1.42, 1.63] | 0.68 [0.66, 0.70] |
| `tradePer100` | explanatory | 1.41 [1.13, 1.34] | 0.66 [0.64, 0.68] |
| `tradePer100` | marketing | 0.26 [0.14, 0.34] | 0.56 [0.53, 0.58] |
| `specificsPer100` | claude-haiku-4-5-20251001 / marketing | -0.23 [-0.35, -0.07] | 0.52 [0.46, 0.58] |
| `specificsPer100` | claude-haiku-4-5-20251001 / business-email | -0.50 [-0.63, -0.34] | 0.33 [0.27, 0.38] |
| `specificsPer100` | claude-opus-5-5 / marketing | -0.05 [-0.20, 0.18] | 0.57 [0.51, 0.64] |
| `specificsPer100` | claude-opus-5-5 / business-email | -0.27 [-0.39, -0.15] | 0.42 [0.38, 0.47] |
| `specificsPer100` | claude-sonnet-5 / marketing | -0.02 [-0.15, 0.21] | 0.58 [0.53, 0.65] |
| `specificsPer100` | claude-sonnet-5 / business-email | -0.29 [-0.46, -0.06] | 0.42 [0.36, 0.50] |
| `specificsPer100` | service-blurb | -0.08 [-0.22, 0.09] | 0.57 [0.52, 0.63] |
| `specificsPer100` | booking-description | -0.24 [-0.36, -0.05] | 0.51 [0.46, 0.58] |
| `specificsPer100` | cta-block | 0.02 [-0.11, 0.23] | 0.58 [0.53, 0.64] |
| `specificsPer100` | enquiry-reply | -0.51 [-0.59, -0.42] | 0.33 [0.30, 0.36] |
| `specificsPer100` | internal-email | -0.08 [-0.25, 0.04] | 0.49 [0.42, 0.54] |
| `specificsPer100` | business-email | -0.37 [-0.43, -0.33] | 0.39 [0.37, 0.41] |
| `specificsPer100` | literary | 0.59 [0.48, 0.66] | 0.64 [0.61, 0.66] |
| `specificsPer100` | institutional | 0.00 [-0.09, 0.07] | 0.48 [0.45, 0.50] |
| `specificsPer100` | explanatory | 0.60 [0.51, 0.66] | 0.68 [0.67, 0.71] |
| `specificsPer100` | marketing | -0.07 [-0.16, 0.11] | 0.53 [0.49, 0.57] |
| `generic` | claude-haiku-4-5-20251001 / marketing | -0.72 [-0.85, -0.62] | 0.35 [0.32, 0.38] |
| `generic` | claude-haiku-4-5-20251001 / business-email | 1.01 [0.71, 1.31] | 0.66 [0.62, 0.71] |
| `generic` | claude-opus-5-5 / marketing | -0.72 [-0.85, -0.61] | 0.35 [0.32, 0.38] |
| `generic` | claude-opus-5-5 / business-email | 0.36 [0.21, 0.57] | 0.56 [0.53, 0.59] |
| `generic` | claude-sonnet-5 / marketing | -0.75 [-0.85, -0.65] | 0.35 [0.32, 0.37] |
| `generic` | claude-sonnet-5 / business-email | 0.38 [0.16, 0.69] | 0.56 [0.52, 0.61] |
| `generic` | service-blurb | -0.75 [-0.87, -0.66] | 0.35 [0.31, 0.37] |
| `generic` | booking-description | -0.75 [-0.87, -0.66] | 0.35 [0.31, 0.37] |
| `generic` | cta-block | -0.68 [-0.84, -0.57] | 0.36 [0.32, 0.38] |
| `generic` | enquiry-reply | 0.67 [0.46, 0.83] | 0.61 [0.57, 0.64] |
| `generic` | internal-email | 0.35 [0.15, 0.61] | 0.56 [0.52, 0.60] |
| `generic` | business-email | 0.16 [0.08, 0.26] | 0.53 [0.51, 0.54] |
| `generic` | literary | -0.09 [-0.19, -0.03] | 0.48 [0.46, 0.49] |
| `generic` | institutional | 0.37 [0.24, 0.47] | 0.55 [0.53, 0.56] |
| `generic` | explanatory | -0.43 [-0.51, -0.37] | 0.40 [0.38, 0.41] |
| `generic` | marketing | -0.34 [-0.50, -0.24] | 0.43 [0.40, 0.45] |
| `figures` | claude-haiku-4-5-20251001 / marketing | -0.50 [-0.61, -0.40] | 0.37 [0.34, 0.39] |
| `figures` | claude-haiku-4-5-20251001 / business-email | -0.34 [-0.45, -0.18] | 0.37 [0.34, 0.42] |
| `figures` | claude-opus-5-5 / marketing | -0.45 [-0.57, -0.34] | 0.39 [0.35, 0.42] |
| `figures` | claude-opus-5-5 / business-email | -0.07 [-0.19, 0.08] | 0.45 [0.41, 0.48] |
| `figures` | claude-sonnet-5 / marketing | -0.35 [-0.49, -0.23] | 0.41 [0.37, 0.44] |
| `figures` | claude-sonnet-5 / business-email | -0.16 [-0.33, 0.05] | 0.44 [0.39, 0.50] |
| `figures` | service-blurb | -0.55 [-0.63, -0.49] | 0.36 [0.33, 0.38] |
| `figures` | booking-description | -0.24 [-0.40, -0.05] | 0.44 [0.39, 0.48] |
| `figures` | cta-block | -0.53 [-0.61, -0.47] | 0.37 [0.34, 0.39] |
| `figures` | enquiry-reply | -0.03 [-0.17, 0.09] | 0.45 [0.42, 0.48] |
| `figures` | internal-email | -0.36 [-0.47, -0.25] | 0.39 [0.35, 0.42] |
| `figures` | business-email | -0.32 [-0.40, -0.26] | 0.38 [0.36, 0.40] |
| `figures` | literary | 0.96 [0.67, 1.03] | 0.58 [0.56, 0.59] |
| `figures` | institutional | -0.20 [-0.31, -0.12] | 0.42 [0.39, 0.43] |
| `figures` | explanatory | -0.12 [-0.22, -0.04] | 0.46 [0.44, 0.47] |
| `figures` | marketing | -0.05 [-0.18, 0.08] | 0.45 [0.41, 0.48] |
| `names` | claude-haiku-4-5-20251001 / marketing | -0.06 [-0.19, 0.11] | 0.61 [0.56, 0.67] |
| `names` | claude-haiku-4-5-20251001 / business-email | -0.56 [-0.71, -0.37] | 0.30 [0.24, 0.36] |
| `names` | claude-opus-5-5 / marketing | 0.04 [-0.12, 0.20] | 0.64 [0.57, 0.69] |
| `names` | claude-opus-5-5 / business-email | -0.35 [-0.49, -0.19] | 0.37 [0.32, 0.42] |
| `names` | claude-sonnet-5 / marketing | -0.03 [-0.17, 0.16] | 0.62 [0.56, 0.68] |
| `names` | claude-sonnet-5 / business-email | -0.38 [-0.58, -0.25] | 0.36 [0.29, 0.42] |
| `names` | service-blurb | 0.15 [-0.02, 0.38] | 0.68 [0.63, 0.74] |
| `names` | booking-description | -0.05 [-0.20, 0.13] | 0.62 [0.56, 0.67] |
| `names` | cta-block | -0.14 [-0.28, 0.01] | 0.58 [0.53, 0.63] |
| `names` | enquiry-reply | -0.80 [-0.86, -0.75] | 0.22 [0.20, 0.25] |
| `names` | internal-email | 0.17 [-0.06, 0.33] | 0.54 [0.47, 0.59] |
| `names` | business-email | -0.34 [-0.40, -0.28] | 0.41 [0.39, 0.43] |
| `names` | literary | -0.14 [-0.20, -0.08] | 0.46 [0.45, 0.48] |
| `names` | institutional | -0.68 [-0.74, -0.65] | 0.28 [0.27, 0.30] |
| `names` | explanatory | 0.13 [0.08, 0.21] | 0.60 [0.59, 0.62] |
| `names` | marketing | -0.13 [-0.27, 0.05] | 0.53 [0.49, 0.58] |

## Edit survival

| Feature | Original TPR | After edit TPR |
| --- | ---: | ---: |
| `listRate` | 2.7% | 2.3% |
| `studyRate` | – | – |
| `hardPer100` | – | – |
| `tradePer100` | 9.1% | 9.1% |
| `specificsPer100` | – | – |
| `generic` | – | – |
| `figures` | – | – |
| `names` | – | – |

## Matched-register gate (informational, not a ship rule)

The ship rule holds every human register, literary and parliamentary included, at 5%. This shows what the threshold would catch if only the matched register had to hold at 5% on its tuning half. False positives are on that register's holdout half.

| Feature | Register | Threshold | Holdout FP | TPR | TPR edited |
| --- | --- | ---: | ---: | ---: | ---: |
| `listRate` | marketing | 1.695 | 3.2% | 5.2% | 3.2% |
| `listRate` | business-email | 0.704 | 0.5% | 0.8% | 1.6% |
| `studyRate` | marketing | – | – | – | – |
| `studyRate` | business-email | – | – | – | – |
| `hardPer100` | marketing | – | – | – | – |
| `hardPer100` | business-email | – | – | – | – |
| `tradePer100` | marketing | 3.774 | 2.4% | 10.4% | 8.9% |
| `tradePer100` | business-email | 1.163 | 4.7% | 25.6% | 24.6% |
| `specificsPer100` | marketing | – | – | – | – |
| `specificsPer100` | business-email | – | – | – | – |
| `generic` | marketing | – | – | – | – |
| `generic` | business-email | – | – | – | – |
| `figures` | marketing | – | – | – | – |
| `figures` | business-email | – | – | – | – |
| `names` | marketing | – | – | – | – |
| `names` | business-email | – | – | – | – |

## Words

Share of blurbs containing each word: matched AI blurbs (624) against every human register. A candidate appears in at least 1.5% of matched AI blurbs and in at most 0.5% of every human register. A candidate is a word to consider for a review-tier list, not a tell; the 5% gate above still applies to any rate built from them.

| Word | Source | AI | AI edited | business-email | literary | institutional | explanatory | marketing | Candidate |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| tailored to your | STOCK_PHRASES | 5.6% | 0.3% | 0.0% | 0.0% | 0.0% | 0.0% | 0.6% | no |
| we pride ourselves | STOCK_PHRASES | 1.6% | 0.2% | 0.0% | 0.0% | 0.0% | 0.0% | 1.4% | no |
| peace of mind | STOCK_PHRASES | 0.8% | 0.3% | 0.0% | 0.0% | 0.0% | 0.0% | 0.3% | no |
| your journey | STOCK_PHRASES | 0.6% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.1% | no |
| nestled | AI_WORDS | 0.5% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| intricate | Juzek and Ward, arXiv:2412.11385, Appendix A (PubMed abstracts, 2020 to 2024) | 0.3% | 0.2% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| meticulous | AI_WORDS | 0.3% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.1% | no |
| showcasing | Juzek and Ward, arXiv:2412.11385, Appendix A (PubMed abstracts, 2020 to 2024) | 0.2% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| passionate about | STOCK_PHRASES | 0.2% | 0.0% | 0.0% | 0.0% | 0.1% | 0.0% | 0.1% | no |
| reach out | BUZZWORDS | 0.2% | 1.2% | 0.0% | 0.0% | 0.1% | 0.0% | 0.0% | no |
| delved | Juzek and Ward, arXiv:2412.11385, Appendix A (PubMed abstracts, 2020 to 2024) | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| delving | Juzek and Ward, arXiv:2412.11385, Appendix A (PubMed abstracts, 2020 to 2024) | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| delve | Juzek and Ward, arXiv:2412.11385, Appendix A (PubMed abstracts, 2020 to 2024) | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| boasts | Juzek and Ward, arXiv:2412.11385, Appendix A (PubMed abstracts, 2020 to 2024) | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| underscores | Juzek and Ward, arXiv:2412.11385, Appendix A (PubMed abstracts, 2020 to 2024) | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| comprehending | Juzek and Ward, arXiv:2412.11385, Appendix A (PubMed abstracts, 2020 to 2024) | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| intricacies | Juzek and Ward, arXiv:2412.11385, Appendix A (PubMed abstracts, 2020 to 2024) | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| surpassing | Juzek and Ward, arXiv:2412.11385, Appendix A (PubMed abstracts, 2020 to 2024) | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| tapestry | AI_WORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| testament | AI_WORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.1% | 0.1% | 0.1% | no |
| realm | AI_WORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| embark | AI_WORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| embarking | AI_WORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| unleash | AI_WORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| unlocks | AI_WORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| unlocking | AI_WORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.1% | no |
| elevate | AI_WORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| elevates | AI_WORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| elevated | AI_WORDS | 0.0% | 0.0% | 0.0% | 0.1% | 0.0% | 0.1% | 0.0% | no |
| elevating | AI_WORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| bustling | AI_WORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| meticulously | AI_WORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| paramount | AI_WORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.1% | 0.0% | 0.0% | no |
| furthermore | AI_WORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.2% | 0.2% | 0.1% | no |
| moreover | AI_WORDS | 0.0% | 0.0% | 0.0% | 0.2% | 0.1% | 0.0% | 0.0% | no |
| navigating | AI_WORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| unparalleled | AI_WORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| underscore | AI_WORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| pivotal | AI_WORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.1% | 0.0% | 0.0% | no |
| empower | PLAINER_WORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.1% | 0.0% | 0.0% | no |
| empowers | PLAINER_WORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| empowered | PLAINER_WORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| empowering | PLAINER_WORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.1% | 0.0% | 0.0% | no |
| harness | PLAINER_WORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.1% | no |
| harnesses | PLAINER_WORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| harnessed | PLAINER_WORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| harnessing | PLAINER_WORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| leverage | PLAINER_WORDS | 0.0% | 0.0% | 0.1% | 0.0% | 0.1% | 0.1% | 0.0% | no |
| leveraged | PLAINER_WORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.1% | 0.0% | no |
| leveraging | PLAINER_WORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| dive into | AI_PHRASES | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| here's the thing | AI_PHRASES | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| it's important to note | AI_PHRASES | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| it's important to remember | AI_PHRASES | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| it is worth noting that | AI_PHRASES | 0.0% | 0.0% | 0.0% | 0.0% | 0.1% | 0.0% | 0.0% | no |
| at its core | AI_PHRASES | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| the reality is | AI_PHRASES | 0.0% | 0.0% | 0.0% | 0.0% | 0.3% | 0.1% | 0.0% | no |
| the truth is | AI_PHRASES | 0.0% | 0.0% | 0.0% | 0.1% | 0.2% | 0.0% | 0.0% | no |
| increasingly digital | AI_PHRASES | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| seamless | AI_PHRASES | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.1% | no |
| seamlessly | AI_PHRASES | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.1% | no |
| unlock your | AI_PHRASES | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| look no further | AI_PHRASES | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.3% | no |
| in the event that | AI_PHRASES | 0.0% | 0.0% | 0.1% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| rest assured | AI_PHRASES | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.4% | no |
| when it comes to | AI_PHRASES | 0.0% | 0.2% | 0.0% | 0.0% | 0.6% | 0.3% | 0.1% | no |
| to the next level | STOCK_PHRASES | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| one-stop shop | STOCK_PHRASES | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| second to none | STOCK_PHRASES | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.7% | no |
| our journey | STOCK_PHRASES | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| curated | STOCK_PHRASES | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.1% | no |
| so here's | STOCK_PHRASES | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| the future looks bright | STOCK_PHRASES | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| only time will tell | STOCK_PHRASES | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| synergy | BUZZWORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| synergize | BUZZWORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| cutting-edge | BUZZWORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| cutting edge | BUZZWORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| best-in-class | BUZZWORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| best in class | BUZZWORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| game-changer | BUZZWORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| game changer | BUZZWORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| world-class | BUZZWORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.2% | 0.0% | 0.0% | no |
| state of the art | BUZZWORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| state-of-the-art | BUZZWORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.1% | no |
| mission-critical | BUZZWORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| low-hanging fruit | BUZZWORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| circle back | BUZZWORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| touch base | BUZZWORDS | 0.0% | 0.2% | 0.1% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| robust | BUZZWORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.4% | 0.1% | 0.4% | no |
| turnkey | BUZZWORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | no |
| holistic | BUZZWORDS | 0.0% | 0.0% | 0.0% | 0.0% | 0.1% | 0.0% | 0.3% | no |
| disruptive | BUZZWORDS | 0.0% | 0.2% | 0.0% | 0.0% | 0.1% | 0.0% | 0.0% | no |

