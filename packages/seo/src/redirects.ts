/**
 * Redirect validator: the migration gate. When a rebuild changes URLs, every
 * old address another site links to must still land somewhere real, in one
 * hop, or the links the business already earned stop counting. A redesign
 * that drops them looks fine in every test that only visits the new pages.
 *
 * Pure function, like validateCoverage: the caller supplies the linked URLs
 * (liveLinkedUrls over links.json, or a backlink export), the routes on disk
 * and the redirect list. No filesystem, no network.
 *
 * Exact paths only. Pattern redirects (`/blog/:slug`) are not in v0.2.
 */

import { normalizeRoutePath } from "./normalize";
import { getRoutePolicy } from "./policy";
import type { RoutePolicyEntry } from "./policy";

export type Redirect = {
  /** Root-relative path on this site, e.g. "/services/rewiring.html". */
  from: string;
  /** Root-relative path, or an absolute http(s) URL for an external destination. */
  to: string;
  /** Defaults to true (301/308). */
  permanent?: boolean;
  reason?: string;
};

export type RedirectsFile = { $schema?: string; redirects: Redirect[] };

export type RedirectIssue =
  /** Another site links here, and there is neither a page nor a redirect. */
  | { kind: "linked-url-not-found"; url: string; path: string }
  | { kind: "linked-url-invalid"; url: string }
  /** `to` is the final hop, after following any chain. */
  | { kind: "redirect-target-not-found"; from: string; to: string }
  /** More than one hop: point `from` straight at the last entry of `hops`. */
  | { kind: "redirect-chain"; from: string; hops: string[] }
  /** Reported once per cycle, however many of its members are listed. */
  | { kind: "redirect-loop"; hops: string[] }
  /** `from` is still a live page, so the redirect hides it (or never fires). */
  | { kind: "redirect-shadows-route"; from: string }
  /** Link equity sent to a page the policy marks indexable: false. */
  | { kind: "redirect-to-noindex"; from: string; to: string }
  | { kind: "duplicate-redirect"; from: string; to: string[] };

export type ValidateRedirectsInput = {
  /** Absolute or root-relative URLs other sites link to, e.g. liveLinkedUrls(links). */
  linkedUrls: string[];
  /** Same contract as validateCoverage: concrete paths, dynamic segments excluded by the caller. */
  routesOnDisk: string[];
  redirects: Redirect[];
  /** Dynamic-pattern entries count as pages; indexable: false destinations are flagged. */
  policy?: RoutePolicyEntry[];
  /**
   * Hostnames this site answers on, including old domains redirected here.
   * When given, linked URLs on any other host are ignored. `www.` is ignored
   * on both sides.
   */
  hosts?: string[];
};

const isExternal = (to: string) => /^https?:\/\//i.test(to);
const bareHost = (host: string) => host.toLowerCase().replace(/^www\./, "");

type LinkedPath = { kind: "path"; path: string } | { kind: "invalid" } | { kind: "foreign" };

// scheme://[userinfo@]host[:port]path — enough to pull a host and a path out
// of an absolute URL without the URL global, which this package does not
// assume (it builds with no DOM and no Node types).
const ABSOLUTE = /^([a-z][a-z0-9+.-]*):\/\/(?:[^@/?#]*@)?([^/?#:]*)(?::\d*)?([^?#]*)/i;

function linkedPath(url: string, hosts: Set<string> | null): LinkedPath {
  if (url.startsWith("/")) return { kind: "path", path: normalizeRoutePath(url) };
  const match = ABSOLUTE.exec(url.trim());
  if (!match || !/^https?$/i.test(match[1]!) || !match[2]) return { kind: "invalid" };
  if (hosts && !hosts.has(bareHost(match[2]))) return { kind: "foreign" };
  return { kind: "path", path: normalizeRoutePath(match[3] || "/") };
}

export function validateRedirects(input: ValidateRedirectsInput): RedirectIssue[] {
  const { linkedUrls, routesOnDisk, redirects, policy = [], hosts } = input;
  const issues: RedirectIssue[] = [];

  const routes = new Set(routesOnDisk.map((p) => normalizeRoutePath(p)));
  const hostSet = hosts && hosts.length ? new Set(hosts.map(bareHost)) : null;

  const isPage = (path: string) => {
    if (routes.has(path)) return true;
    return getRoutePolicy(policy, path)?.isDynamicPattern === true;
  };

  // First redirect for each `from` wins; later ones are reported, not used.
  const byFrom = new Map<string, string>();
  const allTargets = new Map<string, string[]>();
  for (const r of redirects) {
    const from = normalizeRoutePath(r.from);
    const to = isExternal(r.to) ? r.to : normalizeRoutePath(r.to);
    if (!byFrom.has(from)) byFrom.set(from, to);
    const seen = allTargets.get(from) ?? [];
    if (!seen.includes(to)) seen.push(to);
    allTargets.set(from, seen);
  }

  // Linked URLs: each must be a page or have a redirect. One report per path.
  const reportedPaths = new Set<string>();
  for (const url of linkedUrls) {
    const linked = linkedPath(url, hostSet);
    if (linked.kind === "invalid") {
      issues.push({ kind: "linked-url-invalid", url });
      continue;
    }
    if (linked.kind === "foreign") continue;
    const { path } = linked;
    if (isPage(path) || byFrom.has(path) || reportedPaths.has(path)) continue;
    reportedPaths.add(path);
    issues.push({ kind: "linked-url-not-found", url, path });
  }

  // Redirect hygiene, in input order, once per distinct `from`.
  const reportedLoops = new Set<string>();
  const checked = new Set<string>();
  for (const r of redirects) {
    const from = normalizeRoutePath(r.from);
    if (checked.has(from)) continue;
    checked.add(from);

    const targets = allTargets.get(from) ?? [];
    if (targets.length > 1) issues.push({ kind: "duplicate-redirect", from, to: targets });

    if (isPage(from)) issues.push({ kind: "redirect-shadows-route", from });

    const hops = [from];
    let current = byFrom.get(from)!;
    let loop: string[] | null = null;
    while (true) {
      if (isExternal(current)) {
        hops.push(current);
        break;
      }
      const repeatAt = hops.indexOf(current);
      if (repeatAt !== -1) {
        loop = hops.slice(repeatAt);
        break;
      }
      hops.push(current);
      const next = byFrom.get(current);
      if (next === undefined) break;
      current = next;
    }

    if (loop) {
      const key = [...loop].sort().join("\u0000");
      if (!reportedLoops.has(key)) {
        reportedLoops.add(key);
        issues.push({ kind: "redirect-loop", hops: loop });
      }
      continue;
    }

    if (hops.length > 2) issues.push({ kind: "redirect-chain", from, hops });

    const final = hops[hops.length - 1]!;
    if (isExternal(final)) continue;
    if (!isPage(final)) {
      issues.push({ kind: "redirect-target-not-found", from, to: final });
    } else if (getRoutePolicy(policy, final)?.indexable === false) {
      issues.push({ kind: "redirect-to-noindex", from, to: final });
    }
  }

  return issues;
}
