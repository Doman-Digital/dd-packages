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

/**
 * 2 adds `role` and `geometry` per section, `rhythmVariance` for the page and
 * the screenshot measures in `visual`. All four are optional: a version 1
 * snapshot reads as version 2 without them (see `readSnapshot`), and nothing
 * that judged a v1 snapshot judges it differently.
 */
export const SNAPSHOT_VERSION = 2;

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

/**
 * What a section is for, finer than `kind`. `kind` keeps its version 1
 * meaning because the rendered tells, the null models and the estate were
 * calibrated on it; `role` is what component-level comparison reads.
 */
export type SectionRole =
  | SectionKind
  | "cta-band"
  | "footer-cta"
  | "pricing"
  | "testimonials"
  | "faq"
  | "process"
  | "features"
  | "team"
  | "contact";

/** How a section is laid out, measured, not judged. */
export interface SectionGeometry {
  /** Share of the section's text blocks that are centred, 0 to 1. */
  centredShare: number;
  /** Content area balance about the vertical centre line: 1 mirror-even, 0 all on one side. */
  mirrorSymmetry: number;
  /** Share of the section's area with no text, image or control in it, 0 to 1. */
  whitespaceRatio: number;
  /** Width the content spans, over the viewport width. */
  contentWidthRatio: number;
  /** The painted background behind the section, as computed. */
  background: string;
  /** Buttons and button-styled links in the section. */
  controls: number;
}

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
  /** Version 2. */
  role?: SectionRole;
  /** Version 2. */
  geometry?: SectionGeometry;
  /** Version 2: short pill or label texts in the section ("Most popular", "New"), at most 5. */
  badges?: string[];
  /** Version 2: small round portraits (at most 96px, roughly square, radius 40% or more). */
  avatars?: number;
  /** Version 2: a horizontal scroller, snap track or prev/next control holds the content. */
  carousel?: boolean;
  /** Version 2: large standalone figures ("500+", "98%", "4.9/5") at 24px or more. */
  figures?: number;
  /**
   * Version 2, craft 0.13 and later: the section's visible text, one block per
   * heading, paragraph, list item or quote, each at most 300 characters, at
   * most 40. Navigation, buttons and footers are left out. What the
   * specificity and proof tells read.
   */
  text?: string[];
}

export type ImageRole = "photo" | "illustration" | "icon" | "avatar" | "logo";

/**
 * What the image's own bytes say about where it came from. Only a positive
 * is evidence: most images carry no metadata at all, and a re-encode strips
 * it, so no marker proves nothing.
 */
export interface ImageProvenance {
  /** The IPTC digital source type found, if any: "trainedAlgorithmicMedia" or "compositeWithTrainedAlgorithmicMedia". */
  digitalSourceType: string | null;
  /** Where the marker sat: an XMP packet, a C2PA manifest, or somewhere else in the file. */
  source: "xmp" | "c2pa" | "other" | null;
  /** The file carries a C2PA manifest (Content Credentials), whatever it says. */
  c2pa: boolean;
  /** Bytes read, from the start of the file. */
  bytes: number;
}

/** One image as the visitor sees it: an `img`, or a CSS background large enough to be a picture. */
export interface SnapshotImage {
  /** The URL the browser loaded, unwrapped from an image optimiser (`/_next/image?url=`), or a `data:` URI cut to 64 characters. */
  src: string;
  /** Host of `src`, or null for a `data:` URI. */
  host: string | null;
  width: number;
  height: number;
  top: number;
  role: ImageRole;
  alt: string | null;
  /** Empty alt, `aria-hidden` or `role="presentation"`. */
  decorative: boolean;
  /** Index into `sections`, or null when the image sits outside them. */
  section: number | null;
  /** A CSS `background-image`, not an `img`. */
  background: boolean;
  /** Present when the bytes were read. */
  provenance?: ImageProvenance;
}

/**
 * Measures of the rendered pixels, from a full-page screenshot (capped at
 * `height`). None of them passes or fails anything: they describe.
 */
export interface SnapshotVisual {
  /** Hasler and Süsstrunk (2003) colourfulness, M = σ_rgyb + 0.3 μ_rgyb, on 0-255 channels. Grey is 0. */
  colourfulness: number;
  /** Share of sampled pixels on a luminance edge: a complexity proxy, 0 to 1. */
  edgeDensity: number;
  /** 1 minus the mean luminance difference between each pixel and its left-right mirror, 0 to 1. */
  symmetry: number;
  width: number;
  height: number;
  /** Pixels actually read: large pages are sampled on a grid. */
  sampled: number;
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
  /** Version 2: coefficient of variation of the section heights. Null with fewer than two sections. */
  rhythmVariance?: number | null;
  /** Version 2: absent when the page could not be screenshotted. */
  visual?: SnapshotVisual;
  /**
   * Version 2, craft 0.13 and later: every image on the page, largest first, at
   * most 60. Absent in older snapshots, which the imagery tells never judge.
   */
  images?: SnapshotImage[];
  /**
   * Version 2, craft 0.13 and later: the text a visitor reads before
   * scrolling, at most 12 blocks. Navigation, a header without the headline,
   * and the words on buttons and links are left out: this is the page's
   * claim, not its menu or its calls to action.
   */
  firstScreenText?: string[];
  /** Set when a version 1 snapshot was read and upgraded in memory. */
  migratedFrom?: 1;
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
