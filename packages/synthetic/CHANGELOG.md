# @domandigital/synthetic

## 0.2.0

### Minor Changes

- 7c2f815: Security review (DD Checks C38). `verify` and `verifyRequest` refuse a body over `maxBodyBytes` (default 1 MiB) as a `shape` rejection before hashing, reading a streamed body only up to the cap. `upstashReplayGuard` times out after 2 s and so fails closed. `synthetic_rejected` beacons are throttled to one per client, form and reason a minute, so forged traffic cannot flood dd-checks. See `docs/synthetic-threat-model.md`.

## 0.1.0

### Minor Changes

- 7a03bb5: First release: the signed synthetic-submission protocol (DD Checks C7). `sign` and `verify` for the `X-DD-Synth` headers with published test vectors, a required replay guard, shape check, frozen `synthetic` context, canary recipient lock, `turnstileConfigCheck`, `sendBeacon` and `sendPurgeReceipt`, and a scrubber for Sentry events and logs. Web Crypto only.
