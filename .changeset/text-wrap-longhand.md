---
"@domandigital/craft": minor
---

Use the `text-wrap-style` longhand, and stop applying orphan control to every
`li`.

`text-wrap` is shorthand for `text-wrap-mode` + `text-wrap-style`, so
`text-wrap: pretty` silently resets the mode to `wrap`. `white-space: nowrap` is
itself shorthand setting `text-wrap-mode: nowrap`, so the shorthand defeated it
along with any `text-overflow: ellipsis` truncation that relied on it.

Caught by a visual regression suite: `li { text-wrap: pretty }` expanded a
breadcrumb that truncates to one line into three lines and pushed the page 40px
taller. The longhand sets only the style, so an element that asked not to wrap
still does not.

`li` is now scoped to `.craft-prose li`. Breadcrumbs, navs, tab strips and menus
are all `li` and none of them are body copy.
