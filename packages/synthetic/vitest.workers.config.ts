import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// The same test files as vitest.config.ts, run inside workerd. The package is
// Web-Crypto-only, so a pass here is the proof that it runs in a Worker.
export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: { compatibilityDate: "2026-10-01" },
    }),
  ],
  test: {
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
