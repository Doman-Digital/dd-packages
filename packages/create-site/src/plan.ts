// Works out everything the scaffold would do, without doing any of it. Pure
// apart from reading the project, so --dry-run and the real run print the
// same plan, and a second run can prove it has nothing left to do.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Answers } from "./answers.js";
import { layoutFor } from "./adapters.js";
import { MANUAL_INSTRUCTIONS, patchConfig } from "./config-patch.js";
import type { Project } from "./detect.js";
import { hasDependency, patchPackageJson } from "./package-json.js";
import { renderFacts, renderLinks, renderRedirects, renderRoutes } from "./render/data.js";
import { renderBaseline, renderChecklist, renderDirection, renderHouseMd, renderWorkflow } from "./render/docs.js";
import { readTemplate, rewriteSiteImports } from "./templates.js";
import { HOUSE_DEPENDENCIES, HOUSE_DEV_DEPENDENCIES } from "./versions.js";
import * as nextRoutes from "../templates/next/tests/seo/routes-on-disk.js";
import * as astroRoutes from "../templates/astro/tests/seo/routes-on-disk.js";

export type FileAction = "create" | "unchanged" | "skip-exists" | "overwrite" | "keep-data";

export type PlannedFile = {
  path: string;
  contents: string;
  /** Data files belong to the site from the first day and are never replaced. */
  data: boolean;
  action: FileAction;
};

export type Command = { cmd: string; args: string[] };

export type Plan = {
  project: Project;
  files: PlannedFile[];
  packageJson: { text: string; changes: string[] } | null;
  config: { file: string; text: string } | null;
  /** CLAUDE.md gains an import of docs/HOUSE.md; it is created if missing, never replaced. */
  claudeMd: { text: string; created: boolean } | null;
  commands: Command[];
  /** Run `craft direction init` after the install, via the installed bin. */
  craftInit: boolean;
  notes: string[];
};

export type PlanOptions = { force: boolean; skipInstall: boolean; today: string };

const PM_ADD: Record<Project["packageManager"], { add: string[]; dev: string }> = {
  pnpm: { add: ["add"], dev: "-D" },
  npm: { add: ["install"], dev: "--save-dev" },
  yarn: { add: ["add"], dev: "-D" },
  bun: { add: ["add"], dev: "-d" },
};

const HOUSE_IMPORT = "@docs/HOUSE.md";

const specs = (deps: Record<string, string>) => Object.entries(deps).map(([name, range]) => `${name}@${range}`);

function hasWorkflows(root: string): boolean {
  const dir = join(root, ".github", "workflows");
  return existsSync(dir) && readdirSync(dir).some((f) => /\.ya?ml$/.test(f));
}

function actionFor(root: string, path: string, contents: string, data: boolean, force: boolean): FileAction {
  const abs = join(root, path);
  if (!existsSync(abs)) return "create";
  if (readFileSync(abs, "utf8") === contents) return "unchanged";
  if (data) return "keep-data";
  return force ? "overwrite" : "skip-exists";
}

export function planScaffold(project: Project, answers: Answers, options: PlanOptions): Plan {
  const { root } = project;
  const layout = layoutFor(project);
  const notes: string[] = [];
  if (project.packageManagerWarning) notes.push(project.packageManagerWarning);

  const files: Omit<PlannedFile, "action">[] = [];

  for (const t of layout.templates) {
    if (t.template.endsWith("config.test.ts") && !project.configFile) {
      notes.push(`no ${project.framework} config file, so tests/seo/config.test.ts was not written: ${MANUAL_INSTRUCTIONS[project.framework]}`);
      continue;
    }
    files.push({ path: t.dest, contents: rewriteSiteImports(readTemplate(t.template), t.dest, layout.siteKeys), data: false });
  }

  const adapterSpec = `./${layout.siteKeys["site-adapter"]!.replace(/\.ts$/, "")}`;
  const enumerate = project.framework === "next" ? nextRoutes : astroRoutes;
  files.push(
    { path: "site.facts.ts", contents: renderFacts(answers, adapterSpec), data: true },
    { path: "site.routes.ts", contents: renderRoutes(enumerate.routesOnDisk(root), enumerate.dynamicRoutesOnDisk(root)), data: true },
    { path: "links.json", contents: renderLinks(), data: true },
    { path: "redirects.json", contents: renderRedirects(), data: true },
    { path: "docs/HOUSE.md", contents: renderHouseMd(answers, project), data: false },
    { path: "docs/DIRECTION.md", contents: renderDirection(answers, options.today), data: true },
    { path: "docs/seo-launch-checklist.md", contents: renderChecklist(answers), data: true },
    { path: "docs/seo-baseline.md", contents: renderBaseline(answers, options.today), data: true },
  );

  const workflowPath = ".github/workflows/seo-check.yml";
  const workflow = renderWorkflow(project);
  if (existsSync(join(root, workflowPath)) || (workflow && !hasWorkflows(root))) {
    if (workflow) files.push({ path: workflowPath, contents: workflow, data: false });
  } else if (!workflow) {
    notes.push(`no CI workflow written for ${project.packageManager}: run seo:check in your CI`);
  } else {
    notes.push(`this project already has CI workflows, so ${workflowPath} was not added: run seo:check in yours`);
  }

  const planned = files.map((f) => ({ ...f, action: actionFor(root, f.path, f.contents, f.data, options.force) }));
  for (const f of planned) {
    if (f.action === "keep-data" && options.force) notes.push(`${f.path} is yours and was kept (--force never replaces data files)`);
  }

  const pkg = patchPackageJson(
    project.packageJson,
    {
      scripts: { "seo:check": "vitest run tests/seo tests/house.test.ts", "launch:check": "vitest run tests --mode launch" },
      scriptsIfMissing: { test: "vitest run" },
      dependencies: options.skipInstall ? { ...HOUSE_DEPENDENCIES } : {},
      devDependencies: options.skipInstall ? { ...HOUSE_DEV_DEPENDENCIES } : {},
    },
    options.force,
  );

  const commands: Command[] = [];
  if (!options.skipInstall) {
    const pm = PM_ADD[project.packageManager];
    const missing = (deps: Record<string, string>) =>
      Object.fromEntries(Object.entries(deps).filter(([name]) => !hasDependency(project.packageJson, name)));
    const deps = missing(HOUSE_DEPENDENCIES);
    const dev = missing(HOUSE_DEV_DEPENDENCIES);
    if (Object.keys(deps).length) commands.push({ cmd: project.packageManager, args: [...pm.add, ...specs(deps)] });
    if (Object.keys(dev).length) commands.push({ cmd: project.packageManager, args: [...pm.add, pm.dev, ...specs(dev)] });
  }

  let config: Plan["config"] = null;
  if (project.configFile) {
    const patched = patchConfig(project.framework, project.configFile, readFileSync(join(root, project.configFile), "utf8"));
    if (patched.kind === "patched") config = { file: project.configFile, text: patched.text };
    if (patched.kind === "manual") notes.push(`${patched.reason}: ${MANUAL_INSTRUCTIONS[project.framework]}. tests/seo/config.test.ts fails until it does.`);
  }

  // create-next-app writes its own CLAUDE.md ("@AGENTS.md"), so the house
  // rules live in docs/HOUSE.md and CLAUDE.md imports them.
  const claudePath = join(root, "CLAUDE.md");
  const claudeText = existsSync(claudePath) ? readFileSync(claudePath, "utf8") : null;
  const claudeMd =
    claudeText === null
      ? { text: `${HOUSE_IMPORT}\n`, created: true }
      : claudeText.includes(HOUSE_IMPORT)
        ? null
        : { text: `${claudeText.trimEnd()}\n${HOUSE_IMPORT}\n`, created: false };

  const artDirection = existsSync(join(root, "art-direction.json"));
  const craftInstalled = existsSync(join(root, "node_modules", "@domandigital", "craft", "package.json"));
  const craftInit = !artDirection && (craftInstalled || commands.length > 0);
  if (!artDirection && !craftInit) notes.push(`after installing, run: npx craft direction init --client ${JSON.stringify(answers.tradingName)}`);

  return {
    project,
    files: planned,
    packageJson: pkg.changes.length ? pkg : null,
    config,
    claudeMd,
    commands,
    craftInit,
    notes,
  };
}

export function hasWork(plan: Plan): boolean {
  return (
    plan.files.some((f) => f.action === "create" || f.action === "overwrite") ||
    plan.packageJson !== null ||
    plan.config !== null ||
    plan.claudeMd !== null ||
    plan.commands.length > 0 ||
    plan.craftInit
  );
}

const LABEL: Record<FileAction, string> = {
  create: "create   ",
  unchanged: "unchanged",
  "skip-exists": "differs  ",
  overwrite: "replace  ",
  "keep-data": "keep     ",
};

const SUFFIX: Partial<Record<FileAction, string>> = {
  "skip-exists": " (differs from the house template: --force to replace)",
  "keep-data": " (yours: never replaced)",
};

export function formatPlan(plan: Plan, clientName: string): string {
  const { project } = plan;
  const where = project.framework === "next" ? `Next.js, ${project.routesDir}/` : "Astro, src/pages/";
  const lines = [`create-site: ${where}, ${project.packageManager}`];
  for (const f of plan.files) lines.push(`  ${LABEL[f.action]}  ${f.path}${SUFFIX[f.action] ?? ""}`);
  if (plan.packageJson) lines.push(`  patch      package.json: ${plan.packageJson.changes.join(", ")}`);
  if (plan.config) lines.push(`  patch      ${plan.config.file}: serve redirects.json`);
  if (plan.claudeMd) lines.push(`  ${plan.claudeMd.created ? "create   " : "patch    "}  CLAUDE.md: import docs/HOUSE.md`);
  for (const c of plan.commands) lines.push(`  run        ${c.cmd} ${c.args.join(" ")}`);
  if (plan.craftInit) lines.push(`  run        craft direction init --client ${JSON.stringify(clientName)}`);
  for (const note of plan.notes) lines.push(`  note       ${note}`);
  if (!hasWork(plan)) lines.push("  nothing to do");
  return lines.join("\n");
}
