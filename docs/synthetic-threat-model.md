# Threat model: `@domandigital/synthetic` and the Sensphere wiring

DD Checks C38 (DOM-499). Scope: the signed-submission protocol in
`packages/synthetic` (C7) and its first consumer, Sensphere's forms (C15,
sen-sphere #243) with the portal public-intake route. Reviewed 9 October 2026
against the HMAC control list in "DD Checks: research (build vs adopt)".

## What is being protected

A request carrying valid `X-DD-Synth-*` headers skips Turnstile on a client's
form and does a real write. The asset an attacker wants is that bypass: spam
and abuse without a captcha, mail to real people, or rows in the client's
database. The signing key must never leave the checker and the site's secret
store. Everything below follows from that.

## Controls checked against the research list

| Control | Status | Where |
| --- | --- | --- |
| Sign version, kid, check id, client id, ts, nonce, method, host, path, body hash | Met | `canonicalString` signs prefix, kid, ts, runId, mode, client, form, POST, host, path, content type, body SHA-256 |
| Per-client key, rotation overlap | Met | Two keys at most (`DD_SYNTHETIC_SECRET`, `_NEXT`), chosen by kid |
| 60 to 120 s skew | Met | ±120 s, `DEFAULT_WINDOW_SECONDS` |
| Nonce stored until the window expires | Met | 16-char run id, guard TTL 300 s, more than twice the window |
| Constant-time compare | Met | `constantTimeEqual`; a mismatched pin takes the same path as a bad signature |
| Reject unexpected path, host, content type, method | Met | shape check runs before anything is hashed |
| Separate rate limit for signed traffic | Met in Sensphere | `buildSyntheticIdentifier`: one bucket per form, apart from visitors |
| Key never in page JS | Met | server-only env; the checker signs, the page never sees a key |
| No signatures or secrets in traces | Met, proof pending | see "Scrubbing" |
| Context set only after verification, immutable | Met | frozen `SyntheticContext` built from verified headers only |
| Alert on invalid signatures, repeated nonces, unknown kids | Met, throttled | `synthetic_rejected` beacon with a reason; now throttled (F3) |

## Threats and findings

**Secret leakage (logs, Sentry, traces, R2, error pages).** `scrubText`,
`scrubHeaders` and `scrubSentryEvent` redact `X-DD-Synth*` values, and
`@domandigital/sentry` runs them after PII scrubbing, including spans and
transactions. The rejection beacon carries a reason code only. Errors raised in
`verify` are caught and returned as a code, never as text. Sensphere strips the
synth headers before building request context. Open: the runner artefacts in
dd-checks (traces, HAR, screenshots) must be redacted before R2, as the C9a
decision records; that is owned by C9b/C21. Open: the live proof on staging
(below).

**Replay and clock skew.** The nonce is single-use for 300 s and the window is
±120 s, so a captured request cannot be replayed inside or after the window.
The guard runs last, so a forged request cannot burn a real run id, and fails
closed if the store is down. Finding F2: the Upstash call had no timeout, so a
slow store held the form open. Fixed: 2 s timeout, which fails closed.

**Canonicalisation.** Host is lower-cased from the URL as the visitor reached
it; path is exact with no query; the content type is signed as sent
(parameters included, so a changed multipart boundary invalidates the
signature); the body is hashed as raw bytes before any parsing. Each signed
field is delimited by a newline and validated against a pattern that excludes
newlines, so fields cannot be shifted into one another. No finding.

**Key rotation and unknown kids.** The kid selects the key; an unknown kid is
rejected without trying the other key. With no keys the path is off and
requests are handled as ordinary. No finding.

**The bypass becoming an unauthenticated form API.** What a verified request
can do is bounded by the handler: Sensphere runs the recipient lock, the config
self-check instead of the token, the real rate limiter and the real schema.
Finding F1: `verifyRequest` read the whole body before checking the signature,
so an unauthenticated caller could make a handler buffer an arbitrarily large
body by adding the header. Fixed: `maxBodyBytes` (default 1 MiB), checked on
`Content-Length` and again while streaming; over the cap is a `shape` rejection.
Sensphere passes its own limit (S1).

**The recipient lock.** `isCanaryRecipient` accepts one plain address at
exactly `canary.domandigital.co.uk`: no display name, list, subdomain or
look-alike. `canaryAddress` takes only a valid run id. Sensphere sends staff
mail to the canary address and submitter mail only on the daily full run. No
finding.

**A user-supplied `synthetic` field.** No body or query value feeds
`SyntheticContext`; tests cover `synthetic=true` in both. The portal accepts a
`synthetic` object only from the Bearer-authenticated intake call, and clamps
synthetic retention to 7 days. No finding.

**Rate limiting of signed traffic.** Signed requests use their own limiter
bucket, so a flood of forged signatures cannot starve visitors and a checker
burst cannot lock out visitors. Forged requests are rejected before the replay
store is touched. Finding F3: every rejection sent a beacon, so forged traffic
could flood dd-checks. Fixed: one `synthetic_rejected` beacon per client, form
and reason per minute per isolate.

**The WAF skip rule scope.** No skip rule exists in any repo reviewed. When one
is written (C21 onwards) it must be an expression, not a blanket skip: the
request carries `X-DD-Synth` and `X-DD-Synth-Sig`, the method is POST, the host
and path equal the form's, and, if C9a establishes it, the source is the
checker (`cf.worker.upstream_zone`, which is not yet proved on Browser
Rendering traffic into another zone, see `services/checks/docs/spike-browser.md`).
It must skip only managed challenge and Bot Fight Mode, never the rate limit or
custom block rules. Because the header is attacker-controlled, a WAF skip is
weaker than the in-app check: the app still verifies the signature, so a forged
header gets past the WAF at worst and fails there. Accepted by design.

## Still open

- Live proof that `X-DD-Synth-*` is absent from Sentry events and logs on
  staging: Sensphere staging does not exist (C15 DOM-497). Proved against a
  local fixture in the Sensphere test suite instead; repeat on staging when it
  lands.
- Live canary arrival: waits on the canary mailbox DNS (DOM-495).
- Redaction of runner artefacts before R2 (C9b/C21).

## Findings summary

| ID | Finding | Fix |
| --- | --- | --- |
| F1 | Body read and hashed without a size cap | `maxBodyBytes`, streamed cap (this PR) |
| F2 | Replay store call had no timeout | 2 s timeout, fails closed (this PR) |
| F3 | Rejection beacon unthrottled | per client/form/reason per minute (this PR) |
| S1 | Sensphere trusted `Content-Length` alone | pass `maxBodyBytes` (sen-sphere PR) |
| S2 | No test proving scrubbing of synth headers end to end | fixture test (sen-sphere PR) |
