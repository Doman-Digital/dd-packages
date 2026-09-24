// The site's data files, rendered from the answers. These are the files a
// person edits after the scaffold runs, so none of them is ever overwritten.

import type { Answers } from "../answers.js";
import { policyPatternsFor } from "../patterns.js";
import { SECTORS } from "../sectors.js";

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
};
`;
}

export function renderRoutes(routesOnDisk: string[], dynamicRoutesOnDisk: string[] = []): string {
  // /resources is added below as noindex, whatever is on disk.
  const routes = [...new Set([...routesOnDisk, "/press"])].filter((r) => r !== "/resources").sort();
  const entries = routes.map((path) => `  { path: ${JSON.stringify(path)}, indexable: true, inSitemap: true },`);
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
