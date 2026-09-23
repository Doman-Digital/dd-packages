/** `craft direction init | validate | propose`. All file I/O for art-direction.json lives here. */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseFlags, type Io } from "../character/cli.js";
import { fingerprint, type Fingerprint } from "../fingerprint/index.js";
import type { Snapshot } from "../snapshot/types.js";
import { initDirection } from "./init.js";
import { decodePng } from "./png.js";
import { paletteFromPixels, propose } from "./propose.js";
import type { ArtDirection } from "./types.js";
import { validateDirection } from "./validate.js";

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;

function fingerprintFrom(path: string | undefined, cwd: string): Fingerprint | undefined {
  return path ? fingerprint(readJson<Snapshot>(resolve(cwd, path))) : undefined;
}

function estateFrom(dir: string | undefined, cwd: string): { id: string; fingerprint: Fingerprint }[] {
  if (!dir) return [];
  const root = resolve(cwd, dir);
  return readdirSync(root)
    .filter((f) => f.endsWith(".json"))
    .flatMap((f) => {
      try {
        const snap = readJson<Snapshot>(join(root, f));
        return snap.version === 1 && snap.fonts ? [{ id: f.replace(/(\.snapshot)?\.json$/, ""), fingerprint: fingerprint(snap) }] : [];
      } catch {
        return [];
      }
    });
}

export function runDirection(args: string[], io: Io): number {
  try {
    const flags = parseFlags(args);
    if (typeof flags === "string") throw new Error(flags);
    const [sub] = flags.positional;
    const file = resolve(io.cwd, flags.direction ?? "art-direction.json");
    const current = fingerprintFrom(flags.snapshot, io.cwd);

    if (sub === "init") {
      const out = resolve(io.cwd, flags.out ?? "art-direction.json");
      if (existsSync(out) && !flags.out) {
        // An existing file keeps its exceptions; nothing else is overwritten silently.
        const existing = readJson<Partial<ArtDirection>>(out);
        if (existing.version !== undefined) throw new Error(`${out} already records choices. Pass --out to write elsewhere.`);
        const next = initDirection({ client: flags.client, current, exceptions: existing.exceptions });
        writeFileSync(out, `${JSON.stringify(next, null, 2)}\n`);
      } else {
        writeFileSync(out, `${JSON.stringify(initDirection({ client: flags.client, current }), null, 2)}\n`);
      }
      io.out(`craft direction: wrote ${out}. Add the sources and a reason for every choice, then run craft direction validate.`);
      return 0;
    }

    if (sub === "validate") {
      if (!existsSync(file)) throw new Error(`no ${file}. Run craft direction init.`);
      const report = validateDirection(readJson<unknown>(file), {
        fingerprint: current,
        pathExists: (p) => existsSync(resolve(dirname(file), p)),
      });
      if (flags.json) io.out(JSON.stringify(report, null, 2));
      else {
        for (const p of report.problems) io.out(`  ${p.severity === "error" ? "error" : "warn "}  ${p.at || "(file)"}  ${p.message}`);
        io.out(`craft direction: ${report.valid ? "valid" : "not valid"}, ${report.decided} of 7 choices decided with a reason.`);
      }
      return report.valid ? 0 : 1;
    }

    if (sub === "propose") {
      if (!existsSync(file)) throw new Error(`no ${file}. Run craft direction init and add the sources first.`);
      const base = readJson<ArtDirection>(file);
      const sources = (base.sources ?? []).map((s) => {
        if (s.colours?.length || !s.path || !/\.png$/i.test(s.path)) return s;
        const path = resolve(dirname(file), s.path);
        if (!existsSync(path)) return s;
        try {
          const { rgba } = decodePng(readFileSync(path));
          return { ...s, colours: paletteFromPixels(rgba).filter((c) => c.share >= 0.03).map((c) => c.hex) };
        } catch (error) {
          io.err(`craft direction: ${s.path}: ${(error as Error).message}`);
          return s;
        }
      });
      const result = propose({ client: base.client, brief: base.brief, sources, current, estate: estateFrom(flags.estate, io.cwd) });
      const merged: ArtDirection = { ...base, sources, choices: { ...result.direction.choices, ...stripUndecided(base.choices) }, ...(base.exceptions ? { exceptions: base.exceptions } : {}) };
      const text = `${JSON.stringify(merged, null, 2)}\n`;
      if (flags.out) writeFileSync(resolve(io.cwd, flags.out), text);
      else io.out(text);
      for (const p of result.proposals) {
        io.err(`${p.key}: ${p.candidates.length ? p.candidates.map((c) => `${c.value || "?"} (${c.note})`).join("; ") : "nothing in the sources to draw on yet"}`);
      }
      return 0;
    }

    throw new Error("usage: craft direction init | validate | propose");
  } catch (error) {
    io.err(`craft: ${(error as Error).message}`);
    return 2;
  }
}

/** Choices a person has already reasoned keep priority over a proposal. */
function stripUndecided(choices: ArtDirection["choices"] = {}): ArtDirection["choices"] {
  return Object.fromEntries(Object.entries(choices).filter(([, c]) => c && c.because && c.because.trim().length > 0));
}
