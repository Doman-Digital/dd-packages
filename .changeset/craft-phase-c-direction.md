---
"@domandigital/craft": minor
---

Phase C: `art-direction.json`, the reason rule, and `craft direction init | validate | propose`.

- A schema for the seven expressive choices (accent, ground, display, body, shape, motif,
  signature), the sources in the client's world they come from, and the tell exceptions
  from phase A. Ships as `art-direction.schema.json` for editors.
- `validateDirection` applies the reason rule: a reason is a sentence, cites a declared
  source and mentions what that source shows; preferences, mood boards and unconfirmed
  proposals are rejected; a value on the tell catalogue needs an exception. Given a
  fingerprint it warns where the page does not show what the file declares.
- `initDirection` writes today's choices with empty reasons. `propose` reads dominant
  colours off PNG photos (`paletteFromPixels`, k-means in OKLab) and drafts choices ranked
  away from the reflex band and the estate, every one marked `PROPOSED:` until a person
  rewrites it.
- An exceptions-only file stays valid.
