# CTA idiom set

Snapshots of live pages that CTA.gallery (https://www.cta.gallery) features, so component-level
typicality has an outside comparison line (ROADMAP row L). Snapshots only: no page HTML, no screenshots.

Collected 2026-09-30. Snapshot version 2.

## Permission

`https://www.cta.gallery/robots.txt` allows all crawlers (`User-agent: *`, `Allow: /`) and lists the sitemap.
The site has no terms page (`/terms` is a 404) and none linked from its footer. Requests were identified by a
user agent naming this project and paced at one a second. Each snapshot is of the featured brand's own public page,
not of CTA.gallery.

## Selection rule (fixed before any snapshot was taken)

CTA.gallery lists examples by industry (`/industry/<name>`, 24 industries). For each industry, in the order its
page lists examples, take the 3rd, the 7th, and (for the eight industries that list at least 15: design,
ecommerce, finance, landing, mobile-app, services, saas, tech) the 15th. An industry with fewer takes what exists.
Duplicates across industries are dropped. That gives 42 examples, spread across every industry and not the first ones
listed. The example's live URL is the link on its CTA.gallery page (`/cta/<slug>`).

## Result

37 of 42 snapshotted. Five are not measured and were not worked around:

| Slug | Why |
|---|---|
| bakedwith | its CTA.gallery page has no live URL in the served HTML |
| charityconcert | HTTP 403 |
| kit | HTTP 403 |
| saapro | did not render in 150 s |
| uttkarsh.design | did not render in 150 s |

`register.json` is a `craft estate` register holding the 37 fingerprints, so the existing comparison runs against
it with no new code:

```bash
node dist/cli.js estate compare <snapshot.json> --component cta-band --estate calibration/idiom/cta/register.json
```

The role name is `cta-band` (or `footer-cta`); `cta` alone is not one. `compare-estate-cta.txt` has the seven estate
sites against it.

## What this shows, and its limits

- **Too thin for a sibling line.** The section-role reader found a `cta-band` in only 6 of the 37 examples and a
  `footer-cta` in 2. CTA.gallery's categories are mostly buttons, navigation, forms and modals, which are not
  page-width bands, so the reader (built for bands and footers) rarely sees them. Six sites cannot set a sibling
  threshold. Component comparison stays ranked, not judged.
- **Estate side is thin too.** Against this set only Chair and Blade has a `cta-band` (closest: teachable 0.12,
  waxyweb 0.14, discord 0.15). For `footer-cta`, Doman Digital, Harrison James and RMP Electrical each sit close to
  turn-io (0.10 to 0.11), which is one example.
- **Not what small-business sites do.** These are design-showcase and software pages. Reading the numbers as
  "sameness with a typical CTA" would overreach.
- Some of the 37 are Framer or template demos (`echowave`, `glass-abstract`), kept because the rule picked them.

Needed to make this useful: a CTA reader for buttons, forms and modals (a new role in snapshot v2, so a code
change and a snapshot version decision), or a different idiom source made of full-width bands.

## The examples

| Industry | Position | Slug | Live URL | Status |
|---|---|---|---|---|
| ai | 3 | bakedwith | (none) | no live URL on its CTA.gallery page |
| ai | 7 | neon | https://neon.com/ | snapshotted |
| design | 3 | houseofhoney | https://www.houseofhoney.com/ | snapshotted |
| design | 7 | glass-abstract | https://glass-abstract-animated-shapes.wannathis.one/ | snapshotted |
| design | 15 | droplette | https://droplette.app | snapshotted |
| ecommerce | 3 | drinksom | https://www.drinksom.eu/ | snapshotted |
| ecommerce | 7 | journa | https://www.journahealth.com/ | snapshotted |
| ecommerce | 15 | islaporter | https://islaporter.com/ | snapshotted |
| education | 3 | dominiquesire | https://www.dominiquesire.com/ | snapshotted |
| education | 7 | teachable | https://teachable.com/ | snapshotted |
| event-conference | 3 | povbudapest | https://www.povbudapest.com/ | snapshotted |
| finance | 3 | legend | https://legend.xyz/ | snapshotted |
| finance | 7 | freetrade | https://freetrade.io/ | snapshotted |
| finance | 15 | safepal | https://www.safepal.com/en/ | snapshotted |
| health-fitness | 3 | mollypelletier | https://www.mollypelletier.com/ | snapshotted |
| health-fitness | 7 | antaraspawellness | https://antaraspawellness.com/ | snapshotted |
| hotel | 3 | happyvalleyfarms | https://www.happyvalleyfarms.com/ | snapshotted |
| landing | 3 | quinngtl | https://www.quinngtl.com/ | snapshotted |
| landing | 7 | ridiculous | https://www.ridiculous.design/ | snapshotted |
| landing | 15 | echowave | https://echowave.uprock.pro/ | snapshotted |
| logistic | 3 | bigblue | https://www.bigblue.co/ | snapshotted |
| marketing | 3 | dearchpin | https://searchpin.in/ | snapshotted |
| marketing | 7 | kit | https://kit.com/ | HTTP 403, not measured |
| medical | 3 | cocoonapp | https://www.cocoonapp.ca/ | snapshotted |
| medical | 7 | firesidedc | https://www.firesidedc.com/ | snapshotted |
| mobile-app | 3 | teero | https://www.teero.com/ | snapshotted |
| mobile-app | 7 | getboom | https://www.getboom.app/ | snapshotted |
| mobile-app | 15 | discord | https://discord.com/ | snapshotted |
| nonprofit | 3 | charityconcert | https://charityconcert.ru/ | HTTP 403, not measured |
| portfolio | 3 | uttkarsh.design | https://www.uttkarsh.design/ | did not render within 150 s, not measured |
| portfolio | 7 | waxyweb | https://www.waxyweb.agency/ | snapshotted |
| real-estate | 3 | saapro | https://www.saapro.ae/ | did not render within 150 s, not measured |
| saas | 3 | langchain | https://www.langchain.com/ | snapshotted |
| saas | 7 | short | https://short.io/ | snapshotted |
| saas | 15 | shop | https://www.shop.io/ | snapshotted |
| services | 3 | andreigorskikh | https://andreigorskikh.digital/ | snapshotted |
| services | 7 | turn-io | https://www.turn.io/ | snapshotted |
| services | 15 | mewsunfold | https://www.mewsunfold.com/ | snapshotted |
| tech | 3 | understory | https://understory.io/ | snapshotted |
| tech | 7 | brainfishai | https://www.brainfishai.com/ | snapshotted |
| tech | 15 | visual-domain | https://www.visualdomain.com.au/ | snapshotted |
| travel | 3 | boutindia | https://www.boutindia.com/ | snapshotted |
