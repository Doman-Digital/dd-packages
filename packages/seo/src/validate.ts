/**
 * Coverage validator: the check that would have caught six live case-study
 * pages shipping indexable and unsubmitted, with no policy entry and no CI
 * failure. Filesystem route enumeration vs policy, generalised so every
 * repo on this package runs the same check instead of reinventing it.
 *
 * Pure function — no filesystem access here. Callers do the `page.tsx`
 * enumeration (glob is a per-repo, per-router concern) and pass the
 * resulting route list in.
 */

import { normalizeRoutePath, toPolicyPatterns } from "./normalize";
import type { RoutePolicyEntry } from "./policy";
import type { PageTarget } from "./targets";

export type CoverageIssue =
  | { kind: "route-missing-policy"; path: string }
  | { kind: "policy-missing-route"; path: string }
  | { kind: "money-route-missing-target"; path: string }
  /** A dynamic route on disk with no policy entry for the pattern it serves. `path` is the route as passed in. */
  | { kind: "dynamic-route-missing-policy"; path: string; pattern: string }
  /** A `/prefix/*` policy entry that no dynamic route on disk produces. Only reported when `dynamicRoutesOnDisk` is passed. */
  | { kind: "policy-pattern-missing-route"; path: string };

export type ValidateCoverageInput = {
  /** Routes found on disk, e.g. every app/**\/page.tsx resolved to its URL path. Dynamic routes go in `dynamicRoutesOnDisk`, not here. */
  routesOnDisk: string[];
  policy: RoutePolicyEntry[];
  /** Routes that must have a target declared (the pages the business actually wants to rank), e.g. ["/pricing", "/services/rewiring"]. */
  moneyRoutes?: string[];
  targets?: PageTarget[];
  /**
   * Dynamic routes found on disk, in Next.js bracket form (e.g.
   * `/blog/[slug]`, `/docs/[...slug]`, `/help/[[...slug]]`). Route groups
   * may be left in; parallel slots (`@x`) and intercepting routes (`(.)x`)
   * must be excluded by the caller. Each is checked for the policy entries
   * `toPolicyPatterns` says it needs. Pages generated at request time never
   * appear in a build-time list, so the pattern is the only thing that can
   * be checked. Omit to skip both dynamic checks (the pre-0.2 behaviour).
   */
  dynamicRoutesOnDisk?: string[];
};

export function validateCoverage(input: ValidateCoverageInput): CoverageIssue[] {
  const { routesOnDisk, policy, moneyRoutes = [], targets = [], dynamicRoutesOnDisk } = input;
  const issues: CoverageIssue[] = [];

  const staticPolicy = new Set(
    policy.filter((p) => !p.isDynamicPattern).map((p) => normalizeRoutePath(p.path)),
  );
  const patternPolicy = new Set(policy.filter((p) => p.isDynamicPattern).map((p) => p.path));

  for (const path of routesOnDisk) {
    if (!staticPolicy.has(normalizeRoutePath(path))) {
      issues.push({ kind: "route-missing-policy", path });
    }
  }

  const diskSet = new Set(routesOnDisk.map((p) => normalizeRoutePath(p)));
  for (const entry of policy) {
    if (entry.isDynamicPattern) continue;
    if (entry.inSitemap && !diskSet.has(normalizeRoutePath(entry.path))) {
      issues.push({ kind: "policy-missing-route", path: entry.path });
    }
  }

  if (dynamicRoutesOnDisk) {
    const producedPatterns = new Set<string>();
    for (const path of dynamicRoutesOnDisk) {
      for (const pattern of toPolicyPatterns(path)) {
        const isPattern = pattern.endsWith("/*");
        if (isPattern) producedPatterns.add(pattern);
        const covered = isPattern ? patternPolicy.has(pattern) : staticPolicy.has(pattern);
        if (!covered) issues.push({ kind: "dynamic-route-missing-policy", path, pattern });
      }
    }
    for (const pattern of patternPolicy) {
      if (!producedPatterns.has(pattern)) {
        issues.push({ kind: "policy-pattern-missing-route", path: pattern });
      }
    }
  }

  const targetedRoutes = new Set(targets.map((t) => t.routeKey));
  for (const money of moneyRoutes) {
    if (!targetedRoutes.has(money)) {
      issues.push({ kind: "money-route-missing-target", path: money });
    }
  }

  return issues;
}
