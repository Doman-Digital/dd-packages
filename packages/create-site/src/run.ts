// The whole command, with its outside world passed in, so tests can run it
// against a fixture project with no terminal, no network and no install.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { collectAnswers } from "./answers.js";
import { applyPlan } from "./apply.js";
import type { Exec } from "./apply.js";
import { USAGE, parseOptions } from "./args.js";
import { detectProject } from "./detect.js";
import { formatPlan, hasWork, planScaffold } from "./plan.js";
import { TEMPLATE_ROOT } from "./templates.js";

export type Io = {
  cwd: string;
  out: (text: string) => void;
  err: (text: string) => void;
  /** undefined when there is no terminal to ask. */
  ask: ((question: string) => Promise<string>) | undefined;
  exec: Exec;
  now: () => Date;
  userAgent?: string;
};

export async function run(argv: string[], io: Io): Promise<number> {
  const options = parseOptions(argv);
  if (typeof options === "string") {
    io.err(`create-site: ${options}\n\n${USAGE}`);
    return 2;
  }
  if (options.help) {
    io.out(USAGE);
    return 0;
  }
  if (options.version) {
    io.out((JSON.parse(readFileSync(`${TEMPLATE_ROOT}../package.json`, "utf8")) as { version: string }).version);
    return 0;
  }

  const root = resolve(io.cwd, options.dir ?? ".");
  const project = detectProject(root, io.userAgent);
  if (typeof project === "string") {
    io.err(`create-site: ${project}`);
    return 1;
  }

  const answers = await collectAnswers({
    flags: {
      legalName: options.client,
      tradingName: options.tradingName,
      siteUrl: options.siteUrl,
      sector: options.sector,
      description: options.description,
    },
    file: options.answers,
    cwd: io.cwd,
    ask: options.yes ? undefined : io.ask,
  });
  if (typeof answers === "string") {
    io.err(`create-site: ${answers}`);
    return 2;
  }

  const today = io.now().toISOString().slice(0, 10);
  const plan = planScaffold(project, answers, { force: options.force, skipInstall: options.skipInstall, today });
  io.out(formatPlan(plan, answers.tradingName));
  if (options.dryRun || !hasWork(plan)) return 0;

  const pending = applyPlan(plan, answers.tradingName, io.exec);
  const pm = project.packageManager === "npm" ? "npm run" : project.packageManager;
  io.out(
    [
      "",
      "Next:",
      "  1. Fill in site.facts.ts: contact details, hours, accreditations, profiles. Unknown stays null.",
      "  2. Put <DesignerCredit /> in the footer, and <JsonLd graph={buildPageGraph(...)} /> on every page.",
      "  3. Work through docs/seo-launch-checklist.md.",
      `  4. ${pm} seo:check now, and ${pm} launch:check before go-live.`,
      ...pending.map((p) => `  Still to run: ${p}`),
    ].join("\n"),
  );
  return 0;
}
