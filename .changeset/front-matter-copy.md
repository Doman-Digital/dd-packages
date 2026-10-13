---
"@domandigital/craft": patch
---

`craft copy` reads `title` and `description` in Markdown front matter. A dash or a stock phrase in an agent description or a page title is reported on that line, and `copy-ok` on the line or the line above still suppresses it. Other front matter keys stay unread, and fenced code stays unread.
