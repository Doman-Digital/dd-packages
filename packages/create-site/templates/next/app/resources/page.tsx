// The home for the site's linkable assets: a cost guide from the client's own
// job data, a calculator, or a practical guide. Kept out of the index until
// the first one ships: flip /resources to indexable in site.routes.ts then.
// Written by @domandigital/create-site.

import type { Metadata } from "next";
import { isRouteIndexable } from "@domandigital/seo";
import { facts } from "~site/facts";
import { linkableAssets, policy } from "~site/routes";

export const metadata: Metadata = {
  title: `Resources: ${facts.tradingName}`,
  robots: { index: isRouteIndexable(policy, "/resources") },
};

export default function ResourcesPage() {
  return (
    <main>
      <h1>Resources</h1>
      {linkableAssets.length > 0 && (
        <ul>
          {linkableAssets.map((asset) => (
            <li key={asset.path}>
              <a href={asset.path}>{asset.title}</a>
              <p>{asset.summary}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
