---
"@domandigital/create-site": patch
---

New sites install `@domandigital/craft` ^0.21.0 (DOM-1053), so `measure.mjs` holds a text field, select or textarea to 48px tall (portal standard rule 5; the measure failed fields under 44px as targets before).
