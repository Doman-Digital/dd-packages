import { parseArgs } from "node:util";

export type Options = {
  dir: string | undefined;
  client: string | undefined;
  tradingName: string | undefined;
  siteUrl: string | undefined;
  sector: string | undefined;
  description: string | undefined;
  answers: string | undefined;
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
              [--description "<one or two sentences>"] [--answers <file.json>]
              [--visibility private|public] [--dry-run] [--check] [--force]
              [--skip-install] [--yes] [--help] [--version]

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
        answers: { type: "string" },
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
    return {
      dir: positionals[0],
      client: values.client,
      tradingName: values["trading-name"],
      siteUrl: values["site-url"],
      sector: values.sector,
      description: values.description,
      answers: values.answers,
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
