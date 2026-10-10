#!/usr/bin/env node
import { parseArgs } from "node:util";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { expandPath, loadPanel, type Device } from "./config.js";
import { diffRuns } from "./diff.js";
import { evaluateRun, runPanel } from "./run.js";

const HELP = `buyer-panel: AI buyers browse a site, a separate model grades the traces, reproducing findings are reported.

Usage
  buyer-panel run <panel.json> --version <worker-version-id> [options]
  buyer-panel evaluate <panel.json> <run-dir>
  buyer-panel diff <panel.json> <earlier-run-dir> <later-run-dir>

Run options
  --version <id>      The deployed version the run is keyed by, or auto (read with wrangler from target.worker)
  --label <text>      A note stored with the run
  --only <ids>        Comma-separated profile ids
  --device <d>        desktop or phone (repeatable)
  --variant <id>      Variant id (repeatable)
  --concurrency <n>   Sessions in parallel (default 3)
  --no-evaluate       Run the sessions only

Credentials come from the environment, never from flags:
  model    AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_BEDROCK_REGION (provider bedrock) or ANTHROPIC_API_KEY
  access   the env var names in the panel's target.access
On dd-work-01:  doppler run -p dd-work-box -c prd -- buyer-panel run panels/dd-redesign.json --version auto

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
      help: { type: "boolean", short: "h" },
    },
  });
  const [cmd, panelPath, ...rest] = positionals;
  if (values.help || !cmd) {
    console.log(HELP);
    return 0;
  }
  if (!panelPath) throw new Error(`${cmd}: the panel file is required`);
  const panel = loadPanel(panelPath);
  const runDir = (p: string | undefined) => {
    if (!p) throw new Error(`${cmd}: a run directory is required`);
    const d = existsSync(expandPath(p)) ? expandPath(p) : join(panel.archive, panel.client, "panel", "runs", p);
    if (!existsSync(join(d, "run.json"))) throw new Error(`${p}: not a run directory`);
    return d;
  };
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
    });
    return 0;
  }
  if (cmd === "evaluate") {
    await evaluateRun(panel, runDir(rest[0]));
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
