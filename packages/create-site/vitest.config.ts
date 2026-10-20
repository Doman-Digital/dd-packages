import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (pkg: string) => fileURLToPath(new URL(`../${pkg}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    // Test against the house packages' source, so a fresh checkout does not
    // need them built first. CI runs the tests before the build.
    alias: {
      // The templates import the site's own files as ~site/<key>; the tests of
      // the shared templates point the keys they use at the template itself.
      "~site/consent": fileURLToPath(new URL("./templates/shared/lib/consent.ts", import.meta.url)),
      "@domandigital/craft": src("craft"),
      "@domandigital/graph": src("graph"),
      "@domandigital/seo": src("seo"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    testTimeout: 30_000,
  },
});
