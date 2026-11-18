import { parseArgs } from "node:util";
import { VISIBLE_PIECES } from "./handover.js";

export type Options = {
  dir: string | undefined;
  client: string | undefined;
  tradingName: string | undefined;
  siteUrl: string | undefined;
  sector: string | undefined;
  description: string | undefined;
  programme: string | undefined;
  answers: string | undefined;
  handover: boolean;
  reason: string | undefined;
  /** Visible pieces a handover adds (--with credit,consent,...). Empty: invisible layers only. */
  with: string[];
  /** Skip the programme gate. Recorded in the start label, and the registry sweep treats it as not started. */
  noGate: boolean;
  dryRun: boolean;
  check: boolean;
  visibility: "private" | "public";
  force: boolean;
  skipInstall: boolean;
  yes: boolean;
  help: boolean;
  version: boolean;
};

export const USAGE = `create-site: start a Doman Digital client site on the house foundation.

Run it inside a fresh Next.js (App Router) or Astro TypeScript project:
  pnpm create next-app@latest acme && cd acme && pnpm create @domandigital/site
  npm create @domandigital/site@latest -- --dry-run      (npm needs the --)

Usage
  create-site [dir] [--client <legal name>] [--trading-name <name>]
              [--site-url <https://...>] [--sector trades|beauty|clinics|professional]
              [--description "<one or two sentences>"] [--programme DOM-123]
              [--answers <file.json>] [--visibility private|public]
              [--handover --reason "<why>" [--with credit,consent,analytics,legal,press,resources]]
              [--no-gate] [--dry-run] [--check] [--force] [--skip-install] [--yes] [--help] [--version]

--programme     The site's programme issue in Linear, opened from the Site programme
                template. The build refuses to run until site.programme.json names it.
                A real run first passes the programme gate: Stage 05 accepted
                (dd-programme gate DOM-123 --stage 05), so nothing is scaffolded early.
--handover      Start an existing live site that is being copied in (an Astro handover).
                Needs --programme (a Site handover programme) and --reason. It adds the
                invisible layers only (facts, routes, redirects, JSON-LD, SEO tests, gates
                in advisory mode) and keeps the client's look and copy. Anything a visitor
                can see is added only when named in --with, one site at a time.
--with          A handover's visible pieces: credit (Website by Doman Digital), consent
                (cookie banner), analytics (Cloudflare Web Analytics), legal (privacy,
                cookies, terms, accessibility), press, resources.
--no-gate       Skip the programme gate (the nightly starter check and tests). The start
                label records it, and the estate sweep does not count the site as started.
--dry-run       Print the plan and stop. Writes nothing, runs nothing.
--check         Like --dry-run, never prompts, and exits 3 when there is work to do,
                a house file that differs from its template included. For CI.
--visibility    The GitHub repo's visibility (default private). Decides the runner
                the CI workflow names, so it passes dd doctor either way.
--force         Replace house template files that differ. Data files (the facts,
                routes, links, redirects, DIRECTION and baseline) are never replaced.
--skip-install  Write the package ranges into package.json instead of installing.
--yes           Never prompt. Missing required answers are an error, not a guess.

Exit codes: 0 done, 1 refused (nothing written), 2 usage error,
3 --check found work to do.`;

export function parseOptions(argv: string[]): Options | string {
  try {
    const { values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        client: { type: "string" },
        "trading-name": { type: "string" },
        "site-url": { type: "string" },
        sector: { type: "string" },
        description: { type: "string" },
        programme: { type: "string" },
        answers: { type: "string" },
        handover: { type: "boolean", default: false },
        reason: { type: "string" },
        with: { type: "string" },
        "no-gate": { type: "boolean", default: false },
        "dry-run": { type: "boolean", default: false },
        check: { type: "boolean", default: false },
        visibility: { type: "string", default: "private" },
        force: { type: "boolean", default: false },
        "skip-install": { type: "boolean", default: false },
        yes: { type: "boolean", short: "y", default: false },
        help: { type: "boolean", short: "h", default: false },
        version: { type: "boolean", default: false },
      },
    });
    if (positionals.length > 1) return `one directory at most, got ${positionals.length}`;
    if (values.visibility !== "private" && values.visibility !== "public") return `--visibility is private or public, not ${values.visibility}`;
    const withList = values.with ? values.with.split(",").map((w) => w.trim()).filter(Boolean) : [];
    const bad = withList.filter((w) => !(VISIBLE_PIECES as readonly string[]).includes(w));
    if (bad.length) return `--with takes ${VISIBLE_PIECES.join(", ")}, not ${bad.join(", ")}`;
    if (withList.length && !values.handover) return "--with is for --handover: a new build adds every piece";
    if (values.reason && !values.handover) return "--reason is for --handover";
    return {
      dir: positionals[0],
      client: values.client,
      tradingName: values["trading-name"],
      siteUrl: values["site-url"],
      sector: values.sector,
      description: values.description,
      programme: values.programme,
      answers: values.answers,
      handover: values.handover ?? false,
      reason: values.reason,
      with: [...new Set(withList)],
      noGate: values["no-gate"] ?? false,
      dryRun: values["dry-run"] ?? false,
      check: values.check ?? false,
      visibility: values.visibility,
      force: values.force ?? false,
      skipInstall: values["skip-install"] ?? false,
      yes: values.yes ?? false,
      help: values.help ?? false,
      version: values.version ?? false,
    };
  } catch (error) {
    return (error as Error).message;
  }
}
