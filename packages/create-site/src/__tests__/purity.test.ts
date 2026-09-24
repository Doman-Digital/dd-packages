// The scaffold has no runtime dependencies: everything under src/ imports
// only relative files or node: built-ins. A dependency here would be
// installed into every client's machine for one command.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { PACKAGE_ROOT } from "./fixtures";

describe("runtime imports", () => {
  test("src/ imports only relative paths and node: built-ins", () => {
    const dir = join(PACKAGE_ROOT, "src");
    const offenders: string[] = [];
    const walk = (d: string) => {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (entry.name !== "__tests__") walk(join(d, entry.name));
          continue;
        }
        const text = readFileSync(join(d, entry.name), "utf8");
        for (const m of text.matchAll(/^import(?!\s+type)[^"']*from\s*["']([^"']+)["']/gm)) {
          if (!m[1]!.startsWith(".") && !m[1]!.startsWith("node:")) offenders.push(`${entry.name}: ${m[1]}`);
        }
      }
    };
    walk(dir);
    expect(offenders).toEqual([]);
  });

  test("would notice a bare import", () => {
    expect(/^import(?!\s+type)[^"']*from\s*["']([^"']+)["']/m.exec('import { x } from "lodash";')?.[1]).toBe("lodash");
  });
});
