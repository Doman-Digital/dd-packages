// The whole command, with its outside world passed in, so tests can run it
// against a fixture project with no terminal, no network and no install.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { collectAnswers } from "./answers.js";
import { applyPlan } from "./apply.js";
import type { Exec } from "./apply.js";
import { USAGE, parseOptions } from "./args.js";
import { detectProject } from "./detect.js";
import { VISIBLE_PIECES } from "./handover.js";
import { readLabel, toolVersion } from "./label.js";
import type { StartInfo } from "./label.js";
import { formatPlan, hasWork, pendingWork, planScaffold, programmeIssueIn } from "./plan.js";
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
  /** The value of DD_CREATE_SITE_NO_GATE: the same as --no-gate, for a job that cannot pass the flag through. */
  noGateEnv?: string;
  /**
   * Asks the programme gate (dd-programme) whether the site may be scaffolded.
   * undefined when dd-programme is not installed, which refuses a real run.
   */
  gate?: (programme: string, kind: "stage05" | "handover") => Promise<{ ok: boolean; message: string }>;
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
      programme: options.programme,
    },
    file: options.answers,
    cwd: io.cwd,
    ask: options.yes || options.check ? undefined : io.ask,
  });
  if (typeof answers === "string") {
    io.err(`create-site: ${answers}`);
    return 2;
  }

  // A site that carries a label keeps its mode: --check and a re-run do not need the flags again.
  const existing = readLabel(root);
  const handover = options.handover || existing?.mode === "handover";
  const reason = options.reason ?? existing?.reason;
  const withPieces = options.handover ? options.with : (existing?.with ?? []);
  const programme = answers.programme ?? programmeIssueIn(root);
  const readOnly = options.check || options.dryRun;

  if (handover && !readOnly) {
    if (!reason || reason.trim().length < 10) {
      io.err('create-site: --handover needs --reason "<why this site is copied in, in a sentence>".');
      return 2;
    }
    if (!programme) {
      io.err("create-site: --handover needs --programme DOM-123, the Site handover programme in Linear.");
      return 2;
    }
  }

  // The gate: no scaffold before the programme says so. A dry run and --check never need it.
  let gateResult: boolean | undefined;
  if (!readOnly && !existing) {
    const kind = handover ? "handover" : "stage05";
    // The nightly starter job runs where dd-programme is not installed and sets the variable;
    // the label records the skip either way, so the registry sweep never counts it as started.
    if (options.noGate || io.noGateEnv === "1") {
      gateResult = false;
      io.err(`create-site: --no-gate skips the programme gate. The start label records it, and the estate sweep does not count this site as started.`);
    } else if (!programme) {
      io.err("create-site: name the programme with --programme DOM-123. Nothing is scaffolded before the programme gate passes.");
      return 1;
    } else if (!io.gate) {
      io.err(`create-site: cannot run the programme gate here (dd-programme is not installed). Run it where dd-programme is, or pass --no-gate and accept that the site is not counted as started.`);
      return 1;
    } else {
      const result = await io.gate(programme, kind);
      if (!result.ok) {
        io.err(`create-site: the programme gate for ${programme} did not pass, so nothing was written.\n${result.message}`);
        return 1;
      }
      gateResult = true;
    }
  }
  const start: StartInfo = {
    mode: handover ? "handover" : "programme",
    ...(handover ? { reason: reason?.trim(), handoverGate: gateResult } : { stage05Gate: gateResult }),
    with: withPieces.filter((w) => (VISIBLE_PIECES as readonly string[]).includes(w)),
    version: toolVersion(),
  };

  const today = io.now().toISOString().slice(0, 10);
  const plan = planScaffold(project, answers, { force: options.force, skipInstall: options.skipInstall, today, visibility: options.visibility, start });
  io.out(formatPlan(plan, answers.tradingName));
  if (options.check) {
    const work = pendingWork(plan);
    if (work.length === 0) {
      io.out("create-site --check: up to date.");
      return 0;
    }
    io.err(`create-site --check: ${work.length} thing(s) to do.\n${work.map((w) => `  ${w}`).join("\n")}`);
    return 3;
  }
  if (options.dryRun || !hasWork(plan)) return 0;

  const pending = applyPlan(plan, answers.tradingName, io.exec);
  const pm = project.packageManager === "npm" ? "npm run" : project.packageManager;
  if (handover) {
    io.out(
      [
        "",
        "Next (handover):",
        "  1. Fill in site.facts.ts from the live site: contact details, hours, accreditations, profiles. Unknown stays null.",
        "  2. Capture the live site's claims with dd-claims before anything else changes; keep every one.",
        "  3. Put <JsonLd graph={buildPageGraph(...)} /> on every page. That is invisible to visitors.",
        "  4. Redirects: every old URL that moved goes in redirects.json; run seo:check.",
        "  5. The build runs in handover mode: facts is blocking; the direction and mobile-first checks report only.",
        "     Anything a visitor can see (credit, cookie banner, analytics, legal pages, /press, /resources) needs the founder's yes",
        "     for this site, then re-run with --with <piece>.",
        ...pending.map((p) => `  Still to run: ${p}`),
      ].join("\n"),
    );
    return 0;
  }
  io.out(
    [
      "",
      "Next:",
      "  1. Fill in site.facts.ts: contact details, hours, accreditations, profiles. Unknown stays null.",
      "  2. Put <DesignerCredit /> and links to /privacy, /cookies, /terms and /accessibility in the footer,",
      "     <CookieBanner /> and <WebAnalytics /> once in the root layout, and <JsonLd graph={buildPageGraph(...)} /> on every page.",
      "     Put the site's Cloudflare Web Analytics token in site.facts.ts (webAnalytics.token); launch:check fails until it is set.",
      "     Fill in legal in site.facts.ts and have the client confirm the legal pages match what the business does.",
      "  3. Work through docs/seo-launch-checklist.md.",
      `  4. ${pm} seo:check now, and ${pm} launch:check before go-live.`,
      "  5. The build runs the site programme's gates (docs/site-programme.md) and refuses until the",
      "     programme issue, the Stage 05 direction and both sides of the sheet, and the Stage 06 copy deck exist.",
      `     Preview deploys go through ${pm} deploy:preview only; it measures at 1440 and 390 first.`,
      ...pending.map((p) => `  Still to run: ${p}`),
    ].join("\n"),
  );
  return 0;
}
