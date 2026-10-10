// Stages 06 to 08: the only deploy this site has until the Stage 09 release
// decision, and it can only make a preview. It sets PUBLIC_PREVIEW=1 (and
// NEXT_PUBLIC_PREVIEW=1) itself, so nobody has to remember to; builds, which
// runs every build gate; serves the build locally and measures it at 1440 and
// 390 with --preview (noindex required); and only then deploys, preview only:
//
//   cloudflare  wrangler deploy, refused while the wrangler config carries a
//               route, a custom domain or workers_dev: false
//   vercel      vercel deploy, never --prod
//
// The host is preview.host in site.programme.json, or found from the
// wrangler config or .vercel/project.json. Going live is a separate,
// recorded decision in Stage 09; nothing here can do it. --dry-run does
// everything but the deploy.
//
// Lifted from the build:preview and deploy:preview scripts and wrangler.jsonc
// of apps/site in Doman-Digital (DOM-647).

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { programme, root, stop } from "./programme.mjs";

const GATE = "deploy-preview";
if (process.argv.includes("--prod")) stop(GATE, "09", "this script never deploys to production. Going live is the Stage 09 release decision.");
const dryRun = process.argv.includes("--dry-run");
const { preview = {} } = programme();
const env = { ...process.env, PUBLIC_PREVIEW: "1", NEXT_PUBLIC_PREVIEW: "1" };
const bin = (name) => join(root, "node_modules", ".bin", name);

const wranglerFile = ["wrangler.jsonc", "wrangler.json", "wrangler.toml"].find((f) => existsSync(join(root, f)));
const host = preview.host ?? (wranglerFile ? "cloudflare" : existsSync(join(root, ".vercel", "project.json")) ? "vercel" : null);
if (!host) stop(GATE, "06", "no preview host. Set preview.host in site.programme.json to cloudflare or vercel.");

if (host === "cloudflare") {
  if (!wranglerFile) stop(GATE, "06", "preview.host is cloudflare but there is no wrangler config.");
  // Comments out, so a commented-out route still counts as no route.
  const text = readFileSync(join(root, wranglerFile), "utf8").replace(/^\s*(\/\/|#).*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  if (/["']?\broutes?\b["']?\s*[:=]/.test(text)) stop(GATE, "06", `${wranglerFile} carries a route. A preview has none: the live domain is attached only by the Stage 09 release.`);
  if (/custom_domain/.test(text)) stop(GATE, "06", `${wranglerFile} carries a custom domain. A preview has none.`);
  if (/workers_dev["']?\s*[:=]\s*false/.test(text)) stop(GATE, "06", `${wranglerFile} sets workers_dev to false, so a preview would have no address.`);
} else if (host !== "vercel") {
  stop(GATE, "06", `preview.host is ${host}; this script knows cloudflare and vercel.`);
}

// The package manager that ran this script, so the build is the one `build` names.
const pm = process.env.npm_execpath;
const build = pm ? spawnSync(process.execPath, [pm, "run", "build"], { cwd: root, env, stdio: "inherit" }) : spawnSync("npm", ["run", "build"], { cwd: root, env, stdio: "inherit" });
if (build.status !== 0) stop(GATE, "06", "the preview build failed. Nothing was deployed.");

const measured = spawnSync(process.execPath, [join(root, "scripts", "gates", "measure.mjs"), "--serve", "--preview"], { cwd: root, env, stdio: "inherit" });
if (measured.status !== 0) stop(GATE, "06", "the measurement failed. Nothing was deployed.");

if (dryRun) {
  console.log(`${GATE}: built and measured; --dry-run, so nothing was deployed.`);
  process.exit(0);
}
const deploy =
  host === "cloudflare"
    ? spawnSync(existsSync(bin("wrangler")) ? bin("wrangler") : "npx", existsSync(bin("wrangler")) ? ["deploy"] : ["wrangler", "deploy"], { cwd: root, env, stdio: "inherit" })
    : spawnSync("npx", ["vercel", "deploy", "--build-env", "PUBLIC_PREVIEW=1", "--build-env", "NEXT_PUBLIC_PREVIEW=1", "--env", "PUBLIC_PREVIEW=1", "--env", "NEXT_PUBLIC_PREVIEW=1"], { cwd: root, env, stdio: "inherit" });
if (deploy.status !== 0) stop(GATE, "06", `the ${host} deploy failed.`);
console.log(`${GATE}: measured and deployed to a ${host} preview. The live site is untouched.`);
