/**
 * The one builder behind every entry point. It returns plain `Sentry.init`
 * options and imports no SDK, so the same code serves `@sentry/browser`,
 * `@sentry/astro`, `@sentry/cloudflare` and `@sentry/nextjs` at whatever
 * version the site has installed: v10 and v11 are both supported.
 *
 * Where the two majors differ:
 * - PII: v10's `sendDefaultPii` defaults to false and is left at that (v11
 *   removed it, and v11's `withSentry` rejects a key it does not know). v11's
 *   replacement, `dataCollection`, collects cookies, bodies and local
 *   variables by default, so it is set; v10 ignores it.
 * - Transactions: v11 ignores `beforeSendTransaction` by default (spans are
 *   streamed) and warns on every init when it is set. Transactions are
 *   scrubbed by an integration instead, which both majors run, and streamed
 *   spans by `beforeSendSpan`.
 */

import { type EnvSource, type SentryEnvironment, resolveDsn, resolveEnvironment, resolveRelease } from "./env";
import { DENY_URLS, IGNORE_ERRORS, isThirdPartyNetworkError } from "./filters";
import { scrubEvent, scrubSpan } from "./scrub";

type Pattern = string | RegExp;
// The SDK's own types differ per package and version; these accept all of them.
type AnyHook = (event: any, hint: any) => any;
type IntegrationLike = { name: string; processEvent?: (event: any, hint: any, client: any) => any };
type Integrations = IntegrationLike[] | ((defaults: any[]) => IntegrationLike[]);

type CollectBehavior = boolean | { allow: string[] } | { deny: string[] };
type HttpBody = "incomingRequest" | "outgoingRequest" | "incomingResponse" | "outgoingResponse";

/** v11's `dataCollection`, written out here so the package needs no SDK types and v10 sites typecheck too. */
export interface DataCollection {
  userInfo?: boolean;
  cookies?: CollectBehavior;
  httpHeaders?: CollectBehavior | { request?: CollectBehavior; response?: CollectBehavior };
  httpBodies?: HttpBody[];
  urlQueryParams?: CollectBehavior;
  graphQL?: { document?: boolean; variables?: boolean };
  genAI?: { inputs?: boolean; outputs?: boolean };
  databaseQueryData?: boolean;
  queues?: boolean;
  stackFrameVariables?: CollectBehavior;
  frameContextLines?: number;
}

/**
 * The v11 equivalent of `sendDefaultPii: false`, a little tighter: no user
 * info, cookies, bodies, bound query values, queue arguments, AI prompts or
 * local variables (an enquiry handler's locals are the enquiry). Request
 * headers and query strings stay, with the SDK's sensitive-value filter and
 * then the scrubber over them, because they are what makes an error readable.
 */
export const DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: true, response: false },
  httpBodies: [] as HttpBody[],
  urlQueryParams: true,
  graphQL: { document: true, variables: false },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
} satisfies DataCollection;

/** What every entry point accepts. Anything else is passed to `Sentry.init` untouched. */
export interface PresetInput {
  /** Defaults to `SENTRY_DSN`, `PUBLIC_SENTRY_DSN` or `NEXT_PUBLIC_SENTRY_DSN` in `env`. No DSN, no events. */
  dsn?: string | null;
  /** The variables to read: `import.meta.env`, `process.env`, or a Worker's `env`. */
  env?: EnvSource;
  /** Overrides the variables. `production`, `staging` or `preview`; `development`, `dev`, `local` and `test` turn reporting off. */
  environment?: string | null;
  /** Overrides the variables. The git SHA the build came from. */
  release?: string | null;
  /** Hosts that count as this site's own when deciding whether a failed fetch is third-party noise. The page's host always counts. */
  firstPartyHosts?: readonly string[];
  /** Added to the shared list, never instead of it. */
  ignoreErrors?: Pattern[];
  /** Added to the shared list, never instead of it. */
  denyUrls?: Pattern[];
  /** The site's own integrations. The scrubber's is added to them. */
  integrations?: unknown;
  /** Runs before the scrubber, which always has the last word. */
  beforeSend?: AnyHook;
  /** Replaces the span scrubber. Only for a site that scrubs spans itself. */
  beforeSendSpan?: (span: any) => any;
  /** Merged over {@link DATA_COLLECTION} (v11). */
  dataCollection?: DataCollection;
  tracesSampleRate?: number;
  replaysSessionSampleRate?: number;
  replaysOnErrorSampleRate?: number;
  /** Only ever false, which is v10's default; it is left out of the options. Personal data reaches Sentry only by being named in a scope, and then the scrubber sees it. */
  sendDefaultPii?: false;
  [option: string]: unknown;
}

/** A hook that works as `beforeSend` on every Sentry SDK. */
export type ScrubbingHook = <E extends object>(event: E, hint?: unknown) => E | null | PromiseLike<E | null>;
/** A hook that works as `beforeSendSpan` on every Sentry SDK. */
export type SpanScrubbingHook = <S extends object>(span: S) => S;

/**
 * What the preset sets on a server. Everything else in the input comes
 * through as given. Every key here is one `@sentry/cloudflare` v11's strict
 * `withSentry` accepts.
 */
export interface PresetDefaults {
  dsn?: string;
  environment: SentryEnvironment;
  release?: string;
  enabled?: boolean;
  dataCollection: DataCollection;
  ignoreErrors: Pattern[];
  denyUrls: Pattern[];
  integrations: Integrations;
  beforeSend: ScrubbingHook;
  beforeSendSpan: SpanScrubbingHook;
  tracesSampleRate: number;
}

/** What the preset sets in a browser: the server's, plus replay rates when Replay is added. */
export interface BrowserPresetDefaults extends PresetDefaults {
  replaysSessionSampleRate?: number;
  replaysOnErrorSampleRate?: number;
}

type Internal = "env" | "firstPartyHosts" | "sendDefaultPii" | "replaysSessionSampleRate" | "replaysOnErrorSampleRate";
export type Preset<I extends PresetInput> = Omit<I, Internal | keyof PresetDefaults> & PresetDefaults;
export type BrowserPreset<I extends PresetInput> = Omit<I, Internal | keyof BrowserPresetDefaults> & BrowserPresetDefaults;

export interface Runtime {
  /** Traces sampled when the input does not say. */
  tracesSampleRate: number;
  /** Browsers only: drop failed fetches to other sites, and set replay rates when Replay is added. */
  browser: boolean;
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return typeof value === "object" && value !== null && typeof (value as { then?: unknown }).then === "function";
}

function scrubbingHook(user: AnyHook | undefined, drop?: (event: object, hint: unknown) => boolean): ScrubbingHook {
  return ((event: object, hint?: unknown) => {
    if (drop?.(event, hint)) return null;
    const out = user ? user(event, hint) : event;
    if (isThenable(out)) return Promise.resolve(out).then((e) => (e ? scrubEvent(e as object) : null));
    return out ? scrubEvent(out as object) : null;
  }) as ScrubbingHook;
}

/**
 * Scrubs transaction events. An integration rather than `beforeSendTransaction`
 * because both majors run it and neither warns about it. Error events are left
 * to `beforeSend`, which runs after every integration.
 */
const SCRUB_TRANSACTIONS: IntegrationLike = {
  name: "DomanDigitalScrubTransactions",
  processEvent: (event: { type?: string }) => (event.type === "transaction" ? scrubEvent(event) : event),
};

function withScrubber(integrations: unknown): Integrations {
  if (typeof integrations === "function") {
    return (defaults: any[]) => [...(integrations as (d: any[]) => IntegrationLike[])(defaults), SCRUB_TRANSACTIONS];
  }
  return [...(Array.isArray(integrations) ? (integrations as IntegrationLike[]) : []), SCRUB_TRANSACTIONS];
}

function hasReplay(integrations: unknown): boolean {
  return Array.isArray(integrations) && integrations.some((i) => typeof i === "object" && i !== null && (i as { name?: unknown }).name === "Replay");
}

export function buildPreset<I extends PresetInput>(input: I, runtime: Runtime & { browser: true }): BrowserPreset<I>;
export function buildPreset<I extends PresetInput>(input: I, runtime: Runtime): Preset<I>;
export function buildPreset<I extends PresetInput>(input: I, runtime: Runtime): Preset<I> | BrowserPreset<I> {
  const {
    dsn: dsnIn,
    env,
    environment: environmentIn,
    release: releaseIn,
    firstPartyHosts = [],
    ignoreErrors = [],
    denyUrls = [],
    integrations,
    beforeSend,
    beforeSendSpan,
    dataCollection,
    tracesSampleRate,
    replaysSessionSampleRate,
    replaysOnErrorSampleRate,
    sendDefaultPii: _sendDefaultPii,
    ...rest
  } = input;

  const { environment, enabled } = resolveEnvironment({ environment: environmentIn, env });
  const dsn = resolveDsn({ dsn: dsnIn, env });
  const release = resolveRelease({ release: releaseIn, env });

  const out: Record<string, unknown> = {
    ...rest,
    environment,
    dataCollection: { ...DATA_COLLECTION, ...dataCollection },
    ignoreErrors: [...IGNORE_ERRORS, ...ignoreErrors],
    denyUrls: [...DENY_URLS, ...denyUrls],
    integrations: withScrubber(integrations),
    beforeSend: scrubbingHook(
      beforeSend,
      runtime.browser ? (event, hint) => isThirdPartyNetworkError(event, hint, firstPartyHosts) : undefined,
    ),
    // A site's own hook replaces this one rather than being wrapped: v11 marks
    // a static-span hook (`withStaticSpan`), and a wrapper would lose the mark.
    beforeSendSpan: beforeSendSpan ?? scrubSpan,
    tracesSampleRate: tracesSampleRate ?? runtime.tracesSampleRate,
  };

  // An option set to undefined still overrides the SDK's own default (the
  // release a bundler plugin injected, for one), so unknown values are left out.
  if (dsn) out.dsn = dsn;
  if (release) out.release = release;
  if (!enabled) out.enabled = false;

  // Replay rates mean nothing without the integration, and several sites set
  // them with none. They are set only when a Replay integration is passed:
  // never a sampled session, every session that errors.
  if (runtime.browser && hasReplay(integrations)) {
    out.replaysSessionSampleRate = replaysSessionSampleRate ?? 0;
    out.replaysOnErrorSampleRate = replaysOnErrorSampleRate ?? 1.0;
  }

  return out as Preset<I> | BrowserPreset<I>;
}
