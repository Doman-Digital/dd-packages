# The blind test

The protocol for craft's fifth target: **people can't tell**. In a blind
side-by-side test, judges pick a site we built as the AI-made one no more
often than chance.

Targets 1 to 4 are proxies, and `craft calibrate` and `craft estate compare`
measure them. This one takes people and runs once a quarter. Record every run
in `packages/craft/CHARACTER.md`, under Calibration, with its date.

## Where the method comes from

UI-Bench (Jung, Garcinuno and Mateega, [arXiv 2508.20410](https://arxiv.org/abs/2508.20410),
v3, 3 September 2025) ranked ten AI text-to-app tools. It used 194 expert
judges and more than 4,000 blinded pairwise votes. This protocol keeps its
design choices:

- **Pairwise, forced choice.** A judge sees two pages and answers one
  question. There is no tie option.
- **Blinded.** Tool identities are hidden, URLs are sanitised, and left and
  right placement is random.
- **Full view.** A judge must see the whole page before voting, not a cropped
  hero.
- **Split sessions.** UI-Bench used two sessions of 30 votes each, with a day
  recommended between them.

It changes one thing. UI-Bench asked "Which project would you be more likely
to deliver to a client?", which measures quality. Our question is **"Which of
these two was built by AI?"**, because the target is whether the AI look is
visible.

## The pairs

- **Test pair:** a site we built, against a site in the same trade built by
  people.
  - Choose the human site before anyone votes, and not a judge.
  - Record why you believe people built it: a build date before 2023, or the
    maker's own statement. A human site that might itself be generated voids
    that pair.
- **Control pair:** a page from the null model for the same brief
  (`calibration/null/<brief>/pages/`), against the same human site.

Never pair our site with a null page. A generated page that is obviously
generated makes our site look human by comparison, so the test would pass
without measuring anything.

Mix test and control pairs in random order. Judges are not told there are two
kinds, or in what ratio.

**Size.** The estate is seven sites. Pair each with four different human sites
for 28 test pairs, and add 10 control pairs.

A site appears in four pairs, so its votes are not independent. Read the
per-site counts (below) as well as the pooled result.

## The judges

- **At least one outside judge**: a working designer or front-end developer
  who has not seen the sites before.
- **The art director** judges too, but their votes on any site they have
  directed or reviewed are not blind. Record those votes and leave them out of
  the verdict. Their votes on the control pairs, and on sites they have not
  seen, count.
- Record judges as codes (`J1`, `J2`), never by name. The repository is public.

## Presentation

- Full-page screenshots, taken with the same browser, at 1440 wide and at 390
  wide, shown side by side at the same scale.
- File names are neutral (`pair-07-a.png`, `pair-07-b.png`). Left or right is
  set by a coin flip or a random number per pair, recorded before the session.
- Motion is lost in a screenshot: scroll reveals, marquees and intros do not
  show. Say so in the record. A screen recording of each page, scrolled at the
  same speed, is the fuller alternative when there is time to make one.
- Two sessions of about 20 votes each, on different days.

## The record

One CSV per run, in `packages/craft/calibration/blind/<date>/votes.csv`:

```csv
judge,session,pair,kind,left,right,picked,excluded
J1,1,07,test,ours:hj-beauty,human:salon-x,left,
J2,1,07,test,ours:hj-beauty,human:salon-x,right,
J2,1,11,control,null:dd/14,human:agency-y,left,
AD,1,07,test,ours:hj-beauty,human:salon-x,left,directed this site
```

`picked` is the side the judge said was built by AI. `excluded` holds the
reason a vote does not count, and stays empty otherwise. Keep the answer key
(which side is ours) out of anything a judge sees.

## Scoring

Count only votes with an empty `excluded`.

**1. Controls first.** Out of the control votes, count how many picked the null
page as AI. If that count is not above chance at 5% (see the table), the
judges could not see the AI look in pages known to have it, and the test says
nothing. Void the run and record why.

**2. The test pairs.** Count how many times our site was picked as the AI one.
The target is met when that count is **not** significantly above half, using
a one-sided exact binomial test at 5%.

| Votes counted | Picked as AI this many times or more fails the target | Chance of that by luck |
|---|---|---|
| 20 | 15 | 2.1% |
| 30 | 20 | 4.9% |
| 40 | 26 | 4.0% |
| 60 | 37 | 4.6% |

| Control votes | Null page picked this many times or more: the controls work |
|---|---|
| 8 | 7 |
| 10 | 9 |
| 12 | 10 |

For any other count, use the smallest k where the chance of k or more heads
in n fair coin flips is 5% or less.

**3. How much it can see.** Passing with few votes proves little.

- With 20 votes, judges who really spot our sites 75% of the time are caught
  only 62% of the time.
- With 30 votes, 89%.
- With 40 votes, 95%.

Aim for 40 counted test votes. Report the share with its 95% Clopper-Pearson
interval, so a reader sees the uncertainty and not only the verdict.

**4. Per site.** List each site's count (for example "picked 6 of 8"). A site
picked in most of its pairs is the next retrofit to revisit, whatever the
pooled result says.

## What this cannot show

- **Which cue a judge used.** Ask for one sentence after each session (not
  per vote, which slows judging and primes the next pair). Each cue named twice
  is a candidate tell for `craft tells harvest` to check.
- **That our sites are good.** Passing means they don't read as generated. It
  does not mean they are good. UI-Bench's own question measures quality, and
  can be run on the same pairs as a separate session if wanted.
- **Anything about a site that changes afterwards.** Record the date of every
  screenshot.
