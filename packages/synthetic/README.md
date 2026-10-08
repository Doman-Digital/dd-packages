# @domandigital/synthetic

The signed synthetic-submission protocol (`X-DD-Synth` v1) for Doman Digital
form handlers and for dd-checks. Web Crypto only, no dependencies: it runs
unchanged in Cloudflare Workers, Node 22+, Vercel and browsers.

Turnstile blocks synthetic browsers, so each form handler accepts a signed
request that skips **only** the Turnstile token. Same-origin, schema
validation, the rate limiter and every WAF rule still apply. The design is the
"DD Checks: plan" document on DOM-487, section 3; this package is the one
implementation of it.

```
pnpm add @domandigital/synthetic
```

## The protocol

Headers on the request:

| Header | Value |
| --- | --- |
| `X-DD-Synth` | `v1` |
| `X-DD-Synth-Kid` | key id, e.g. `sensphere-2026-10` |
| `X-DD-Synth-Ts` | unix seconds |
| `X-DD-Synth-Run` | 16 characters of `[a-z2-7]`; the nonce, the replay key and the canary address |
| `X-DD-Synth-Mode` | `probe` or `full` |
| `X-DD-Synth-Client` | client slug |
| `X-DD-Synth-Form` | form name |
| `X-DD-Synth-Sig` | `v1=<hex>` |

Signature: HMAC-SHA-256 with the 32-byte base64url secret over

```
DD-SYNTH-V1\n<kid>\n<ts>\n<runId>\n<mode>\n<client>\n<form>\nPOST\n<host>\n<path>\n<content-type>\n<hex sha256(raw body)>
```

`host` is the public host (with a port if non-default), `path` has no query
string, `content-type` is the header exactly as sent, and the body hash is of
the raw bytes received, not of a parsed or re-serialised body.

### Verification order

1. No `X-DD-Synth` header: an ordinary request (`not_synthetic`). No keys
   configured: the path is off (`disabled`). Neither sends a beacon.
2. **Shape**: method `POST`, configured host, exact path, listed content type.
   A wrong shape is rejected before any key is touched.
3. Header syntax, then the key is chosen **by kid**. An unknown kid is rejected.
4. HMAC compared in constant time.
5. `|now - ts| <= 120` seconds.
6. **Replay guard**, required: the run id is claimed through your hook. It is
   claimed last, so junk cannot burn run ids. A guard that throws rejects.

Anything from step 2 onward that fails returns `{ ok: false, reason, beacon: true }`.
Handle the request as an ordinary one (Turnstile still applies) and send a
`synthetic_rejected` beacon with the reason.

### Two keys, rotation

At most two keys: `DD_SYNTHETIC_SECRET` and `DD_SYNTHETIC_SECRET_NEXT`, each
with its kid (`DD_SYNTHETIC_KID`, `DD_SYNTHETIC_KID_NEXT`). Rotate by setting
`_NEXT` with a new kid, switching the platform over, promoting it to the
primary slot, then removing the old one.

## Use in a form handler

```ts
import { verify, keysFromEnv, upstashReplayGuard, isOwnCanaryAddress, sendBeacon, turnstileConfigCheck } from "@domandigital/synthetic";

export async function POST(request: Request, env: Env, ctx: ExecutionContext) {
  const raw = await request.arrayBuffer(); // the raw bytes, before any parsing

  const synth = await verify(
    { method: request.method, url: request.url, headers: request.headers, body: raw },
    {
      keys: keysFromEnv(env),
      host: "www.example.co.uk",
      paths: "/api/contact",
      contentTypes: ["application/json"],
      replayGuard: upstashReplayGuard({ url: env.UPSTASH_URL, token: env.UPSTASH_TOKEN }),
      // No Upstash? Pass a guard that inserts into a table with a unique
      // constraint on synthetic_run_id and returns false on a unique violation.
    },
  );

  if (!synth.ok && synth.beacon) {
    ctx.waitUntil(sendBeacon({ url: env.CHECKS_BEACON_URL, key: keysFromEnv(env)[0], client: "example", form: "contact", code: "synthetic_rejected", reason: synth.reason }));
  }

  if (synth.ok) {
    const s = synth.context; // frozen; the only thing downstream may read
    // 1 same-origin, 2 schema validation: as normal
    // 3 instead of the token:
    const t = await turnstileConfigCheck({ siteKey: env.TURNSTILE_SITE_KEY, secretKey: env.TURNSTILE_SECRET_KEY, expectedHostname: env.TURNSTILE_EXPECTED_HOSTNAME, publicHost: "www.example.co.uk" });
    if (!t.ok) return Response.json({ error: "misconfigured", synthetic: { v: 1, runId: s.runId, stages: { turnstile: t.outcome } } }, { status: 503 });
    // 4 the real rate limiter with identifier `synthetic:${s.form}`
    // 5 mode "full" only: DB write, staff email to s-<runId>@canary…, submitter email only if isOwnCanaryAddress(email, s)
  } else {
    // ordinary path: verify the Turnstile token as usual
  }
}
```

Nothing in this package reads a body or query field called `synthetic`, and
`isSynthContext()` is true only for a context `verify` produced. Never write
`if (body.synthetic)`.

## Signing (dd-checks, tests)

```ts
import { sign } from "@domandigital/synthetic";

const { headers } = await sign({
  key: { kid: "sensphere-2026-10", secret: env.SYNTH_SENSPHERE },
  mode: "probe", client: "sensphere", form: "contact",
  url: "https://www.sensphere.co.uk/api/contact",
  contentType: "application/json",
  body: rawBodyString, // sign the exact bytes you send
});
await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: rawBodyString });
```

Every call gets a fresh run id from `generateRunId()`. The run id is also the
local part of the canary address (`canaryAddress("s" | "u", runId)`), so a
fixture is never identical twice and a client idempotency key cannot dedupe a
synthetic run.

## Recipient lock

`isCanaryRecipient(email)` is true only for one plain address at exactly
`canary.domandigital.co.uk`. A display name, an address list, a sub-domain or a
look-alike suffix all fail. `isOwnCanaryAddress(email, ctx)` additionally
requires the address to be this run's own `s-` or `u-` address.

## `turnstileConfigCheck()`

Replaces the token on a verified synthetic request. It is the check that would
have caught Sensphere's eleven weeks of rejected forms. Never throws.

| `outcome` | Meaning |
| --- | --- |
| `ok` | Keys present, hostname matches, siteverify says the secret is good and the dummy token is bad. |
| `keys_missing` | Site key or secret key unset. |
| `expected_hostname_missing` | `TURNSTILE_EXPECTED_HOSTNAME` unset. |
| `hostname_mismatch` | Normalised expected hostname differs from the public host (`www.` is not stripped). |
| `test_key_in_production` | A Cloudflare test key on a production host. |
| `invalid_input_secret` | Siteverify answered `invalid-input-secret` (or `missing-input-secret`). |
| `unexpected_response` | Anything else: success for a dummy token, other codes, not JSON. |
| `siteverify_unreachable` | Network error or timeout. |

On a non-production host (`staging.*`, `localhost`, …) test keys are allowed
and siteverify is skipped for the always-pass secret.

## Beacons and purge receipts

`sendBeacon()` and `sendPurgeReceipt()` are fire-and-forget: they return a
promise that never rejects, and never throw, even on bad arguments. Pass
`waitUntil` in a Worker. Bodies are codes and counts only:

```
{"v":1,"kind":"beacon","client":"…","form":"…","code":"accepted|captcha_failed|hostname_mismatch|invalid-input-secret|misconfigured|service_unavailable|delivery_failed|synthetic_rejected","reason":"<RejectReason, with synthetic_rejected only>"}
{"v":1,"kind":"purge","client":"…","form":"…","deleted":0,"remaining":0}
```

They are signed with the same key: header `X-DD-Synth: report-v1`, `-Kid`,
`-Ts`, `-Sig: v1=<hex>` over
`DD-SYNTH-REPORT-V1\n<kid>\n<ts>\n<kind>\n<client>\n<form>\n<hex sha256(body)>`.
dd-checks authenticates them with `verifyReport()`.

## Keeping the headers out of Sentry and logs

```ts
import { scrubSentryEvent, scrubHeaders, scrubString } from "@domandigital/synthetic";

Sentry.init({ beforeSend: scrubSentryEvent, beforeBreadcrumb: scrubSentryEvent });
console.log(scrubHeaders(request.headers));
```

## Test vectors

`test-vectors.json` (exported as `@domandigital/synthetic/test-vectors.json`)
holds three request vectors and one report vector: every input, the canonical
string, the body hash and the signature. The secret is the 32 bytes
`0x00`..`0x1f` (`AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8`); **it is for
tests only**. They are generated by `scripts/gen-vectors.mjs` with
`node:crypto`, not through this package, so they are an independent
implementation. A client written in another language should reproduce them.

First vector, `probe, JSON`:

```
DD-SYNTH-V1
test-2026-10
1790000000
abcdefghijklmnop
probe
sensphere
contact
POST
staging.sensphere.co.uk
/api/contact
application/json
ddc9f37904f8c8e794d6f12a9fd3dd0fba3d3f4df4e04aa5bd8bb88fe689747d
```

signature `0373003451566d5b228183518c1f7f7417dc9ee27b30819d4b417e6daa0f112f`.

## Tests

`pnpm test` runs the suite twice: in Node, and in workerd through
`@cloudflare/vitest-pool-workers` (`pnpm test:node`, `pnpm test:workers`).

## Licence

Apache-2.0.
