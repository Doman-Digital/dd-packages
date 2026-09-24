import { existsSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auditSnapshot } from "../character/check.js";
import { fingerprint, fingerprintDistance } from "../fingerprint/index.js";
import { AI_IRI, png, xmpChunk, xmpPacket } from "./image-bytes.js";

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
    // A photo of the job, and one a generator labelled as its own.
    const job = png(64, 40);
    const generated = png(64, 40, [xmpChunk(xmpPacket(AI_IRI))]);
    server = createServer((req, res) => {
      if (req.url?.startsWith("/img/") || req.url?.startsWith("/_next/image")) {
        res.setHeader("content-type", "image/png");
        res.end(req.url.startsWith("/img/ai.png") ? generated : job);
        return;
      }
      res.setHeader("content-type", "text/html");
      if (req.url === "/missing") {
        res.statusCode = 404;
        res.end("<!doctype html><title>Not found</title><h1>Not found</h1>");
        return;
      }
      res.end(page(req.url === "/decided" ? "decided.html" : req.url === "/nested" ? "nested-reveal.html" : req.url === "/roles" ? "roles.html" : req.url === "/components" ? "components.html" : req.url === "/imagery" ? "imagery.html" : "generated.html"));
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
      "no-real-imagery",
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

  it("snapshots several pages through one browser, and one that will not load costs only itself", async () => {
    const { snapshotUrl, snapshotUrls } = await import("../audit/index.js");
    // Port 9 is one Chromium refuses to open, so the page fails at once.
    const results = await snapshotUrls([`${base}/decided`, "http://127.0.0.1:9/", `${base}/generated`], { executablePath: chromium, introWindowMs: 200, timeoutMs: 5000 });
    expect(results.map((r) => Boolean(r.snapshot))).toEqual([true, false, true]);
    expect(results[1].error).toMatch(/net::ERR_UNSAFE_PORT/);
    await expect(snapshotUrl("http://127.0.0.1:9/", { executablePath: chromium, timeoutMs: 5000 })).rejects.toThrow(/net::ERR_UNSAFE_PORT/);
  }, 60_000);

  it("never measures an error page as the page", async () => {
    // A 404 page is a page of its own. Measured, it reports a missing page as
    // clean, and a page not measured must never count as a pass.
    const { snapshotUrl, snapshotUrls } = await import("../audit/index.js");
    const results = await snapshotUrls([`${base}/missing`, `${base}/decided`], { executablePath: chromium, introWindowMs: 200 });
    expect(results.map((r) => Boolean(r.snapshot))).toEqual([false, true]);
    expect(results[0].error).toBe("HTTP 404");
    await expect(snapshotUrl(`${base}/missing`, { executablePath: chromium })).rejects.toThrow(/HTTP 404/);
  }, 60_000);

  it("names what each section is for, and measures its layout and the page's pixels (snapshot v2)", async () => {
    const { snapshotUrl } = await import("../audit/index.js");
    const snap = await snapshotUrl(`${base}/roles`, { executablePath: chromium, introWindowMs: 200 });
    expect(snap.version).toBe(2);
    expect(snap.sections.map((s) => s.role)).toEqual(["hero", "pricing", "testimonials", "process", "faq", "team", "contact", "footer-cta"]);
    // kind keeps its version 1 meaning: the rendered tells were calibrated on it.
    expect(snap.sections.every((s) => ["hero", "logos", "stats", "cards", "marquee", "text", "other"].includes(s.kind))).toBe(true);
    const band = snap.sections.at(-1)!.geometry!;
    expect(band.centredShare).toBeGreaterThan(0.9);
    expect(band.controls).toBe(1);
    expect(band.background).toBe("rgb(31, 58, 46)");
    const pricing = snap.sections[1].geometry!;
    expect(pricing.centredShare).toBeLessThan(0.5);
    expect(pricing.contentWidthRatio).toBeGreaterThan(0.8);
    expect(typeof snap.rhythmVariance).toBe("number");
    expect(snap.visual).toBeDefined();
    expect(snap.visual!.colourfulness).toBeGreaterThan(0);
    expect(snap.visual!.height).toBe(Math.min(snap.pageHeight, 6000));
  }, 60_000);

  it("finds the stock components on a page built from them, and none on the page with its own (Phase L)", async () => {
    const { snapshotUrl } = await import("../audit/index.js");
    const stock = await snapshotUrl(`${base}/components`, { executablePath: chromium, introWindowMs: 200 });
    expect(stock.sections.map((s) => s.role)).toEqual(["hero", "text", "stats", "pricing", "testimonials", "faq", "footer-cta"]);
    const pricing = stock.sections[3];
    expect(pricing.cards).toBe(3);
    expect(pricing.badges).toContain("Most popular");
    const quotes = stock.sections[4];
    expect(quotes.carousel).toBe(true);
    expect(quotes.avatars).toBe(3);
    expect(stock.sections[2].figures).toBe(4);
    const found = new Set(auditSnapshot(stock).findings.map((f) => f.tell));
    for (const id of ["cta-band-stock", "pricing-trio-popular", "testimonial-avatar-carousel", "faq-accordion-closer", "stats-row"]) expect(found, id).toContain(id);

    const own = await snapshotUrl(`${base}/roles`, { executablePath: chromium, introWindowMs: 200 });
    const ownFound = new Set(auditSnapshot(own).findings.map((f) => f.tell));
    for (const id of ["pricing-trio-popular", "testimonial-avatar-carousel", "faq-accordion-closer", "stats-row", "centred-everything"]) expect(ownFound, id).not.toContain(id);
    expect(own.sections[1].badges).toEqual([]);
    expect(own.sections[2].carousel).toBe(false);
  }, 60_000);

  it("records every picture with its role, unwraps an image optimiser, and reads a generator's label (Phase M)", async () => {
    const { snapshotUrl } = await import("../audit/index.js");
    const snap = await snapshotUrl(`${base}/imagery`, { executablePath: chromium, introWindowMs: 200 });
    const images = snap.images!;
    const bySrc = (end: string) => images.filter((i) => i.src.endsWith(end));
    expect(bySrc("/img/ai.png")[0]).toMatchObject({ role: "photo", section: 0, background: false, decorative: false });
    expect(bySrc("/img/ai.png")[0].provenance).toMatchObject({ digitalSourceType: "trainedAlgorithmicMedia", source: "xmp" });
    expect(images.filter((i) => i.role === "icon")).toHaveLength(3);
    expect(bySrc("/img/shutterstock_1234567890.png")[0]).toMatchObject({ role: "photo", decorative: true });
    // /_next/image?url=%2Fimg%2Fjob.png is read as the file it serves.
    expect(images.some((i) => i.src === `${base}/img/job.png` && i.role === "photo" && !i.background && i.alt === "The new combi in Hinton")).toBe(true);
    expect(images.find((i) => i.role === "avatar")).toMatchObject({ width: 56, alt: "Sam" });
    expect(images.find((i) => i.background)).toMatchObject({ role: "photo", section: 4 });
    expect(images.find((i) => i.role === "logo")).toMatchObject({ alt: "Acme Heating logo", section: null });
    expect(images.find((i) => i.src === `${base}/img/job.png` && !i.background)?.provenance).toMatchObject({ digitalSourceType: null });

    const found = new Set(auditSnapshot(snap).findings.map((f) => f.tell));
    expect(found).toContain("ai-image");
    expect(found).toContain("stock-photo");
    expect(found).not.toContain("no-real-imagery");
    expect(found).not.toContain("stock-avatar");

    const unread = await snapshotUrl(`${base}/imagery`, { executablePath: chromium, introWindowMs: 200, provenance: false });
    expect(unread.images!.every((i) => i.provenance === undefined)).toBe(true);
    expect(auditSnapshot(unread).findings.map((f) => f.tell)).not.toContain("ai-image");
  }, 60_000);

  it("sees a reveal on the cards inside a section, not only on the section", async () => {
    // Found in the null models: the one generated page with scroll reveals put
    // them on cards two levels down, and the section-level check read it as still.
    const { snapshotUrl } = await import("../audit/index.js");
    const snap = await snapshotUrl(`${base}/nested`, { executablePath: chromium, introWindowMs: 200 });
    expect(snap.motion.hiddenSections).toBeGreaterThanOrEqual(4);
    expect(auditSnapshot(snap).findings.map((f) => f.tell)).toContain("reveal-everywhere");
  }, 60_000);
});
