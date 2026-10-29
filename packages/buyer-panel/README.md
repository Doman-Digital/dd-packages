# @domandigital/buyer-panel

A panel of AI buyers who browse a site the way a prospective client would, and a separate model that reads what
happened. It finds places where a site is hard to understand, navigate or trust. **It is a defect-finding layer,
never validation:** it cannot show that real owners trust a site or would pay for it, and a run with no findings
means nothing was found. Human sessions decide releases; this runs before them so they spend their time on what is
left. Decided on DOM-642.

Private: it runs from the ops box, not from npm.

## What a run does

For each profile × device × variant (5 × 2 × 2 = 20 sessions in the DD redesign panel):

1. **First impression from the fold.** The buyer sees one screenshot, the 390-wide phone fold of the start page,
   before any scrolling or task, and answers "In your own words, what does this company do?".
2. **The task.** The buyer gets its task and browses in Playwright (1440 desktop or a 390 iPhone) with five tools:
   click by visible text, scroll, back, type, and `note_problem`. Each action returns a screenshot and the text on
   screen: headings, links, buttons, fields and every other visible line, including text in plain divs and spans (the
   price and duration beside a treatment link). Div and span lines are not de-duplicated, so two rows with one price stay two rows.
   The step budget (25) caps it, because simulated users underestimate effort and frustration; a person
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

On the ops box, from this folder after `pnpm install && pnpm run build`, under the panel's Doppler config (see
dd-repo-registry `docs/buyer-panel.md`):

```sh
doppler run -p <project> -c <config> -- node dist/cli.js run panels/dd-redesign.json --version auto
```

A prototype that is not on the web can be served on this machine: `target.origin` may be `http://127.0.0.1:<port>` or
`http://localhost:<port>`. Anywhere else the origin must be https.

`--version auto` reads the version the Worker serves (`target.worker` in the panel) and checks it again at the
end; a deploy during the run is recorded in the report. Otherwise `--version` takes the Worker version id, or any
value that starts with at least 8 hex characters: for a target that is not a Worker (a live site on another host),
a date such as `20261014` works and keys the run as `20261014-<minute>`. Narrow a run with `--only clinic,salon`,
`--device phone`, `--variant a`. Re-grade an existing run with `evaluate`, and compare two runs with `diff`:

```sh
doppler run -p <project> -c <config> -- node dist/cli.js evaluate panels/dd-redesign.json <run-id>
doppler run -p <project> -c <config> -- node dist/cli.js diff panels/dd-redesign.json <earlier-run-id> <later-run-id>
```

`evaluate` grades with the panel's current evaluator, so changing the evaluator and re-running `evaluate` re-grades
a run without browsing again. The report says which model graded it: `meta.evaluator` is the one used, and
`meta.firstEvaluator` (with `gradedAt`) records the one that graded first when they differ.

`diff` asks the evaluator to pair clusters of the two runs and accepts a pair only when it is one to one and the
model gave it high or medium confidence, with a one-line reason. A key paired twice keeps its most confident pair;
a tie keeps neither. Pairs it did not accept are listed under "Matches not accepted" with why, and their clusters
count as gone and new. Clusters are keyed per run, so a diff between runs graded by different evaluators matches
two different sets of wording; re-grade both with the same evaluator first.

### What a run costs

Every model call is priced from the table in `src/pricing.ts` (USD per million tokens, input, output, cache read,
cache write, with the date the prices were checked at the top). Update the table there when a price changes; a model
with no entry is refused when the panel file is loaded, so the cap below never runs blind. The report's cost record
shows each side's calls, tokens (billed input, cache reads, cache writes, output), estimated dollars, and for Workers
AI its neurons.

- **Prompt caching (Claude).** Buyer calls carry cache checkpoints on the system prompt, on the end of the
  conversation and just before the oldest screenshot still in full, so each step re-reads its history from cache at a
  tenth of the input price. Haiku 4.5 caches only from 4,096 tokens, so the first steps run uncached. The buyer prunes
  old screenshots in strides (up to five screens in full, then back to two) so the cache holds between prunes. On
  the same four MMM sessions this cut input cost by about 40%. The evaluator's long system prompt (journey map and
  brand facts) is cached too, shared by every session graded in the run.
- **`--max-usd <n>` (default 3).** Spend is estimated live from token usage. Past the cap no new session starts,
  running sessions end cleanly (`endReason: capped`), grading stops starting new sessions, and the report names the
  sessions it cut, did not start, or left ungraded. On `evaluate` the cap covers the grading only.
- **Kill switch.** An AWS budget action denies Bedrock to the panel's IAM user when account
  spend passes $20 in the month. If Bedrock calls suddenly return AccessDenied, it has fired: stop and ask, do not
  work around it.

### Providers

Each variant and the evaluator takes a `provider`:

| provider | models | credentials |
| --- | --- | --- |
| `bedrock` (default) | Claude, through Bedrock's Anthropic SDK | `AWS_*`, `AWS_BEDROCK_REGION` |
| `anthropic` | Claude, first-party API | `ANTHROPIC_API_KEY` |
| `bedrock-converse` | any other Bedrock model, through the Converse API (tested: Qwen3-VL 235B, Kimi K2.5) | `AWS_*` |
| `workers-ai` | Cloudflare Workers AI (tested: Llama 4 Scout, Mistral Small 3.1) | `CLOUDFLARE_AI_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` |

The panel works in Anthropic's message shape everywhere. `src/providers/` translates a request out and the reply back
for the two non-Claude providers (images, tool calls and results, usage), so `buyer.ts` and `evaluate.ts` are the same
whichever model runs. Notes from the adapters: screenshots are moved out of tool results into the same turn (not every
vision model accepts them inside one); a model's second parallel tool call is dropped (the buyer answers one);
Workers AI is always asked for `tool_choice: required`, because Llama 4 Scout otherwise writes a call as prose, which
leaves its one-line thought before an action empty; Mistral Small 3.1 needs a one-line assistant turn between a tool
result and the next user turn. Neither non-Claude provider caches prompts. Cheaper models are not a free swap: see the
bake-off report before changing a panel's models.

### Credentials

From the environment, never from flags: the model provider's keys (table above) and the two Access service-token
variables the panel names in `target.access`. Which Doppler config holds them, which IAM user and Access policy they
belong to, and when the token expires are recorded in dd-repo-registry `docs/buyer-panel.md` (private), not in this public repo (DOM-1643).

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
