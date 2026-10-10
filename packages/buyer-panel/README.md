# @domandigital/buyer-panel

A panel of AI buyers who browse a site the way a prospective client would, and a separate model that reads what
happened. It finds places where a site is hard to understand, navigate or trust. **It is a defect-finding layer,
never validation:** it cannot show that real owners trust a site or would pay for it, and a run with no findings
means nothing was found. Human sessions decide releases; this runs before them so they spend their time on what is
left. Decided on DOM-642.

Private: it runs from dd-work-01, not from npm.

## What a run does

For each profile × device × variant (5 × 2 × 2 = 20 sessions in the DD redesign panel):

1. **First impression from the fold.** The buyer sees one screenshot, the 390-wide phone fold of the start page,
   before any scrolling or task, and answers "In your own words, what does this company do?".
2. **The task.** The buyer gets its task and browses in Playwright (1440 desktop or a 390 iPhone) with five tools:
   click by visible text, scroll, back, type, and `note_problem`. Each action returns a screenshot and the text on
   screen. The step budget (25) caps it, because simulated users underestimate effort and frustration; a person
   gives up sooner than a model does.
3. **Evidence.** `note_problem` outlines the element the buyer names and screenshots it. A problem whose element
   cannot be found on the page carries no evidence.
4. **Grading, by a different call.** The evaluator alone gets the journey map's expected answers, the brand facts
   and the known preview-only states, and reads every trace. It records the measures (first impression, Build vs
   Run comprehension, navigation, pricing clarity and invented assumptions, trust, conversion, mobile) and files
   findings. A finding stands only with a screen reference and the exact text of an element on that screen; the
   code checks this and drops the rest. Preview-only states are filed as expected, the buyer's own mistakes as not
   a defect.
5. **Reproduction.** Findings are clustered by underlying defect. A cluster **reproduces** when both runs (both
   variants) of one profile show it, or when two or more profiles do. Only those become Linear issues; the rest stay
   in the report as seen once.

The buyer is a plain API call with a system prompt holding the persona and nothing else: never a Claude Code
session in a repo, which would load the project's own documentation before reading a page.

## Running it

On dd-work-01, from this folder after `pnpm install && pnpm run build`:

```sh
doppler run -p dd-work-box -c prd -- node dist/cli.js run panels/dd-redesign.json --version auto
```

`--version auto` reads the version the Worker serves (`target.worker` in the panel) and checks it again at the
end; a deploy during the run is recorded in the report. Narrow a run with `--only clinic,salon`, `--device phone`,
`--variant a`. Re-grade an existing run with `evaluate`, and compare two runs with `diff`:

```sh
doppler run -p dd-work-box -c prd -- node dist/cli.js evaluate panels/dd-redesign.json <run-id>
doppler run -p dd-work-box -c prd -- node dist/cli.js diff panels/dd-redesign.json <earlier-run-id> <later-run-id>
```

### Credentials

- **Model:** Claude on Amazon Bedrock with `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_BEDROCK_REGION`
  (dd-work-box/prd). A variant or the evaluator can set `"provider": "anthropic"` to use `ANTHROPIC_API_KEY`.
- **Cloudflare Access:** the preview sits behind Access. A service token (application `0a9340f0`, policy
  "dd-buyer-panel service token (DOM-642)", non-identity) lives in dd-work-box/prd as
  `DD_SITE_PREVIEW_ACCESS_CLIENT_ID` and `DD_SITE_PREVIEW_ACCESS_CLIENT_SECRET`. The runner trades it for Access's
  24-hour session cookie with one request outside the browser, so the token itself never reaches a page, a
  screenshot or a Playwright trace. The token expires on 10 October 2027.

## Where runs go

The client-capsule archive, as the portal teardowns do: `~/dd-client-capsule/<client>/panel/runs/<runId>/` with
`runId` = the first eight characters of the version and the minute. Each run holds `run.json`, `report.md`,
`report.json` and one folder per session (`session.json` with every step, thought, screen text and problem; the
screenshots; `grade.json`; `trace.zip` for `npx playwright show-trace`). `<client>/index.json` lists the runs under
`panel`, keyed by version, so the next version diffs against this one.

## A panel file

`panels/dd-redesign.json` is the DD redesign panel. A panel names the target, the archive, the step budget, the
devices, two or more variants (model and temperature: real variation, so a finding has to survive it), the
evaluator, the profiles (persona and task, in the buyer's own terms, with none of the business's facts) and the
grading material. Relative paths resolve against the panel file; `~` is the home folder.

## The trap it is built around

A model recognises a design pattern from thousands of sites; a real owner may not. Simulated users are patient and
literal and underrate effort. Hence the step budget, the fold-only first impression, the evidence rule, grading by a
separate model with the reference material the buyer never sees, and the rule that only reproducing findings are
filed.
