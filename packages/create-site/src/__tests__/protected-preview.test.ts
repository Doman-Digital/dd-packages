import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vitest";
// Generated gates are plain JS, shared with the deployed sites.
// @ts-expect-error template module is intentionally untyped
import { parseJsonc, validateProtectedConfig, validateAccessState, probeProtectedPreview, readAccessState, canonicalReviewers, validateWorkerProtection } from "../../templates/shared/scripts/gates/protected-preview.mjs";

const protection = {
  gateKey: "fixture-preview",
  workerName: "private-review",
  hostname: "staging.example.com", accountId: "a".repeat(32), appName: "Private review",
  teamDomain: "review.cloudflareaccess.com", reviewerGroupId: "a1e88a9f-4b88-4604-95e9-808cc5543bb9",
  probePaths: ["/", "/collection/R048/", "/emblem.svg"],
};
const registry = {
  default_groups: ["Doman Digital reviewers"],
  groups: { "Doman Digital reviewers": ["admin", "owner", "reviewer"].map(n => `${n}@domandigital.co.uk`) },
  gates: { [protection.gateKey]: { worker: protection.workerName, account: protection.accountId, app: protection.appName, team: "review", hosts: [protection.hostname], session: "24h" } },
};
const wrangler = () => ({ name: "private-review", account_id: protection.accountId, workers_dev: false, preview_urls: false, routes: [{ pattern: protection.hostname, custom_domain: true }] });
const state = () => ({
  organization: { auth_domain: protection.teamDomain },
  applications: [{ id: "app", name: protection.appName, type: "self_hosted", domain: protection.hostname,
    destinations: [{ type: "public", uri: protection.hostname }], session_duration: "24h", allowed_idps: ["pin", "cf"],
    policies: [{ decision: "allow", include: [{ group: { id: protection.reviewerGroupId } }], exclude: [], require: [], session_duration: "24h" }],
  }],
  groups: [{ id: protection.reviewerGroupId, name: "Doman Digital reviewers", exclude: [], require: [], include: ["reviewer", "admin", "owner"].map(name => ({ email: { email: `${name}@domandigital.co.uk` } })) }],
  identityProviders: [{ id: "pin", type: "onetimepin" }, { id: "cf", type: "cloudflare" }],
});

describe("protected staging boundaries", () => {
  test("parses JSONC without corrupting URLs and rejects malformed comments", () => {
    expect(parseJsonc('{ // comment\n "url":"https://example.com/a/*b*/,}", /* comment */ "items":[1,], }')).toEqual({ url: "https://example.com/a/*b*/,}", items: [1] });
    expect(() => parseJsonc('{/* missing')).toThrow();
  });
  test("accepts an exact staging hostname with alternate public URLs disabled", () => {
    expect(validateProtectedConfig(wrangler(), protection)).toBe(protection);
    expect(validateAccessState(protection, state(), registry)).toMatchObject({ hostname: protection.hostname, reviewers: 3 });
  });
  for (const hostname of ["example.com", "www.example.com", "*.example.com", "staging.example.com/path", "staging.example.com/*", "staging.localhost", "staging.example.com.evil/path"]) {
    test(`refuses unsafe hostname ${hostname}`, () => expect(() => validateProtectedConfig(wrangler(), { ...protection, hostname })).toThrow());
  }
  for (const [name, change] of Object.entries({
    workers: (w: any): unknown => w.workers_dev = true,
    previews: (w: any): unknown => w.preview_urls = true,
    implicitPreviews: (w: any): unknown => delete w.preview_urls,
    account: (w: any): unknown => w.account_id = "b".repeat(32),
    production: (w: any): unknown => w.routes.push({ pattern: "example.com", custom_domain: true }),
    route: (w: any): unknown => w.route = "example.com/*",
    environment: (w: any): unknown => w.env = { production: {} },
    worker: (w: any): unknown => w.name = "production",
  })) test(`refuses ${name}`, () => { const w = wrangler(); change(w); expect(() => validateProtectedConfig(w, protection)).toThrow(); });

  for (const [name, change] of Object.entries({
    missingApp: (s: any): unknown => s.applications = [],
    wrongTeam: (s: any): unknown => s.organization.auth_domain = "other.cloudflareaccess.com",
    pathBypass: (s: any): unknown => s.applications.push({ domain: "staging.example.com/assets", policies: [{ decision: "bypass" }] }),
    wildcardBypass: (s: any): unknown => s.applications.push({ domain: "*.example.com", policies: [{ decision: "bypass" }] }),
    everyone: (s: any): unknown => s.applications[0].policies[0].include = [{ everyone: {} }],
    bypass: (s: any): unknown => s.applications[0].policies[0].decision = "bypass",
    serviceToken: (s: any): unknown => s.applications[0].policies.push({ decision: "non_identity" }),
    longSession: (s: any): unknown => s.applications[0].session_duration = "720h",
    broadGroup: (s: any): unknown => s.groups[0].include.push({ email_domain: { domain: "domandigital.co.uk" } }),
    extraEmail: (s: any): unknown => s.groups[0].include.push({ email: { email: "stranger@example.com" } }),
    wrongProvider: (s: any): unknown => s.identityProviders[0].type = "google",
    missingGroupRules: (s: any): unknown => delete s.groups[0].include,
  })) test(`refuses live Access drift: ${name}`, () => { const s = state(); change(s); expect(() => validateAccessState(protection, s, registry)).toThrow(); });

  test("the merged canonical registry is the only source of intended reviewers", () => {
    expect(canonicalReviewers(protection, registry)).toEqual(registry.groups["Doman Digital reviewers"]);
    expect(() => canonicalReviewers(protection, { ...registry, gates: {} })).toThrow();
    const changed = structuredClone(registry); changed.groups["Doman Digital reviewers"].pop();
    expect(() => validateAccessState(protection, state(), changed)).toThrow();
  });

  test("requires live readback of both alternate Worker URLs disabled", () => {
    const worker = { name: protection.workerName, subdomain: { enabled: false, previews_enabled: false } };
    expect(validateWorkerProtection(protection, worker)).toEqual(worker.subdomain);
    for (const subdomain of [{ enabled: true, previews_enabled: false }, { enabled: false, previews_enabled: true }, { enabled: false }, undefined]) {
      expect(() => validateWorkerProtection(protection, { ...worker, subdomain })).toThrow();
    }
  });

  test("reads all pages and rejects repeated pagination", () => {
    const visited: string[] = [];
    const run = (_bin: string, args: string[]) => {
      const resource = args[1], page = Number(args[args.indexOf("--page") + 1]);
      visited.push(args.join(" "));
      const output = resource === "organization" ? {} : page === 1 ? Array.from({ length: 50 }, (_, i) => ({ id: `first-${i}` })) : [{ id: "last" }];
      return { status: 0, stdout: JSON.stringify(output) };
    };
    const read = readAccessState(protection, run);
    expect(read.applications).toHaveLength(51); expect(read.groups).toHaveLength(51); expect(read.identityProviders).toHaveLength(51);
    expect(visited.filter(v => v.includes("--page 2"))).toHaveLength(3);
    expect(() => readAccessState(protection, () => ({ status: 0, stdout: JSON.stringify(Array.from({ length: 50 }, (_, i) => ({ id: String(i) }))) }))).toThrow(/pagination/);
  });

  test("probes every path anonymously and only accepts the exact team's login redirect", async () => {
    const calls: string[] = [];
    await probeProtectedPreview(protection, async (url: string, opts: any) => {
      calls.push(url); expect(opts.redirect).toBe("manual"); expect(opts.headers.Authorization).toBeUndefined();
      return new Response(null, { status: 302, headers: { location: `https://${protection.teamDomain}/cdn-cgi/access/login/example` } });
    });
    expect(calls).toEqual(protection.probePaths.map(path => `https://${protection.hostname}${path}`));
    for (const [status, location] of [[200, ""], [302, "https://other.cloudflareaccess.com/cdn-cgi/access/login"], [302, `https://${protection.teamDomain}/other`], [302, `http://${protection.teamDomain}/cdn-cgi/access/login`]] as const) {
      await expect(probeProtectedPreview(protection, async () => new Response(null, { status, headers: { location } }))).rejects.toThrow();
    }
  });
});

const roots: string[] = [];
afterAll(() => roots.forEach(root => rmSync(root, { recursive: true, force: true })));
test("deployment refuses unsafe live Access before build or upload, and dry-run still measures a valid gate", () => {
  for (const valid of [false, true]) {
    const root = mkdtempSync(join(tmpdir(), "protected-preview-")); roots.push(root);
    mkdirSync(join(root, "scripts/gates"), { recursive: true });
    const templates = fileURLToPath(new URL("../../templates/shared/scripts/gates/", import.meta.url));
    for (const name of ["programme.mjs", "deploy-preview.mjs", "protected-preview.mjs"]) cpSync(join(templates, name), join(root, "scripts/gates", name));
    writeFileSync(join(root, "site.programme.json"), JSON.stringify({ preview: { host: "cloudflare", protected: protection } }));
    writeFileSync(join(root, "wrangler.json"), JSON.stringify(wrangler()));
    writeFileSync(join(root, "pm.js"), "require('fs').writeFileSync('built', 'yes')");
    writeFileSync(join(root, "scripts/gates/measure.mjs"), "import fs from 'node:fs'; fs.writeFileSync('measured', 'yes');");
    mkdirSync(join(root, "bin"));
    writeFileSync(join(root, "bin/git"), `#!/usr/bin/env node\nconsole.log(${JSON.stringify(JSON.stringify(registry))});`, { mode: 0o755 });
    const s = state(); if (!valid) s.applications[0].policies[0].decision = "bypass";
    writeFileSync(join(root, "bin/cf"), `#!/usr/bin/env node\nconst s=${JSON.stringify(s)}; const args=process.argv.join(' '); console.log(JSON.stringify(args.includes('organization')?s.organization:args.includes('applications')?s.applications:args.includes('rule-groups')?s.groups:s.identityProviders));`, { mode: 0o755 });
    const r = spawnSync(process.execPath, [join(root, "scripts/gates/deploy-preview.mjs"), "--dry-run"], { cwd: root, encoding: "utf8", env: { ...process.env, PATH: `${join(root, "bin")}:${process.env.PATH}`, npm_execpath: join(root, "pm.js") } });
    expect(r.status, r.stdout + r.stderr).toBe(valid ? 0 : 1);
    expect(existsSync(join(root, "built"))).toBe(valid);
    expect(existsSync(join(root, "measured"))).toBe(valid);
  }
});
