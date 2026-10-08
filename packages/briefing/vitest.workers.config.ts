import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// The same test files as vitest.config.ts, run inside workerd. dd-relay builds
// briefings with this package on a Worker, so a pass here is the proof that the
// Europe/London date maths and the hashing hold there too.
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
