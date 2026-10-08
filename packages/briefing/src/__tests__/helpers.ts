import fortnight from "./fixtures/fortnight.json";
import type { ClientConfig, RawEntry, RawInput } from "../types";

export const REPO = "example/site";

let clock = Date.UTC(2026, 9, 1, 9, 0, 0);

/** A merged PR. Merge times increase with each call unless given. */
export function entry(number: number, title: string, forClient: string | null = null, extra: Partial<RawEntry> = {}): RawEntry {
  clock += 3600_000;
  return { repo: REPO, number, title, mergedAt: new Date(clock).toISOString(), forClient, ...extra };
}

export const briefingBlock = (lines: string) => `## Summary\n\nWhat changed.\n\n## Briefing\n${lines}\n\n## Test plan\n\n- [x] ran it\n`;

export function config(overrides: Partial<ClientConfig> = {}): ClientConfig {
  return {
    slug: "example",
    name: "Example",
    contactFirstName: "Sam",
    signoffName: "Dmitri",
    headline: "Your new booking page went live on 6 October.",
    subhead: "Your site passed every check this fortnight.",
    note: "The booking page is the first of three this autumn. I'll send the next one for you to read before it goes live.",
    approvals: [],
    urls: { log: "https://review.example/log", webView: "https://review.example/view" },
    ...overrides,
  };
}

export function input(overrides: Partial<RawInput> = {}): RawInput {
  return {
    period: { start: "2026-09-27", end: "2026-10-10", sendAt: "2026-10-11T08:00:00Z" },
    entries: [],
    uptime: { intervalSeconds: 300, incidents: [] },
    search: { clicks: 0, impressions: 0, queries: [] },
    ...overrides,
  };
}

export const approval = (id: string, title: string, sources: string[] = []) => ({
  id,
  title,
  why: "It sends only after you approve it.",
  content: `${id} content v1`,
  review: { label: "Review it", url: `https://review.example/${id}` },
  sources,
});

/** The committed fixture: a real client fortnight, redacted. A fresh copy each call. */
export function fixture(): { input: RawInput; config: ClientConfig } {
  return structuredClone(fortnight) as unknown as { input: RawInput; config: ClientConfig };
}

/**
 * The same fortnight unredacted, kept off this public repository. Set
 * BRIEFING_PRIVATE_FIXTURE to its path to run the fixture tests on it too
 * (Node only).
 */
export async function privateFixture(): Promise<{ input: RawInput; config: ClientConfig } | undefined> {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined>; versions?: { node?: string } } }).process;
  const path = env?.env?.BRIEFING_PRIVATE_FIXTURE;
  if (!path || !env?.versions?.node) return undefined;
  const fs = (await import(/* @vite-ignore */ "node:" + "fs")) as { readFileSync(p: string, e: string): string };
  return JSON.parse(fs.readFileSync(path, "utf8"));
}
