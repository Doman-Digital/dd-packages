---
"@domandigital/gbp": minor
---

Reviews survive a bad minute at Google, and stop publishing a count Google never gave.

- **Breaking: `totalReviewCount` is now `number | null`.** A missing count used to fall back to the length of the filtered, limited list, which would put a wrong number into anything built from it (an `aggregateRating`, a "120 reviews" badge). Now it is `null`, and so is an unconfigured result. Handle `null` by rendering no number.
- A 401 drops the cached access token, refreshes once and asks for the same page again; a second 401 throws. Concurrent callers share one token refresh.
- Every request has an 8 s deadline. 429 and 500/502/503/504 are retried up to three attempts with full-jitter backoff, honouring `Retry-After` up to 30 s. Tunable with `request`.
- Pagination stops on a repeated page token or after `maxPages` (default 50) with a `GbpPaginationError`, rather than looping.
- Typed errors: `GbpAuthError` (`reauthorizationRequired` on `invalid_grant`), `GbpApiError`, `GbpTimeoutError`, `GbpPaginationError`, all extending `GbpError`, none carrying a credential.
- New review fields from Google: attached photos and videos (`media`), the reply link (`replyUrl`), and the reply's moderation `state` with `policyViolation`. Replies Google has not approved are left off unless `includeUnapprovedReplies` is set, so a site never shows a rejected reply.
- The response is validated: a malformed review is skipped, a malformed page throws.
