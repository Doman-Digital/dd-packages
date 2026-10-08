import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// The same suite as vitest.config.ts, run inside workerd. The protocol is Web
// Crypto only, so this is the runtime the form handlers actually use.
// node:crypto is used by the suite for independent cross-checks, hence
// nodejs_compat.
export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: { compatibilityDate: "2026-08-22", compatibilityFlags: ["nodejs_compat"] },
    }),
  ],
  test: {
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
