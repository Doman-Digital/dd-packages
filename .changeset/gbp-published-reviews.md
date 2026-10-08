---
"@domandigital/gbp": minor
---

Read reviews from the file Doman Digital publishes, so a site needs no Google token.

- **`getPublishedReviews({ client })`** fetches `https://files.domandigital.co.uk/reviews/<client>.json` (override with `baseUrl` or `GBP_REVIEWS_BASE_URL`). One collector reads every listing with the only Google credential and the portal publishes the file each night, so a dead token makes reviews stale, not missing.
- Same shape as `getBusinessReviews`: Google's own `averageRating` and `totalReviewCount` for the whole listing, plus `reviews` (four and five stars with words, replies Google shows). Adds `syncedAt`, when Google was last read.
- Throws `GbpPublishedError` (`http`, `invalid`, `unknown_schema`) instead of returning an empty result, so the caller keeps the copy it already has. Retries 429 and transient 5xx within the usual deadline.
- Defaults to newest first (`order: "api"`) and a daily Next.js revalidate tagged `google-reviews`.
