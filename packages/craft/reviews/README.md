# Reviewer corpus

Each file here is one person's review of a site, kept whole: every note as
they wrote it, what they proposed, what was done with it, the founder's ruling
where one was needed, and the principle the note teaches. The notes use the
design-review shape (`../design-review.schema.json`), so a record reads the
same way as a note written for `craft direction review`.

The first reviewer is Eunice Ordor, Client Relations & Operations at Doman
Digital. Her reviews catch defaults a model builds by reflex (two buttons in a
hero, confession lines, summary cards that are a list of nouns), so each one is
recorded here and turned into principles in `CHARACTER.md` and tells in
`src/character/tells/`. Nothing she raised stays only in Pastel or a chat.

| File | Reviewer | Subject | Notes |
| --- | --- | --- | --- |
| `eunice-ordor/2026-10-19-dd-site.json` | Eunice Ordor | The new DD site preview, Pastel canvas 986559 | 73 |

## What a record holds

The design-review fields (`observation`, `raisedBy`, `basis`, `evidence`,
`suggested`, `recommend`), plus five that a reviewer's own record needs:

| Field | What it holds |
| --- | --- |
| `source` | Where the note was left: tool, canvas, comment number and id, the page, the time |
| `verdict` | `praise`, `take`, `take-reworded`, `partly`, `decline`, `founder-decision` or `known` |
| `founderRuling` | The founder's call, dated, stated as the decision and nothing more |
| `principle` | The id of the principle it teaches, written up in `CHARACTER.md` |
| `tells` | The tells it informed; with `text`, the words that tell must fire on |

At the top of the file: `reviewer`, `date`, `source` (the canvas) and
`rulings` (who made the final calls, and when).

`take-reworded` means the diagnosis is taken and the wording rewritten.
`partly` means the aim is taken by a smaller or different change. `known`
means it is already tracked elsewhere.

## Adding a review

Use the `reviewer-intake` skill in claude-kit (`skills/reviewer-intake`). In
short:

1. Pull every comment from the canvas with the Pastel MCP, and the screenshots
   for any note about something visual.
2. Keep each note whole. Classify it, and check every fact it relies on
   against the proof ledger, brand facts and Linear before taking it.
3. Write the record as `reviews/<reviewer>/<YYYY-MM-DD>-<subject>.json`, one
   note per comment, with the source of each.
4. Write the principles into `CHARACTER.md` under a section named for the
   review, keeping the observations, the proposals, the rulings and the
   principles apart.
5. Propose a tell, or a fixture for an existing one, for anything a model
   would build again, with the reviewer's own examples as flag cases and
   precise, honest lines as pass cases. New tells start in review.
6. Run the craft tests and open the dd-packages PR.

`src/__tests__/reviews.test.ts` holds every record to the schema, checks that
every principle it names is written up in `CHARACTER.md`, and fires each tell
a note taught on the words that note flagged.

## Her wording is still copy-checked

A record keeps the reviewer's words as written, including lines the house
rules block, so the folder is listed in `.copyauditignore`. That exemption
covers the record only. When a reviewer's suggested wording is used on a site,
it goes through copy-check like any other copy: a diagnosis that is taken is
never an exemption for the words that came with it. In the first review, four
of her comments blocked at catalogue 2026.10.4 and eight block at 2026.10.5,
and the test keeps it that way.

## This folder is public

dd-packages is a public repository. Keep a note's words as written, except a
remark that is private to the business or names a private relationship: elide
it with `[...]` and leave it in the source tool, where the full comment stays.
Prices on the live site are public; internal plans, client relationships and
anything said in private are not. The folder is left out of the npm package
(`files` in `package.json`), because nothing a consumer runs reads it.
