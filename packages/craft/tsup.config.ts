import { defineConfig } from "tsup";

export default defineConfig([
  // The library: pure, zero dependencies, both module formats.
  { entry: ["src/index.ts"], format: ["cjs", "esm"], dts: true, clean: true },
  // The CLI: ESM only, never imported, so no types.
  { entry: ["src/cli.ts"], format: ["esm"], dts: false, clean: false },
]);
