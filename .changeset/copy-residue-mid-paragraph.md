---
"@domandigital/craft": patch
---

`chatbot-residue` now finds "Certainly, here is…" at the start of any sentence that follows a full stop or exclamation mark, not only at the start of a line. An email opening "I hope this email finds you well! Certainly, here is the handover request." passed `craft copy --gate` before this. A question mark still does not count, so an FAQ answer such as "Do you work weekends? Absolutely, here are our hours." passes. New review-tier tell `stock-email-line` (catalogue 2026.10.3) reports the stock lines of a form email: "I hope this email finds you well", "hope you're having a great week", "let me know if you have any questions", "don't hesitate to contact us". It prints for review and never blocks, following the house rule that a new tell starts in review.
