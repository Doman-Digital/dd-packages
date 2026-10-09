import { defineConfig } from "tsup";

export default defineConfig([
  // The presets: no runtime dependency outside this repo, both module formats.
  // `@sentry/nextjs` is only ever imported lazily, from the consumer's own install.
  {
    entry: ["src/index.ts", "src/browser.ts", "src/cloudflare.ts", "src/next.ts"],
    format: ["cjs", "esm"],
    dts: true,
    clean: true,
    external: ["@sentry/nextjs"],
  },
  // The CLI: ESM only, never imported, so no types.
  { entry: { cli: "src/cli.ts" }, format: ["esm"], dts: false, clean: false },
]);
