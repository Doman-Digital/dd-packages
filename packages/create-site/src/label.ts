// The start label: .dd/site-start.json says how a site was started. It
// describes; it is not the proof. The proof is `create-site --check` passing,
// which the estate sweep and the deploy refusal run. A hand-written label
// with a drifted site still fails the check.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { TEMPLATE_ROOT } from "./templates.js";

export const LABEL_PATH = ".dd/site-start.json";
export const TOOL_NAME = "@domandigital/create-site";

export type StartMode = "programme" | "handover";

export type StartInfo = {
  mode: StartMode;
  /** A handover's reason: why this site is copied in rather than built new. */
  reason?: string;
  /** The visible pieces a handover added. */
  with: string[];
  /** Programme mode: true when `dd-programme gate --stage 05` passed, false when --no-gate skipped it. */
  stage05Gate?: boolean;
  /** Handover mode: true when `dd-programme gate --handover` passed, false when --no-gate skipped it. */
  handoverGate?: boolean;
  version: string;
};

export function toolVersion(): string {
  return (JSON.parse(readFileSync(`${TEMPLATE_ROOT}../package.json`, "utf8")) as { version: string }).version;
}

export function renderLabel(start: StartInfo, programme: string | null, today: string): string {
  const label = {
    $comment:
      "How this site was started. A label only: the proof is `create-site --check` passing. Written by @domandigital/create-site; never replaced.",
    tool: TOOL_NAME,
    version: start.version,
    mode: start.mode,
    programme,
    ...(start.stage05Gate === undefined ? {} : { stage05Gate: start.stage05Gate }),
    ...(start.handoverGate === undefined ? {} : { handoverGate: start.handoverGate }),
    ...(start.mode === "handover" ? { reason: start.reason ?? null, with: start.with } : {}),
    startedAt: today,
  };
  return `${JSON.stringify(label, null, 2)}\n`;
}

/** The label a site already carries, or null when it has none or it cannot be read. */
export function readLabel(root: string): (Partial<StartInfo> & { programme?: string | null }) | null {
  const path = join(root, LABEL_PATH);
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    const mode = raw.mode === "handover" || raw.mode === "programme" ? raw.mode : undefined;
    return {
      mode,
      reason: typeof raw.reason === "string" ? raw.reason : undefined,
      with: Array.isArray(raw.with) ? raw.with.filter((w): w is string => typeof w === "string") : [],
      programme: typeof raw.programme === "string" ? raw.programme : null,
    };
  } catch {
    return null;
  }
}
