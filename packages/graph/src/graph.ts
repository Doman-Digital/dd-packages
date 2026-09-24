export type JsonLdNode = Record<string, unknown>;
export type JsonLdGraph = { "@context": "https://schema.org"; "@graph": JsonLdNode[] };

// Compose a final <script> graph from one-or-more nodes, dropping any that
// weren't built (conditional nodes return null upstream).
export function buildGraph(nodes: Array<JsonLdNode | null | undefined>): JsonLdGraph {
  return {
    "@context": "https://schema.org",
    "@graph": nodes.filter((n): n is JsonLdNode => Boolean(n)),
  };
}

// A "pure ref" is exactly the shape our node builders emit for a relation:
// {'@id': 'https://...'} and nothing else. Full nodes always carry more than
// just '@id' (at minimum '@type'), so this can't mistake a node for a ref.
function isPureRef(value: unknown): value is { "@id": string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value as Record<string, unknown>);
  return keys.length === 1 && keys[0] === "@id" && typeof (value as Record<string, unknown>)["@id"] === "string";
}

export type FindGraphIssuesOptions = {
  /**
   * The `@id` of the business this site belongs to (usually `ids.org`).
   * When set, also reports "self-serving" review markup: an
   * `aggregateRating` on that entity, and `Review` nodes whose
   * `itemReviewed` is that entity. Google's review snippet guidelines make
   * such markup ineligible for stars on the business's own site. It is
   * still valid schema.org and carries no manual action on its own, so
   * these are reported for a decision, not as errors in the graph.
   */
  siteEntityId?: string;
};

function isReviewType(type: unknown): boolean {
  return type === "Review" || (Array.isArray(type) && type.includes("Review"));
}

/**
 * Validates a graph is self-contained: every `{'@id': X}` reference resolves
 * to a node with `@id: X` somewhere in the same `@graph`, and no two nodes
 * share an `@id`. Returns an empty array when the graph is clean.
 *
 * This is the check that catches the class of bug where `provider` /
 * `worksFor` / `publisher` drift into a nested literal instead of a real
 * reference, and the case of two differently-typed nodes accidentally
 * sharing one `@id` (which JSON-LD parsers merge into one contradictory
 * node).
 *
 * With `options.siteEntityId`, also reports self-serving review markup; see
 * `FindGraphIssuesOptions`.
 */
export function findGraphIssues(graph: JsonLdGraph, options: FindGraphIssuesOptions = {}): string[] {
  const issues: string[] = [];
  const idCounts = new Map<string, number>();

  for (const node of graph["@graph"]) {
    const id = node["@id"];
    if (typeof id === "string") {
      idCounts.set(id, (idCounts.get(id) || 0) + 1);
    }
  }
  for (const [id, count] of idCounts) {
    if (count > 1) issues.push(`duplicate @id (${count}×): ${id}`);
  }

  const definedIds = new Set(idCounts.keys());

  const walk = (value: unknown, path: string) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }
    if (isPureRef(value)) {
      if (!definedIds.has(value["@id"])) {
        issues.push(`unresolved @id ref at ${path}: ${value["@id"]}`);
      }
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        walk(child, `${path}.${key}`);
      }
    }
  };

  graph["@graph"].forEach((node, index) => walk(node, `@graph[${index}]`));

  const { siteEntityId } = options;
  if (siteEntityId) {
    let ratedSiteEntity = false;
    let reviewsOfSiteEntity = 0;
    const visit = (value: unknown) => {
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      if (!value || typeof value !== "object") return;
      const node = value as Record<string, unknown>;
      if (node["@id"] === siteEntityId && node.aggregateRating) ratedSiteEntity = true;
      if (isReviewType(node["@type"])) {
        const reviewed = node.itemReviewed as Record<string, unknown> | undefined;
        if (reviewed && reviewed["@id"] === siteEntityId) reviewsOfSiteEntity++;
      }
      Object.values(node).forEach(visit);
    };
    graph["@graph"].forEach(visit);
    if (ratedSiteEntity) issues.push(`self-serving review: aggregateRating on ${siteEntityId}`);
    if (reviewsOfSiteEntity > 0) {
      issues.push(`self-serving review: Review of ${siteEntityId} (${reviewsOfSiteEntity}×)`);
    }
  }

  return issues;
}
