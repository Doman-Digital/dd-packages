#!/usr/bin/env node
/**
 * `sanity-copy`: sweep a whole Sanity dataset with the house copy check.
 *
 *   sanity-copy --project 6xogwbpo [--dataset production] [--types a,b] [--json]
 *   sanity-copy --file export.json   # the documents already fetched, as an array or { result }
 *
 * Reads published documents over the plain query API, so a public dataset
 * needs no token. A private one reads `SANITY_API_TOKEN` (or
 * `SANITY_AUTH_TOKEN`) from the environment, never from a flag, so a token
 * never lands in shell history.
 *
 * Reports, changes nothing. Copy the owner typed is theirs.
 *
 * Exit codes: 0 no house-rule finding, 1 at least one, 2 nothing was checked.
 */

import { readFileSync } from "node:fs";
import { type CopyFinding, checkDocumentCopy, describeFinding, pathToString } from "./core.js";

interface Args {
  project?: string;
  dataset: string;
  types?: string[];
  file?: string;
  json: boolean;
}

function parse(argv: string[]): Args | string {
  const args: Args = { dataset: "production", json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const value = () => {
      const v = argv[++i];
      if (!v || v.startsWith("--")) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === "--project") args.project = value();
    else if (a === "--dataset") args.dataset = value();
    else if (a === "--types") args.types = value().split(",").map((t) => t.trim()).filter(Boolean);
    else if (a === "--file") args.file = value();
    else if (a === "--json") args.json = true;
    else if (a === "--help" || a === "-h") return "help";
    else return `unknown option ${a}`;
  }
  if (!args.project && !args.file) return "give --project <id> or --file <export.json>";
  return args;
}

async function fetchDocuments(args: Args): Promise<unknown[]> {
  if (args.file) {
    const data = JSON.parse(readFileSync(args.file, "utf8")) as unknown;
    const list = Array.isArray(data) ? data : (data as { result?: unknown }).result;
    if (!Array.isArray(list)) throw new Error(`${args.file} holds no array of documents`);
    return list;
  }
  if (!/^[a-z0-9-]+$/i.test(args.project!) || !/^[a-z0-9_-]+$/i.test(args.dataset)) throw new Error("project and dataset are letters, numbers and dashes only");
  const typeFilter = args.types?.length ? " && _type in $types" : "";
  const query = `*[!(_id in path("drafts.**")) && !(_type match "sanity.*")${typeFilter}]`;
  const params = new URLSearchParams({ query });
  if (args.types?.length) params.set("$types", JSON.stringify(args.types));
  const token = process.env.SANITY_API_TOKEN ?? process.env.SANITY_AUTH_TOKEN;
  const host = token ? "api.sanity.io" : "apicdn.sanity.io";
  const res = await fetch(`https://${args.project}.${host}/v2025-02-19/data/query/${args.dataset}?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Sanity answered ${res.status}${token ? "" : ": a private dataset needs SANITY_API_TOKEN"}`);
  const body = (await res.json()) as { result?: unknown };
  if (!Array.isArray(body.result)) throw new Error("Sanity returned no documents");
  return body.result;
}

const label = (doc: Record<string, unknown>): string => {
  const slug = doc.slug as { current?: string } | undefined;
  return `${doc._type}/${slug?.current ?? doc._id}`;
};

export async function main(argv: string[], out = console.log, err = console.error): Promise<number> {
  const args = parse(argv);
  if (args === "help") {
    out("usage: sanity-copy --project <id> [--dataset production] [--types a,b] [--json]\n       sanity-copy --file export.json [--json]");
    return 0;
  }
  if (typeof args === "string") {
    err(`sanity-copy: ${args}`);
    return 2;
  }
  let docs: unknown[];
  try {
    docs = await fetchDocuments(args);
  } catch (e) {
    err(`sanity-copy: ${(e as Error).message}. Nothing was checked.`);
    return 2;
  }
  if (docs.length === 0) {
    err("sanity-copy: the dataset returned 0 documents. Nothing was checked.");
    return 2;
  }

  const results: { doc: string; findings: CopyFinding[] }[] = [];
  for (const doc of docs) {
    const findings = checkDocumentCopy(doc);
    if (findings.length) results.push({ doc: label(doc as Record<string, unknown>), findings });
  }
  const all = results.flatMap((r) => r.findings);
  const block = all.filter((f) => f.tier === "block").length;

  if (args.json) {
    out(JSON.stringify({ documents: docs.length, block, review: all.length - block, results }, null, 2));
  } else {
    for (const r of results) {
      out(r.doc);
      for (const f of r.findings) out(`  ${pathToString(f.path) || "(whole document)"}  ${describeFinding(f)}`);
    }
    out(`\nsanity-copy: ${docs.length} documents, ${block} house-rule finding${block === 1 ? "" : "s"}, ${all.length - block} worth a look.`);
    out("Reports only: copy the owner typed is theirs to change.");
  }
  return block > 0 ? 1 : 0;
}

// Run only as the command, never on import.
const invoked = process.argv[1] ?? "";
if (/sanity-copy|cli\.(?:c?js|ts)$/.test(invoked)) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
