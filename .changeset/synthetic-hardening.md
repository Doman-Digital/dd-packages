---
"@domandigital/synthetic": minor
---

Security review (DD Checks C38). `verify` and `verifyRequest` refuse a body over `maxBodyBytes` (default 1 MiB) as a `shape` rejection before hashing, reading a streamed body only up to the cap. `upstashReplayGuard` times out after 2 s and so fails closed. `synthetic_rejected` beacons are throttled to one per client, form and reason a minute, so forged traffic cannot flood dd-checks. See `docs/synthetic-threat-model.md`.
