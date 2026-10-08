---
"@domandigital/gbp": minor
---

A dead Google token or a Google 503 no longer reaches the page, and no longer files a new error-tracker issue every time.

- **`getBusinessReviewsSafe(options)` and `getPublishedReviewsSafe(options)`** never throw. On any failure they serve the last good result this process fetched (up to `maxStaleMs`, default 30 days), then your `fallback` (a snapshot, or a loader such as a KV read), then an empty result. `source` says which (`live`, `cache`, `fallback`, `empty`) and `error` holds the failure.
- They report each kind of failure at most once per `reportIntervalMs` (default one hour) per process, through `report(error, { fingerprint, context, transient, served, suppressed })`. Pass `fingerprint` and `context` straight to `Sentry.captureException`.
- After `invalid_grant` or `invalid_client` they skip the token request for `authRetryMs` (default five minutes) and serve the cache or fallback straight away.
- **Error messages are now short and stable**, with what varies moved to `error.context`: `GBP token refresh failed: invalid_grant` (was `Google OAuth token refresh failed: 400 invalid_grant (...)`), `GBP reviews.list failed: 5xx` (was the status plus Google's body), `GBP reviews.list timed out`. A published-file HTTP failure no longer puts the body in its message. Anything matching on the old message text needs updating; match on `error.code` instead.
- Every `GbpError` has `code`, `transient`, `context` and `fingerprint` (`["gbp", code]`). Every 5xx shares the code `api_5xx`, so a Google outage is one issue rather than one per status. `GbpApiError` also has `body`.
