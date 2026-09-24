// The policy entries a dynamic route needs, in @domandigital/seo's `/prefix/*`
// convention. seo's toPolicyPatterns is the source of this rule; the
// generator cannot import it (no runtime dependencies), so this copy is held
// to it by patterns.test.ts, which runs both on the same inputs.

const DYNAMIC = /^\[.+\]$/;
const OPTIONAL_CATCH_ALL = /^\[\[\.\.\..+\]\]$/;
const ROUTE_GROUP = /^\([^.)][^)]*\)$/;

export function policyPatternsFor(bracketPath: string): string[] {
  const kept: string[] = [];
  for (const segment of bracketPath.split("/").filter(Boolean)) {
    if (ROUTE_GROUP.test(segment)) continue;
    if (DYNAMIC.test(segment)) {
      const parent = kept.length > 0 ? `/${kept.join("/")}` : "";
      const pattern = `${parent}/*`;
      return OPTIONAL_CATCH_ALL.test(segment) ? [parent || "/", pattern] : [pattern];
    }
    kept.push(segment);
  }
  return [`/${kept.join("/")}`];
}
