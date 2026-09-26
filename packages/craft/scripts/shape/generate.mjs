// The AI comparison set for shape calibration.
//
//   node scripts/shape/generate.mjs [--provider claude] [--parallel 4] [--only <genre>] [--limit N]
//
// One piece per call: every brief × genre × model in calibration/copy-shape/briefs.json,
// then each piece once more through the edit prompt ("edit this to sound more
// human"), so measure.mjs can say which features survive light editing.
// Resumable: a piece already written is not generated again.
//
// Providers: `claude` calls `claude -p` with nothing loaded, the same call as
// `craft null build`. `openai` and `gemini` go over plain fetch, so no
// dependency is added, and fail with a clear message until a key exists.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { generate } from "../../dist/generate.js";
import { CALIBRATION, flag } from "./lib.mjs";

const config = JSON.parse(readFileSync(join(CALIBRATION, "briefs.json"), "utf8"));
const provider = flag("provider", "claude");
const parallel = Number(flag("parallel", 4));
const only = flag("only");
const limit = Number(flag("limit", Infinity));
if (!Number.isInteger(parallel) || parallel < 1 || !((Number.isInteger(limit) && limit > 0) || limit === Infinity)) {
  throw new Error("--parallel and --limit must be positive integers");
}

async function openai(prompt, model) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("no OPENAI_API_KEY: the openai provider waits on a key");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`openai ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).choices[0].message.content;
}

async function gemini(prompt, model) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("no GEMINI_API_KEY: the gemini provider waits on a key");
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).candidates[0].content.parts.map((p) => p.text).join("");
}

const call = { claude: generate, openai, gemini }[provider];
if (!call) {
  console.error(`--provider takes claude, openai or gemini`);
  process.exit(2);
}
if (provider === "openai" && !process.env.OPENAI_API_KEY) throw new Error("no OPENAI_API_KEY: the openai provider waits on a key");
if (provider === "gemini" && !process.env.GEMINI_API_KEY) throw new Error("no GEMINI_API_KEY: the gemini provider waits on a key");
const models = config.models[provider] ?? [];
if (models.length === 0) {
  console.error(`no models listed for ${provider} in briefs.json`);
  process.exit(2);
}

const jobs = [];
for (const model of models) {
  for (const [genre, template] of Object.entries(config.genres)) {
    if (only && genre !== only) continue;
    for (const [id, brief] of Object.entries(config.briefs)) {
      const path = join(CALIBRATION, "ai", provider, model, genre, `${id}.txt`);
      jobs.push({ model, genre, id, path, prompt: template.replace("{brief}", brief) });
    }
  }
}

const clean = (text) => text.replace(/^```[a-z]*\n?|\n?```$/g, "").trim();
let done = 0;
let failed = 0;

async function run(job) {
  if (!existsSync(job.path)) {
    const text = clean(await call(job.prompt, job.model));
    mkdirSync(dirname(job.path), { recursive: true });
    writeFileSync(job.path, `${text}\n`);
  }
  const edited = job.path.replace(/\.txt$/, ".edited.txt");
  if (!existsSync(edited)) {
    const text = readFileSync(job.path, "utf8").trim();
    writeFileSync(edited, `${clean(await call(config.edit.replace("{text}", text), job.model))}\n`);
  }
}

const queue = jobs.slice(0, limit);
console.error(`shape generate: ${queue.length} pieces (${provider}: ${models.join(", ")}), ${parallel} at a time`);
await Promise.all(
  Array.from({ length: Math.min(parallel, queue.length) }, async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      try {
        await run(job);
        done += 1;
      } catch (e) {
        failed += 1;
        console.error(`  ${job.model} ${job.genre} ${job.id}: ${e.message}`);
      }
      if ((done + failed) % 25 === 0) console.error(`  ${done} done, ${failed} failed`);
    }
  }),
);
console.error(`shape generate: ${done} done, ${failed} failed. Re-run to retry failures.`);
if (failed) process.exitCode = 1;
