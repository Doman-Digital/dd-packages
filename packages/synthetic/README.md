# @domandigital/synthetic

The signed synthetic-submission protocol for Doman Digital client forms. DD
Checks (`dd-checks`) submits a real enquiry through a client's real form
handler on a schedule; Turnstile blocks synthetic browsers, so the handler
accepts a signed request that skips **only the Turnstile token**.

Web Crypto only, no dependencies: it runs in Cloudflare Workers, Node 22+,
Vercel and the browser-side signing helpers in dd-checks. Tests run in both
Node and workerd.

The protocol is specified in the "DD Checks: plan" document on DOM-487,
section 3. This package is that section as code.

## Install

```sh
pnpm add @domandigital/synthetic
```

## In a form handler

```ts
import {
  verifyRequest, keysFromEnv, turnstileConfigCheck, assertCanaryRecipient,
  syntheticReport, sendBeacon, upstashReplayGuard,
} from "@domandigital/synthetic";

export async function POST(request: Request) {
  const verified = await verifyRequest(request, {
    keys: keysFromEnv(env),                 // empty => synthetic path off
    host: "www.example.co.uk",              // the public host
    path: "/api/enquiry",
    contentTypes: ["application/json"],
    replayGuard: upstashReplayGuard({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN }),
  });

  if (!verified.ok && verified.rejected) {
    // Handle as an ordinary request (Turnstile still applies) and tell dd-checks.
    ctx.waitUntil(sendBeacon(reporter, { form: "enquiry", code: "synthetic_rejected", reason: verified.reason }));
  }

  const synthetic = verified.ok ? verified.synthetic : null; // frozen; the only source of truth
  // 1. same-origin  2. schema validation
  // 3. synthetic ? turnstileConfigCheck({...}) : verify the Turnstile token
  // 4. the real rate limiter, identifier `synthetic:<form>` when synthetic
  // 5. full mode only: DB write (record_origin='synthetic', synthetic_run_id, purge_after),
  //    staff email redirected to canaryAddress("s", runId); submitter email to
  //    canaryAddress("u", runId) on the daily run only. assertCanaryRecipient() first.
  // 6. skip SMS, CRM, marketing lists, trackLead; report them as "skipped".
  // 7. respond with { ..., synthetic: syntheticReport(synthetic, stages) } only when synthetic
}
```

Rules the code enforces for you:

- **Off by default.** Without `DD_SYNTHETIC_SECRET` (and `DD_SYNTHETIC_KID`) every request is ordinary.
- **Shape before signature.** Method, host, path and content type are checked before the body is hashed.
- **A rejected request is an ordinary request**, never a failure. `verify` never throws.
- **The replay guard is required** and runs after the signature, so a forged request cannot burn a real run id.
- **The body and query are never read** for `synthetic`. The `SyntheticContext` is built only from verified headers and is frozen.

Replay guard options: `upstashReplayGuard` (`SET synth:<runId> NX EX 300`), or
your own function over a unique constraint on `synthetic_run_id`:

```ts
replayGuard: async (runId) => {
  try { await db.insert(syntheticRuns).values({ syntheticRunId: runId }); return true; }
  catch (e) { if (isUniqueViolation(e)) return false; throw e; }
}
```

## Rotation

A site holds at most two keys: `DD_SYNTHETIC_SECRET` + `DD_SYNTHETIC_KID`, and
`DD_SYNTHETIC_SECRET_NEXT` + `DD_SYNTHETIC_KID_NEXT`. Set the new key as
`_NEXT` with a new kid, switch the platform over, promote it, then remove the
old one. An unknown kid is rejected. The secret is 32 random bytes, base64url:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

## Signing (dd-checks)

```ts
const { headers, runId } = await sign({
  key: { kid: "sensphere-2026-10", secret },
  url: "https://www.sensphere.co.uk/api/enquiry",
  contentType: "application/json",
  body: rawBodyString,
  client: "sensphere", form: "enquiry", mode: "probe",
});
```

`runId` is 16 characters of `[a-z2-7]`, generated fresh for every call from the
CSPRNG. It is the replay nonce and goes into the canary address, so every run
is unique and no idempotency key on the client's side can dedupe one.

## The wire format

Headers: `X-DD-Synth: v1`, `X-DD-Synth-Kid`, `-Ts` (unix seconds), `-Run`,
`-Mode` (`probe` or `full`), `-Client`, `-Form`, `-Sig: v1=<hex>`.

The signature is HMAC-SHA256 with the 32-byte secret over:

```
DD-SYNTH-V1\n<kid>\n<ts>\n<runId>\n<mode>\n<client>\n<form>\nPOST\n<host>\n<path>\n<content-type>\n<hex sha256(raw body)>
```

`host` is lower-case and includes a port only if the URL has one. `path` has
the query string removed. `content-type` is the header exactly as sent (a
multipart boundary is part of it). Window: ±120 s. Comparison: constant time.

**Test vectors** are published in [`test-vectors.json`](./test-vectors.json)
(`@domandigital/synthetic/test-vectors.json`): a test secret and, per case, the
inputs, the canonical string, the body hash and the expected signature. They
are generated with `node:crypto` by `scripts/gen-vectors.mjs`, independent of
this package's code. Any other implementation (a Python checker, a Go service)
must reproduce them.

## Recipient lock

```ts
assertCanaryRecipient(submitterEmail);   // throws SyntheticRecipientError
```

Only `@canary.domandigital.co.uk` passes, as one plain address. Display names,
lists, subdomains and look-alike domains all fail. Call it before anything is
sent.

## Turnstile config self-check

`turnstileConfigCheck({ siteKey, secretKey, expectedHostname, publicHost })`
replaces the token on a verified synthetic request. It returns
`{ ok, outcome }`, with `outcome` one of:

| outcome | meaning |
| -- | -- |
| `ok` | keys present, hostname right, secret accepted by siteverify |
| `missing_keys` | a key or `TURNSTILE_EXPECTED_HOSTNAME` is unset |
| `hostname_mismatch` | `TURNSTILE_EXPECTED_HOSTNAME`, normalised, is not the public host (the Sensphere failure) |
| `test_key_on_production` | a Cloudflare test key on a production host |
| `invalid-input-secret` | siteverify says the secret is wrong |
| `siteverify_unexpected` | siteverify answered something else (for example `success` for a dummy token on production) |
| `siteverify_unreachable` | network error, timeout or non-JSON; says nothing about the config |

Hostnames compare lower-case with scheme, port, path and trailing dot removed;
`www.` is kept, because it is a different host. Staging hosts accept the test
keys, since staging browser journeys use Cloudflare's always-pass keys.

## Beacons and purge receipts

```ts
const reporter = { key, client: "sensphere", waitUntil: ctx.waitUntil.bind(ctx) };
sendBeacon(reporter, { form: "enquiry", code: "accepted" });
sendPurgeReceipt(reporter, { form: "enquiry", deleted: 24, remaining: 0 });
```

Both are signed with the site's key (`-Mode: beacon` / `receipt`), post to
`https://checks.domandigital.co.uk/beacon` and `/purge-receipt`, are
fire-and-forget, and **never throw or reject**: a bad argument is dropped. A
beacon holds codes only (`accepted`, `hostname_mismatch`,
`invalid-input-secret`, `misconfigured`, `service_unavailable`,
`delivery_failed`, `captcha_failed`, `synthetic_rejected` plus a `reason`),
and never personal data.

## Keeping the headers out of Sentry and logs

```ts
Sentry.init({ beforeSend: scrubSentryEvent, beforeSendTransaction: scrubSentryEvent });
logger.info(scrubText(headerDump));
const safe = scrubHeaders(request.headers);
```

## Development

```sh
pnpm --filter @domandigital/synthetic test    # Node, then workerd
```
