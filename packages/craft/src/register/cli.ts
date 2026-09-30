/** `craft register list | brief | check`: write in a chosen register, then see where the draft sits. */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Io } from "../character/cli.js";
import { toJson } from "../character/json.js";
import { checkRegister, featureLabel, MIN_PARAGRAPHS, type RegisterCheck } from "./check.js";
import { PROFILE, PROFILE_MEASURED } from "./profile.js";
import { getRegister, REGISTER_IDS, REGISTERS, registerBrief, type RegisterId } from "./registers.js";

const USAGE = `usage: craft register list [--json]
       craft register brief <${REGISTER_IDS.join("|")}> [--json]
       craft register check <file> --as <${REGISTER_IDS.join("|")}> [--json]`;

function formatCheck(c: RegisterCheck, file: string): string {
  const name = getRegister(c.register)!.name;
  const lines = [`craft register check ${file} --as ${c.register} (${name})`, ""];
  if (!c.measured) return [...lines, c.summary].join("\n");
  lines.push(`${c.paragraphs} paragraphs measured. ${c.summary}`, "");
  for (const o of c.outside) lines.push(`  ${o.sentence}`);
  if (c.outside.length) lines.push("");
  lines.push("Closest baselines:");
  for (const n of c.nearest.slice(0, 3)) lines.push(`  ${n.register.padEnd(16)} ${n.distance.toFixed(2)}`);
  lines.push("", c.note, `Each range is the middle 80% of human documents, so one in five falls outside any single range. Bands measured ${PROFILE_MEASURED}, over ${MIN_PARAGRAPHS}-paragraph averages. A read-through, not a grade.`);
  return lines.join("\n");
}

export function runRegister(args: string[], io: Io): number {
  const [sub, ...rest] = args;
  const json = rest.includes("--json");
  const positional = rest.filter((a, i) => !a.startsWith("--") && rest[i - 1] !== "--as");
  const bad = (msg: string) => {
    io.err(`craft register: ${msg}\n${USAGE}`);
    return 2;
  };

  if (sub === "list") {
    if (json) io.out(toJson({ registers: REGISTERS.map(({ id, name, useFor }) => ({ id, name, useFor })) }));
    else for (const r of REGISTERS) io.out(`${r.id.padEnd(11)} ${r.name}. ${r.useFor}`);
    return 0;
  }

  if (sub === "brief") {
    const id = positional[0];
    const r = id ? getRegister(id) : undefined;
    if (!r) return bad(id ? `unknown register "${id}". Registers: ${REGISTER_IDS.join(", ")}` : "name a register");
    io.out(json ? toJson({ register: r }) : registerBrief(r.id));
    return 0;
  }

  if (sub === "check") {
    const i = rest.indexOf("--as");
    const id = i === -1 ? undefined : rest[i + 1];
    if (!id || !getRegister(id)) return bad(id ? `unknown register "${id}". Registers: ${REGISTER_IDS.join(", ")}` : "--as <register> is required");
    const file = positional[0];
    if (!file) return bad("name a file to check");
    const path = resolve(io.cwd, file);
    if (!existsSync(path)) return bad(`${file} does not exist`);
    const result = checkRegister(readFileSync(path, "utf8"), id as RegisterId, PROFILE);
    if (json) io.out(toJson({ ...result, labels: Object.fromEntries(Object.keys(result.means).map((f) => [f, featureLabel(f)])) }));
    else io.out(formatCheck(result, file));
    return 0;
  }

  return bad(sub ? `unknown subcommand "${sub}"` : "name a subcommand");
}
