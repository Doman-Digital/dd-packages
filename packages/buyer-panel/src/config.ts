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

/** The archive token for the cloud client capsule (R2, through dd-storage). Any other archive is a folder path. */
export const CAPSULE_ARCHIVE = "storage:capsule";

/**
 * A grading file kept in the cloud capsule: `storage:capsule/<client>/panel/inputs/<file>`, resolved at run time
 * against the capsule's working copy that dd-storage names. It keeps machine paths (a home folder, a worktree) out of
 * a panel file, and the file itself in the one store that is backed up (DOM-18300).
 */
export const CAPSULE_FILE_PREFIX = `${CAPSULE_ARCHIVE}/`;

export const isCapsuleFile = (p: string): boolean => p.startsWith(CAPSULE_FILE_PREFIX);

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

/**
 * Claude models from Opus 4.7 on (Opus 5.x, Sonnet 5.x, Haiku 5.5, Fable, Mythos) reject temperature with a 400 and
 * always think. For them the panel sends no temperature and gives each call room to think.
 */
export const rejectsSampling = (model: string): boolean => /claude-(opus-(4-[7-9]|[5-9])|sonnet-[5-9]|haiku-[5-9]|fable|mythos)/i.test(model);

/** The temperature to send, if any: none for a model that rejects sampling, whatever a default says. */
export const samplingFor = (c: ModelChoice): { temperature?: number } =>
  c.temperature === undefined || rejectsSampling(c.model) ? {} : { temperature: c.temperature };

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
  /**
   * Where runs are kept, in the client-capsule pattern: runs land in <archive>/<client>/panel/runs/<runId>.
   * `storage:capsule` (the default) is the cloud capsule: its local working copy is resolved with `dd-storage`
   * at run time and each run is published to R2. A folder path is an offline working copy, reported as local only.
   */
  archive: string;
  stepBudget: number;
  devices: Device[];
  /** The phone's viewport in CSS pixels, for a test plan that names one. Defaults to a 390-wide iPhone 14. */
  phoneViewport?: { width: number; height: number };
  variants: Variant[];
  /** Defaults to Sonnet 4.6. An Opus model is refused unless the run passes `--allow-opus`. */
  evaluator: ModelChoice;
  /** Set when `--allow-opus` let an Opus evaluator load; the report records it. */
  allowOpus?: boolean;
  firstImpressionQuestion: string;
  profiles: Profile[];
  grading: {
    /**
     * The journey map: an HTML or text file holding each door's expected answers. A `storage:capsule/...` path (the
     * default for a client's map) is resolved in the capsule's working copy; any other path is a file on this machine.
     */
    journeyMap: string;
    /** The brand facts file and the top-level sections the evaluator gets. Same path forms as journeyMap. */
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

/**
 * Checks a grading path's form and expands it. A capsule path stays a token (it is resolved at run time, so a panel
 * parses where there is no capsule, as in CI). A git worktree path is refused: worktrees are removed when their session
 * ends, so a panel naming one stops working without saying why.
 */
function gradingPath(field: string, p: string, base: string): string {
  if (p.startsWith("storage:")) {
    if (!isCapsuleFile(p)) fail(`${field} "${p}" is not a capsule path; use ${CAPSULE_FILE_PREFIX}<client>/...`);
    const rel = p.slice(CAPSULE_FILE_PREFIX.length);
    if (!rel || rel.startsWith("/") || rel.split("/").some((seg) => seg === ".." || seg === "")) fail(`${field} "${p}" must name a file inside the capsule`);
    return p;
  }
  if (/(^|\/)\.claude\/worktrees\//.test(p)) fail(`${field} "${p}" is inside a git worktree, which is removed when its session ends; name the repo's own checkout (~/GitHub/<repo>/...) or a ${CAPSULE_FILE_PREFIX} path`);
  return expandPath(p, base);
}

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
  const vp = p.phoneViewport;
  if (vp && !(vp.width >= 320 && vp.width <= 480 && vp.height >= 480 && vp.height <= 1000)) fail("phoneViewport must be 320 to 480 wide and 480 to 1000 high");
  if ((p.variants?.length ?? 0) < 2) fail("at least two variants are needed for a finding to reproduce within a profile");
  if (new Set(p.variants.map((v) => v.id)).size !== p.variants.length) fail("variant ids must be unique");
  const evaluator = p.evaluator ?? DEFAULT_EVALUATOR;
  if (!evaluator.model) fail("evaluator.model is required");
  if (isOpus(evaluator.model) && !opts.allowOpus) fail(`evaluator ${evaluator.model} is an Opus model; pass --allow-opus to grade with it (Sonnet is the default)`);
  // A temperature the panel names but cannot send would be reported as if it ran, so it is refused here.
  for (const c of [...(p.evaluator ? [p.evaluator] : []), ...p.variants]) {
    if (c.temperature !== undefined && rejectsSampling(c.model)) fail(`${c.model} rejects temperature; leave temperature out`);
  }
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
  if (!Array.isArray(p.grading.brandFacts.include) || !p.grading.brandFacts.include.length) fail("grading.brandFacts.include must list the sections the evaluator gets");
  const journeyMap = gradingPath("grading.journeyMap", p.grading.journeyMap, base);
  const factsPath = gradingPath("grading.brandFacts.path", p.grading.brandFacts.path, base);
  if (!p.archive) fail(`archive is required: ${CAPSULE_ARCHIVE} for the cloud capsule, or a folder path for an offline working copy`);
  if (p.archive.startsWith("storage:") && p.archive !== CAPSULE_ARCHIVE) fail(`archive "${p.archive}" is not a storage token; use ${CAPSULE_ARCHIVE} or a folder path`);
  return {
    ...p,
    evaluator,
    ...(isOpus(evaluator.model) ? { allowOpus: true } : {}),
    archive: p.archive === CAPSULE_ARCHIVE ? CAPSULE_ARCHIVE : expandPath(p.archive, base),
    grading: {
      ...p.grading,
      journeyMap,
      brandFacts: { ...p.grading.brandFacts, path: factsPath },
      knownStates: p.grading.knownStates ?? [],
    },
  };
}
