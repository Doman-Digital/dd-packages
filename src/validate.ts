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

import type { RoutePolicyEntry } from "./policy";
import type { PageTarget } from "./targets";

export type CoverageIssue =
  | { kind: "route-missing-policy"; path: string }
  | { kind: "policy-missing-route"; path: string }
  | { kind: "money-route-missing-target"; path: string };

export type ValidateCoverageInput = {
  /** Routes found on disk, e.g. every app/**\/page.tsx resolved to its URL path. Dynamic segments excluded by the caller. */
  routesOnDisk: string[];
  policy: RoutePolicyEntry[];
  /** Routes that must have a target declared (the pages the business actually wants to rank), e.g. ["/audit", "/work/sensphere"]. */
  moneyRoutes?: string[];
  targets?: PageTarget[];
};

export function validateCoverage(input: ValidateCoverageInput): CoverageIssue[] {
  const { routesOnDisk, policy, moneyRoutes = [], targets = [] } = input;
  const issues: CoverageIssue[] = [];

  const policyByPath = new Map(policy.filter((p) => !p.isDynamicPattern).map((p) => [p.path, p]));

  for (const path of routesOnDisk) {
    if (!policyByPath.has(path)) {
      issues.push({ kind: "route-missing-policy", path });
    }
  }

  const diskSet = new Set(routesOnDisk);
  for (const entry of policy) {
    if (entry.isDynamicPattern) continue;
    if (entry.inSitemap && !diskSet.has(entry.path)) {
      issues.push({ kind: "policy-missing-route", path: entry.path });
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
