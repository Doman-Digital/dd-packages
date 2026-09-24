import { describe, expect, test } from "vitest";
import { patchConfig } from "../config-patch";
import { ASTRO_CONFIG, NEXT_CONFIG } from "./fixtures";

describe("patchConfig", () => {
  test("adds redirects() to the create-next-app config, reading redirects.json", () => {
    const patched = patchConfig("next", "next.config.ts", NEXT_CONFIG);
    expect(patched.kind).toBe("patched");
    if (patched.kind !== "patched") return;
    expect(patched.text).toContain("const siteRedirects: { from: string; to: string; permanent?: boolean }[] =");
    expect(patched.text).toContain("async redirects() {");
    expect(patched.text.split("\n")[0]).toBe('import type { NextConfig } from "next";');
  });

  test("leaves type annotations out of a .mjs config", () => {
    const patched = patchConfig("next", "next.config.mjs", NEXT_CONFIG.replace("import type { NextConfig } from \"next\";\n", "").replace(": NextConfig", ""));
    expect(patched.kind === "patched" && patched.text).not.toMatch(/siteRedirects:/);
    expect(patched.kind === "patched" && patched.text).toContain("/** @type {{ from: string; to: string; permanent?: boolean }[]} */\nconst siteRedirects =");
  });

  test("adds redirects to the create-astro config", () => {
    const patched = patchConfig("astro", "astro.config.mjs", ASTRO_CONFIG);
    expect(patched.kind === "patched" && patched.text).toContain(
      "defineConfig({\n  redirects: Object.fromEntries(\n    siteRedirects.map((r) => [r.from, { status: r.permanent === false ? 302 : 301, destination: r.to }]),\n  ),\n})",
    );
    expect(patched.kind === "patched" && patched.text.indexOf("import { defineConfig }")).toBeLessThan(
      patched.kind === "patched" ? patched.text.indexOf("const siteRedirects") : 0,
    );
  });

  test("recognises its own work, so a second run changes nothing", () => {
    const once = patchConfig("next", "next.config.ts", NEXT_CONFIG);
    expect(once.kind === "patched" && patchConfig("next", "next.config.ts", once.text)).toEqual({ kind: "already" });
  });

  test("hands back to a person when it cannot find exactly one config object", () => {
    expect(patchConfig("next", "next.config.ts", "export default { reactStrictMode: true };\n").kind).toBe("manual");
    expect(patchConfig("next", "next.config.js", "module.exports = { reactStrictMode: true };\n").kind).toBe("manual");
  });
});
