---
"@domandigital/craft": minor
---

A font size in `em` or `%` counts against its own budget, not the type scale's.

`code { font-size: 0.875em }` does not add a step to a scale. It states one
relationship — code is 87.5% of whatever it sits in — and applies it wherever
code appears. Counting it as a step is the same category error section 9 already
corrected once for the framework's theme: a number that is not part of the
vocabulary a reader has to hold.

They are still counted, under `maxRelativeFontSizes` (house value 3), because
the failure they can cause is real — eight competing ratios is as unreadable as
eight competing steps. Split, not dropped. A value that stops being reported is
a value that grows.

`counts.relativeFontSizes` is new; `counts.fontSizes` now excludes them, so a
surface using `em` will report a lower scale count than under 0.4.0.

Only bare ratios move: `0.875em` and `75%` are relative, `0.875rem` is not, and
neither is a composite like `max(16px, 1em)`.
