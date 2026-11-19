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

// Select only a named staging environment, retaining Wrangler's non-inherited bindings.
export function stagingConfig(config, environment) {
  if (environment == null) return config;
  if (environment !== "staging" || !config.env?.staging) fail("only an existing staging environment is supported");
  const { env, ...base } = config;
  const selected = env.staging;
  for (const key of ["vars", "d1_databases", "kv_namespaces", "r2_buckets", "services", "queues", "durable_objects", "triggers"]) delete base[key];
  if (selected.vars?.ENVIRONMENT !== "staging" || selected.vars?.REVIEW_INVITATIONS_ENABLED === "true" || selected.triggers?.crons?.length) fail("staging must disable production mode, invitations and scheduled jobs");
  return { ...base, ...selected };
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

// Registered named exceptions: exact lower-case addresses, each with a reason.
export function outsideAddresses(gate) {
  const rows = gate.allow_outside_domain ?? [];
  if (!Array.isArray(rows)) fail("allow_outside_domain must be a list");
  const emails = rows.map(row => {
    if (!row || typeof row.email !== "string" || row.email !== row.email.toLowerCase() || !/^[^\s@*]+@[^\s@*]+\.[^\s@*]+$/.test(row.email)) fail("each allow_outside_domain entry needs one exact lower-case email");
    if (typeof row.why !== "string" || !row.why.trim()) fail(`allow_outside_domain ${row.email} has no reason`);
    return row.email;
  });
  if (new Set(emails).size !== emails.length) fail("allow_outside_domain repeats an address");
  return emails.sort();
}

export function canonicalReviewers(protection, registry) {
  const gate = registry.gates?.[protection.gateKey];
  if (!gate || !gate.worker || gate.worker !== protection.workerName || gate.account !== protection.accountId || gate.app !== protection.appName || `${gate.team}.cloudflareaccess.com` !== protection.teamDomain || !same(gate.hosts, [protection.hostname]) || gate.session !== "24h") fail("settings do not match the merged canonical Access registry");
  const groups = [...new Set([...(registry.default_groups || []), ...(gate.groups || [])])];
  if (!same(groups, ["Doman Digital reviewers"]) || !empty(gate.allow)  || !empty(gate.service_tokens)) fail("the registered gate must allow only the DD reviewer group and its registered outside-domain addresses");
  outsideAddresses(gate);
  const callbacks = gate.bypass || [];
  if (callbacks.some(b => !/^\/api\/(?:webhooks\/[a-z0-9-]+|revalidate)$/.test(b.path || "") || !b.why || !b.authProbe || b.authProbe.method !== "POST" || ![400, 401, 403].includes(b.authProbe.status))) fail("callback exceptions require exact API paths and an unsigned POST rejection probe");
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

export function matchesHost(destination, hostname) {
  const host = destination.split("/")[0].toLowerCase();
  // A `*` matches any run of characters. Done by hand, not with a RegExp built
  // from the registry, so no pattern is ever compiled from data.
  const parts = host.split("*");
  if (parts.length === 1) return host === hostname;
  const first = parts[0];
  const last = parts[parts.length - 1];
  if (!hostname.startsWith(first)) return false;
  let at = first.length;
  for (const part of parts.slice(1, -1)) {
    const found = hostname.indexOf(part, at);
    if (found < 0) return false;
    at = found + part.length;
  }
  return hostname.length - last.length >= at && hostname.endsWith(last);
}

export function validateAccessState(protection, state, registry) {
  const reviewers = canonicalReviewers(protection, registry);
  const { hostname, appName, reviewerGroupId, teamDomain } = protection;
  if (state.organization.auth_domain !== teamDomain) fail("the live Zero Trust team does not match");
  const apps = state.applications.filter(app => publicDestinations(app).some(d => matchesHost(d, hostname)));
  const callbacks = registry.gates[protection.gateKey].bypass || [];
  if (apps.length !== 1 + callbacks.length) fail("unexpected overlapping or path-specific Access app");
  for (const callback of callbacks) {
    const domain = `${hostname}${callback.path}`;
    const match = apps.filter(a => a.domain === domain);
    const bypass = match[0];
    if (match.length !== 1 || bypass.type !== "self_hosted" || !same(bypass.destinations, [{type: "public", uri: domain}]) || bypass.policies?.length !== 1) fail("callback Access app does not match the canonical exact path");
    const policy = bypass.policies[0];
    if (policy.decision !== "bypass" || !same(policy.include, [{everyone: {}}]) || !empty(policy.exclude) || !empty(policy.require)) fail("callback must carry only its registered bypass policy");
  }
  const rootApps = apps.filter(a => a.domain === hostname);
  if (rootApps.length !== 1) fail("exactly one root reviewer app is required");
  const app = rootApps[0];
  if (app.name !== appName || app.type !== "self_hosted" || app.domain !== hostname || !same(app.destinations, [{ type: "public", uri: hostname }]) || app.session_duration !== "24h") fail("live Access app does not match the exact staging hostname and 24h session");
  if (!Array.isArray(app.policies) || app.policies.length !== 1) fail("exactly one reviewer allow policy is required");
  const policy = app.policies[0];
  const outside = outsideAddresses(registry.gates[protection.gateKey]);
  const wanted = [JSON.stringify({ group: { id: reviewerGroupId } }), ...outside.map(email => JSON.stringify({ email: { email } }))].sort();
  const have = Array.isArray(policy.include) ? policy.include.map(rule => JSON.stringify(rule)).sort() : null;
  if (policy.decision !== "allow" || !same(have, wanted) || !empty(policy.exclude) || !empty(policy.require) || policy.session_duration !== "24h") fail("live policy must allow only the reviewer group and registered outside-domain addresses for 24h; no bypass or service token");
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
  const domains = worker.references?.domains;
  if (!Array.isArray(domains) || domains.some(domain => (domain.hostname ?? domain.domain ?? domain.name) !== protection.hostname)) fail("the live Worker has an unexpected custom domain, or domain readback is missing");
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

export async function probeCallbacks(protection, registry = readCanonicalRegistry(), fetcher = fetch) {
  canonicalReviewers(protection, registry);
  for (const callback of registry.gates[protection.gateKey].bypass || []) {
    const response = await fetcher(`https://${protection.hostname}${callback.path}`, {method: "POST", body: "{}", headers: {"Content-Type": "application/json"}, redirect: "manual", signal: AbortSignal.timeout(20000)});
    if (response.status !== callback.authProbe.status) fail(`unsigned callback ${callback.path} did not reject with ${callback.authProbe.status}`);
  }
}
