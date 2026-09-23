import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The core import stays pure: nothing reachable from src/index.ts may import
 * the browser half or Playwright. A pre-commit hook loading a browser to scan
 * a stylesheet is the failure this prevents.
 */
const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function reachable(entry: string, seen = new Set<string>()): Set<string> {
  if (seen.has(entry)) return seen;
  seen.add(entry);
  const text = readFileSync(entry, "utf8");
  for (const m of text.matchAll(/(?:import|export)[^"']*?from\s*["'](\.[^"']+)["']/g)) {
    reachable(resolve(dirname(entry), m[1].replace(/\.js$/, ".ts")), seen);
  }
  return seen;
}

describe("the core import", () => {
  const files = [...reachable(resolve(SRC, "index.ts"))];

  it("reaches the modules it should", () => {
    expect(files.some((f) => f.endsWith("snapshot/rendered.ts"))).toBe(true);
  });

  it("never reaches the browser half or Playwright", () => {
    expect(files.filter((f) => f.includes("/audit/"))).toEqual([]);
    for (const f of files) expect(readFileSync(f, "utf8"), f).not.toMatch(/["']playwright(?:-core)?["']/);
  });

  it("would notice if it did", () => {
    // The walker must follow a real import, or the assertion above is vacuous.
    const audit = [...reachable(resolve(SRC, "audit/cli.ts"))];
    expect(audit.some((f) => f.endsWith("audit/index.ts"))).toBe(true);
  });
});
