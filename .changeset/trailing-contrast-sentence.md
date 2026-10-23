---
"@domandigital/craft": patch
---

`trailing-contrast` no longer goes quiet on a sentence that follows one `not-just-but` blocks (DOM-1358, catalogue 2026.10.8). The check that keeps one sentence from being reported twice looked back a fixed 80 characters and could reach the sentence before; it now reads only the sentence the match sits in. Found by running the released `copy-check` over the 92EL lines: "Edge matters for game servers, not registration." went unreported when it came straight after the gerund pair.
