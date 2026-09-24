import { describe, expect, test } from "vitest";
import { parseOptions } from "../args";
import { run } from "../run";
import { captureIo } from "./fixtures";

describe("parseOptions", () => {
  test("reads the directory and every flag", () => {
    const o = parseOptions(["site", "--client", "Acme Ltd", "--sector", "trades", "--dry-run", "--skip-install", "-y"]);
    expect(typeof o !== "string" && [o.dir, o.client, o.sector, o.dryRun, o.skipInstall, o.yes]).toEqual([
      "site",
      "Acme Ltd",
      "trades",
      true,
      true,
      true,
    ]);
  });

  test("an unknown flag is a usage error, exit 2", async () => {
    const { io, err } = captureIo(process.cwd());
    expect(await run(["--nope"], io)).toBe(2);
    expect(err.join("\n")).toMatch(/Unknown option '--nope'/);
  });

  test("--help prints the usage and exits 0", async () => {
    const { io, out } = captureIo(process.cwd());
    expect(await run(["--help"], io)).toBe(0);
    expect(out.join("\n")).toMatch(/pnpm create @domandigital\/site/);
  });
});
