import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Test against craft's source, so a fresh checkout does not need craft
    // built first. CI runs the tests before the build.
    alias: { "@domandigital/craft": fileURLToPath(new URL("../craft/src/index.ts", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
