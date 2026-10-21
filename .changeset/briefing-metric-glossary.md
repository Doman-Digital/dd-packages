---
"@domandigital/briefing": minor
---

Every health tile now explains itself. Adds a glossary (`GLOSSARY`, `speedWords`, `uptimeHeadline`, `searchSentence`) and new fields on the built briefing: `uptime.headline` and `uptime.meaning`, `speed.headline` and `speed.meaning`, and `search.line` and `search.meaning` when there are numbers. The copy gate now reads them, and flags the bare words "availability", "uptime" and "impressions" in client copy unless a client config allows them (DOM-1009).
