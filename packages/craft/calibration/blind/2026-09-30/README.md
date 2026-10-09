# Blind test pack, 2026-09-30

Materials for the fifth target in [`docs/blind-test.md`](../../../../../docs/blind-test.md): people
cannot tell our sites from human ones. This folder holds the set-up only. No judge has voted and
nothing has been scored.

## What is here

| File | What it is |
|---|---|
| `config.json` | The seven sites, the human sites chosen for each, the control counts, the seed and the session count. |
| `votes.csv` | Header only. Filled in from the judges' answers. |
| `not-measured.txt` | Pages that could not be screenshotted. |
| `judge/` | Not committed. Screenshots and `sessions.csv`, the only thing a judge sees. |
| `.key/key.json` | Not committed. Which side of each pair is ours. Keep it from judges until scoring. |

Scripts: [`scripts/blind/prepare.mjs`](../../../scripts/blind/prepare.mjs) builds the pack and
[`scripts/blind/score.mjs`](../../../scripts/blind/score.mjs) scores it.

```bash
node scripts/blind/prepare.mjs calibration/blind/2026-09-30/config.json
node scripts/blind/score.mjs calibration/blind/2026-09-30
```

## How the pairs were made

- **Test pair:** one of our sites against a human site in the same trade.
- **Control pair:** a null page for the same brief (`calibration/null/<brief>/pages/`) against the
  same human site. Never our site against a null page.
- Left and right come from a seeded random generator (seed in `config.json`), so the flips were
  fixed before any session. Pairs are shuffled and split into two sessions.
- Full-page screenshots at 1440 and 390 wide, taken with one Chrome, after scrolling the page once
  so lazy images draw. Motion (scroll reveals, marquees, intros) is lost.

## Why these human sites

They come from the DMOZ seed list (`calibration/copy-shape/wayback-domains.json`, frozen 2017),
matched by trade, so each was listed by a directory editor before 2018. That is weaker than a dated
build. `prepare.mjs --verify` checks that each is still live and shares assets with a capture from
2022 or earlier. It was not run for this pack: archive.org answered HTTP 429 (too many requests).
Run it before any judge votes, and drop any site that fails.

One candidate was dropped on inspection: `webdesigninessex.co.uk` now redirects to a parked-domain
page (`/lander`), and another (`tadleyangling.com`) redirects to a different domain.

## Gaps, and what is needed

- **chair, rmp, sensphere have too few human sites.** The DMOZ list has none for a barber or a
  therapy practice and one for electricians. chair and sensphere have no test or control pairs; rmp has one test pair. Someone needs to nominate about four human sites for each, with a
  reason to believe people built them.
- **hjbeauty humans are loose matches** (online shops, not beauty). Treat its result with care.
- **Size:** the protocol asks for 28 test pairs and 10 controls. This pack has 14 test pairs and 10 control pairs, so
  the power figure `score.mjs` prints will be lower than the 40 votes the protocol aims for.
- **Judges:** at least one outside designer or front-end developer, plus the art director. Record
  judges as codes (`J1`, `J2`). The art director's votes on sites they directed are excluded.
- **Screenshots are not committed.** They are large and third-party. Regenerate with `prepare.mjs`
  or hand over the local `judge/` folder.
- Record the date of every screenshot and the run result in `CHARACTER.md` under Calibration once
  voting is done.
