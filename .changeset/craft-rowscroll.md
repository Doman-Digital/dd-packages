---
"@domandigital/craft": minor
---

The phone measure and the every-viewport sweep fail a sideways row (a carousel, a strip of chips or cards) that also scrolls up and down: `rowscroll`. Setting `overflow-x: auto` turns a visible `overflow-y` into `auto`, so a row whose items are a few pixels taller than the row takes the thumb's vertical swipe instead of the page.
