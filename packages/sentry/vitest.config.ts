import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Test against synthetic's source, so a fresh checkout does not need it built first.
      "@domandigital/synthetic": here("../synthetic/src/index.ts"),
      // The Next hooks import the site's own @sentry/nextjs; a recorder stands in for it.
      "@sentry/nextjs": here("src/__tests__/fixtures/sentry-nextjs.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
