---
"@domandigital/craft": minor
---

Signal 2, the counterfactual. `craft null build --brief "..." --out <dir>` asks `claude -p` for about 20 home pages from the brief alone, renders and fingerprints each, and writes `null.json`. `craft audit <url> --null <dir>` scores how typical a page is against them: the share of the model's own pages that sit further out than this one, typical at 0.10 or above, with the choices it shares with most of them. `craft tells harvest <dir>` lists what recurs across null pages and which tell already catches it, so the next generation of tells comes from what the model builds now. `snapshotUrls` in `@domandigital/craft/audit` snapshots several pages through one browser. The rendered reveal check now also reads the text blocks inside a section, so reveals on cards two levels down are no longer read as a still page.
