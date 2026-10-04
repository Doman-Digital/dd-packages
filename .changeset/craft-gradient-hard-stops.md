---
"@domandigital/craft": patch
---

`gradientContrast` no longer blends across a hard stop. A gradient such as `linear-gradient(90deg, #000 50%, #fff 50%)` is painted as a jump from black to white, but 0.18.0 sampled the greys between them and could fail text that clears every colour the browser actually paints. Stop positions are now read, and a stop placed at or before an earlier position starts a hard edge that is not sampled, as in CSS. A painted blend is still sampled between its stops. Found by Codex review on Doman-Digital/dd-drift-guards#8, where the same fix landed.
