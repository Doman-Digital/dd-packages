/**
 * `thirdPartyErrorFilterIntegration` drops errors whose every frame is in code
 * the site did not build. It needs the bundler plugin to tag the site's own
 * files with the same key at build time, so it is only for builds that run
 * the plugin: Next.js through `withSentryConfig` (webpack and Turbopack), and
 * Vite or Astro through the Sentry Vite plugin. A Worker or Astro build whose
 * maps go up with `dd-sentry-release` has no tag, and must not add it.
 */

/** The key the bundler plugin tags first-party code with: `dd-<sentry project slug>`. */
export function applicationKey(project: string): string {
  return `dd-${project}`;
}

/**
 * Options for `Sentry.thirdPartyErrorFilterIntegration`, matched to
 * {@link applicationKey}. Drops an error only when all of its frames are
 * third-party; an error that passes through the site's code is kept.
 */
export function thirdPartyFilterOptions(project: string) {
  return {
    filterKeys: [applicationKey(project)],
    behaviour: "drop-error-if-exclusively-contains-third-party-frames" as const,
  };
}
