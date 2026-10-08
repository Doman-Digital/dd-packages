# @domandigital/synthetic

## 0.1.0

### Minor Changes

- 7a03bb5: First release: the signed synthetic-submission protocol (DD Checks C7). `sign` and `verify` for the `X-DD-Synth` headers with published test vectors, a required replay guard, shape check, frozen `synthetic` context, canary recipient lock, `turnstileConfigCheck`, `sendBeacon` and `sendPurgeReceipt`, and a scrubber for Sentry events and logs. Web Crypto only.
