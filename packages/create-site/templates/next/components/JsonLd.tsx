// One JSON-LD script per page. Pass buildPageGraph({ path, name, description }).
// Written by @domandigital/create-site.

import { escapeJsonLdForScript } from "@domandigital/graph";
import type { JsonLdGraph } from "@domandigital/graph";

export function JsonLd({ graph }: { graph: JsonLdGraph }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: escapeJsonLdForScript(JSON.stringify(graph)) }} />
  );
}
