"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  findKeywordCannibalization: () => findKeywordCannibalization,
  getBreadcrumbTrail: () => getBreadcrumbTrail,
  getRelatedLinks: () => getRelatedLinks,
  getRoutePolicy: () => getRoutePolicy,
  getSitemapRoutes: () => getSitemapRoutes,
  getTargetForRoute: () => getTargetForRoute,
  isRouteIndexable: () => isRouteIndexable,
  validateCoverage: () => validateCoverage
});
module.exports = __toCommonJS(index_exports);

// src/policy.ts
function getSitemapRoutes(policy) {
  return policy.filter((r) => r.inSitemap && !r.isDynamicPattern);
}
function getRoutePolicy(policy, path) {
  const exact = policy.find((r) => r.path === path);
  if (exact) return exact;
  return policy.find((r) => {
    if (!r.isDynamicPattern) return false;
    const prefix = r.path.replace(/\/\*$/, "");
    return path.startsWith(prefix + "/");
  });
}
function isRouteIndexable(policy, path) {
  const found = getRoutePolicy(policy, path);
  return found ? found.indexable : true;
}

// src/targets.ts
function getTargetForRoute(targets, routeKey) {
  return targets.find((t) => t.routeKey === routeKey);
}
function findKeywordCannibalization(targets, allowlist = []) {
  const byKeyword = /* @__PURE__ */ new Map();
  for (const t of targets) {
    if (allowlist.includes(t.primaryKeyword)) continue;
    const existing = byKeyword.get(t.primaryKeyword) ?? [];
    existing.push(t.routeKey);
    byKeyword.set(t.primaryKeyword, existing);
  }
  return [...byKeyword.entries()].filter(([, routeKeys]) => routeKeys.length > 1).map(([primaryKeyword, routeKeys]) => ({ primaryKeyword, routeKeys }));
}

// src/links.ts
function getRelatedLinks(declarations, routeKey, opts = {}) {
  const self = declarations.find((d) => d.routeKey === routeKey);
  const linkedFrom = declarations.filter((d) => d.routeKey !== routeKey && (d.supports ?? []).includes(routeKey)).map((d) => d.routeKey);
  const explicit = self?.supports ?? [];
  let linksTo = [...explicit];
  const limit = opts.limit;
  const needsTopUp = limit === void 0 || linksTo.length < limit;
  if (needsTopUp && self?.pillar) {
    const siblings = declarations.filter(
      (d) => d.routeKey !== routeKey && d.pillar === self.pillar && !linksTo.includes(d.routeKey)
    ).map((d) => d.routeKey);
    linksTo = limit === void 0 ? [...linksTo, ...siblings] : [...linksTo, ...siblings].slice(0, limit);
  } else if (limit !== void 0) {
    linksTo = linksTo.slice(0, limit);
  }
  return {
    linksTo,
    linkedFrom: limit === void 0 ? linkedFrom : linkedFrom.slice(0, limit)
  };
}

// src/trail.ts
function getBreadcrumbTrail(labels, path) {
  const segments = path.split("/").filter(Boolean);
  const trail = [];
  let acc = "";
  for (const segment of segments) {
    acc += `/${segment}`;
    const match = labels.find((l) => l.path === acc);
    if (match) trail.push({ path: acc, label: match.label });
  }
  return trail;
}

// src/validate.ts
function validateCoverage(input) {
  const { routesOnDisk, policy, moneyRoutes = [], targets = [] } = input;
  const issues = [];
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  findKeywordCannibalization,
  getBreadcrumbTrail,
  getRelatedLinks,
  getRoutePolicy,
  getSitemapRoutes,
  getTargetForRoute,
  isRouteIndexable,
  validateCoverage
});
