---
"@domandigital/create-site": patch
---

The site measure gate now sees sideways scroll at phone widths (DOM-774). It compared `scrollWidth` with `window.innerWidth`, which grows with the page under mobile emulation, so a 500px-wide page at 375 passed. It now measures against the layout viewport (`clientWidth`), reports a page with no `width=device-width` viewport meta, and treats a target parked past the right edge as off the page, as `@domandigital/craft/phone` does.
