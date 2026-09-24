import { defineConfig } from "tsup";

// The CLI only: ESM, never imported, so no types and no CJS build (craft's
// CLI entry makes the same call). Templates ship as files, not code.
export default defineConfig({ entry: ["src/cli.ts"], format: ["esm"], dts: false, clean: true });
