---
"@domandigital/gbp": minor
---

Read a client's Checkatrade or MyBuilder reviews from the file Doman Digital publishes, so a site holds no scraper.

- **`getPublishedExternalReviews({ client, source })`** fetches `https://files.domandigital.co.uk/reviews/<client>.<source>.json`, `source` being `"checkatrade"` or `"mybuilder"`, which the portal writes from the collector's nightly read of the client's public profile.
- Returns the platform's own `score` and `count` on its own `scale` (`out_of_10` for Checkatrade, `percent_positive` for MyBuilder), the `profileUrl`, and `reviews`: every review with words, word for word, with `author` as "Karen P.", the review's `rating` out of 10 or `sentiment`, the `job` and the trader's `reply`.
- Throws `GbpPublishedError` like `getPublishedReviews`, so the caller keeps its last good copy. Refuses the other platform's file, another client's file, a scale that does not match the source and a score above the scale.
