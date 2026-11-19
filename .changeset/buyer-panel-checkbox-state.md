---
"@domandigital/buyer-panel": patch
---

Screen text lists a checkbox or radio as `[ticked]` or `[not ticked]`. It listed the input's value, which is `on` whether or not the box is ticked, so the evaluator reported an unticked consent checkbox as pre-ticked: a high-severity false finding that reproduced across two sessions on a live client site.
