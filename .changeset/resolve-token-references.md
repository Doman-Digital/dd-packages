---
"@domandigital/craft": minor
---

`checkRestraint` resolves token references instead of skipping them.

The old rule skipped any value starting with `var(`, on the reasoning that a
token reference is the token layer doing its job rather than a new value. True
of a hand-written sheet. On a Tailwind v4 sheet it is close to measuring
nothing: `text-sm` compiles to `font-size: var(--text-sm)` and `rounded-lg` to
`border-radius: var(--radius-lg)`, and `shadow-[…]` emits no `box-shadow` at
all — it assigns `--tw-shadow` and lets one shared composite read it.

Measured on the estate this was hiding, per surface: 19 font sizes reported
against 28 shipped, 5 shadows against 18, 7 radii against 13. A second surface
reported `ok: true` on every axis and is over budget on four.

What changes:

- A value that is exactly one `var()` is resolved through the token chain to
  the value that renders, and counted.
- `--tw-shadow` assignments count as shadows; Tailwind's composite plumbing
  value does not, and neither does its `0 0 #0000` initial.
- `var(--tw-shadow-color, X)` is unwrapped to `X`, so the report names what a
  reader would see.
- Definitions are read from the whole sheet, including ignored layers, while
  usage is still read only from kept ones. The layer exclusion is unchanged in
  intent and now works: a framework default nothing uses still counts for
  nothing. Used versus unused was always the real distinction; which layer the
  definition sat in never was.
- New `unresolved-token` warning for a declaration whose token is defined
  nowhere and which carries no fallback. It applies nothing, so it is not
  vocabulary — it is a bug, and it now says so. It found two on first contact.

**Every consumer's baseline will move**, upward, on surfaces built with a
utility framework. That is the correction, not a regression.
