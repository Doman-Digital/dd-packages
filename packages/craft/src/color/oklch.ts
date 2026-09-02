/**
 * OKLab / OKLCh conversions, after Björn Ottosson's published M1/M2 matrices.
 * https://bottosson.github.io/posts/oklab/
 *
 * Zero dependencies is a hard constraint for every dd-packages package, so the
 * colour maths is implemented here rather than pulled from culori/colorjs.
 */

export interface Oklch {
  /** Perceptual lightness, 0..1. */
  l: number;
  /** Chroma, 0..~0.4 in practice. */
  c: number;
  /** Hue angle in degrees, 0..360. */
  h: number;
}

export interface Rgb {
  /** 0..1 */
  r: number;
  /** 0..1 */
  g: number;
  /** 0..1 */
  b: number;
}

export type Gamut = "srgb" | "p3";

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/** sRGB transfer function, encoded 0..1 to linear-light 0..1. */
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Inverse sRGB transfer function, linear-light 0..1 to encoded 0..1. */
function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/** Parse `#rgb`, `#rrggbb` or `#rrggbbaa` (alpha ignored) into 0..1 channels. */
export function parseHex(hex: string): Rgb {
  const raw = hex.trim().replace(/^#/, "");
  const expanded =
    raw.length === 3 || raw.length === 4
      ? raw
          .slice(0, 3)
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : raw.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    throw new Error(`craft: not a hex colour: ${JSON.stringify(hex)}`);
  }
  return {
    r: parseInt(expanded.slice(0, 2), 16) / 255,
    g: parseInt(expanded.slice(2, 4), 16) / 255,
    b: parseInt(expanded.slice(4, 6), 16) / 255,
  };
}

/** Serialise 0..1 channels as a lowercase `#rrggbb`, clamping out-of-range input. */
export function formatHex({ r, g, b }: Rgb): string {
  const byte = (n: number): string =>
    Math.round(clamp01(n) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

/** Linear-light sRGB to OKLab. */
function linearRgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ];
}

/** OKLab to linear-light sRGB. Values may fall outside 0..1 when out of gamut. */
function oklabToLinearRgb(L: number, A: number, B: number): [number, number, number] {
  const l_ = L + 0.3963377774 * A + 0.2158037573 * B;
  const m_ = L - 0.1055613458 * A - 0.0638541728 * B;
  const s_ = L - 0.0894841775 * A - 1.291485548 * B;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** OKLab to CIE XYZ (D65), the bridge used for the Display P3 gamut test. */
function oklabToXyz(L: number, A: number, B: number): [number, number, number] {
  const l_ = L + 0.3963377774 * A + 0.2158037573 * B;
  const m_ = L - 0.1055613458 * A - 0.0638541728 * B;
  const s_ = L - 0.0894841775 * A - 1.291485548 * B;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return [
    1.2270138511 * l - 0.5577999807 * m + 0.281256149 * s,
    -0.0405801784 * l + 1.1122568696 * m - 0.0716766787 * s,
    -0.0763812845 * l - 0.4214819784 * m + 1.5861632204 * s,
  ];
}

/** CIE XYZ (D65) to linear-light Display P3. */
function xyzToLinearP3(x: number, y: number, z: number): [number, number, number] {
  return [
    2.4934969119 * x - 0.9313836179 * y - 0.4027107845 * z,
    -0.8294889696 * x + 1.7626640603 * y + 0.0236246858 * z,
    0.0358458302 * x - 0.0761723893 * y + 0.956884524 * z,
  ];
}

const RAD = 180 / Math.PI;

/** Convert a hex string to OKLCh. */
export function hexToOklch(hex: string): Oklch {
  const { r, g, b } = parseHex(hex);
  const [L, A, B] = linearRgbToOklab(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b));
  const c = Math.sqrt(A * A + B * B);
  // Hue is meaningless at zero chroma; report 0 rather than atan2's sign noise.
  const h = c < 1e-7 ? 0 : ((Math.atan2(B, A) * RAD) % 360 + 360) % 360;
  return { l: L, c, h };
}

/** OKLCh to OKLab's a/b pair. */
function toAb({ c, h }: Oklch): [number, number] {
  const rad = h / RAD;
  return [c * Math.cos(rad), c * Math.sin(rad)];
}

/** Is this OKLCh colour representable in sRGB, within a small epsilon? */
export function inSrgbGamut(colour: Oklch, epsilon = 1e-5): boolean {
  const [A, B] = toAb(colour);
  const rgb = oklabToLinearRgb(colour.l, A, B);
  return rgb.every((ch) => ch >= -epsilon && ch <= 1 + epsilon);
}

/** Is this OKLCh colour representable in Display P3, within a small epsilon? */
export function inP3Gamut(colour: Oklch, epsilon = 1e-5): boolean {
  const [A, B] = toAb(colour);
  const [x, y, z] = oklabToXyz(colour.l, A, B);
  const rgb = xyzToLinearP3(x, y, z);
  return rgb.every((ch) => ch >= -epsilon && ch <= 1 + epsilon);
}

/** Unclamped OKLCh to sRGB, for callers that have already gamut-mapped. */
export function oklchToRgb(colour: Oklch): Rgb {
  const [A, B] = toAb(colour);
  const [r, g, b] = oklabToLinearRgb(colour.l, A, B);
  return { r: linearToSrgb(r), g: linearToSrgb(g), b: linearToSrgb(b) };
}

/**
 * Perceptual distance in OKLab. ~0.02 is the just-noticeable difference used as
 * the house tolerance for a derived colour standing in for a hand-picked one.
 */
export function deltaEOk(a: Oklch, b: Oklch): number {
  const [aA, aB] = toAb(a);
  const [bA, bB] = toAb(b);
  const dL = a.l - b.l;
  const dA = aA - bA;
  const dB = aB - bB;
  return Math.sqrt(dL * dL + dA * dA + dB * dB);
}

/** Convenience: perceptual distance between two hex strings. */
export function deltaEOkHex(a: string, b: string): number {
  return deltaEOk(hexToOklch(a), hexToOklch(b));
}
