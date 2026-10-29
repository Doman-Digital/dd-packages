import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, resolve } from "node:path";
import { priceFor } from "./pricing.js";

export type Device = "desktop" | "phone";
/**
 * bedrock: Claude through Bedrock's Anthropic SDK. anthropic: Claude through the first-party API.
 * bedrock-converse: any other model on Bedrock, through the Converse API. workers-ai: a Cloudflare Workers AI model.
 */
export type Provider = "bedrock" | "anthropic" | "bedrock-converse" | "workers-ai";
export const PROVIDERS: Provider[] = ["bedrock", "anthropic", "bedrock-converse", "workers-ai"];

export interface ModelChoice {
  provider?: Provider;
  model: string;
  temperature?: number;
}

/** One run of a profile: a model and a temperature. Two variants give the "real variation" a reproduction needs. */
export interface Variant extends ModelChoice {
  id: string;
}

export interface Profile {
  id: string;
  label: string;
  /** Who the buyer is, in the second person. The buyer model gets this and nothing else about the business. */
  persona: string;
  /** What they came to do. */
  task: string;
}

/** What grades a run when the panel file names no evaluator. */
export const DEFAULT_EVALUATOR: ModelChoice = { provider: "bedrock", model: "eu.anthropic.claude-sonnet-4-6", temperature: 0 };

/** Opus grading cost about $13 of one month's Bedrock bill (DOM-1642), so it needs `--allow-opus` on every run. */
export const isOpus = (model: string): boolean => /opus/i.test(model);

export interface LoadOptions {
  /** `--allow-opus`: lets a panel whose evaluator is an Opus model load. */
  allowOpus?: boolean;
}

export interface Panel {
  name: string;
  /** Folder name in the archive, e.g. "dd-site-preview". */
  client: string;
  target: {
    origin: string;
    start: string;
    /** Env var names for a Cloudflare Access service token; sent only to the target origin. */
    access?: { idEnv: string; secretEnv: string };
    /** A Cloudflare Worker serving the target: lets `--version auto` read the deployed version, and the run check it again at the end. accountId is optional: without it wrangler uses CLOUDFLARE_ACCOUNT_ID from the environment (the panel's Doppler config), which keeps account ids out of this public repo. */
    worker?: { name: string; accountId?: string };
  };
  /** Archive root (the client-capsule pattern). Runs land in <archive>/<client>/panel/runs/<runId>. */
  archive: string;
  stepBudget: number;
  devices: Device[];
  variants: Variant[];
  /** Defaults to Sonnet 4.6. An Opus model is refused unless the run passes `--allow-opus`. */
  evaluator: ModelChoice;
  /** Set when `--allow-opus` let an Opus evaluator load; the report records it. */
  allowOpus?: boolean;
  firstImpressionQuestion: string;
  profiles: Profile[];
  grading: {
    /** The journey map: an HTML or text file holding each door's expected answers. */
    journeyMap: string;
    brandFacts: { path: string; include: string[] };
    /** States that are true of the preview only and are filed as expected, never as defects. */
    knownStates: string[];
    notes?: string[];
  };
}

export function expandPath(p: string, base = process.cwd()): string {
  if (p === "~" || p.startsWith("~/")) return resolve(homedir(), p.slice(2));
  return isAbsolute(p) ? p : resolve(base, p);
}

const fail = (msg: string): never => {
  throw new Error(`panel config: ${msg}`);
};

/** Reads and checks a panel file. Relative paths inside it resolve against the file's own folder. */
export function loadPanel(path: string, opts: LoadOptions = {}): Panel {
  const file = expandPath(path);
  const raw = JSON.parse(readFileSync(file, "utf8")) as Panel;
  return validatePanel(raw, dirname(file), opts);
}

export function validatePanel(p: Panel, base = process.cwd(), opts: LoadOptions = {}): Panel {
  if (!p.name) fail("name is required");
  if (!p.client || /[^a-z0-9-]/.test(p.client)) fail("client must be a lower-case folder name");
  // http only for this machine's loopback: a prototype served locally (DOM-1396) has no Access gate or certificate.
  const origin = p.target?.origin ?? "";
  if (!/^https:\/\//.test(origin) && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) fail("target.origin must be an https origin, or http on 127.0.0.1 or localhost");
  if (!p.target.start?.startsWith("/")) fail("target.start must be a path");
  if (!(p.stepBudget >= 5 && p.stepBudget <= 60)) fail("stepBudget must be between 5 and 60");
  if (!p.devices?.length || p.devices.some((d) => d !== "desktop" && d !== "phone")) fail("devices must be desktop and/or phone");
  if ((p.variants?.length ?? 0) < 2) fail("at least two variants are needed for a finding to reproduce within a profile");
  if (new Set(p.variants.map((v) => v.id)).size !== p.variants.length) fail("variant ids must be unique");
  const evaluator = p.evaluator ?? DEFAULT_EVALUATOR;
  if (!evaluator.model) fail("evaluator.model is required");
  if (isOpus(evaluator.model) && !opts.allowOpus) fail(`evaluator ${evaluator.model} is an Opus model; pass --allow-opus to grade with it (Sonnet is the default)`);
  for (const c of [evaluator, ...p.variants]) {
    if (c.provider && !PROVIDERS.includes(c.provider)) fail(`provider "${c.provider}" is not one of ${PROVIDERS.join(", ")}`);
    try {
      priceFor(c.model);
    } catch (e) {
      fail((e as Error).message);
    }
  }
  if (!p.profiles?.length) fail("profiles are required");
  for (const pr of p.profiles) {
    if (!/^[a-z0-9-]+$/.test(pr.id)) fail(`profile id "${pr.id}" must be kebab-case`);
    if (!pr.persona || !pr.task) fail(`profile ${pr.id} needs a persona and a task`);
  }
  if (new Set(p.profiles.map((x) => x.id)).size !== p.profiles.length) fail("profile ids must be unique");
  if (!p.grading?.journeyMap || !p.grading.brandFacts?.path) fail("grading.journeyMap and grading.brandFacts.path are required");
  return {
    ...p,
    evaluator,
    ...(isOpus(evaluator.model) ? { allowOpus: true } : {}),
    archive: expandPath(p.archive, base),
    grading: {
      ...p.grading,
      journeyMap: expandPath(p.grading.journeyMap, base),
      brandFacts: { ...p.grading.brandFacts, path: expandPath(p.grading.brandFacts.path, base) },
      knownStates: p.grading.knownStates ?? [],
    },
  };
}
