---
"@domandigital/create-site": patch
---

Handover mode no longer lists pages a handed-over site does not have. The generated route policy now adds its press, legal and resources entries only when that piece is installed: every piece in a new build, and only the pieces named with `--with` in a handover. A handover with no `--with` no longer gets a `/press` entry that failed the site's sitemap coverage check. Programme builds are unchanged.
