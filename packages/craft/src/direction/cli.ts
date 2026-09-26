/** `craft direction init | validate | propose | research`. All file I/O for art-direction.json lives here. */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseFlags, type Io } from "../character/cli.js";
import { fingerprint, type Fingerprint } from "../fingerprint/index.js";
import { readSnapshot } from "../snapshot/migrate.js";
import type { Snapshot } from "../snapshot/types.js";
import { initDirection } from "./init.js";
import { decodePng } from "./png.js";
import { paletteFromPixels, propose } from "./propose.js";
import { researchPrompt } from "./research.js";
import { PAGE_TYPES, type ArtDirection, type DirectionSource, type PageType } from "./types.js";
import { validateDirection } from "./validate.js";
import type { DirectionSummary } from "../estate/direction.js";
import { toJson } from "../character/json.js";

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;

/** A saved snapshot, or a URL (a Vercel preview, a local dev server, production) taken now. */
async function snapshotFrom(target: string | undefined, cwd: string): Promise<Snapshot | undefined> {
  if (!target) return undefined;
  if (/^https?:\/\//.test(target)) {
    const { snapshotUrl } = await import("../audit/index.js");
    return snapshotUrl(target);
  }
  return readSnapshot(readJson<unknown>(resolve(cwd, target)), target);
}

/** Declared directions in the estate register, for the before-build check. */
function declaredFrom(path: string | undefined, cwd: string): { id: string; client?: string; direction?: DirectionSummary }[] {
  if (!path || !path.endsWith(".json")) return [];
  const register = readJson<{ sites?: { id: string; client?: string; direction?: DirectionSummary }[] }>(resolve(cwd, path));
  return register.sites ?? [];
}

const TEXT_SOURCE = /\.(?:txt|md|markdown|csv|json|html?)$/i;

function estateFrom(dir: string | undefined, cwd: string): { id: string; fingerprint: Fingerprint }[] {
  if (!dir) return [];
  const root = resolve(cwd, dir);
  // The estate register, or a folder of snapshots.
  if (root.endsWith(".json")) {
    const register = readJson<{ sites?: { id: string; fingerprint: Fingerprint }[] }>(root);
    return (register.sites ?? []).filter((s) => s.fingerprint).map((s) => ({ id: s.id, fingerprint: s.fingerprint }));
  }
  return readdirSync(root)
    .filter((f) => f.endsWith(".json"))
    .flatMap((f) => {
      try {
        const snap = readSnapshot(readJson<unknown>(join(root, f)), f);
        return snap.fonts ? [{ id: f.replace(/(\.snapshot)?\.json$/, ""), fingerprint: fingerprint(snap) }] : [];
      } catch {
        return [];
      }
    });
}

export async function runDirection(args: string[], io: Io): Promise<number> {
  try {
    const flags = parseFlags(args);
    if (typeof flags === "string") throw new Error(flags);
    const [sub] = flags.positional;
    const file = resolve(io.cwd, flags.direction ?? "art-direction.json");

    if (sub === "research") {
      const base = existsSync(file) ? readJson<Partial<ArtDirection>>(file) : {};
      const brief = flags.brief ?? base.brief;
      if (!brief || brief.trim().split(/\s+/).length < 5) throw new Error('usage: craft direction research --brief "<who, where, what they do>" [--visual], or run it next to an art-direction.json with a brief');
      io.out(researchPrompt({ brief, client: flags.client ?? base.client, visual: flags.visual }));
      return 0;
    }

    const page = (flags.page ?? "home") as PageType;
    if (!(PAGE_TYPES as readonly string[]).includes(page)) throw new Error(`--page takes one of ${PAGE_TYPES.join(", ")}`);
    const snapshot = await snapshotFrom(flags.snapshot, io.cwd);
    const current = snapshot ? fingerprint(snapshot) : undefined;

    if (sub === "init") {
      const out = resolve(io.cwd, flags.out ?? "art-direction.json");
      if (existsSync(out) && !flags.out) {
        // An existing file keeps its exceptions; nothing else is overwritten silently.
        const existing = readJson<Partial<ArtDirection>>(out);
        if (existing.version !== undefined) throw new Error(`${out} already records choices. Pass --out to write elsewhere.`);
        const next = initDirection({ client: flags.client, brief: flags.brief, current, exceptions: existing.exceptions });
        writeFileSync(out, `${JSON.stringify(next, null, 2)}\n`);
      } else {
        writeFileSync(out, `${JSON.stringify(initDirection({ client: flags.client, brief: flags.brief, current }), null, 2)}\n`);
      }
      io.out(`craft direction: wrote ${out}. Add the sources and a reason for every choice, then run craft direction validate.`);
      return 0;
    }

    if (sub === "validate") {
      if (!existsSync(file)) throw new Error(`no ${file}. Run craft direction init.`);
      const direction = readJson<Partial<ArtDirection>>(file);
      const estate = declaredFrom(flags.estate, io.cwd);
      const report = validateDirection(direction, {
        fingerprint: current,
        snapshot,
        page,
        strict: flags.strict,
        pathExists: (p) => existsSync(resolve(dirname(file), p)),
        readSource: (s: DirectionSource) => {
          if (!s.path || /^https?:/.test(s.path) || !TEXT_SOURCE.test(s.path)) return undefined;
          const path = resolve(dirname(file), s.path);
          return existsSync(path) ? readFileSync(path, "utf8") : undefined;
        },
        estate,
        estateId: estate.find((s) => s.client && s.client === direction.client)?.id,
      });
      if (flags.json) io.out(toJson(report));
      else {
        for (const p of report.problems) io.out(`  ${p.severity === "error" ? "error" : "warn "}  ${p.at || "(file)"}  ${p.message}`);
        const l = report.layers;
        const pages = l.hierarchy.map((h) => `${h.page} ${h.decided} of ${h.total}`).join(", ");
        io.out(
          `craft direction: ${report.valid ? "valid" : "not valid"}. Job ${l.job ? "decided" : "not decided"}; hierarchy ${pages || "not decided"}; tokens ${l.tokens.decided} of ${l.tokens.total}.${l.complete ? " Every layer decided." : ""}`,
        );
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
      const declared = declaredFrom(flags.estate, io.cwd).flatMap((s) => (s.direction?.accent && s.client !== base.client ? [{ id: s.id, accent: s.direction.accent }] : []));
      const result = propose({ client: base.client, brief: base.brief, sources, current, estate: estateFrom(flags.estate, io.cwd), declared });
      const merged: ArtDirection = { ...base, sources, choices: { ...result.direction.choices, ...stripUndecided(base.choices) }, ...(base.exceptions ? { exceptions: base.exceptions } : {}) };
      const text = `${JSON.stringify(merged, null, 2)}\n`;
      if (flags.out) writeFileSync(resolve(io.cwd, flags.out), text);
      else io.out(text);
      for (const p of result.proposals) {
        io.err(`${p.key}: ${p.candidates.length ? p.candidates.map((c) => `${c.value || "?"} (${c.note})`).join("; ") : "nothing in the sources to draw on yet"}`);
      }
      return 0;
    }

    throw new Error("usage: craft direction init | validate | propose | research");
  } catch (error) {
    io.err(`craft: ${(error as Error).message}`);
    return 2;
  }
}

/** Choices a person has already reasoned keep priority over a proposal. */
function stripUndecided(choices: ArtDirection["choices"] = {}): ArtDirection["choices"] {
  return Object.fromEntries(Object.entries(choices).filter(([, c]) => c && c.because && c.because.trim().length > 0));
}
