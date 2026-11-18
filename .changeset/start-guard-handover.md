---
"@domandigital/create-site": minor
---

A site cannot be started without passing its programme. A real run now calls `dd-programme gate` (Stage 05 accepted) and refuses, writing nothing, when it fails or when dd-programme is not installed. `--no-gate` (or `DD_CREATE_SITE_NO_GATE=1`, for the nightly starter job) skips it and the start label records the skip.

New `.dd/site-start.json` says how the site was started: `mode`, `programme`, the gate result and, for a handover, the reason and the visible pieces added. It describes the site; the proof is `create-site --check` passing.

New `--handover --reason "..." --programme DOM-123 [--with credit,consent,analytics,legal,press,resources]` starts an existing live site copied in as Astro. It adds the invisible layers only (facts, routes, redirects, JSON-LD, SEO tests, gates) and keeps the client's look and copy. In handover mode the build blocks on facts, reports the direction and mobile-first checks without stopping, and skips tokens, night contrast, the copy deck and the null check. A visible piece is added only when named in `--with`. `--check` keeps the mode from the label.

`site.programme.json` gains `mode`.
