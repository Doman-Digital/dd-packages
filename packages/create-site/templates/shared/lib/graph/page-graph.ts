// One JSON-LD graph per page: the organisation and website spine, the page
// itself, and its breadcrumb trail, all joined by @id references so search
// engines read one connected entity. Written by @domandigital/create-site.
//
// Use it through the JsonLd component, once per page:
//   <JsonLd graph={buildPageGraph({ path: "/services/rewiring", name: "Rewiring" })} />

import { buildBreadcrumbs, buildGraph, buildSpine, buildWebPage, createGraphIds } from "@domandigital/graph";
import type { JsonLdGraph } from "@domandigital/graph";
import { getBreadcrumbTrail } from "@domandigital/seo";
import { facts } from "~site/facts";
import { trailLabels } from "~site/routes";
import { toOrganizationInput } from "~site/site-adapter";

export type PageGraphInput = { path: string; name: string; description?: string | null };

export function buildPageGraph(page: PageGraphInput): JsonLdGraph {
  const origin = facts.url.replace(/\/$/, "");
  const ids = createGraphIds(origin);
  const [organization, website] = buildSpine(
    toOrganizationInput(facts),
    { name: facts.tradingName, url: origin, inLanguage: "en-GB" },
    ids,
    facts.businessTypes,
  );
  const trail = getBreadcrumbTrail(trailLabels, page.path).map((t) => ({ name: t.label, url: `${origin}${t.path}` }));

  return buildGraph([
    organization,
    website,
    buildWebPage(
      { path: page.path, url: `${origin}${page.path}`, name: page.name, description: page.description, inLanguage: "en-GB" },
      ids,
    ),
    trail.length > 1 ? buildBreadcrumbs(trail, ids.breadcrumb(page.path)) : null,
  ]);
}
