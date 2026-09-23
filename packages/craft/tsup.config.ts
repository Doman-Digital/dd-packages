import { defineConfig } from "tsup";

export default defineConfig([
  // The library: pure, zero dependencies, both module formats.
  { entry: ["src/index.ts"], format: ["cjs", "esm"], dts: true, clean: true },
  // The browser half: the only entry that may import Playwright, and only lazily.
  { entry: { audit: "src/audit/index.ts" }, format: ["cjs", "esm"], dts: true, clean: false, external: ["playwright", "playwright-core"] },
  // The CLI: ESM only, never imported, so no types.
  { entry: ["src/cli.ts"], format: ["esm"], dts: false, clean: false, external: ["playwright", "playwright-core"] },
]);
