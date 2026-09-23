/**
 * Font family names as a browser reports them, turned back into the names a
 * person would use.
 *
 * `next/font` renames every family it loads: Inter arrives as
 * `__Inter_d65c78` and its metric-matched fallback as `__Inter_Fallback_d65c78`.
 * A rendered check that compared raw names would never see a single reflex
 * font on a Next.js site, which is most of the estate.
 */

export type FontClass = "serif" | "sans" | "mono" | "script" | "system";

const SYSTEM = /^(?:system-ui|-apple-system|BlinkMacSystemFont|ui-sans-serif|ui-serif|ui-monospace|ui-rounded|sans-serif|serif|monospace|cursive)$/i;

export function normaliseFamily(raw: string): string {
  let name = raw.replace(/["']/g, "").trim();
  const next = name.match(/^__(.+?)(?:_Fallback)?_[0-9a-f]{5,8}$/i);
  if (next) name = next[1].replace(/_/g, " ");
  name = name.replace(/\s+Fallback$/i, "").replace(/\s+Variable$/i, "");
  // System keywords first: `ui-monospace` is not a CSS variable name.
  if (SYSTEM.test(name)) return "system-ui";
  // A CSS variable name used as a family: `cormorantGaramond`, `dm-sans`.
  if (!/\s/.test(name) && (/[a-z][A-Z]/.test(name) || /^[a-z]+(?:-[a-z]+)+$/.test(name))) {
    name = name
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/-/g, " ")
      .replace(/\b([a-z])/g, (c) => c.toUpperCase())
      .replace(/\bDm\b/, "DM");
  }
  return name;
}

/** Families whose class cannot be read from the name. Extend as the estate needs. */
const KNOWN: Record<string, FontClass> = {
  fraunces: "serif",
  "playfair display": "serif",
  "cormorant garamond": "serif",
  cormorant: "serif",
  "eb garamond": "serif",
  lora: "serif",
  merriweather: "serif",
  "libre baskerville": "serif",
  "instrument serif": "serif",
  newsreader: "serif",
  "source serif 4": "serif",
  "crimson pro": "serif",
  canela: "serif",
  "tiempos headline": "serif",
  "tiempos text": "serif",
  "gt super": "serif",
  "freight display pro": "serif",
  "gt sectra": "serif",
  georgia: "serif",
  "times new roman": "serif",
  "dm serif display": "serif",
  "bodoni moda": "serif",
  "libre caslon text": "serif",
  "young serif": "serif",
  "caveat": "script",
  "dancing script": "script",
  "great vibes": "script",
  "pinyon script": "script",
};

export function fontClass(family: string): FontClass {
  const name = normaliseFamily(family);
  if (name === "system-ui") return "system";
  const known = KNOWN[name.toLowerCase()];
  if (known) return known;
  if (/\bmono\b|code|courier/i.test(name)) return "mono";
  if (/script|hand/i.test(name)) return "script";
  if (/serif/i.test(name) && !/sans/i.test(name)) return "serif";
  return "sans";
}
