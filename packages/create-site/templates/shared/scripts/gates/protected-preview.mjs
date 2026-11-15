// Private custom staging is allowed only after the live Access rules match.
// This module makes no Cloudflare changes and never reads credentials itself.
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const fail = (message) => { throw new Error(`protected preview: ${message}`); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const empty = (value) => value == null || (Array.isArray(value) && value.length === 0);

// Preserve strings (including URLs) while removing JSONC comments.
export function parseJsonc(source) {
  let text = "", string = false, escaped = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i], next = source[i + 1];
    if (string) {
      text += c;
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') string = false;
    } else if (c === '"') { string = true; text += c; }
    else if (c === "/" && next === "/") {
      while (i + 1 < source.length && source[i + 1] !== "\n") i++;
      text += " ";
    } else if (c === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      if (end < 0) fail("unterminated JSONC comment");
      i = end + 1; text += " ";
    } else if (c === ",") {
      // Comments are removed first; trailing commas are handled below.
      text += c;
    } else text += c;
  }
  let clean = ""; string = false; escaped = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (string) {
      clean += c;
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') string = false;
    } else if (c === '"') { string = true; clean += c; }
    else if (c !== "," || !/^[\s]*[}\]]/.test(text.slice(i + 1))) clean += c;
  }
  return JSON.parse(clean);
}

export function validateProtectedConfig(wrangler, protection) {
  if (!protection || typeof protection !== "object") fail("missing Access settings");
  const { hostname, accountId, appName, teamDomain, reviewerGroupId, probePaths } = protection;
  if (!/^[a-z0-9-]+$/.test(protection.gateKey || "")) fail("a canonical Access gateKey is required");
  if (typeof hostname !== "string" || !/^staging\.(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(hostname)) fail("only an exact staging subdomain is allowed; never apex, www, wildcards or paths");
  if (!/^[a-f0-9]{32}$/.test(accountId || "") || wrangler.account_id !== accountId) fail("account_id must match the Access account");
  if (!appName || !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(teamDomain || "") || !/^[a-f0-9-]{36}$/.test(reviewerGroupId || "")) fail("invalid Access application, team or reviewer group");
  if (wrangler.workers_dev !== false || wrangler.preview_urls !== false) fail("workers_dev and preview_urls must both be false");
  if (wrangler.route != null || !same(wrangler.routes, [{ pattern: hostname, custom_domain: true }])) fail("exactly one matching custom staging route is required");
  if (wrangler.env && Object.keys(wrangler.env).length) fail("named Wrangler environments are not supported for protected previews");
  if (!/^[a-z0-9-]+$/.test(wrangler.name || "") || wrangler.name !== protection.workerName) fail("the exact registered staging Worker name is required");
  if (!Array.isArray(probePaths) || probePaths.length < 3 || !probePaths.includes("/") || probePaths.some(p => typeof p !== "string" || !/^\/(?!\/)[A-Za-z0-9_./-]*$/.test(p) || p.includes(".."))) fail("probePaths must include the root, a real page and a real asset, with local absolute paths only");
  if (!probePaths.some(p => /\.[a-z0-9]+$/i.test(p)) || !probePaths.some(p => p !== "/" && !/\.[a-z0-9]+$/i.test(p))) fail("probePaths need both a page and an asset");
  return protection;
}

export function canonicalReviewers(protection, registry) {
  const gate = registry.gates?.[protection.gateKey];
  if (!gate || !gate.worker || gate.worker !== protection.workerName || gate.account !== protection.accountId || gate.app !== protection.appName || `${gate.team}.cloudflareaccess.com` !== protection.teamDomain || !same(gate.hosts, [protection.hostname]) || gate.session !== "24h") fail("settings do not match the merged canonical Access registry");
  const groups = [...new Set([...(registry.default_groups || []), ...(gate.groups || [])])];
  if (!same(groups, ["Doman Digital reviewers"]) || !empty(gate.allow) || !empty(gate.bypass) || !empty(gate.service_tokens)) fail("the registered gate must allow only the DD reviewer group");
  const reviewers = registry.groups?.[groups[0]];
  if (!Array.isArray(reviewers) || !reviewers.length || reviewers.some(email => typeof email !== "string" || !email.endsWith("@domandigital.co.uk"))) fail("the canonical reviewer group is missing or invalid");
  return [...reviewers].sort();
}

export function readCanonicalRegistry(run = spawnSync) {
  // origin/main is the merged source, unaffected by another session's dirty
  // kit checkout. Fetch that canonical repo before adopting a new gate.
  const result = run("git", ["-C", join(homedir(), "GitHub", "dd-agent-kit"), "show", "origin/main:config/access-gates.json"], { encoding: "utf8", timeout: 10000, maxBuffer: 1024 * 1024 });
  if (result.status !== 0) fail("the merged canonical Access registry is unavailable");
  return JSON.parse(result.stdout);
}

function publicDestinations(app) {
  return [app.domain, ...(app.destinations || []).filter(d => d.type === "public").map(d => d.uri)].filter(Boolean);
}

function matchesHost(destination, hostname) {
  const host = destination.split("/")[0].toLowerCase();
  const escaped = host.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(hostname);
}

export function validateAccessState(protection, state, registry) {
  const reviewers = canonicalReviewers(protection, registry);
  const { hostname, appName, reviewerGroupId, teamDomain } = protection;
  if (state.organization.auth_domain !== teamDomain) fail("the live Zero Trust team does not match");
  const apps = state.applications.filter(app => publicDestinations(app).some(d => matchesHost(d, hostname)));
  if (apps.length !== 1) fail("the hostname needs exactly one Access app, with no overlapping or path-specific apps");
  const app = apps[0];
  if (app.name !== appName || app.type !== "self_hosted" || app.domain !== hostname || !same(app.destinations, [{ type: "public", uri: hostname }]) || app.session_duration !== "24h") fail("live Access app does not match the exact staging hostname and 24h session");
  if (!Array.isArray(app.policies) || app.policies.length !== 1) fail("exactly one reviewer allow policy is required");
  const policy = app.policies[0];
  if (policy.decision !== "allow" || !same(policy.include, [{ group: { id: reviewerGroupId } }]) || !empty(policy.exclude) || !empty(policy.require) || policy.session_duration !== "24h") fail("live policy must allow only the reviewer group for 24h; no bypass or service token");
  const group = state.groups.find(g => g.id === reviewerGroupId);
  const expected = reviewers.map(email => ({ email: { email } }));
  if (!group || group.name !== "Doman Digital reviewers" || !empty(group.require) || !empty(group.exclude) || !Array.isArray(group.include) || !same([...group.include].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))), expected)) fail("the live reviewer group differs from the canonical named DD reviewers");
  const providers = state.identityProviders.filter(p => app.allowed_idps?.includes(p.id));
  if (app.allowed_idps?.length !== 2 || providers.length !== 2 || !same(providers.map(p => p.type).sort(), ["cloudflare", "onetimepin"])) fail("only the existing Cloudflare and one-time PIN providers are allowed");
  return { appId: app.id, hostname, teamDomain, session: "24h", reviewers: reviewers.length };
}

export function readAccessState(protection, run = spawnSync) {
  const read = (args) => {
    const result = run("cf", ["zero-trust", ...args], { env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: protection.accountId }, encoding: "utf8", timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
    if (result.status !== 0) fail(`Cloudflare read failed (${args.join(" ")}); nothing may be deployed`);
    const data = JSON.parse(result.stdout);
    return data.result ?? data;
  };
  const list = (args) => {
    const rows = [], seen = new Set();
    for (let page = 1; page <= 100; page++) {
      const batch = read([...args, "--page", String(page), "--per-page", "50"]);
      if (!Array.isArray(batch)) fail("Cloudflare list response is not an array");
      for (const row of batch) {
        if (!row.id || seen.has(row.id)) fail("Cloudflare pagination repeated a row or omitted its id");
        seen.add(row.id); rows.push(row);
      }
      if (batch.length < 50) return rows;
    }
    fail("Cloudflare pagination exceeded the safe limit; completeness is unknown");
  };
  return {
    organization: read(["organization", "get"]),
    applications: list(["access", "applications", "list"]),
    groups: list(["access", "rule-groups", "list"]),
    identityProviders: list(["identity-providers", "list"]),
  };
}

export function assertAccessProtection(protection) {
  const registry = readCanonicalRegistry();
  canonicalReviewers(protection, registry);
  const evidence = validateAccessState(protection, readAccessState(protection), registry);
  console.log(`protected preview: live Access app ${evidence.appId} protects ${evidence.hostname}; 24h, ${evidence.reviewers} DD reviewers.`);
  return evidence;
}

export function validateWorkerProtection(protection, worker) {
  if (worker.name !== protection.workerName || worker.subdomain?.enabled !== false || worker.subdomain?.previews_enabled !== false) fail("the live Worker still exposes workers.dev or version preview URLs");
  return worker.subdomain;
}

export function assertWorkerProtection(protection, run = spawnSync) {
  const result = run("cf", ["workers", "get", protection.workerName], { env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: protection.accountId }, encoding: "utf8", timeout: 60000, maxBuffer: 1024 * 1024 });
  if (result.status !== 0) fail("cannot verify the deployed Worker's alternate URLs");
  const data = JSON.parse(result.stdout);
  const subdomain = validateWorkerProtection(protection, data.result ?? data);
  console.log("protected preview: live workers.dev and version preview URLs are disabled.");
  return subdomain;
}

export async function probeProtectedPreview(protection, fetcher = fetch) {
  for (const path of protection.probePaths) {
    const response = await fetcher(`https://${protection.hostname}${path}`, { redirect: "manual", signal: AbortSignal.timeout(20000), headers: { "Cache-Control": "no-cache" } });
    let location;
    try { location = new URL(response.headers.get("location")); } catch { fail(`anonymous ${path} did not redirect to Access`); }
    if (response.status !== 302 || location.protocol !== "https:" || location.hostname !== protection.teamDomain || !location.pathname.startsWith("/cdn-cgi/access/login")) fail(`anonymous ${path} was not protected by the expected Access login`);
    console.log(`protected preview: anonymous ${path} -> Access login (302).`);
  }
}
