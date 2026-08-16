/**
 * Breadcrumb trail derivation: given a site's known path -> label entries
 * and a target path, walk the path segments and pick up the registered
 * label at each level that has one. This is the one touchpoint with
 * @domandigital/graph — feed the result to buildBreadcrumbs there. Neither
 * package depends on the other; see dd-graph/PRINCIPLES.md for why.
 *
 * Deliberately doesn't read from a live route (usePathname() or similar) —
 * that couples breadcrumb generation to whatever's rendering, and a page
 * three levels deep with no registered parent produces a broken trail
 * instead of a short-but-correct one.
 */

export type TrailLabel = { path: string; label: string };
export type TrailEntry = { path: string; label: string };

export function getBreadcrumbTrail(labels: TrailLabel[], path: string): TrailEntry[] {
  const segments = path.split("/").filter(Boolean);
  const trail: TrailEntry[] = [];
  let acc = "";
  for (const segment of segments) {
    acc += `/${segment}`;
    const match = labels.find((l) => l.path === acc);
    if (match) trail.push({ path: acc, label: match.label });
  }
  return trail;
}
