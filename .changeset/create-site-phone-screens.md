---
"@domandigital/create-site": minor
---

`measure.mjs` counts phone screens to the footer for every page and prints it, and `site.programme.json` `measure.screens` sets a budget per page or page pattern (`{ "/": 6.5, "/services/*": 6 }`): a page over its budget fails the build (DOM-1052, part of DOM-772; the Bellerose home page ran 12.7 screens against a target of 6.5). New sites install `@domandigital/craft` ^0.22.0, which carries the count. `measure.screens` needs that craft or newer, and the gate says so when it is older.
