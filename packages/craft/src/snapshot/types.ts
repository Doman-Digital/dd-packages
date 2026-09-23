/**
 * A snapshot: what a page looks like once it has rendered, as plain data.
 *
 * Source tells read what a site writes. A snapshot reads what a visitor gets:
 * the font that actually loaded, the colour that actually covers the page,
 * the sections that actually fade in. The two disagree often enough to need
 * both. A Tailwind class list can name indigo and a CMS can override it; a
 * source can name Fraunces and the font can fail to load.
 *
 * Everything here is plain JSON so a snapshot can be saved, diffed, attached
 * to a report and judged again later without a browser. Capturing one needs a
 * browser (see `@domandigital/craft/audit`); judging one does not.
 */

export const SNAPSHOT_VERSION = 1;

export interface SnapshotColour {
  /** `rgb(r, g, b)` or `rgba(r, g, b, a)`, as the browser computed it. */
  value: string;
  /** Painted area in CSS px², summed over every element using it. */
  area: number;
  /** Characters of text drawn in it, for text colours. */
  chars: number;
}

export interface SnapshotFont {
  /** The first family in the computed stack, unquoted. */
  family: string;
  /** Characters of visible text set in it. */
  chars: number;
  /** Characters of it in headings (h1 to h3 and elements at 28px or more). */
  displayChars: number;
  italicChars: number;
  weights: number[];
}

export interface SnapshotHeading {
  level: number;
  family: string;
  sizePx: number;
  weight: number;
  italic: boolean;
  /** An `<em>`, `<i>` or italic span inside a non-italic heading: "Beauty, *reimagined*". */
  italicPart: boolean;
  text: string;
  top: number;
}

export interface SnapshotControl {
  /** `button` for a <button> or submit, `link` for an anchor styled as a button. */
  kind: "button" | "link";
  radiusPx: number;
  heightPx: number;
  background: string;
  text: string;
}

export type SectionKind = "hero" | "logos" | "stats" | "cards" | "marquee" | "text" | "other";

export interface SnapshotSection {
  top: number;
  height: number;
  kind: SectionKind;
  /** The first heading's text, or the first words, so a report can name it. */
  label: string;
  /** Cards laid out side by side: siblings of similar size in one row. */
  cards: number;
  /** Of those cards, how many open with an icon (an <svg> or small image). */
  iconCards: number;
  /** Hidden at load, waiting for a scroll to reveal it. */
  hiddenAtLoad: boolean;
}

export interface SnapshotGradient {
  /** Colour stops, as computed. */
  stops: string[];
  area: number;
  radial: boolean;
}

export interface SnapshotEffects {
  /** Elements with backdrop-filter blur and a translucent background. */
  glass: number;
  /** Text painted with a gradient (background-clip: text). */
  gradientText: number;
  gradients: SnapshotGradient[];
  /** Large blurred shapes or radial gradients behind content with no content of their own. */
  glows: number;
  /** Repeating 1px line or dot backgrounds. */
  gridBackgrounds: number;
  /** Infinite horizontal translate animations. */
  marquees: number;
  /** Cards with a near-invisible border and a wide soft shadow. */
  hairlineShadowCards: number;
  /** A small bordered pill directly above the first h1. */
  eyebrowChip: boolean;
}

export interface SnapshotMotion {
  /** Sections hidden at load (opacity near 0 or translated) that appear on scroll. */
  hiddenSections: number;
  sections: number;
  /** Running CSS or Web Animations at capture time. */
  animations: number;
  /** A full-screen layer over the page at load that is gone a few seconds later. */
  introOverlay: boolean;
}

export interface Snapshot {
  version: typeof SNAPSHOT_VERSION;
  url: string;
  capturedAt: string;
  viewport: { width: number; height: number };
  pageHeight: number;
  /** The page ground: the body's computed background, or the html's. */
  ground: string;
  colours: {
    backgrounds: SnapshotColour[];
    text: SnapshotColour[];
  };
  fonts: SnapshotFont[];
  headings: SnapshotHeading[];
  controls: SnapshotControl[];
  sections: SnapshotSection[];
  effects: SnapshotEffects;
  motion: SnapshotMotion;
  /** The design-system measures trawl has collected since v7, kept so it can switch to this. */
  metrics: {
    fontSizes: number[];
    fontWeights: number[];
    radii: string[];
    shadows: string[];
    spacingOnScalePct: number | null;
    bodyLineLengthCh: number | null;
    bodyFontSizePx: number | null;
  };
}
