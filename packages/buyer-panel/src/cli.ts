#!/usr/bin/env node
import { parseArgs } from "node:util";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { expandPath, loadPanel, type Device } from "./config.js";
import { diffRuns } from "./diff.js";
import { SpendMeter } from "./pricing.js";
import { DEFAULT_MAX_USD, evaluateRun, runPanel } from "./run.js";

const HELP = `buyer-panel: AI buyers browse a site, a separate model grades the traces, reproducing findings are reported.

Usage
  buyer-panel run <panel.json> --version <worker-version-id> [options]
  buyer-panel evaluate <panel.json> <run-dir> [--max-usd <n>] [--allow-opus]
  buyer-panel diff <panel.json> <earlier-run-dir> <later-run-dir>

Run options
  --version <id>      The version the run is keyed by: 8+ hex characters. The Worker version id, auto (read with
                      wrangler from target.worker), or for a target that is not a Worker a date such as 20261014
  --label <text>      A note stored with the run
  --only <ids>        Comma-separated profile ids
  --device <d>        desktop or phone (repeatable)
  --variant <id>      Variant id (repeatable)
  --concurrency <n>   Sessions in parallel (default 3)
  --no-evaluate       Run the sessions only
  --max-usd <n>       Spend cap for the run, estimated live from token usage (default 3). Past it no new session starts,
                      running ones end cleanly, and the report says what was cut. Also on evaluate (grading only)
  --allow-opus        Let a panel whose evaluator is an Opus model load; without it that panel is refused. The
                      evaluator defaults to Sonnet 4.6, and the report records when Opus was allowed. Also on evaluate
  --into <run-id>    Finish an earlier run of the same version: run only its missing or failed sessions

Credentials come from the environment, never from flags:
  model    AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_BEDROCK_REGION (providers bedrock and bedrock-converse),
           ANTHROPIC_API_KEY (anthropic) or CLOUDFLARE_AI_TOKEN and CLOUDFLARE_ACCOUNT_ID (workers-ai)
  access   the env var names in the panel's target.access
On the ops box:  doppler run -p <project> -c <config> -- buyer-panel run panels/dd-redesign.json --version auto
                (the config is in dd-repo-registry docs/buyer-panel.md)

A defect-finding layer, never validation: no finding means nothing was found.`;

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      version: { type: "string" },
      label: { type: "string" },
      only: { type: "string" },
      device: { type: "string", multiple: true },
      variant: { type: "string", multiple: true },
      concurrency: { type: "string" },
      "no-evaluate": { type: "boolean" },
      "max-usd": { type: "string" },
      into: { type: "string" },
      "allow-opus": { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
  const [cmd, panelPath, ...rest] = positionals;
  if (values.help || !cmd) {
    console.log(HELP);
    return 0;
  }
  if (!panelPath) throw new Error(`${cmd}: the panel file is required`);
  const panel = loadPanel(panelPath, { allowOpus: values["allow-opus"] });
  const runDir = (p: string | undefined) => {
    if (!p) throw new Error(`${cmd}: a run directory is required`);
    const d = existsSync(expandPath(p)) ? expandPath(p) : join(panel.archive, panel.client, "panel", "runs", p);
    if (!existsSync(join(d, "run.json"))) throw new Error(`${p}: not a run directory`);
    return d;
  };
  const maxUsd = values["max-usd"] === undefined ? undefined : Number(values["max-usd"]);
  if (maxUsd !== undefined && !(maxUsd > 0)) throw new Error("--max-usd must be a number above 0");
  if (cmd === "run") {
    if (!values.version) throw new Error("run: --version is required");
    const devices = (values.device ?? []) as Device[];
    if (devices.some((d) => d !== "desktop" && d !== "phone")) throw new Error("--device must be desktop or phone");
    await runPanel(panel, {
      version: values.version,
      label: values.label,
      only: values.only?.split(",").map((s) => s.trim()).filter(Boolean),
      devices,
      variants: values.variant,
      concurrency: values.concurrency ? Number(values.concurrency) : undefined,
      evaluate: !values["no-evaluate"],
      maxUsd,
      into: values.into ? runDir(values.into) : undefined,
    });
    return 0;
  }
  if (cmd === "evaluate") {
    await evaluateRun(panel, runDir(rest[0]), console.log, new SpendMeter(maxUsd ?? DEFAULT_MAX_USD));
    return 0;
  }
  if (cmd === "diff") {
    const d = await diffRuns(panel, runDir(rest[0]), runDir(rest[1]));
    console.log(`persisting ${d.persisting.length}, not found this time ${d.gone.length}, new ${d.added.length}`);
    return 0;
  }
  throw new Error(`unknown command ${cmd}`);
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e: Error) => {
    console.error(`buyer-panel: ${e.message}`);
    process.exit(1);
  },
);
