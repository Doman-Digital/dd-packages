/**
 * A first art-direction.json for a site that exists: what it does today,
 * written down, with every reason left empty.
 *
 * Empty on purpose. `validateDirection` fails the file until each choice has
 * a source and a reason, so the first thing init produces is the list of
 * things nobody decided.
 */

import type { Fingerprint } from "../fingerprint/index.js";
import { formatHex, oklchToRgb } from "../color/oklch.js";
import { DIRECTION_VERSION, type ArtDirection } from "./types.js";

const hex = (o: { l: number; c: number; h: number }): string => {
  const { r, g, b } = oklchToRgb(o);
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  return formatHex({ r: clamp(r), g: clamp(g), b: clamp(b) });
};

export function initDirection(input: { client?: string; brief?: string; current?: Fingerprint; exceptions?: ArtDirection["exceptions"] }): ArtDirection {
  const fp = input.current;
  const empty = (value: string) => ({ value, because: "", evidence: [] as string[] });
  const choices: ArtDirection["choices"] = fp
    ? {
        ...(fp.accent ? { accent: empty(hex(fp.accent)) } : {}),
        ground: empty(hex(fp.ground)),
        display: empty(fp.display.family),
        body: empty(fp.body.family),
        ...(fp.roundness !== null ? { shape: empty(fp.roundness >= 0.45 ? "pill buttons" : fp.roundness <= 0.05 ? "square corners" : `corners at ${Math.round(fp.roundness * 100)}% of button height`) } : {}),
      }
    : {};
  return {
    $schema: "https://unpkg.com/@domandigital/craft/art-direction.schema.json",
    version: DIRECTION_VERSION,
    client: input.client ?? "",
    brief: input.brief ?? "",
    sources: [],
    choices,
    ...(input.exceptions?.length ? { exceptions: input.exceptions } : {}),
  };
}
