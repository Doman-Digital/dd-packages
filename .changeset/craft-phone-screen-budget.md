---
"@domandigital/craft": minor
---

The every-viewport measure counts phone screens to the footer (DOM-1052, part of DOM-772): page height at 375 x 667 over 667, with lazy images loaded. `screens` sets a length budget per route, route pattern or prefix (`{ "/": 6.5, "/services/*": 6, "/areas/[town]": 5, "*": 9 }`, the most specific wins), on `measureViewports`, `measureRoute`, `measureSite` and `viewports.json`. A route over its budget fails a new `screens` check ("page too long for a phone"), baselined like the others; with no budget the count is only reported. `ViewportsResult.screens` and the measured file carry the count, `craft viewports` and `craft phone-first --measured` print it for every route, and `screenBudgetFor`, `checkScreenBudgets` and `formatScreens` are exported. The Bellerose home page ran 12.7 phone screens against a target of 6.5.
