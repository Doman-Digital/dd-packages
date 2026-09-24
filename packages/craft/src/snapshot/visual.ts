/**
 * Measures of a screenshot's pixels. Pure: RGBA in, numbers out, no decoder
 * and no browser, so it is tested on synthetic images.
 *
 * Only measures that need no model are here, after Miniukovich and De Angeli
 * (2015, "Computation of interface aesthetics"): colourfulness, an edge-density
 * complexity proxy, and left-right symmetry. None of them is a verdict. A
 * sober site and a busy one can both be decided; these say which it is.
 */

import type { SnapshotVisual } from "./types.js";

export interface RgbaImage {
  width: number;
  height: number;
  /** Row-major, 4 bytes a pixel. */
  rgba: Uint8Array;
}

/** A luminance step, on 0-255, that counts as an edge. About a 12% contrast change. */
export const EDGE_STEP = 32;

/**
 * Colourfulness, edge density and symmetry. Images over `maxSamples` pixels
 * are read on a regular grid, and edges are taken between grid neighbours.
 */
export function visualMeasures(img: RgbaImage, maxSamples = 1_000_000): SnapshotVisual {
  const { width: w, height: h, rgba } = img;
  if (w < 2 || h < 2 || rgba.length < w * h * 4) throw new Error(`visualMeasures: ${w}x${h} image with ${rgba.length} bytes`);
  const step = Math.max(1, Math.ceil(Math.sqrt((w * h) / maxSamples)));
  const lum = (x: number, y: number): number => {
    const i = (y * w + x) * 4;
    return 0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2];
  };

  let n = 0;
  let sumRg = 0;
  let sumYb = 0;
  let sumRg2 = 0;
  let sumYb2 = 0;
  let edges = 0;
  let edgeN = 0;
  let asym = 0;
  let asymN = 0;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      const r = rgba[i];
      const g = rgba[i + 1];
      const b = rgba[i + 2];
      const rg = r - g;
      const yb = 0.5 * (r + g) - b;
      sumRg += rg;
      sumYb += yb;
      sumRg2 += rg * rg;
      sumYb2 += yb * yb;
      n += 1;
      const l = lum(x, y);
      if (x + step < w && y + step < h) {
        if (Math.abs(lum(x + step, y) - l) + Math.abs(lum(x, y + step) - l) > EDGE_STEP) edges += 1;
        edgeN += 1;
      }
      if (x < w / 2) {
        asym += Math.abs(l - lum(w - 1 - x, y));
        asymN += 1;
      }
    }
  }
  const meanRg = sumRg / n;
  const meanYb = sumYb / n;
  const sdRg = Math.sqrt(Math.max(0, sumRg2 / n - meanRg * meanRg));
  const sdYb = Math.sqrt(Math.max(0, sumYb2 / n - meanYb * meanYb));
  const colourfulness = Math.sqrt(sdRg ** 2 + sdYb ** 2) + 0.3 * Math.sqrt(meanRg ** 2 + meanYb ** 2);
  const round = (v: number, d = 3): number => Math.round(v * 10 ** d) / 10 ** d;
  return {
    colourfulness: round(colourfulness, 1),
    edgeDensity: round(edgeN ? edges / edgeN : 0),
    symmetry: round(asymN ? 1 - asym / asymN / 255 : 1),
    width: w,
    height: h,
    sampled: n,
  };
}
