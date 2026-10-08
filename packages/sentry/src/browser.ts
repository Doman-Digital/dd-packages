/**
 * Browser init options: plain sites, Astro's client (`@sentry/astro` or
 * `@sentry/browser`), anything that runs in a visitor's tab. For Next.js use
 * `@domandigital/sentry/next`.
 */

import { type BrowserPreset, type PresetInput, buildPreset } from "./preset";

/** Traces sampled in the browser when the input does not say. */
export const BROWSER_TRACES_SAMPLE_RATE = 0.05;

/**
 * `Sentry.init` options for a browser bundle.
 *
 * ```ts
 * import * as Sentry from "@sentry/astro";
 * import { browserOptions } from "@domandigital/sentry/browser";
 *
 * Sentry.init(browserOptions({ env: import.meta.env }));
 * ```
 */
export function browserOptions<I extends PresetInput>(input: I = {} as I): BrowserPreset<I> {
  return buildPreset(input, { tracesSampleRate: BROWSER_TRACES_SAMPLE_RATE, browser: true });
}

export { thirdPartyFilterOptions } from "./third-party";
export type { BrowserPreset, BrowserPresetDefaults, PresetInput, ScrubbingHook, SpanScrubbingHook } from "./preset";
