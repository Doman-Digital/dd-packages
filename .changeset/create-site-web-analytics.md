---
"@domandigital/create-site": minor
---

Cloudflare Web Analytics rule (DOM-1060). The cookie banner gains a settings view with a Visit statistics switch, on by default and kept apart from the measurement choice. The consent record moves to v2 with a `statistics` field; v1 records still read, with statistics on. A new `<WebAnalytics />` component loads the manual Cloudflare beacon for every visitor unless statistics is off, with the token in `site.facts.ts` (`webAnalytics.token`) and `launch:check` failing until it is set. The privacy and cookie pages carry the shared notice wording.
