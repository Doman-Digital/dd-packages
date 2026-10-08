/**
 * The pieces every entry point is built from, for a site that wraps Sentry
 * some other way. Most sites want an entry point instead:
 * `@domandigital/sentry/browser`, `/cloudflare` or `/next`.
 */

export {
  DSN_VARS,
  ENVIRONMENTS,
  ENVIRONMENT_VARS,
  type EnvSource,
  INGEST_HOST,
  RELEASE_VARS,
  type ResolvedEnvironment,
  SENTRY_ORG,
  type SentryEnvironment,
  normaliseDsn,
  resolveDsn,
  resolveEnvironment,
  resolveRelease,
} from "./env";
export { DENY_URLS, IGNORE_ERRORS, isThirdPartyNetworkError } from "./filters";
export {
  type BrowserPreset,
  type BrowserPresetDefaults,
  buildPreset,
  DATA_COLLECTION,
  type DataCollection,
  type Preset,
  type PresetDefaults,
  type PresetInput,
  type Runtime,
  type ScrubbingHook,
  type SpanScrubbingHook,
} from "./preset";
export { REDACTED, scrubEvent, scrubSpan, scrubString, scrubValue } from "./scrub";
export { applicationKey, thirdPartyFilterOptions } from "./third-party";
