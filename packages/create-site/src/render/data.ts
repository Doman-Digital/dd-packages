// The site's data files, rendered from the answers. These are the files a
// person edits after the scaffold runs, so none of them is ever overwritten.

import type { Answers } from "../answers.js";
import type { Project } from "../detect.js";
import { policyPatternsFor } from "../patterns.js";
import { SECTORS } from "../sectors.js";

/** The pages create-site writes from dd-base's legal set. */
export const LEGAL_ROUTES = ["/accessibility", "/cookies", "/privacy", "/terms"];

const q = (value: string | null) => (value === null ? "null" : JSON.stringify(value));
const arr = (values: string[]) => `[${values.map((v) => JSON.stringify(v)).join(", ")}]`;

export function renderFacts(a: Answers, siteAdapterSpec: string): string {
  const address =
    a.locality || a.postalCode
      ? `{
    streetAddress: null,
    locality: ${q(a.locality)},
    region: null,
    postalCode: ${q(a.postalCode)},
    country: "GB",
  }`
      : "null";
  return `// The single source of this business's name, contact details, places and
// profiles. Pages, components, JSON-LD and the launch checklist all read this
// file; tests/house.test.ts fails if a page hard-codes a phone number, email
// or postcode instead. Unknown is null, never a placeholder.
//
// Written by @domandigital/create-site. Yours to edit; never overwritten.

import type { SiteFacts } from "${siteAdapterSpec}";

export const facts: SiteFacts = {
  url: ${JSON.stringify(a.siteUrl)},
  legalName: ${JSON.stringify(a.legalName)},
  tradingName: ${JSON.stringify(a.tradingName)},
  description: ${JSON.stringify(a.description)},
  businessTypes: ${arr(SECTORS[a.sector].businessTypes)},
  phone: ${q(a.phone)},
  email: ${q(a.email)},
  address: ${address},
  geo: null,
  openingHours: [],
  serviceAreas: ${arr(a.serviceAreas)},
  // { name, scheme, number, registerUrl, verifiedOn }. Reaches JSON-LD and
  // the press page only once registerUrl and verifiedOn are both set.
  accreditations: [],
  // { kind, name, url, status }. Only "live" profiles become sameAs.
  profiles: [],
  previousHosts: ${arr(a.previousHosts)},
  // The privacy, cookie, terms and accessibility pages read these. A null is
  // left off the page; launch:check fails until retention, the processors
  // (the host at least), the governing law and reviewedOn are set.
  legal: {
    companyNumber: null,
    registeredOffice: null,
    icoNumber: null,
    privacyEmail: null,
    retention: null,
    // { name, purpose, setsCookies }
    processors: [],
    governingLaw: null,
    accessibilityIssues: [],
    reviewedOn: null,
  },
};
`;
}

export function renderRoutes(routesOnDisk: string[], dynamicRoutesOnDisk: string[] = []): string {
  // /resources is added below as noindex, and the legal pages out of the
  // sitemap, whatever is on disk.
  const routes = [...new Set([...routesOnDisk, "/press"])].filter((r) => r !== "/resources" && !LEGAL_ROUTES.includes(r)).sort();
  const entries = routes.map((path) => `  { path: ${JSON.stringify(path)}, indexable: true, inSitemap: true },`);
  for (const path of LEGAL_ROUTES) {
    entries.push(`  { path: ${JSON.stringify(path)}, indexable: true, inSitemap: false, reason: "Legal page: linked from every page's footer, not a search landing page." },`);
  }
  const patterns = new Map<string, string>();
  for (const route of dynamicRoutesOnDisk) {
    for (const pattern of policyPatternsFor(route)) if (pattern.endsWith("/*") && !patterns.has(pattern)) patterns.set(pattern, route);
  }
  for (const [pattern, route] of [...patterns].sort()) {
    entries.push(
      `  { path: ${JSON.stringify(pattern)}, indexable: true, inSitemap: false, isDynamicPattern: true, reason: ${JSON.stringify(
        `Served by ${route}. List each generated URL in the sitemap from its data source.`,
      )} },`,
    );
  }
  entries.push(
    `  { path: "/resources", indexable: false, inSitemap: false, reason: "Empty until the first linkable asset ships. Index it then." },`,
  );
  return `// Every page on the site, what it is trying to rank for, and how pages
// link to each other. Add a policy entry in the same change that adds a
// page: tests/seo/coverage.test.ts fails until you do. Every path and
// routeKey is the URL path with a leading slash.
//
// Written by @domandigital/create-site. Yours to edit; never overwritten.

import type { LinkDeclaration, PageTarget, RoutePolicyEntry, TrailLabel } from "@domandigital/seo";

export const policy: RoutePolicyEntry[] = [
${entries.join("\n")}
];

/** The pages the business wants to rank. Each needs an entry in targets. */
export const moneyRoutes: string[] = [];

export const targets: PageTarget[] = [];

/** Which money pages each content page sends authority to. */
export const internalLinks: LinkDeclaration[] = [];

export const trailLabels: TrailLabel[] = [
  { path: "/", label: "Home" },
  { path: "/press", label: "Press" },
  { path: "/resources", label: "Resources" },
  { path: "/privacy", label: "Privacy policy" },
  { path: "/cookies", label: "Cookie policy" },
  { path: "/terms", label: "Website terms" },
  { path: "/accessibility", label: "Accessibility" },
];

/**
 * The site's linkable assets: a cost guide from the client's own job data
 * (only with enough jobs that one outlier cannot move an average; state the
 * method and the date), a calculator, or a practical guide from their own
 * work. dataSource says where the numbers come from; refreshDue is when
 * they are next checked.
 */
export type LinkableAsset = {
  path: string;
  title: string;
  kind: "cost-guide" | "calculator" | "guide";
  summary: string;
  dataSource: string | null;
  refreshDue: string | null;
};

export const linkableAssets: LinkableAsset[] = [];
`;
}

export function renderLinks(): string {
  return `${JSON.stringify({ $schema: "./node_modules/@domandigital/seo/links.schema.json", links: [] }, null, 2)}\n`;
}

export function renderRedirects(): string {
  return `${JSON.stringify({ $schema: "./node_modules/@domandigital/seo/redirects.schema.json", redirects: [] }, null, 2)}\n`;
}

/**
 * The site's answers to its gates (scripts/gates/, docs/site-programme.md):
 * the programme issue, where the gates read and write, what is measured and
 * how a preview is deployed. The gate scripts are identical on every site;
 * everything that differs between sites is here.
 */
export function renderProgramme(a: Answers, project: Pick<Project, "srcBase">): string {
  const base = project.srcBase;
  const source = base ? [base.replace(/\/$/, "")] : ["app", "components", "lib", "content"];
  const host = a.stack.host === "cloudflare" || a.stack.host === "vercel" ? a.stack.host : null;
  const programme = {
    $comment:
      "Read by scripts/gates/ before every build and preview deploy. docs/site-programme.md says what each key is for. Written by @domandigital/create-site; yours to edit, never overwritten.",
    issue: a.programme,
    registeredDirection: null,
    paths: {
      tokens: `${base}styles/tokens.css`,
      deck: `${base}content/deck.ts`,
      deckMarkdown: "docs/copy-deck.md",
      nullCheck: "docs/null-check.md",
      source,
    },
    measure: { pages: ["/"], minFontPx: 12, labels: null, port: 4410 },
    nullCheck: { harvest: null, justified: {} },
    facts: { importer: null },
    preview: { host },
  };
  return `${JSON.stringify(programme, null, 2)}\n`;
}

/**
 * Both sides of the sheet beyond the direction's own ground and accent: the
 * inks, the rule and the soft accent by day, and every value by night. Null
 * until decided in Stage 05; scripts/gates/tokens.mjs stops the build on a null.
 */
export function renderSheets(): string {
  const inks = { ink: null, "ink-2": null, "ink-3": null, rule: null, "accent-soft": null };
  const sheets = {
    $comment:
      "The day side's ground and accent are art-direction.json's choices. Every other colour, and the whole night side, is decided here in Stage 05 with a reason in because, and measured by scripts/gates/night-contrast.mjs before every build.",
    light: inks,
    night: { ground: null, accent: null, ...inks },
    because: null,
  };
  return `${JSON.stringify(sheets, null, 2)}\n`;
}
