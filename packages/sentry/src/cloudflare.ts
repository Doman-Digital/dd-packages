/**
 * Cloudflare Worker init options, for `@sentry/cloudflare`'s `withSentry`
 * (and Astro or any framework running on a Worker). The Worker's `env` is
 * only available per request, so the options are built from it there.
 */

import { type Preset, type PresetInput, buildPreset } from "./preset";

/** Traces sampled on a server when the input does not say. */
export const SERVER_TRACES_SAMPLE_RATE = 0.1;

/**
 * `Sentry.init` options for a Worker. `env` is the Worker's bindings: the DSN
 * comes from `SENTRY_DSN`, the environment from `SENTRY_ENVIRONMENT` and the
 * release from `SENTRY_RELEASE` (set it at deploy: `wrangler deploy --var
 * SENTRY_RELEASE:$GITHUB_SHA`).
 *
 * ```ts
 * import * as Sentry from "@sentry/cloudflare";
 * import { cloudflareOptions } from "@domandigital/sentry/cloudflare";
 *
 * export default Sentry.withSentry((env: Env) => cloudflareOptions({ env }), handler);
 * ```
 */
export function cloudflareOptions<I extends PresetInput>(input: I = {} as I): Preset<I> {
  return buildPreset(input, { tracesSampleRate: SERVER_TRACES_SAMPLE_RATE, browser: false });
}

export type { Preset, PresetDefaults, PresetInput, ScrubbingHook, SpanScrubbingHook } from "./preset";
