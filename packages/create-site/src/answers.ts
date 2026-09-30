// What the scaffold needs to know about the business. Flags win, then an
// --answers file, then prompts. Unknowns stay null: a placeholder string in a
// facts file is a claim nobody made.

import { readFileSync } from "node:fs";
import { SECTORS, registersFor } from "./sectors.js";
import type { Sector } from "./sectors.js";
import { toolName } from "./stack.js";
import type { StackAnswers } from "./stack.js";

export type Answers = {
  legalName: string;
  tradingName: string;
  siteUrl: string;
  sector: Sector;
  description: string;
  phone: string | null;
  email: string | null;
  locality: string | null;
  postalCode: string | null;
  serviceAreas: string[];
  /** Register ids from sectors.ts the business already holds. */
  registers: string[];
  /** Hostnames of a previous site that will redirect here. */
  previousHosts: string[];
  /** What the builder says the site uses. Declared, not observed: see stack.ts. */
  stack: StackAnswers;
};

export type AnswerSources = {
  flags: Partial<Record<"legalName" | "tradingName" | "siteUrl" | "sector" | "description", string>>;
  file: string | undefined;
  cwd: string;
  /** undefined when prompting is not allowed (no terminal, or --yes). */
  ask: ((question: string) => Promise<string>) | undefined;
};

const REQUIRED = [
  ["legalName", "--client", "Registered business name"],
  ["siteUrl", "--site-url", "Website address (https://...)"],
  ["sector", "--sector", "Sector (trades, beauty, clinics, professional)"],
  ["description", "--description", "What the business does and where, in a sentence or two"],
] as const;

const list = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String).map((s) => s.trim()).filter(Boolean) : typeof value === "string" ? value.split(",").map((s) => s.trim()).filter(Boolean) : [];

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);

export function validateSiteUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return "the site URL must be https";
    if (url.pathname !== "/" || url.search || url.hash) return "the site URL is the origin only, e.g. https://example.co.uk";
    return null;
  } catch {
    return `not a URL: ${value}`;
  }
}

type Optional = (key: string, question: string) => Promise<unknown>;

/** The technology the builder declares. Every question can be skipped; skipped stays null. */
async function collectStack(optional: Optional): Promise<StackAnswers | string> {
  const problems: string[] = [];
  const name = (key: string, value: string): string => {
    const n = toolName(value);
    if (!n) problems.push(`${key}: "${value}" is not a usable name (lowercase letters, digits, dots and hyphens)`);
    return n ?? value;
  };
  const single = async (key: string, question: string): Promise<string | null> => {
    const v = text(await optional(key, question));
    return v === null ? null : name(key, v);
  };
  const many = async (key: string, question: string): Promise<string[]> => [
    ...new Set(list(await optional(key, question)).map((v) => name(key, v))),
  ];

  const stack: StackAnswers = {
    host: await single("host", "Hosting, e.g. vercel"),
    dns: await single("dns", "DNS host, e.g. cloudflare"),
    cms: await single("cms", "CMS, e.g. sanity"),
    analytics: await many("analytics", "Analytics and tags, comma separated, e.g. ga4, gtm, posthog"),
    errorMonitoring: await single("errorMonitoring", "Error monitoring, e.g. sentry"),
    emailSending: await many("emailSending", "Email sending services, comma separated, e.g. resend"),
  };
  return problems.length > 0 ? problems.join("; ") : stack;
}

/** Resolves every answer, or returns an error message naming what is missing or wrong. */
export async function collectAnswers(sources: AnswerSources): Promise<Answers | string> {
  let file: Record<string, unknown> = {};
  if (sources.file) {
    try {
      file = JSON.parse(readFileSync(sources.file.startsWith("/") ? sources.file : `${sources.cwd}/${sources.file}`, "utf8"));
    } catch (error) {
      return `could not read --answers ${sources.file}: ${(error as Error).message}`;
    }
  }
  const pick = (key: string): string | null => text((sources.flags as Record<string, string | undefined>)[key]) ?? text(file[key]);

  const values: Record<string, string | null> = {};
  for (const [key] of REQUIRED) values[key] = pick(key);

  const missing = REQUIRED.filter(([key]) => !values[key]);
  if (missing.length > 0 && !sources.ask) {
    return `missing required answers (no prompting without a terminal, or with --yes): ${missing.map(([, flag]) => flag).join(", ")}`;
  }
  for (const [key, , question] of missing) {
    values[key] = text(await sources.ask!(`${question}: `));
    if (!values[key]) return `${question} is required`;
  }

  const sector = values.sector as Sector;
  if (!(sector in SECTORS)) return `unknown sector "${values.sector}": use one of ${Object.keys(SECTORS).join(", ")}`;
  const urlProblem = validateSiteUrl(values.siteUrl!);
  if (urlProblem) return urlProblem;

  const optional = async (key: string, question: string): Promise<unknown> => {
    if (key in file) return file[key];
    if (!sources.ask) return null;
    return (await sources.ask(`${question} (Enter to skip): `)).trim() || null;
  };

  const tradingName = pick("tradingName") ?? text(await optional("tradingName", "Trading name, if different")) ?? values.legalName!;
  const phone = text(await optional("phone", "Phone"));
  const email = text(await optional("email", "Email"));
  const locality = text(await optional("locality", "Town or city"));
  const postalCode = text(await optional("postalCode", "Postcode"));
  const serviceAreas = list(await optional("serviceAreas", "Areas served, comma separated"));

  const known = registersFor(sector);
  const registersQuestion = `Registers already held, comma separated ids (${known.map((r) => r.id).join(", ")})`;
  const registers = list(await optional("registers", registersQuestion));
  const unknownRegisters = registers.filter((id) => !known.some((r) => r.id === id));
  if (unknownRegisters.length > 0) return `unknown register id for ${sector}: ${unknownRegisters.join(", ")}`;

  const previousHosts = list(await optional("previousHosts", "Previous website hostname, if moving from one"));

  const stack = await collectStack(optional);
  if (typeof stack === "string") return stack;

  return {
    legalName: values.legalName!,
    tradingName,
    siteUrl: values.siteUrl!.replace(/\/$/, ""),
    sector,
    description: values.description!,
    phone,
    email,
    locality,
    postalCode,
    serviceAreas,
    registers,
    previousHosts,
    stack,
  };
}
