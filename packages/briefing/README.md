# @domandigital/briefing

The editorial rules for a client briefing: the fortnightly email that tells a
client what needs them, what went live, how the site is doing and what is
next. One JSON input in, one briefing out, with the flags the founder sees
before it sends and the full log the client can open.

This package decides what a briefing says. It does not render HTML, send
email, fetch data or store anything. No dependencies; it runs in Cloudflare
Workers and Node 22.12+, and the tests run in both.

## Install

```sh
pnpm add @domandigital/briefing
```

## Use

```ts
import { buildBriefing, BriefingBuildError, BriefingLintError } from "@domandigital/briefing";

const { briefing, flags, log } = buildBriefing(input, config);
```

- `input` is the period's raw data: merged PRs with their "For the client"
  lines and PR bodies, did-log notes, uptime incidents, PageSpeed runs, Search
  Console and Analytics totals, and the outcomes ledger (`RawInput`).
- `config` is the client: names, the approvals waiting, the launch, URLs, and
  the hand-written `headline`, `subhead` and `note` (`ClientConfig`).
- `briefing` is everything the template renders, with `sections` in the order
  to render them.
- `flags` are for the founder's preview only: a tracking check, an unmatched
  approval, a proposed launch date, our own name in a client's search terms.
- `log` lists every entry and where it went, every supersession, and how each
  number was worked out.

The build throws `BriefingBuildError` when the headline or the note is empty
(they are written by a person, never generated) and `BriefingLintError` when
any client-readable string breaks the copy rules.

## The rules

**Classify.** Each merged PR becomes *needs you*, *live*, *ready* or
*maintenance*. A line that asks the client something is needs you; a
`chore(deps)` security bump is a live security change; chore, ci, docs, test,
build and refactor titles are maintenance; "not live yet" and "switch over" are
ready. A PR with no client line counts as maintenance and is flagged.

**Override.** An author can be exact with a block in the PR body:

```md
## Briefing
kind: visible
supersedes: #44
title: Your site now runs on a faster setup
outcome: Since Wednesday 7 October, pages open quickly on phones.
image: https://briefings.example/client/home.png | The home page on a phone
```

`kind` is one of `visible`, `security`, `privacy`, `other`, `maintenance`,
`needs-you`, `ready`. An unknown kind, or an image without alt text, throws.

**Group.** The latest entry of a chain wins: one that names another in
`supersedes`, one that moves a date "from X to Y", all security updates in the
period, and two lines that say the same thing. The earlier ones go to the log.

**Rank.** At most three changes: visible first, then security, then privacy,
then everything else, latest first. The rest are counted in one line ("Plus 2
more changes and 14 maintenance tasks behind the scenes."). A feature image
goes above the first change only when that change is visible and has one.

**Approvals.** They come from the config, at most three, each with a SHA-256 of
the exact content being approved. Any approval sets the status to *attention*
and puts needs you straight after the headline. More than three are flagged to
go as their own email.

**Launch.** A proposed date shows "Awaiting your confirmation" and no
countdown. A confirmed date counts the days from the send date in London.

**Numbers.** Uptime is checks passed of checks made. Speed is the median of at
least five distinct PageSpeed runs (cached repeats share a fetch time and count
once); a change is reported only when it beats the measured spread and held
across two sends. Search under 100 impressions or 10 clicks is a sentence, not
numbers, and our own name never appears in top searches. Zero visits beside
real Google clicks holds the visits tile back and raises a tracking check.

**Track record.** Off unless `trackRecordEnabled` is set, and then only with
`trackRecordMinMonths` full months of joined-up data (default 1). Measured
outcomes only: uptime checks, a speed band change, verified orders once sales
are live. Never a count of changes.

**Copy gate.** Every client-readable string is checked for negative
reassurance ("no downtime", "nothing changes"), the banned list in
Doman-Digital `docs/DIRECTION.md` section 5, jargon (unless the client's config
allows the term), em dashes, "done", "fixed" or "complete", hours and rates,
status labels outside Live, Ready, Waiting for you, Next, Planned, and two
different dates for one event. The headline has to name a date, a decision or
a change, and has to point at any approvals waiting.

## Tests

```sh
pnpm test
```

One file per module. `fixtures/fortnight.json` is a real client fortnight with
the client's names, product and domain replaced; the unredacted copy is kept
off this public repository. To run the fixture tests on it as well:

```sh
BRIEFING_PRIVATE_FIXTURE=/path/to/fixture.json pnpm vitest run
```
