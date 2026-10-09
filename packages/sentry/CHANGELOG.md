# @domandigital/sentry

## 0.1.1

### Patch Changes

- 2f756fc: Installable: 0.1.0 was published with its `@domandigital/synthetic` dependency as `workspace:^`, which no package manager outside this repo can resolve. 0.1.1 depends on `^0.1.0`. Use 0.1.1; 0.1.0 is deprecated.

## 0.1.0

### Minor Changes

- 2852752: First release: one Sentry setup for browser, Cloudflare Worker and Next.js sites. `browserOptions`, `cloudflareOptions` and `nextClientOptions` / `nextServerOptions` / `nextEdgeOptions` return `Sentry.init` options with the environment (production, staging or preview, from one variable), the release (the commit SHA), a normalised DSN host, no default PII (v10) and a tight `dataCollection` (v11), a scrubber for events, transactions and spans, the shared noise filters and the house sample rates. Next.js also gets `nextBuildOptions` for `withSentryConfig`, `onRequestError` and `captureGlobalError`. `dd-sentry-release upload` / `finalize` is the release and source-map step for Worker and Astro builds. Works with Sentry SDK v10 and v11.
