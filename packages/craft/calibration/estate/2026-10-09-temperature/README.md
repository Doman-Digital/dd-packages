# Ground temperature and structure, 2026-10-09 (DOM-637)

The calibration set for fingerprint version 3: RMP Electrical against
Bellerose Plumbing's light mode on stone (before bellerose-plumbing#32) and
on porcelain (after), in both colour schemes. The entry in `CHARACTER.md`
under *Calibration* reads these.

| File | What it is |
|---|---|
| `rmp.snapshot.json` | https://www.rmp-electrical.co.uk/ live, 1440 x 900, 2026-10-09 |
| `bellerose-stone-light.snapshot.json` | Bellerose at `c62590c` (stone `#EEEDE8` light mode), `craft snapshot --scheme light` |
| `bellerose-stone-dark.snapshot.json` | the same build, `--scheme dark` |
| `bellerose-porcelain-light.snapshot.json` | Bellerose at `47f9d79` (porcelain `#F1F3F4`, after #32), `--scheme light` |
| `bellerose-porcelain-dark.snapshot.json` | the same build, `--scheme dark` |
| `estate-v2-dd-ops-copy.json` | a copy of the redesign workstream's register (`dd-ops/dd-redesign/estate-v2.json`) as it was on 2026-10-09: seven version 2 fingerprints and one declared direction. The original is that workstream's and is not edited from here. |
| `register-before-after.md` | every pair of the seven register sites, re-fingerprinted from `../2026-09-30-v2/`, scored by craft 0.18.1 and by this build |
| `bellerose-before-after.md` | the RMP and Bellerose pairs the same way, with each page's ground label, rhythm and hero |
| `sibling-line.txt` | the median same-brief distance over the seven v2 null models, old and new distance |

Bellerose staging sits behind Cloudflare Access, so the site was built
locally: a clone outside the main checkout (Vite otherwise reads the parent
checkout's tsconfig), `npm ci`, `npx astro build`, `npx astro preview`, then
`craft snapshot http://127.0.0.1:<port>/ --scheme light|dark`. The snapshot
URLs are therefore loopback. The tests in `src/__tests__/fingerprint-v3.test.ts`
read the snapshots and the register copy from this folder.
