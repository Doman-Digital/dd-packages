/**
 * A plain, decided-looking page as a snapshot, for fixtures.
 *
 * Every rendered tell's pass case starts from this and its flag case changes
 * one thing, so a detector is proved against the difference it claims to see.
 * Exported so a client repo can write the same kind of test.
 */

import { SNAPSHOT_VERSION, type Snapshot } from "./types.js";

export type SnapshotPatch = { [K in keyof Snapshot]?: Snapshot[K] extends object ? Partial<Snapshot[K]> | Snapshot[K] : Snapshot[K] };

export function makeSnapshot(patch: SnapshotPatch = {}): Snapshot {
  const base: Snapshot = {
    version: SNAPSHOT_VERSION,
    url: "https://example.test/",
    capturedAt: "2026-09-23T00:00:00.000Z",
    viewport: { width: 1440, height: 900 },
    pageHeight: 4200,
    ground: "rgb(255, 255, 255)",
    colours: {
      backgrounds: [
        { value: "rgb(255, 255, 255)", area: 6_000_000, chars: 0 },
        { value: "rgb(31, 58, 46)", area: 90_000, chars: 0 },
      ],
      text: [
        { value: "rgb(28, 28, 26)", area: 0, chars: 5200 },
        { value: "rgb(31, 58, 46)", area: 0, chars: 300 },
      ],
    },
    fonts: [
      { family: "Söhne", chars: 4200, displayChars: 0, italicChars: 0, weights: [400, 500] },
      { family: "Tiempos Headline", chars: 900, displayChars: 900, italicChars: 0, weights: [500] },
    ],
    headings: [
      { level: 1, family: "Tiempos Headline", sizePx: 64, weight: 500, italic: false, italicPart: false, text: "Boilers fixed the same day in Brackley", top: 180 },
      { level: 2, family: "Tiempos Headline", sizePx: 36, weight: 500, italic: false, italicPart: false, text: "What we fix", top: 1100 },
    ],
    controls: [
      { kind: "button", radiusPx: 4, heightPx: 44, background: "rgb(31, 58, 46)", text: "Book a visit" },
      { kind: "link", radiusPx: 4, heightPx: 44, background: "rgb(255, 255, 255)", text: "Call 01280 000000" },
      { kind: "button", radiusPx: 4, heightPx: 40, background: "rgb(31, 58, 46)", text: "Send" },
      { kind: "link", radiusPx: 4, heightPx: 40, background: "rgb(31, 58, 46)", text: "See prices" },
    ],
    sections: [
      { top: 0, height: 800, kind: "hero", label: "Boilers fixed the same day in Brackley", cards: 0, iconCards: 0, hiddenAtLoad: false },
      { top: 800, height: 900, kind: "text", label: "What we fix", cards: 0, iconCards: 0, hiddenAtLoad: false },
      { top: 1700, height: 900, kind: "cards", label: "Recent jobs", cards: 3, iconCards: 0, hiddenAtLoad: false },
      { top: 2600, height: 700, kind: "text", label: "Prices", cards: 0, iconCards: 0, hiddenAtLoad: false },
      { top: 3300, height: 900, kind: "text", label: "Contact", cards: 0, iconCards: 0, hiddenAtLoad: false },
    ],
    effects: {
      glass: 0,
      gradientText: 0,
      gradients: [],
      glows: 0,
      gridBackgrounds: 0,
      marquees: 0,
      hairlineShadowCards: 0,
      eyebrowChip: false,
    },
    motion: { hiddenSections: 0, sections: 5, animations: 0, introOverlay: false },
    metrics: {
      fontSizes: [14, 16, 20, 36, 64],
      fontWeights: [400, 500],
      radii: ["4px"],
      shadows: [],
      spacingOnScalePct: 96,
      bodyLineLengthCh: 68,
      bodyFontSizePx: 17,
    },
  };
  const out = { ...base } as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    const current = (base as unknown as Record<string, unknown>)[key];
    out[key] =
      value && typeof value === "object" && !Array.isArray(value) && current && typeof current === "object" && !Array.isArray(current)
        ? { ...(current as object), ...(value as object) }
        : value;
  }
  return out as unknown as Snapshot;
}
