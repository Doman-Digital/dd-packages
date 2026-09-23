---
"@domandigital/craft": minor
---

Catalogue 2026.09.6, tuned against the Doman Digital site's live Sanity content. `chatbot-residue` reads a run of ChatGPT citation tokens as one finding, through the invisible private-use characters ChatGPT wraps them in. `placeholder` skips a placeholder inside quotation marks, which is a template being taught. `vague-attribution` skips a claim that names its source or carries a footnote or link. `inline-label-list` fires only when the text after the label is six words or fewer, so a definition list passes.
