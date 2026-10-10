import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, resolve } from "node:path";

export type Device = "desktop" | "phone";
export type Provider = "bedrock" | "anthropic";

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

export interface Panel {
  name: string;
  /** Folder name in the archive, e.g. "dd-site-preview". */
  client: string;
  target: {
    origin: string;
    start: string;
    /** Env var names for a Cloudflare Access service token; sent only to the target origin. */
    access?: { idEnv: string; secretEnv: string };
    /** A Cloudflare Worker serving the target: lets `--version auto` read the deployed version, and the run check it again at the end. */
    worker?: { name: string; accountId: string };
  };
  /** Archive root (the client-capsule pattern). Runs land in <archive>/<client>/panel/runs/<runId>. */
  archive: string;
  stepBudget: number;
  devices: Device[];
  variants: Variant[];
  evaluator: ModelChoice;
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
export function loadPanel(path: string): Panel {
  const file = expandPath(path);
  const raw = JSON.parse(readFileSync(file, "utf8")) as Panel;
  return validatePanel(raw, dirname(file));
}

export function validatePanel(p: Panel, base = process.cwd()): Panel {
  if (!p.name) fail("name is required");
  if (!p.client || /[^a-z0-9-]/.test(p.client)) fail("client must be a lower-case folder name");
  if (!/^https:\/\//.test(p.target?.origin ?? "")) fail("target.origin must be an https origin");
  if (!p.target.start?.startsWith("/")) fail("target.start must be a path");
  if (!(p.stepBudget >= 5 && p.stepBudget <= 60)) fail("stepBudget must be between 5 and 60");
  if (!p.devices?.length || p.devices.some((d) => d !== "desktop" && d !== "phone")) fail("devices must be desktop and/or phone");
  if ((p.variants?.length ?? 0) < 2) fail("at least two variants are needed for a finding to reproduce within a profile");
  if (new Set(p.variants.map((v) => v.id)).size !== p.variants.length) fail("variant ids must be unique");
  if (!p.evaluator?.model) fail("evaluator.model is required");
  if (!p.profiles?.length) fail("profiles are required");
  for (const pr of p.profiles) {
    if (!/^[a-z0-9-]+$/.test(pr.id)) fail(`profile id "${pr.id}" must be kebab-case`);
    if (!pr.persona || !pr.task) fail(`profile ${pr.id} needs a persona and a task`);
  }
  if (new Set(p.profiles.map((x) => x.id)).size !== p.profiles.length) fail("profile ids must be unique");
  if (!p.grading?.journeyMap || !p.grading.brandFacts?.path) fail("grading.journeyMap and grading.brandFacts.path are required");
  return {
    ...p,
    archive: expandPath(p.archive, base),
    grading: {
      ...p.grading,
      journeyMap: expandPath(p.grading.journeyMap, base),
      brandFacts: { ...p.grading.brandFacts, path: expandPath(p.grading.brandFacts.path, base) },
      knownStates: p.grading.knownStates ?? [],
    },
  };
}
