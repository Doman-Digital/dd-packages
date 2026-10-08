/**
 * Next.js: init options for the client, Node server and edge runtimes, the
 * `withSentryConfig` build options, and the two capture hooks Next needs.
 *
 * Next 16 with Turbopack loads only `instrumentation-client.ts` in the
 * browser. A `sentry.client.config.ts` is never read, and a site that keeps
 * its client init there reports nothing from the browser (HJ-Beauty and the
 * DD portal, 2026-10-08 audit).
 */

import { BROWSER_TRACES_SAMPLE_RATE } from "./browser";
import { SERVER_TRACES_SAMPLE_RATE } from "./cloudflare";
import { type EnvSource, SENTRY_ORG, resolveEnvironment, resolveRelease } from "./env";
import { type BrowserPreset, type Preset, type PresetInput, buildPreset } from "./preset";
import { applicationKey } from "./third-party";

/**
 * For `instrumentation-client.ts`. Pass the public variables written out in
 * full: Next inlines `process.env.NEXT_PUBLIC_*` only where it sees the whole
 * name. The release comes from `withSentryConfig`, which injects it.
 */
export function nextClientOptions<I extends PresetInput>(input: I = {} as I): BrowserPreset<I> {
  return buildPreset(input, { tracesSampleRate: BROWSER_TRACES_SAMPLE_RATE, browser: true });
}

/** For `instrumentation.ts` when `NEXT_RUNTIME === "nodejs"`. Pass `env: process.env`. */
export function nextServerOptions<I extends PresetInput>(input: I = {} as I): Preset<I> {
  return buildPreset(input, { tracesSampleRate: SERVER_TRACES_SAMPLE_RATE, browser: false });
}

/** For `instrumentation.ts` when `NEXT_RUNTIME === "edge"`. Pass `env: process.env`. */
export function nextEdgeOptions<I extends PresetInput>(input: I = {} as I): Preset<I> {
  return buildPreset(input, { tracesSampleRate: SERVER_TRACES_SAMPLE_RATE, browser: false });
}

export interface NextBuildInput {
  /** The Sentry project slug. */
  project: string;
  /** Build-time variables, normally `process.env`. */
  env?: EnvSource;
}

/**
 * The second argument to `withSentryConfig`: org, project, token, the release
 * named after the commit with a deploy record for its environment, maps
 * uploaded then deleted, and the application key `thirdPartyFilterOptions`
 * matches. Spread it and add anything site-specific after.
 */
export function nextBuildOptions({ project, env }: NextBuildInput) {
  const release = resolveRelease({ env });
  const { environment, enabled } = resolveEnvironment({ env });
  const token = typeof env?.SENTRY_AUTH_TOKEN === "string" && env.SENTRY_AUTH_TOKEN ? env.SENTRY_AUTH_TOKEN : undefined;
  return {
    org: SENTRY_ORG,
    project,
    ...(token ? { authToken: token } : {}),
    applicationKey: applicationKey(project),
    silent: !env?.CI,
    widenClientFileUpload: true,
    sourcemaps: { deleteSourcemapsAfterUpload: true },
    ...(release ? { release: { name: release, ...(enabled ? { deploy: { env: environment } } : {}) } } : {}),
  };
}

/** What Next passes to `onRequestError`, loosely enough to accept every Next version's type. */
export type NextRequestInfo = Readonly<{ path: string; method: string; headers: Readonly<Record<string, string | string[] | undefined>> }>;
export type NextErrorContext = Readonly<{ routerKind: string; routePath: string; routeType: string }>;

type NextSdk = {
  captureRequestError(error: unknown, request: NextRequestInfo, context: NextErrorContext): void;
  captureException(error: unknown, context?: Record<string, unknown>): string;
};

async function sdk(): Promise<NextSdk> {
  // Resolved from the site's own install (an optional peer dependency), at
  // the site's own version, in whichever runtime Next is running.
  // @ts-ignore -- not installed here, on purpose
  return (await import("@sentry/nextjs")) as NextSdk;
}

/**
 * Server errors from rendering, route handlers, server actions and the proxy.
 * In `instrumentation.ts`: `export { onRequestError } from "@domandigital/sentry/next";`
 */
export async function onRequestError(error: unknown, request: NextRequestInfo, context: NextErrorContext): Promise<void> {
  (await sdk()).captureRequestError(error, request, context);
}

/**
 * For `app/global-error.tsx`, which replaces the root layout when it throws,
 * so nothing else reports it: `useEffect(() => { captureGlobalError(error); }, [error]);`
 */
export async function captureGlobalError(error: Error & { digest?: string }): Promise<void> {
  (await sdk()).captureException(error, {
    tags: { boundary: "global-error" },
    ...(error.digest ? { extra: { digest: error.digest } } : {}),
  });
}

export { thirdPartyFilterOptions } from "./third-party";
export type { BrowserPreset, BrowserPresetDefaults, Preset, PresetDefaults, PresetInput, ScrubbingHook, SpanScrubbingHook } from "./preset";
