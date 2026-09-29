---
"@domandigital/craft": minor
---

Calibration tooling. `craft null import <dir> --builder <name> --brief "<text>"` builds a null model from pages another builder made (v0, Lovable), each an HTML file or a folder holding a built `index.html`, served on loopback so root-relative assets resolve. `craft null prompt` prints the prompt to give that builder. `craft calibrate <labels.json>` measures a labelled set (`ai`, `human`, `ai-looking`) and reports precision and recall per tell and CHARACTER.md's first three targets; a page it cannot measure is listed and never counts as a pass. `NullModel` gains an optional `builder`. The blind-test protocol for target 5 is in `docs/blind-test.md`.
