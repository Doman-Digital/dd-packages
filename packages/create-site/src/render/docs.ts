// The house documents a site starts with. docs/HOUSE.md is a template (house
// rules, replaced with --force) that CLAUDE.md imports; DIRECTION.md, the
// checklist and the baseline are data from the first day and are never
// overwritten.

import type { Answers } from "../answers.js";
import type { Project } from "../detect.js";
import { REGISTERS_CHECKED_ON, SECTORS, registersFor } from "../sectors.js";

const run = (pm: Project["packageManager"], script: string) => (pm === "npm" ? `npm run ${script}` : `${pm} ${script}`);

export function renderHouseMd(a: Answers, project: Project): string {
  const pm = project.packageManager;
  const base = project.srcBase;
  return `# ${a.tradingName}

The house rules for this Doman Digital site, set up by \`@domandigital/create-site\`
and imported by \`CLAUDE.md\`. Read \`docs/DIRECTION.md\` before changing anything a
visitor can read.

## Where things live

| What | Where |
| --- | --- |
| Name, contact details, places, accreditations, profiles | \`site.facts.ts\` |
| Every page, its indexing, keyword targets, internal links | \`site.routes.ts\` |
| Links the business has earned | \`links.json\` |
| Redirects, including every moved URL | \`redirects.json\` |
| JSON-LD for a page | \`buildPageGraph\` in \`${base}lib/graph/page-graph.ts\`, through the JsonLd component |
| Art direction and the reason for each choice | \`art-direction.json\` |
| Decisions and what is blocked | \`docs/DIRECTION.md\` |
| Launch listings for this sector | \`docs/seo-launch-checklist.md\` |
| Search results at launch, 90 days, 6 and 12 months | \`docs/seo-baseline.md\` |

## Rules

- **The facts file is the only source of contact details.** Import \`facts\`; never type a phone number, email or postcode into a page. \`tests/house.test.ts\` fails if you do.
- **Every page gets a policy entry in the same change.** \`tests/seo/coverage.test.ts\` fails until it has one. Paths and routeKeys are URL paths with a leading slash.
- **Every moved URL gets a redirect**, one hop, to a live page. \`tests/seo/redirects.test.ts\` checks every earned link in \`links.json\`.
- **One JSON-LD script per page**, built by \`buildPageGraph\`. Never hand-write JSON-LD.
- **The designer credit** is the DesignerCredit component, unchanged: "Website by Doman Digital", linking to the Doman Digital homepage, \`rel="nofollow"\`. It is never a contract term and never tied to a discount.
- **Links are earned.** Paying for a link, swapping links, badges that link back and testimonials written for someone else are all out. A sponsorship is for the community, and any link it brings is marked \`rel="sponsored"\` by whoever places it. Any ask for a link goes from the client to someone they already deal with. \`links.json\` records links that exist, not asks.
- **Every claim cites a source a person can check.** Unknown stays null. A cost guide publishes only with enough real jobs that one outlier cannot move an average, and says how the figures were made and when.
- **Copy passes the house gate**: \`npx craft copy --gate <files>\`. Art direction passes \`npx craft direction validate\`.

## Commands

\`\`\`bash
${run(pm, "seo:check")}      # coverage, redirects, JSON-LD, house rules
${run(pm, "launch:check")}   # adds the launch block: credit placed, contact details, a live profile, checked accreditations
\`\`\`
`;
}

export function renderDirection(a: Answers, today: string): string {
  return `# ${a.tradingName}: direction

Started ${today} by \`@domandigital/create-site\`.

## 0. Authority

When two sources disagree, the higher one wins, and the disagreement is written down in section 1, never settled silently. A later date does not settle it.

1. The law and the rules of any regulator the business answers to.
2. What the client has signed or confirmed in writing.
3. The decisions in section 1 of this file.
4. The defaults of the house packages (\`@domandigital/*\`).
5. \`CLAUDE.md\`.
6. Anything else, including what the live site currently says.

## 1. Decisions

A decision that lives only in a conversation will be argued again. Record it here, with what it replaces.

| Decision | Reason | Supersedes |
| --- | --- | --- |
| ${today}: The site starts on the Doman Digital house foundation: facts file, route policy, backlink register, redirects gate, JSON-LD through the house graph package, and the designer credit | Every build starts the same way and upgrades by bumping packages | Nothing |

## 2. Blocked

| Item | Blocked by | Owner | Unblocks |
| --- | --- | --- | --- |
| Launch | \`launch:check\` passing: credit placed, phone and postcode set, one live profile, every accreditation checked | Doman Digital | Go-live |
`;
}

export function renderChecklist(a: Answers): string {
  const sector = SECTORS[a.sector];
  const registers = registersFor(a.sector);
  const held = registers.filter((r) => a.registers.includes(r.id));
  const rest = registers.filter((r) => !a.registers.includes(r.id));
  const line = (r: (typeof registers)[number]) =>
    `- [ ] **${r.name}**${r.url ? ` (${r.url})` : ""}: ${r.condition}.${r.personLevel ? " Held by a person: list it on their profile, not the business." : ""}`;
  const checked = REGISTERS_CHECKED_ON
    ? `Register list last checked by a person on ${REGISTERS_CHECKED_ON}.`
    : "**The register list has not yet been checked by a person.** Open each entry before relying on it: confirm the register still exists, that it shows a business website, and how it links.";

  return `# Launch checklist: ${a.tradingName}

Sector: ${sector.label}. ${checked}

Claim a listing only where the business already qualifies. Nothing here is paid for to get a link, and nobody is cold-asked for one. When a listing goes live, add it to \`profiles\` in \`site.facts.ts\` with status "live" and its URL, and record the link in \`links.json\`.

## Claim: registers the business holds

${held.length > 0 ? held.map(line).join("\n") : "None recorded yet."}

## Only if it applies

${rest.map(line).join("\n")}

## Before launch

- [ ] Every URL of any previous site that other sites link to has a redirect in \`redirects.json\`, and \`seo:check\` passes. On Astro with static output, redirects are meta-refresh pages: use a host adapter or host-level redirects for a migration.
- [ ] \`launch:check\` passes.
- [ ] Search Console property verified and the sitemap submitted.
- [ ] The launch column of \`docs/seo-baseline.md\` filled in.
`;
}

export function renderBaseline(a: Answers, today: string): string {
  const rows = [
    ["Search Console clicks, last 28 days (per money page)", "Search Console"],
    ["Search Console impressions, last 28 days (per money page)", "Search Console"],
    ["Average position for each target keyword", "Search Console"],
    ["Pages indexed", "Search Console, Pages report"],
    ["Business Profile calls, direction requests, website clicks", "Business Profile performance"],
    ["Live referring domains", "links.json and the backlink report"],
    ["Core Web Vitals (mobile)", "Search Console or PageSpeed Insights"],
    ["Enquiries", "The site's forms and calls"],
  ];
  return `# Search baseline: ${a.tradingName}

The proof that the site performs. Fill the launch column before go-live, then each column on its date. A figure without a source is not recorded.

Started ${today}.

| Measure | Launch | 90 days | 6 months | 12 months | Source |
| --- | --- | --- | --- | --- | --- |
${rows.map(([measure, source]) => `| ${measure} | | | | | ${source} |`).join("\n")}
`;
}

export function renderWorkflow(project: Project): string | null {
  const pm = project.packageManager;
  if (pm !== "pnpm" && pm !== "npm") return null;
  const setup =
    pm === "pnpm"
      ? `      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v5
        with:
          node-version: '22.x'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm seo:check`
      : `      - uses: actions/setup-node@v5
        with:
          node-version: '22.x'
          cache: 'npm'
      - run: npm ci
      - run: npm run seo:check`;
  return `name: seo-check

# The house SEO checks on every pull request: route coverage, redirects,
# JSON-LD and the facts-file rule. Written by @domandigital/create-site.

on:
  pull_request:

permissions:
  contents: read

concurrency:
  group: \${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  seo:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v5
${setup}
`;
}
