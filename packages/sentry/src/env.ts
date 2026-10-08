/**
 * Where environment, release and DSN come from. Every runtime hands its own
 * variables over (`import.meta.env`, `process.env`, a Worker's `env`), because
 * a library cannot read a browser bundle's variables for itself: bundlers only
 * inline the names a consumer writes out literally.
 */

/** The org every Doman Digital project lives in. */
export const SENTRY_ORG = "domandigital";

/** The org's EU ingest host. DSNs minted before the org transfer still work, but name another org. */
export const INGEST_HOST = "o4510784554991616.ingest.de.sentry.io";

/** The only environments a Doman Digital project reports under. */
export const ENVIRONMENTS = ["production", "staging", "preview"] as const;
export type SentryEnvironment = (typeof ENVIRONMENTS)[number];

/** Anything with string-ish values: `process.env`, `import.meta.env`, a Worker's `env`. */
export type EnvSource = Readonly<Record<string, unknown>> | null | undefined;

/** Read in this order; the first non-empty value wins. */
export const ENVIRONMENT_VARS = [
  "SENTRY_ENVIRONMENT",
  "PUBLIC_SENTRY_ENVIRONMENT",
  "NEXT_PUBLIC_SENTRY_ENVIRONMENT",
  // Vercel sets these itself, so a Vercel project is right without any setup.
  "VERCEL_ENV",
  "NEXT_PUBLIC_VERCEL_ENV",
] as const;

export const RELEASE_VARS = [
  "SENTRY_RELEASE",
  "PUBLIC_SENTRY_RELEASE",
  "NEXT_PUBLIC_SENTRY_RELEASE",
  "CF_PAGES_COMMIT_SHA",
  "WORKERS_CI_COMMIT_SHA",
  "VERCEL_GIT_COMMIT_SHA",
  "NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA",
  "GITHUB_SHA",
] as const;

export const DSN_VARS = ["SENTRY_DSN", "PUBLIC_SENTRY_DSN", "NEXT_PUBLIC_SENTRY_DSN"] as const;

function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function firstOf(env: EnvSource, names: readonly string[]): { value: string; from: string } | undefined {
  if (!env) return undefined;
  for (const name of names) {
    const value = text(env[name]);
    if (value) return { value, from: name };
  }
  return undefined;
}

const ALIASES: Record<string, SentryEnvironment> = {
  production: "production",
  prod: "production",
  live: "production",
  staging: "staging",
  stage: "staging",
  stg: "staging",
  preview: "preview",
};

/** A developer's own machine. Reported as nothing at all, not as a fourth environment. */
const LOCAL = new Set(["development", "dev", "local", "test"]);

export interface ResolvedEnvironment {
  environment: SentryEnvironment;
  /** False on a developer's machine (`development`, `dev`, `local`, `test`). */
  enabled: boolean;
  /** The variable it came from, `"explicit"`, or null when nothing was set. */
  from: string | null;
}

/**
 * `production`, `staging` or `preview`, from one variable. Never hardcode it:
 * a preview deploy that says `production` pages people for nothing.
 *
 * Unset or unrecognised falls back to `preview`, so a forgotten variable shows
 * up as preview noise rather than as a production incident.
 */
export function resolveEnvironment(input: { environment?: string | null; env?: EnvSource } = {}): ResolvedEnvironment {
  const explicit = text(input.environment);
  const found = explicit ? { value: explicit, from: "explicit" } : firstOf(input.env, ENVIRONMENT_VARS);
  if (!found) return { environment: "preview", enabled: true, from: null };
  const key = found.value.toLowerCase();
  if (LOCAL.has(key)) return { environment: "preview", enabled: false, from: found.from };
  return { environment: ALIASES[key] ?? "preview", enabled: true, from: found.from };
}

/** The git SHA of the build, from whichever CI built it. Undefined when none is set. */
export function resolveRelease(input: { release?: string | null; env?: EnvSource } = {}): string | undefined {
  return text(input.release) ?? firstOf(input.env, RELEASE_VARS)?.value;
}

const OLD_INGEST = /^(https?:\/\/[^@/]+@)(o\d+\.ingest\.de\.sentry\.io)(\/.*)$/i;

/**
 * Rewrites a DSN that names a pre-transfer org host to {@link INGEST_HOST}.
 * The key and project id are what route an event, so the old hosts work; they
 * only confuse whoever reads the config next. Anything else is returned as is.
 */
export function normaliseDsn(dsn: string | null | undefined): string | undefined {
  const value = text(dsn);
  if (!value) return undefined;
  const match = OLD_INGEST.exec(value);
  return match ? `${match[1]}${INGEST_HOST}${match[3]}` : value;
}

/** The DSN given, else the first of `SENTRY_DSN`, `PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`. */
export function resolveDsn(input: { dsn?: string | null; env?: EnvSource } = {}): string | undefined {
  return normaliseDsn(text(input.dsn) ?? firstOf(input.env, DSN_VARS)?.value);
}
