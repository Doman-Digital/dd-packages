---
"@domandigital/gbp": minor
---

Read a client's Facebook Page recommendations from the file Doman Digital publishes, so a site needs no Meta token.

- **`getPublishedFacebookRecommendations({ client })`** fetches `https://files.domandigital.co.uk/reviews/<client>.facebook.json`, which the portal writes daily from the Page token it already holds.
- Returns Meta's own `rating` (null when Meta gives none), `count` (every recommendation), `recommends` (the positive ones) and `reviews`: positive recommendations with words, with `id`, `comment` and `createdAt`. There is no author, because Meta does not return one.
- Throws `GbpPublishedError` like `getPublishedReviews`, so the caller keeps its last good copy. Refuses the Google file, another client's file and a count that does not add up.
