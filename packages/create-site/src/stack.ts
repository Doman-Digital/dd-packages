// The technology a new site is declared to use, turned into an entry for Doman
// Digital's client register. This package is public, so it holds only the
// shape of an entry and never any client's data: the entry is written into the
// new site's own repo for the builder to hand over.
//
// Everything here is declared by the builder, not observed. Evidence is "Decl"
// for exactly that reason, and anything the builder did not say stays null or
// is listed in gaps: a placeholder string in a register is a claim nobody made.

import type { Answers } from "./answers.js";
import type { Framework } from "./detect.js";

export type StackAnswers = {
  host: string | null;
  dns: string | null;
  cms: string | null;
  analytics: string[];
  errorMonitoring: string | null;
  emailSending: string[];
};

export const NO_STACK: StackAnswers = { host: null, dns: null, cms: null, analytics: [], errorMonitoring: null, emailSending: [] };

/** Names people type, mapped to the names the register uses. Anything else is kept as typed. */
const ALIASES: Record<string, string> = {
  "google-analytics": "ga4",
  "google-analytics-4": "ga4",
  clarity: "microsoft-clarity",
  "google-tag-manager": "gtm",
  "facebook-pixel": "meta-pixel",
  "fb-pixel": "meta-pixel",
};

/** Analytics answers that belong to a different register category. */
const ANALYTICS_CATEGORY: Record<string, string> = { gtm: "tag-manager", "meta-pixel": "ads" };

const VALID_TOOL = /^[a-z0-9][a-z0-9.-]*$/;

/** "Google Analytics" -> "google-analytics" -> "ga4". Returns null when it cannot be a register name. */
export function toolName(raw: string): string | null {
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
  const name = ALIASES[slug] ?? slug;
  return VALID_TOOL.test(name) ? name : null;
}

export function siteSlug(tradingName: string): string {
  return tradingName
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type Tool = { category: string; tool: string; consent?: null; evidence: string[] };

const declared = (category: string, tool: string): Tool => ({ category, tool, evidence: ["Decl"] });
// The register wants to know when a tracking tool runs relative to the cookie banner. The
// builder cannot know that before the site is built, so it is left null and the register's
// own check fails until someone fills it in from what the site actually does.
const tracking = (category: string, tool: string): Tool => ({ category, tool, consent: null, evidence: ["Decl"] });

export function buildStackEntry(a: Answers, framework: Framework, today: string): Record<string, unknown> {
  const s = a.stack;
  const tools: Tool[] = [
    // Detected from the project's own files, so this one is read from the repo, not declared.
    { category: "framework", tool: framework === "next" ? "next-app-router" : "astro", evidence: ["C"] },
  ];
  if (s.host) tools.push(declared("host", s.host));
  if (s.dns) tools.push(declared("dns", s.dns));
  if (s.cms) tools.push(declared("cms", s.cms));
  for (const name of s.analytics) {
    const category = ANALYTICS_CATEGORY[name] ?? "analytics";
    tools.push(tracking(category, name));
  }
  if (s.errorMonitoring) tools.push(declared("error-monitoring", s.errorMonitoring));
  for (const name of s.emailSending) tools.push(declared("email-sending", name));

  const gaps = ["Declared at scaffold by the builder. Nothing here has been observed on a live site yet."];
  if (!s.host) gaps.push("Host not declared.");
  if (!s.dns) gaps.push("DNS host not declared.");

  return {
    [siteSlug(a.tradingName)]: {
      siteUrl: a.siteUrl,
      facts: {},
      stack: {
        verifiedOn: today,
        method: "create-site scaffold: declared by the builder, not observed",
        tools,
        gaps,
      },
    },
  };
}

export function renderStackEntry(a: Answers, framework: Framework, today: string): string {
  return `${JSON.stringify(buildStackEntry(a, framework, today), null, 2)}\n`;
}
