/**
 * `craft null build` and `craft tells harvest`: generating the counterfactual
 * and reading it back.
 *
 * Generation calls `claude -p` once per page, from an empty directory with no
 * tools, no settings, no skills and no MCP servers, so the page is what the
 * model builds from the brief alone. Set CRAFT_CLAUDE to use another binary.
 * A user-level CLAUDE.md still loads; the model is only as unprompted as the
 * machine it runs on.
 *
 * Every step is resumable: a page already written is not generated again and
 * a snapshot already taken is not retaken, so an interrupted build picks up
 * where it stopped.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { auditSnapshot, CATALOGUE_VERSION, checkCopy, scanSource } from "../character/check.js";
import { parseFlags, type Io } from "../character/cli.js";
import { extractStrings } from "../character/prose.js";
import { fingerprint } from "../fingerprint/index.js";
import type { Snapshot } from "../snapshot/types.js";
import { readSnapshot } from "../snapshot/migrate.js";
import { extractHtml, harvest, hueSwatch, NULL_VERSION, nullPrompt, type HarvestCandidate, type NullModel, type NullRun, type Typicality } from "./index.js";
import { toJson } from "../character/json.js";

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
const pad = (n: number): string => String(n).padStart(2, "0");

function generate(prompt: string, model: string | undefined): Promise<string> {
  const bin = process.env.CRAFT_CLAUDE ?? "claude";
  const args = ["-p", "--tools", "", "--no-session-persistence", "--disable-slash-commands", "--setting-sources", "", "--strict-mcp-config", ...(model ? ["--model", model] : []), prompt];
  // An empty directory: no CLAUDE.md, no repo, nothing to read but the brief.
  const cwd = mkdtempSync(join(tmpdir(), "craft-null-"));
  return new Promise((done, fail) => {
    const child = spawn(bin, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => (err += d.toString()));
    child.on("error", (e) => fail(new Error(`${bin}: ${e.message}. Install Claude Code, or set CRAFT_CLAUDE.`)));
    child.on("close", (code) => {
      rmSync(cwd, { recursive: true, force: true });
      if (code === 0) done(out);
      else fail(new Error(`${bin} exited ${code}: ${(err || out).trim().slice(0, 200)}`));
    });
  });
}

async function pool<T>(items: T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.max(1, Math.min(size, queue.length)) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await work(item);
  }));
}

/** Where a null model lives: a null.json, or a directory holding one. */
export function nullPath(target: string, cwd: string): string {
  const abs = resolve(cwd, target);
  return existsSync(abs) && statSync(abs).isDirectory() ? join(abs, "null.json") : abs;
}

export function loadNull(target: string, cwd: string): NullModel {
  const path = nullPath(target, cwd);
  if (!existsSync(path)) throw new Error(`no null model at ${target}. Build one with craft null build.`);
  const model = readJson<NullModel>(path);
  if (model.version !== NULL_VERSION) throw new Error(`${target} is null model version ${String(model.version)}; this craft reads ${NULL_VERSION}`);
  return model;
}

/** One page, measured: its fingerprint, the tells it trips and its visible text. */
export function measureRun(id: string, html: string, snapshot: Snapshot): NullRun {
  const file = { path: `${id}.html`, text: html };
  const tells = new Set([...auditSnapshot(snapshot).findings, ...scanSource([file]).findings].map((f) => f.tell));
  // Text a reader sees in place. Quoted strings in a page's script are mostly
  // class names and keys, and would harvest "btn btn-primary" as a phrase.
  const copy = [...new Set(extractStrings(file).filter((b) => !b.literal).map((b) => b.text.replace(/\s+/g, " ").trim()).filter(Boolean))];
  return { id, fingerprint: fingerprint(snapshot), tells: [...tells].sort(), copy };
}

async function build(flags: ReturnType<typeof parseFlags> & object, io: Io): Promise<number> {
  const brief = flags.brief ?? (flags.direction ? readJson<{ brief?: string }>(resolve(io.cwd, flags.direction)).brief : undefined);
  if (!brief || brief.trim().split(/\s+/).length < 5) throw new Error("usage: craft null build --brief \"<who, where, what they do>\" --out <dir> [--runs 20] [--parallel 4]");
  if (!flags.out) throw new Error("--out <dir> is where the pages and null.json go");
  const runs = Number(flags.runs ?? 20);
  const parallel = Number(flags.parallel ?? 4);
  if (!Number.isInteger(runs) || runs < 5) throw new Error("--runs needs a whole number, 5 or more");
  const dir = resolve(io.cwd, flags.out);
  const pages = join(dir, "pages");
  const shots = join(dir, "snapshots");
  mkdirSync(pages, { recursive: true });
  mkdirSync(shots, { recursive: true });
  const prompt = nullPrompt(brief);

  const ids = Array.from({ length: runs }, (_, i) => pad(i + 1));
  // A page on disk is checked like a fresh reply: a model that answers "I'll
  // write the file" instead of writing the page has not built one.
  for (const id of ids) {
    const path = join(pages, `${id}.html`);
    if (!existsSync(path)) continue;
    const raw = readFileSync(path, "utf8");
    const html = extractHtml(raw);
    if (!html) {
      writeFileSync(join(pages, `${id}.reply.txt`), raw);
      rmSync(path);
      rmSync(join(shots, `${id}.json`), { force: true });
      io.out(`  ${id} was a reply, not a page: kept as ${id}.reply.txt and generated again`);
    } else if (html !== raw) writeFileSync(path, html);
  }
  const missing = ids.filter((id) => !existsSync(join(pages, `${id}.html`)));
  const failed: string[] = [];
  if (missing.length) io.out(`craft null: generating ${missing.length} page${missing.length === 1 ? "" : "s"}, ${parallel} at a time`);
  await pool(missing, parallel, async (id) => {
    try {
      const reply = await generate(prompt, flags.model);
      const html = extractHtml(reply);
      if (!html) {
        writeFileSync(join(pages, `${id}.reply.txt`), reply);
        failed.push(`${id}: the reply held no HTML page (kept as ${id}.reply.txt)`);
        return;
      }
      writeFileSync(join(pages, `${id}.html`), html);
      io.out(`  ${id} written`);
    } catch (error) {
      failed.push(`${id}: ${(error as Error).message}`);
    }
  });

  const toShoot = ids.filter((id) => existsSync(join(pages, `${id}.html`)) && !existsSync(join(shots, `${id}.json`)));
  if (toShoot.length) {
    io.out(`craft null: snapshotting ${toShoot.length} page${toShoot.length === 1 ? "" : "s"}`);
    const { snapshotUrls } = await import("../audit/index.js");
    const results = await snapshotUrls(toShoot.map((id) => pathToFileURL(join(pages, `${id}.html`)).href));
    results.forEach((r, i) => {
      const id = toShoot[i];
      if (r.snapshot) writeFileSync(join(shots, `${id}.json`), `${JSON.stringify({ ...r.snapshot, url: `pages/${id}.html` }, null, 2)}\n`);
      else failed.push(`${id}: the page would not render: ${r.error}`);
    });
  }

  const measured = ids
    .filter((id) => existsSync(join(pages, `${id}.html`)) && existsSync(join(shots, `${id}.json`)))
    .map((id) => measureRun(id, readFileSync(join(pages, `${id}.html`), "utf8"), readSnapshot(readJson<unknown>(join(shots, `${id}.json`)), `${id}.json`)));
  const model: NullModel = {
    version: NULL_VERSION,
    brief: brief.trim(),
    prompt,
    model: flags.model ?? "default",
    catalogueVersion: CATALOGUE_VERSION,
    builtAt: new Date().toISOString(),
    runs: measured,
  };
  writeFileSync(join(dir, "null.json"), `${JSON.stringify(model, null, 2)}\n`);
  io.out(`craft null: ${measured.length} of ${runs} pages in ${relative(io.cwd, join(dir, "null.json")) || "null.json"}`);
  for (const f of failed) io.err(`  ${f}`);
  if (measured.length < runs) {
    io.err(`craft null: ${runs - measured.length} missing. Run the same command again to fill them in.`);
    return 1;
  }
  return 0;
}

/** Which copy tell already catches a phrase, if any. */
function copyTell(phrase: string): string | null {
  // A phrase on its own is not a sentence, and the word tells read sentences.
  const text = `We found that ${phrase} was there.`;
  const hit = checkCopy([{ path: "phrase.md", text }]).findings[0];
  return hit ? hit.tell : null;
}

export function formatHarvest(candidates: HarvestCandidate[], models: NullModel[]): string {
  const lines = [`craft tells harvest: ${models.reduce((s, m) => s + m.runs.length, 0)} null pages from ${models.length} brief${models.length === 1 ? "" : "s"}`];
  const fresh = candidates.filter((c) => !c.known);
  const known = candidates.filter((c) => c.known);
  const runs = models.flatMap((m) => m.runs);
  const line = (c: HarvestCandidate) => {
    const swatch = c.kind === "accent" ? hueSwatch(runs, c.value) : null;
    const where = models.length > 1 ? `, ${c.briefs} brief${c.briefs === 1 ? "" : "s"}` : "";
    return `  ${c.kind.padEnd(8)} ${`${c.value}${swatch ? ` (${swatch})` : ""}`.padEnd(44)} ${c.runs} of ${c.of}${where}${c.known ? `  caught by ${c.known}` : ""}`;
  };
  lines.push("", "Not on the catalogue: candidates for the next generation. A person decides.");
  lines.push(...(fresh.length ? fresh.map(line) : ["  none"]));
  lines.push("", "Already caught: the catalogue still describes what the model builds.");
  lines.push(...(known.length ? known.map(line) : ["  none"]));
  return lines.join("\n");
}

export function describeTypicality(t: Typicality, pages: number, briefs: number): string {
  const pct = Math.round(t.score * 100);
  return [
    `Typicality against ${pages} null pages from ${briefs} brief${briefs === 1 ? "" : "s"}`,
    `  score      ${t.score.toFixed(2)}: ${t.typical ? "typical" : "not typical"}. ${pct}% of the model's own pages sit further from the rest than this one.`,
    `  distance   ${t.distance.toFixed(3)} to its nearest null pages; the null's own median is ${t.baseline.toFixed(3)}`,
    `  nearest    ${t.nearest.map((n) => `${n.id} ${n.distance.toFixed(2)}`).join(", ")}`,
    `  shares     ${t.shared.map((s) => `${s.part} ${s.value} (${s.runs} of ${s.of})`).join(", ") || "no choice with a quarter of the null"}`,
  ].join("\n");
}

export async function runNull(args: string[], io: Io): Promise<number> {
  try {
    const flags = parseFlags(args);
    if (typeof flags === "string") throw new Error(flags);
    if (flags.positional[0] !== "build") throw new Error("usage: craft null build --brief \"<text>\" --out <dir> [--runs 20] [--parallel 4] [--model <name>]");
    return await build(flags, io);
  } catch (error) {
    io.err(`craft: ${(error as Error).message}`);
    return 2;
  }
}

export function runHarvest(args: string[], io: Io): number {
  const flags = parseFlags(args);
  if (typeof flags === "string") throw new Error(flags);
  const targets = flags.positional.slice(1);
  if (targets.length === 0) throw new Error("usage: craft tells harvest <null.json | dir>... [--share 0.25] [--json]");
  // A directory of null models is read whole: calibration/null/ holds one per brief.
  const paths = targets.flatMap((t) => {
    const abs = resolve(io.cwd, t);
    if (existsSync(abs) && statSync(abs).isDirectory() && !existsSync(join(abs, "null.json"))) {
      return readdirSync(abs)
        .map((d) => join(abs, d, "null.json"))
        .filter((p) => existsSync(p));
    }
    return [t];
  });
  const models = paths.map((p) => loadNull(p, io.cwd));
  const minShare = flags.share === undefined ? undefined : Number(flags.share);
  if (minShare !== undefined && !(minShare > 0 && minShare <= 1)) throw new Error("--share needs a number above 0 and at most 1");
  const candidates = harvest(models, { minShare, copyTell });
  io.out(flags.json ? toJson({ briefs: models.map((m) => m.brief), candidates }) : formatHarvest(candidates, models));
  return 0;
}
