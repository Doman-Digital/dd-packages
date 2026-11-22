---
"@domandigital/sentry": minor
---

Adds critical-path reporting. `criticalReporter(captureException)` returns `criticalFailure(path, stage, error, extra?)`, which reports a failure at a checkout, booking or enquiry step at level `fatal` with the tags `critical_path` and `critical_stage`, grouped by path and stage, and never throws. `watchCriticalCsp(document, reporter)` reports a CSP block only while the visitor is on a step marked with `enter()`, once per directive and origin, with the blocked URL cut to its origin. `criticalContext()` builds the same event for a site with its own capture wrapper. Exported from the root, `/browser` and `/cloudflare`.
