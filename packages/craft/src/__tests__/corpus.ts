import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The private corpus: client captures, null model builds, calibration runs and
 * the reviewer corpus, in Doman-Digital/dd-craft-corpus. It is not in this
 * public repo and nothing published to npm reads it.
 *
 * Found at CRAFT_CORPUS_DIR, or else at a dd-craft-corpus checkout beside this
 * repo. Tests that need it use `describe.skipIf(!CORPUS)`, so public CI runs
 * everything else and says what it skipped.
 */

const REPO = fileURLToPath(new URL("../../../../", import.meta.url));

function locate(): string | null {
  const env = process.env.CRAFT_CORPUS_DIR?.trim();
  const dir = env ? (isAbsolute(env) ? env : resolve(process.cwd(), env)) : resolve(REPO, "..", "dd-craft-corpus");
  if (existsSync(join(dir, "manifest.json"))) return dir;
  if (env) throw new Error(`CRAFT_CORPUS_DIR is set to ${dir}, but there is no manifest.json there. Point it at a dd-craft-corpus checkout.`);
  return null;
}

export const CORPUS = locate();

export const SKIP_NOTE =
  "craft: the private corpus is not here, so the tests that read it are skipped. Set CRAFT_CORPUS_DIR to a Doman-Digital/dd-craft-corpus checkout, or clone it beside dd-packages, to run them.";

if (!CORPUS && !process.env.CRAFT_CORPUS_QUIET) console.warn(SKIP_NOTE);

export interface CorpusManifest {
  version: number;
  estateTemperature: {
    electrician: string;
    electricianId: string;
    plumberStoneLight: string;
    plumberPorcelainLight: string;
    plumberStoneDark: string;
    plumberPorcelainDark: string;
    register: string;
  };
  nullPages: string;
  reviews: string;
  copyShape: string;
}

/** The corpus manifest. Only call it inside a block skipped when CORPUS is null. */
export function manifest(): CorpusManifest {
  if (!CORPUS) throw new Error(SKIP_NOTE);
  return JSON.parse(readFileSync(join(CORPUS, "manifest.json"), "utf8")) as CorpusManifest;
}

/** A path inside the corpus. Only call it inside a block skipped when CORPUS is null. */
export function corpusPath(rel: string): string {
  if (!CORPUS) throw new Error(SKIP_NOTE);
  return join(CORPUS, rel);
}
