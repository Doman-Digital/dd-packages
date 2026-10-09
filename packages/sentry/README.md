# @domandigital/sentry

One Sentry setup for every Doman Digital site. Each entry point returns plain
`Sentry.init` options, so the site keeps its own Sentry SDK at its own version
(v10 or v11) and this package only decides what those options say:

| | |
|---|---|
| **Environment** | `production`, `staging` or `preview`, from one variable. Never hardcoded. `development`, `dev`, `local` and `test` turn reporting off. Unset means `preview`, so a forgotten variable shows up as preview noise, not as a production incident. |
| **Release** | The git SHA of the build, from whichever CI built it. |
| **DSN** | From the input or `SENTRY_DSN` / `PUBLIC_SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`. A pre-transfer host (`o<other>.ingest.de.sentry.io`) is rewritten to `o4510784554991616.ingest.de.sentry.io`. |
| **PII** | v10's `sendDefaultPii` stays at its default, false. On v11, `dataCollection` is set to collect no user info, cookies, bodies or local variables. |
| **Scrubber** | `beforeSend` redacts emails, bearer tokens, UK phone numbers and sensitive keys (email, token, cookie, password, phone, ...) in the request, user, extra, contexts, tags, message, exception messages and breadcrumbs, then strips `X-DD-Synth-*` (from `@domandigital/synthetic`). Transactions get the same through an integration; spans through `beforeSendSpan`. A site's own `beforeSend` runs first; the scrubber has the last word. |
| **Noise** | Shared `ignoreErrors` and `denyUrls`: in-app browsers and wallets (`ethereum`, `__firefox__`, `webkit.messageHandlers`, "Java object is gone"), missing third-party globals (`googletag`, `jQuery`, `$`, `zaius`, `eventTracker`), "Failed to find Server Action", skipped view transitions, browser-extension frames, tag managers and ad scripts. In the browser, a bare `Failed to fetch` / `Load failed` whose request went to another site is dropped. |
| **Sampling** | Traces: 5% in the browser, 10% on servers. Replay rates (0 per session, 1.0 on error) are set only when the Replay integration is actually added. |

It also ships `dd-sentry-release`, the release and source-map step for Worker
and Astro builds (below). Next.js sites get theirs from `withSentryConfig`.

## Install

```sh
pnpm add @domandigital/sentry
```

The org is always `domandigital` (EU). Each site has its own Sentry project.

## Variables

| Variable | Where | What |
|---|---|---|
| `SENTRY_DSN` / `PUBLIC_SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | runtime | The project's DSN. Public is fine: a DSN is not a secret. |
| `SENTRY_ENVIRONMENT` / `PUBLIC_SENTRY_ENVIRONMENT` / `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | runtime | `production`, `staging` or `preview`. Vercel's `VERCEL_ENV` is read when none is set. |
| `SENTRY_RELEASE` / `PUBLIC_SENTRY_RELEASE` | runtime | The commit SHA. Falls back to `CF_PAGES_COMMIT_SHA`, `WORKERS_CI_COMMIT_SHA`, `VERCEL_GIT_COMMIT_SHA`, `GITHUB_SHA`. |
| `SENTRY_AUTH_TOKEN` | build | An org token, from Doppler. Only `dd-sentry-release` and `withSentryConfig` use it; it never reaches a bundle. |
| `SENTRY_PROJECT` | build | The project slug, for uploads. |

A browser bundle only contains the variables the bundler inlines, so the
browser examples hand them over explicitly (`import.meta.env`, or each
`process.env.NEXT_PUBLIC_*` written out in full).

## Browser: Astro, or any static site

`sentry.client.config.ts` with `@sentry/astro`, or the module that calls
`Sentry.init` with `@sentry/browser`:

```ts
import * as Sentry from "@sentry/astro";
import { browserOptions } from "@domandigital/sentry/browser";

Sentry.init(
  browserOptions({
    env: import.meta.env, // PUBLIC_SENTRY_DSN, PUBLIC_SENTRY_ENVIRONMENT, PUBLIC_SENTRY_RELEASE
    integrations: [Sentry.browserTracingIntegration()],
  }),
);
```

Set `PUBLIC_SENTRY_RELEASE` to the commit SHA in the build step (CI example
below), so browser errors carry the same release as the uploaded maps.

Add Replay only if someone will watch it; the rates follow the integration:

```ts
integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
```

## Cloudflare Worker

```ts
import * as Sentry from "@sentry/cloudflare";
import { cloudflareOptions } from "@domandigital/sentry/cloudflare";

export default Sentry.withSentry((env: Env) => cloudflareOptions({ env }), {
  async fetch(request, env, ctx) {
    // ...
  },
} satisfies ExportedHandler<Env>);
```

`env` is the Worker's bindings: `SENTRY_DSN` (a var or secret),
`SENTRY_ENVIRONMENT` (a var in `wrangler.jsonc`, one per environment) and
`SENTRY_RELEASE` (set at deploy: `wrangler deploy --var SENTRY_RELEASE:$GITHUB_SHA`).
It passes `@sentry/cloudflare` v11's strict `withSentry` check, which rejects
any option it does not know.

An Astro site on a Worker uses the same options for its server side: wrap its
custom worker entry with `withSentry` exactly as above.

## Next.js

Next 16 with Turbopack loads only `instrumentation-client.ts` in the browser.
A `sentry.client.config.ts` is never read, so a client init kept there reports
nothing. Delete it and use these three files.

`instrumentation-client.ts`:

```ts
import * as Sentry from "@sentry/nextjs";
import { nextClientOptions, thirdPartyFilterOptions } from "@domandigital/sentry/next";

Sentry.init(
  nextClientOptions({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NEXT_PUBLIC_VERCEL_ENV,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.thirdPartyErrorFilterIntegration(thirdPartyFilterOptions("acme-site")),
    ],
  }),
);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
```

`instrumentation.ts`:

```ts
import * as Sentry from "@sentry/nextjs";
import { nextEdgeOptions, nextServerOptions } from "@domandigital/sentry/next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") Sentry.init(nextServerOptions({ env: process.env }));
  if (process.env.NEXT_RUNTIME === "edge") Sentry.init(nextEdgeOptions({ env: process.env }));
}

export { onRequestError } from "@domandigital/sentry/next";
```

`app/global-error.tsx` (it replaces the root layout when that throws, so
nothing else reports it):

```tsx
"use client";
import { useEffect } from "react";
import { captureGlobalError } from "@domandigital/sentry/next";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    void captureGlobalError(error);
  }, [error]);
  return (
    <html lang="en-GB">
      <body>
        <h1>Something went wrong.</h1>
      </body>
    </html>
  );
}
```

`next.config.ts`:

```ts
import { withSentryConfig } from "@sentry/nextjs";
import { nextBuildOptions } from "@domandigital/sentry/next";

export default withSentryConfig(nextConfig, nextBuildOptions({ project: "acme-site", env: process.env }));
```

`nextBuildOptions` sets the org, the project, the token, the release (the
commit SHA, with a deploy record for its environment), uploads the maps and
deletes them, and sets the `applicationKey` that `thirdPartyFilterOptions`
matches: the bundler plugin tags the site's own files with it, so an error
made only of third-party frames is dropped. Use the same project slug in both.
`onRequestError` and `captureGlobalError` load the site's own `@sentry/nextjs`
when they run.

## Release and source maps for Worker and Astro builds: `dd-sentry-release`

The step from RMP-Electrical's `deploy-astro.yml`, as one command in two
halves. The maps go up and are deleted **before** the deploy, and the deploy
record is written **after** it:

```sh
pnpm add -D sentry   # the Sentry CLI it drives

dd-sentry-release upload dist/client dist/server --keep-maps dist/server
#   sentry release create domandigital/$SHA --project $SENTRY_PROJECT
#   sentry sourcemap inject <dir>; sentry sourcemap upload <dir> --release $SHA   (each dir)
#   delete every .map in each dir not named by --keep-maps
wrangler deploy --var SENTRY_RELEASE:$SHA
dd-sentry-release finalize
#   sentry release finalize domandigital/$SHA
#   sentry release deploy domandigital/$SHA $SENTRY_ENVIRONMENT
```

`--keep-maps` is for a Worker bundle that wrangler still reads at deploy (it
fails when a file names a map that is gone, and does not upload maps it is not
asked to). Only maps in a directory visitors are served must go.

A missing token, a Sentry outage or a failed upload never fails the deploy;
the maps are deleted either way. `--strict` makes them fail it. `finalize`
records no deploy when no environment is set, rather than guess one.
`dd-sentry-release --help` lists every option.

In GitHub Actions (`SENTRY_AUTH_TOKEN` synced from Doppler to the repo's
secrets):

```yaml
    env:
      SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
      SENTRY_PROJECT: acme-site
      SENTRY_ENVIRONMENT: production
      PUBLIC_SENTRY_RELEASE: ${{ github.sha }}   # browser errors carry the same release
    steps:
      # ... checkout, pnpm, install, test
      - run: pnpm build
      - run: pnpm exec dd-sentry-release upload dist/client dist/server --keep-maps dist/server
      - run: pnpm exec wrangler deploy --config dist/server/wrangler.json --var "SENTRY_RELEASE:${{ github.sha }}"
      - run: pnpm exec dd-sentry-release finalize
```

On Cloudflare Workers Builds the same commands go in the build and deploy
commands; `WORKERS_CI_COMMIT_SHA` is read for the release.

## Lower-level pieces

`@domandigital/sentry` (the root entry) exports what the presets are built
from, for a site that wires Sentry some other way: `resolveEnvironment`,
`resolveRelease`, `resolveDsn`, `normaliseDsn`, `scrubEvent`, `scrubSpan`,
`IGNORE_ERRORS`, `DENY_URLS`, `isThirdPartyNetworkError`, `DATA_COLLECTION`
and `buildPreset`.

## Tests

`pnpm --filter @domandigital/sentry test` runs the presets through real Sentry
v10 and v11 clients (only the network replaced), checks the option types
against `@sentry/browser` v10 and v11 and `@sentry/cloudflare` v11's strict
`withSentry`, and drives the built CLI against a fake `sentry`.
