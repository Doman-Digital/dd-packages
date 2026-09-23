/**
 * The rendered detection path for tells that can be seen on a live page.
 *
 * Same tells, same ids, measured on what the visitor gets rather than on what
 * the source says. A report can then say "Inter in source and on the page",
 * or catch the violet a CMS sets that no source file mentions.
 *
 * Pure over a Snapshot. Thresholds are here, next to their fixtures, and not
 * in the in-page collector, so each one can be proved without a browser.
 */

import { isAiViolet, isCream, parseColour } from "../character/color.js";
import { REFLEX_FONTS_1, REFLEX_FONTS_2 } from "../character/tells/source.js";
import type { Hit, RenderedPath } from "../character/types.js";
import { makeSnapshot } from "./fixture.js";
import { fontClass, normaliseFamily } from "./fonts.js";
import type { Snapshot } from "./types.js";

const hit = (s: Snapshot, message: string, excerpt?: string): Hit => ({ path: s.url, offset: 0, message, excerpt: excerpt ?? message });
const pct = (n: number): string => `${Math.round(n * 100)}%`;
const oklchOf = (value: string) => parseColour(value)?.oklch ?? null;

function reflexFonts(list: readonly string[]): (s: Snapshot) => Hit[] {
  const wanted = new Map(list.map((n) => [n.toLowerCase(), n]));
  return (s) => {
    const total = s.fonts.reduce((n, f) => n + f.chars, 0) || 1;
    const display = s.fonts.reduce((n, f) => n + f.displayChars, 0) || 1;
    const hits: Hit[] = [];
    const seen = new Set<string>();
    // The headline's face is the display face, however little text it sets.
    const h1 = s.headings.find((h) => h.level === 1);
    const h1Name = h1 ? wanted.get(normaliseFamily(h1.family).toLowerCase()) : undefined;
    if (h1 && h1Name) {
      seen.add(h1Name);
      hits.push(hit(s, `${h1Name} sets the headline`, h1.text));
    }
    for (const font of s.fonts) {
      const name = wanted.get(normaliseFamily(font.family).toLowerCase());
      if (!name || seen.has(name)) continue;
      const share = font.chars / total;
      const displayShare = font.displayChars / display;
      // A reflex face used for a caption is not the site's type. Carrying the
      // body or the headings is.
      if (share >= 0.15 || displayShare >= 0.3) {
        seen.add(name);
        hits.push(hit(s, `${name} sets ${pct(share)} of the text on the page${displayShare >= 0.3 ? ` and ${pct(displayShare)} of the headings` : ""}`));
      }
    }
    return hits;
  };
}

function violetHits(s: Snapshot): Hit[] {
  const hits: Hit[] = [];
  const controls = s.controls.filter((c) => {
    const o = oklchOf(c.background);
    return o !== null && (parseColour(c.background)?.alpha ?? 1) > 0.5 && isAiViolet(o);
  });
  if (controls.length > 0) hits.push(hit(s, `${controls.length} button${controls.length === 1 ? "" : "s"} filled with an indigo-violet accent`, `${controls[0].text}: ${controls[0].background}`));
  const totalChars = s.colours.text.reduce((n, t) => n + t.chars, 0) || 1;
  const violetText = s.colours.text.filter((t) => {
    const o = oklchOf(t.value);
    return o !== null && isAiViolet(o);
  });
  const textChars = violetText.reduce((n, t) => n + t.chars, 0);
  if (textChars >= 40 && textChars / totalChars >= 0.01) hits.push(hit(s, `${pct(textChars / totalChars)} of the text is set in indigo-violet`, violetText[0].value));
  const pageArea = s.pageHeight * s.viewport.width || 1;
  const violetBg = s.colours.backgrounds.filter((b) => {
    const o = oklchOf(b.value);
    return o !== null && (parseColour(b.value)?.alpha ?? 1) > 0.5 && isAiViolet(o);
  });
  const bgArea = violetBg.reduce((n, b) => n + b.area, 0);
  if (bgArea / pageArea >= 0.01 && controls.length === 0) hits.push(hit(s, `indigo-violet covers ${pct(bgArea / pageArea)} of the page`, violetBg[0].value));
  return hits;
}

function blueToPurple(s: Snapshot): Hit[] {
  const hits: Hit[] = [];
  for (const g of s.effects.gradients) {
    const hues = g.stops.map(oklchOf).filter((o): o is NonNullable<typeof o> => o !== null && o.c >= 0.08).map((o) => o.h);
    if (hues.some((h) => h >= 235 && h <= 272) && hues.some((h) => h >= 285 && h <= 330)) {
      hits.push(hit(s, "a blue-to-purple gradient covers a large area", g.stops.join(" → ")));
    }
  }
  return hits;
}

const count = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

export const RENDERED_PATHS: Record<string, RenderedPath> = {
  "reflex-font": {
    detect: reflexFonts(REFLEX_FONTS_1),
    fixtures: {
      flag: [makeSnapshot({ fonts: [{ family: "__Inter_d65c78", chars: 5000, displayChars: 900, italicChars: 0, weights: [400, 700] }] })],
      pass: [makeSnapshot(), makeSnapshot({ fonts: [{ family: "Söhne", chars: 5000, displayChars: 900, italicChars: 0, weights: [400] }, { family: "Inter", chars: 60, displayChars: 0, italicChars: 0, weights: [400] }] })],
    },
  },
  "reflex-font-2": {
    detect: reflexFonts(REFLEX_FONTS_2),
    fixtures: {
      flag: [
        makeSnapshot({ fonts: [{ family: "Söhne", chars: 4200, displayChars: 0, italicChars: 0, weights: [400] }, { family: "Fraunces", chars: 900, displayChars: 900, italicChars: 0, weights: [500] }] }),
        makeSnapshot({ headings: [{ level: 1, family: "Instrument Serif", sizePx: 72, weight: 400, italic: false, italicPart: false, text: "Beauty", top: 200 }] }),
      ],
      pass: [makeSnapshot()],
    },
  },
  "ai-violet": {
    detect: violetHits,
    fixtures: {
      flag: [
        makeSnapshot({ controls: [{ kind: "button", radiusPx: 4, heightPx: 44, background: "oklch(0.541 0.281 293.009)", text: "Get started" }] }),
        makeSnapshot({ colours: { backgrounds: makeSnapshot().colours.backgrounds, text: [{ value: "rgb(28, 28, 26)", area: 0, chars: 5000 }, { value: "rgb(79, 70, 229)", area: 0, chars: 400 }] } }),
        makeSnapshot({ colours: { text: makeSnapshot().colours.text, backgrounds: [{ value: "rgb(255, 255, 255)", area: 5_000_000, chars: 0 }, { value: "rgb(90, 53, 209)", area: 400_000, chars: 0 }] } }),
      ],
      pass: [makeSnapshot(), makeSnapshot({ controls: [{ kind: "button", radiusPx: 4, heightPx: 44, background: "rgb(30, 58, 138)", text: "Book" }] })],
    },
  },
  "blue-purple-gradient": {
    detect: blueToPurple,
    fixtures: {
      flag: [makeSnapshot({ effects: { gradients: [{ stops: ["rgb(37, 99, 235)", "rgb(147, 51, 234)"], area: 1_200_000, radial: false }] } })],
      pass: [makeSnapshot({ effects: { gradients: [{ stops: ["rgb(250, 247, 240)", "rgb(255, 255, 255)"], area: 1_200_000, radial: false }] } })],
    },
  },
  "gradient-text": {
    detect: (s) => (s.effects.gradientText > 0 ? [hit(s, `${count(s.effects.gradientText, "heading")} painted with a gradient`)] : []),
    fixtures: { flag: [makeSnapshot({ effects: { gradientText: 1 } })], pass: [makeSnapshot()] },
  },
  "glass-panel": {
    detect: (s) => (s.effects.glass > 0 ? [hit(s, `${count(s.effects.glass, "translucent blurred panel")}`)] : []),
    fixtures: { flag: [makeSnapshot({ effects: { glass: 2 } })], pass: [makeSnapshot()] },
  },
  "cream-palette": {
    detect: (s) => {
      const ground = oklchOf(s.ground);
      if (ground && isCream(ground)) return [hit(s, "the page ground is a warm off-white", s.ground)];
      const pageArea = s.pageHeight * s.viewport.width || 1;
      const cream = s.colours.backgrounds.find((b) => {
        const o = oklchOf(b.value);
        return o !== null && isCream(o) && b.area / pageArea >= 0.3;
      });
      return cream ? [hit(s, `a warm off-white covers ${pct(cream.area / pageArea)} of the page`, cream.value)] : [];
    },
    fixtures: {
      flag: [makeSnapshot({ ground: "rgb(250, 246, 238)" }), makeSnapshot({ colours: { text: makeSnapshot().colours.text, backgrounds: [{ value: "rgb(245, 240, 230)", area: 3_000_000, chars: 0 }] } })],
      pass: [makeSnapshot(), makeSnapshot({ ground: "rgb(254, 252, 232)" })],
    },
  },
  "italic-serif-display": {
    detect: (s) => {
      const h = s.headings.find((x) => x.level <= 2 && fontClass(x.family) === "serif" && (x.italic || x.italicPart));
      return h ? [hit(s, `a serif ${h.level === 1 ? "headline" : "heading"} with an italic turn`, h.text)] : [];
    },
    fixtures: {
      flag: [makeSnapshot({ headings: [{ level: 1, family: "__Instrument_Serif_1a2b3c", sizePx: 72, weight: 400, italic: false, italicPart: true, text: "Beauty, reimagined", top: 200 }] })],
      pass: [makeSnapshot(), makeSnapshot({ headings: [{ level: 1, family: "Söhne", sizePx: 64, weight: 600, italic: false, italicPart: true, text: "Boilers, fixed", top: 200 }] })],
    },
  },
  "hero-eyebrow-chip": {
    detect: (s) => (s.effects.eyebrowChip ? [hit(s, "a small bordered pill sits above the headline")] : []),
    fixtures: { flag: [makeSnapshot({ effects: { eyebrowChip: true } })], pass: [makeSnapshot()] },
  },
  "icon-tile-grid": {
    detect: (s) =>
      s.sections.filter((x) => x.cards >= 3 && x.iconCards >= 3).map((x) => hit(s, `${x.iconCards} icon cards in a row`, x.label)),
    fixtures: {
      flag: [makeSnapshot({ sections: [...makeSnapshot().sections.slice(0, 2), { top: 1700, height: 700, kind: "cards", label: "Our services", cards: 3, iconCards: 3, hiddenAtLoad: false }] })],
      pass: [makeSnapshot()],
    },
  },
  "hero-then-proof": {
    detect: (s) => {
      const [first, second] = s.sections;
      return first?.kind === "hero" && second && ["logos", "stats", "marquee"].includes(second.kind) ? [hit(s, `the hero is followed straight away by ${second.kind === "stats" ? "a row of numbers" : "a strip of logos"}`, second.label)] : [];
    },
    fixtures: {
      flag: [
        makeSnapshot({ sections: [makeSnapshot().sections[0], { top: 800, height: 160, kind: "logos", label: "Trusted by", cards: 0, iconCards: 0, hiddenAtLoad: false }, ...makeSnapshot().sections.slice(1)] }),
        makeSnapshot({ sections: [makeSnapshot().sections[0], { top: 800, height: 220, kind: "stats", label: "500+", cards: 0, iconCards: 0, hiddenAtLoad: false }] }),
      ],
      pass: [makeSnapshot()],
    },
  },
  "reveal-everywhere": {
    detect: (s) => {
      const below = s.sections.filter((x) => x.top > s.viewport.height).length;
      const hidden = s.motion.hiddenSections;
      return hidden >= 4 && below > 0 && hidden / below >= 0.6 ? [hit(s, `${hidden} of ${below} sections below the fold wait for a scroll to appear`)] : [];
    },
    fixtures: {
      flag: [makeSnapshot({ motion: { hiddenSections: 4 }, sections: makeSnapshot().sections.map((x, i) => ({ ...x, hiddenAtLoad: i > 0 })) })],
      pass: [makeSnapshot(), makeSnapshot({ motion: { hiddenSections: 1 } })],
    },
  },
  "pill-everything": {
    detect: (s) => {
      const pills = s.controls.filter((c) => c.radiusPx >= c.heightPx / 2 - 1);
      return s.controls.length >= 4 && pills.length / s.controls.length >= 0.8 ? [hit(s, `${pills.length} of ${s.controls.length} buttons are pills`)] : [];
    },
    fixtures: {
      flag: [makeSnapshot({ controls: makeSnapshot().controls.map((c) => ({ ...c, radiusPx: 9999 })) })],
      pass: [makeSnapshot(), makeSnapshot({ controls: makeSnapshot().controls.slice(0, 2).map((c) => ({ ...c, radiusPx: 9999 })) })],
    },
  },
  "radial-spotlight-glow": {
    detect: (s) => {
      const radial = s.effects.gradients.filter((g) => g.radial).length;
      const n = s.effects.glows + radial;
      return n > 0 ? [hit(s, `${count(n, "soft glow")} behind the content`)] : [];
    },
    fixtures: {
      flag: [makeSnapshot({ effects: { glows: 1 } }), makeSnapshot({ effects: { gradients: [{ stops: ["rgba(99, 102, 241, 0.3)", "rgba(0, 0, 0, 0)"], area: 900_000, radial: true }] } })],
      pass: [makeSnapshot()],
    },
  },
  "grid-background": {
    detect: (s) => (s.effects.gridBackgrounds > 0 ? [hit(s, `${count(s.effects.gridBackgrounds, "graph-paper background")}`)] : []),
    fixtures: { flag: [makeSnapshot({ effects: { gridBackgrounds: 1 } })], pass: [makeSnapshot()] },
  },
  marquee: {
    detect: (s) => (s.effects.marquees > 0 ? [hit(s, `${count(s.effects.marquees, "endless scrolling strip")}`)] : []),
    fixtures: { flag: [makeSnapshot({ effects: { marquees: 1 } })], pass: [makeSnapshot()] },
  },
  "thin-border-wide-shadow": {
    detect: (s) => (s.effects.hairlineShadowCards >= 3 ? [hit(s, `${s.effects.hairlineShadowCards} cards with a hairline border under a wide shadow`)] : []),
    fixtures: { flag: [makeSnapshot({ effects: { hairlineShadowCards: 3 } })], pass: [makeSnapshot(), makeSnapshot({ effects: { hairlineShadowCards: 1 } })] },
  },
  "intro-cinematic": {
    detect: (s) => (s.motion.introOverlay ? [hit(s, "a full-screen layer covers the page at load and then leaves")] : []),
    fixtures: { flag: [makeSnapshot({ motion: { introOverlay: true } })], pass: [makeSnapshot()] },
  },
};
