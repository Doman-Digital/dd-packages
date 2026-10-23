# @domandigital/briefing

## 0.4.0

### Minor Changes

- 82cbf0e: The copy gate now flags vulnerabilities, analytics, cookies, privacy page and page views in client copy, with a suggested plain replacement in each finding. A client config can still allow a term that client uses (DOM-1009).

## 0.3.0

### Minor Changes

- 000edcf: Every health tile now explains itself. Adds a glossary (`GLOSSARY`, `speedWords`, `uptimeHeadline`, `searchSentence`) and new fields on the built briefing: `uptime.headline` and `uptime.meaning`, `speed.headline` and `speed.meaning`, and `search.line` and `search.meaning` when there are numbers. The copy gate now reads them, and flags the bare words "availability", "uptime" and "impressions" in client copy unless a client config allows them (DOM-1009).

## 0.2.0

### Minor Changes

- 6fac93b: Accept typed sparse inputs for clients without uptime or search data. Omit
  unavailable health metrics and empty health sections, use a neutral status
  label without uptime data, and retain the complete-input result contract.

## 0.1.1

### Patch Changes

- 871b3fc: A dependency security bump with no `## Briefing` block now uses the house sentence instead of the author's line, so wording such as "the framework the site runs on" no longer fails the jargon lint.

## 0.1.0

### Minor Changes

- d374680: First release: the editorial rules for a client briefing. `buildBriefing(input, config)` classifies a period's merged PRs (with a per-PR `## Briefing` override block), keeps the latest of each superseded or duplicate entry, ranks at most three changes, puts approvals first, works out uptime, speed, search and visits without overstating them, gates the track record behind `trackRecordEnabled`, and fails the build on an empty headline or note and on any copy-gate finding. Returns the briefing, the founder's flags and the full log.
