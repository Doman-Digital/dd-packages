import { existsSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auditSnapshot } from "../character/check.js";
import { fingerprint, fingerprintDistance } from "../fingerprint/index.js";

/**
 * The browser half, end to end: a real Chromium renders two local pages and
 * the rendered tells judge them. Skipped, visibly, where no browser exists
 * (CI has none); the detectors themselves are proved in catalogue.test.ts
 * with snapshot fixtures, which run everywhere.
 */
const chromium = process.env.CRAFT_CHROMIUM ?? (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const page = (name: string) => readFileSync(fileURLToPath(new URL(`./pages/${name}`, import.meta.url)), "utf8");

let server: Server;
let base = "";

describe.skipIf(!chromium)("craft audit in a real browser", () => {
  beforeAll(async () => {
    server = createServer((req, res) => {
      res.setHeader("content-type", "text/html");
      res.end(page(req.url === "/decided" ? "decided.html" : "generated.html"));
    });
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((done) => server.close(() => done())));

  it("finds the generated look on a page built from it", async () => {
    const { snapshotUrl } = await import("../audit/index.js");
    const snap = await snapshotUrl(`${base}/generated`, { executablePath: chromium, introWindowMs: 1500 });
    const tells = new Set(auditSnapshot(snap).findings.map((f) => f.tell));
    for (const id of [
      "reflex-font",
      "reflex-font-2",
      "ai-violet",
      "blue-purple-gradient",
      "gradient-text",
      "glass-panel",
      "cream-palette",
      "italic-serif-display",
      "hero-eyebrow-chip",
      "icon-tile-grid",
      "hero-then-proof",
      "reveal-everywhere",
      "pill-everything",
      "radial-spotlight-glow",
      "marquee",
      "thin-border-wide-shadow",
      "intro-cinematic",
    ]) {
      expect(tells, id).toContain(id);
    }
  }, 60_000);

  it("finds nothing on a page someone decided, and fingerprints the two far apart", async () => {
    const { snapshotUrl } = await import("../audit/index.js");
    const decided = await snapshotUrl(`${base}/decided`, { executablePath: chromium, introWindowMs: 200 });
    expect(auditSnapshot(decided).findings.map((f) => f.tell)).toEqual([]);
    const generated = await snapshotUrl(`${base}/generated`, { executablePath: chromium, introWindowMs: 1500 });
    const d = fingerprintDistance(fingerprint(decided), fingerprint(generated));
    expect(d.total).toBeGreaterThan(0.5);
    expect(fingerprintDistance(fingerprint(decided), fingerprint(decided)).total).toBe(0);
  }, 60_000);
});
