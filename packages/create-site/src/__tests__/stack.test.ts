import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { run } from "../run";
import { buildStackEntry, siteSlug, toolName } from "../stack";
import type { Answers } from "../answers";
import { ANSWERS, captureIo, cleanup, makeProject, snapshotTree, writeAnswers } from "./fixtures";

const roots: string[] = [];
const project = (...args: Parameters<typeof makeProject>) => {
  const root = makeProject(...args);
  roots.push(root);
  return root;
};
afterEach(() => roots.splice(0).forEach(cleanup));

const STACK = {
  host: "Vercel",
  dns: "cloudflare",
  cms: "sanity",
  analytics: ["Google Analytics", "gtm", "Meta Pixel", "posthog"],
  errorMonitoring: "sentry",
  emailSending: "resend, brevo",
};

const scaffold = async (root: string, overrides: Record<string, unknown> = {}, extra: string[] = []) => {
  const captured = captureIo(root);
  const code = await run(["--yes", "--skip-install", "--answers", writeAnswers(root, overrides), ...extra], captured.io);
  return { code, ...captured };
};

const readEntry = (root: string) => JSON.parse(readFileSync(join(root, "docs/client-facts.entry.json"), "utf8"));

describe("toolName", () => {
  test("maps the names people type to the register's names", () => {
    expect(toolName("Google Analytics")).toBe("ga4");
    expect(toolName("  Clarity ")).toBe("microsoft-clarity");
    expect(toolName("Meta Pixel")).toBe("meta-pixel");
    expect(toolName("Google Tag Manager")).toBe("gtm");
  });
  test("keeps anything else as typed, lowercased and hyphenated", () => {
    expect(toolName("PostHog")).toBe("posthog");
    expect(toolName("Cloudflare Turnstile")).toBe("cloudflare-turnstile");
  });
  test("refuses what cannot be a register name", () => {
    expect(toolName("sentry!")).toBeNull();
    expect(toolName("")).toBeNull();
    expect(toolName("a/b")).toBeNull();
  });
});

describe("siteSlug", () => {
  test("is the lowercase hyphenated trading name", () => {
    expect(siteSlug("Acme Electrical")).toBe("acme-electrical");
    expect(siteSlug("Chair & Blade")).toBe("chair-and-blade");
    expect(siteSlug("  Rise, Bloom!  ")).toBe("rise-bloom");
  });
});

describe("buildStackEntry", () => {
  const answers = (stack: Partial<Answers["stack"]>): Answers => ({
    ...(ANSWERS as unknown as Answers),
    stack: { host: null, dns: null, cms: null, analytics: [], errorMonitoring: null, emailSending: [], ...stack },
  });
  const tools = (entry: Record<string, unknown>) => (Object.values(entry)[0] as { stack: { tools: Record<string, unknown>[] } }).stack.tools;

  test("with nothing declared, carries only the framework it read from the repo, and says what is missing", () => {
    const entry = buildStackEntry(answers({}), "next", "2026-10-01");
    expect(tools(entry)).toEqual([{ category: "framework", tool: "next-app-router", evidence: ["C"] }]);
    const gaps = (Object.values(entry)[0] as { stack: { gaps: string[] } }).stack.gaps;
    expect(gaps.join(" ")).toMatch(/Host not declared/);
    expect(gaps.join(" ")).toMatch(/DNS host not declared/);
  });

  test("a skipped answer produces no entry at all, never a placeholder", () => {
    const list = tools(buildStackEntry(answers({ host: "vercel" }), "astro", "2026-10-01"));
    expect(list.map((t) => t.category)).toEqual(["framework", "host"]);
    expect(list[0]!.tool).toBe("astro");
  });

  test("tracking tools go in the right category and leave consent null, because the builder cannot know it", () => {
    const list = tools(buildStackEntry(answers({ analytics: ["ga4", "gtm", "meta-pixel", "posthog"] }), "next", "2026-10-01"));
    const by = Object.fromEntries(list.map((t) => [t.tool, t]));
    expect(by.ga4).toMatchObject({ category: "analytics", consent: null, evidence: ["Decl"] });
    expect(by.gtm).toMatchObject({ category: "tag-manager", consent: null });
    expect(by["meta-pixel"]).toMatchObject({ category: "ads", consent: null });
    expect(by.posthog).toMatchObject({ category: "analytics", consent: null });
  });

  test("non-tracking tools carry no consent field", () => {
    const list = tools(buildStackEntry(answers({ cms: "sanity", errorMonitoring: "sentry", emailSending: ["resend"] }), "next", "2026-10-01"));
    for (const t of list.filter((x) => x.category !== "framework")) {
      expect(t).not.toHaveProperty("consent");
      expect(t.evidence).toEqual(["Decl"]);
    }
  });
});

describe("the scaffold", () => {
  test("writes an entry with the declared stack, ready to paste", async () => {
    const root = project("next-root");
    const { code } = await scaffold(root, STACK);
    expect(code).toBe(0);
    const entry = readEntry(root);
    expect(Object.keys(entry)).toEqual(["acme-electrical"]);
    expect(entry["acme-electrical"].siteUrl).toBe("https://acme-electrical.example");
    const list = entry["acme-electrical"].stack.tools as { category: string; tool: string }[];
    expect(list.map((t) => `${t.category}:${t.tool}`)).toEqual([
      "framework:next-app-router",
      "host:vercel",
      "dns:cloudflare",
      "cms:sanity",
      "analytics:ga4",
      "tag-manager:gtm",
      "ads:meta-pixel",
      "analytics:posthog",
      "error-monitoring:sentry",
      "email-sending:resend",
      "email-sending:brevo",
    ]);
  });

  test("with no stack answers it still writes an entry, and says what to do with it", async () => {
    const root = project("astro");
    const { code, out } = await scaffold(root);
    expect(code).toBe(0);
    expect(readEntry(root)["acme-electrical"].stack.tools).toHaveLength(1);
    expect(out.join("\n")).toMatch(/client-facts\.entry\.json/);
  });

  test("the launch checklist asks for the hand-over", async () => {
    const root = project("next-root");
    await scaffold(root, STACK);
    expect(readFileSync(join(root, "docs/seo-launch-checklist.md"), "utf8")).toMatch(/client register/);
  });

  test("a name that cannot be a register name stops the run before anything is written", async () => {
    const root = project("next-root");
    const before = snapshotTree(root);
    const { code, err } = await scaffold(root, { analytics: ["ga4", "bad name!"] });
    expect(code).toBe(2);
    expect(err.join("\n")).toMatch(/analytics: "bad name!" is not a usable name/);
    expect(snapshotTree(root)).toEqual(before);
    expect(existsSync(join(root, "docs/client-facts.entry.json"))).toBe(false);
  });

  test("the entry is the builder's data: a re-run and --force never replace an edited one", async () => {
    const root = project("next-root");
    await scaffold(root, STACK);
    const path = join(root, "docs/client-facts.entry.json");
    const edited = readFileSync(path, "utf8").replace('"consent": null', '"consent": "after-accept"');
    writeFileSync(path, edited);
    await scaffold(root, STACK, ["--force"]);
    expect(readFileSync(path, "utf8")).toBe(edited);
  });
});
