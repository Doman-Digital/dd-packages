# Held-out human set: selection rule (proposal, 2026-09-30)

Status: **proposed, not approved.** No site has been fetched, snapshotted or
scored for this set. Nothing below has looked at a tell result, a
fingerprint or a screenshot.

## Why this set exists

`CHARACTER.md`, "Decision on the flagged rule (2026-09-30)": the flagged rule
marks 14 of 36 human sites as tell-heavy, and five tells (`icon-tile-grid`,
`generic-hero-claim`, `marquee`, `grid-background`, `unproven-claim`) fire
more on human sites than on the AI set. The 36-site set was used to measure
that, so it cannot also be used to fix it. Any change to the rule or to those
five tells must be judged on sites nobody has scored. This is that set.

## Source

`calibration/copy-shape/wayback-domains.json`: 224 UK small-business domains
from DMOZ (frozen 2017, CC BY) by county and trade. They were chosen by a
directory editor years before any AI site builder existed, not by us and not
by any tell. Sites already in `calibration/labels.json` are excluded (12 of
the 224 are used, 212 remain).

## Selection rule (fixed before anything is fetched)

1. **Trade.** Keep trades that match the 20 AI briefs (local trades, clinics,
   shops, food, services): Motoring, Financial_Services, Business_Services,
   Construction_and_Maintenance, Event_Planning, Legal_Services, Shopping,
   Restaurants_and_Bars, Home_and_Garden, Animals, General,
   Beauty_and_Cosmetic_Services, Property, Funeral_Services, Printing,
   Marine_Sales_and_Services, Agriculture. Drop Directories, Organisations,
   Economic_Development, Employment, Training, Computers_and_Internet,
   Industrial and Shipping/Logistics (not like the AI briefs) and
   Entertainment_and_Media.
2. **Order.** Sort the remaining domains by SHA-1 of
   `dd-heldout-2026-09-30:<domain>`, ascending. The order is fixed by that
   string, so nobody can choose.
3. **Walk the list from the top** and accept a domain if all of these hold.
   They read HTTP status, the page title and the visible business name only:
   - `https://<domain>/` (or its `www` form) answers 200 and stays on the
     same registrable domain after redirects.
   - It is the same business that DMOZ described (name matches the title or
     the first heading), and it is not parked, for sale, a directory, a
     holding page or a "coming soon" gate.
   - It is UK-based (UK address, phone or `.uk` domain).
   - It does not state that an AI builder made it (Lovable, v0, Bolt,
     Framer AI, "built with AI") in its generator meta tag or footer.
4. **Cap 3 accepted per trade**, so no trade dominates. Skip the rest of a
   trade once it has 3.
5. **Stop at 36** accepted (30 needed, 6 spare for sites that will not
   render). Rejected domains are listed with the reason, in list order.
6. Record for each accepted site the platform it runs on (from the generator
   meta tag, if any). Do not exclude by platform: a hand-built site and a
   Wix site are both human sites.

## What step 2 does (only after approval)

Snapshot each site on the current snapshot version, add it to `labels.json`
as `human` with its live URL, and run
`craft calibrate calibration/labels.json --fresh --out calibration/results/<date>-heldout`.
Record per-tell precision, the flagged count, the false-positive rate for the
five weak tells, and the not-measured list (403s, 5xx, blocked pages are
recorded as not measured, not worked around). The rule and the tells do not
change in that step. If the numbers argue for a change, it is written as a
proposal at the end of the section and the work stops.

## Limits, stated now

- A domain listed in 2017 may have been rebuilt since. Rule 3 catches sites
  that say they are AI-built, not ones that are and do not say so.
- The set is UK small-business sites with a web presence old enough to be in
  a 2017 directory. Newer businesses are not represented.
- Rule 1 chooses the trades. That is a judgement, made here, before any data.
