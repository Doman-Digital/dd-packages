---
"@domandigital/craft": patch
---

`measurePhone` leaves out what is parked off the page until it is needed, such as a skip link before focus or a closed drawer, as create-site's measure.mjs does (DOM-775).
