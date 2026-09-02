---
"@domandigital/craft": minor
---

Initial release: OKLCh colour, contrast, motion tokens and the base stylesheet.

Colour ramps snap to anchors byte-identically, so an existing site adopts craft
without a visual diff. Semantic tokens are derived with measured WCAG 2.x *and*
APCA-W3 contrast, and `accentFork` returns the step nearest the brand accent that
clears both bars, emitting the measured ratios as a CSS comment.

Motion ships one vocabulary for CSS and JS (`EASE` / `EASE_TUPLE` hold identical
control points), replacing three ease curves that were wrong in the shared layer:
two byte-identical curves under different names, and an `ease-in` exit.

`craft.css` collapses reduced-motion durations rather than using `animation:
none`, which strands forwards-filled entrances at `opacity: 0`.
