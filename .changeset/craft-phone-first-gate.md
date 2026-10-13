---
"@domandigital/craft": minor
---

The phone-first gate for portals (DOM-775). `@domandigital/craft/phone` measures a route at 375px from inside a portal's own signed-in Playwright suite (sideways scroll against the layout viewport, a missing device-width viewport meta, targets under 44px, fields under 16px, text under 12px, a cut-off title), and `craft phone-first` judges those routes and the source's max-width queries and Tailwind `max-*` variants against a baseline that only shrinks.
