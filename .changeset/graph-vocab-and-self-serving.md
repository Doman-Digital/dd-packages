---
"@domandigital/graph": minor
---

Check every builder's output against the schema.org vocabulary, and report self-serving review markup.

- **Output change: `buildService` no longer emits `isPartOf`.** schema.org defines `isPartOf` on CreativeWork only, and a Service is not one, so parsers were already dropping it. The service's WebPage node carries the link to the WebSite.
- **Output change: `buildWebsite` ignores `speakable`.** schema.org defines `speakable` on Article and WebPage only. `WebsiteInput.speakable` is deprecated; pass `speakable` to the new `WebPageInput.speakable` (or `buildArticle`) instead.
- `findGraphIssues(graph, { siteEntityId })` reports `self-serving review: aggregateRating on <id>` and `self-serving review: Review of <id> (N×)`. Google makes review markup about the business on its own site ineligible for stars, with no manual action for that alone. Without the option the output is unchanged.
- `buildFAQPage` is marked `@deprecated` in JSDoc: Google removed the FAQ rich result on 7 May 2026. It still works and the markup is still valid.
- JSDoc on `buildReview` and `OrganizationInput.aggregateRating` states the self-serving rule.
- New dev-only test: every builder's keys are checked against a pinned schema.org 30.1 snapshot (`pnpm run snapshot:vocab` regenerates it). It found the two output changes above; reintroducing the old `PostalAddress.locality` bug makes it fail by name.
