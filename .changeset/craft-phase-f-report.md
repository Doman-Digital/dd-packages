---
"@domandigital/craft": minor
---

The character report. `craft report <url | snapshot.json>` reads a site against all three signals and the reason rule (`--repo`, `--null`, `--estate`, `--direction`) and gives a verdict: default, mixed, decided, or unproven when something was not measured. The actions come in retrofit order, one per choice, with every reason that points at it. `craft retrofit` writes them as a Markdown checklist that names the art-direction choice settling each change, shows the decided value, and ends with what to leave alone. `characterReport` and `retrofitPlan` are exported. System font keywords such as `ui-monospace` no longer read as CSS variable names.
