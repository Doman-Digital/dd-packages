import { defineConfig } from "tsup";

// The CLI only: ESM, never imported, so no types. Playwright and the SDKs come from node_modules.
export default defineConfig({
  entry: { cli: "src/cli.ts" },
  format: ["esm"],
  dts: false,
  clean: true,
  external: ["playwright", "playwright-core", "@anthropic-ai/sdk", "@anthropic-ai/bedrock-sdk"],
});
