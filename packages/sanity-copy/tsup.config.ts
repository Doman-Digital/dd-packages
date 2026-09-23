import { defineConfig } from "tsup";

export default defineConfig([
  // The library: what a Studio imports. No Node built-ins, so it bundles for the browser.
  { entry: ["src/index.ts"], format: ["cjs", "esm"], dts: true, clean: true },
  // The sweep command: ESM only, never imported, so no types.
  { entry: ["src/cli.ts"], format: ["esm"], dts: false, clean: false },
]);
