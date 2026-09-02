# @domandigital/craft

The Doman Digital house craft standard, as numbers.

OKLCh colour ramps that snap to colours you already ship, semantic tokens derived
with measured WCAG **and** APCA contrast, one motion vocabulary shared by CSS and
JS, and a base stylesheet. Zero runtime dependencies.

Read [PRINCIPLES.md](./PRINCIPLES.md) for why each rule is a rule.

## Install

```bash
pnpm add @domandigital/craft
```

## Use

```ts
import { craftTokens } from "@domandigital/craft";

const { css, report, ramps } = craftTokens({
  // Steps you already ship come back byte-identical.
  accent: { 400: "#a78bfa", 500: "#7050f5", 600: "#6e4ce8" },
  bgCanvas: "#04060e",
  bgSurface: "#0b1120",
  bgElevated: "#151c2e",
  textPrimary: "#ecf2ff",
  textSecondary: "#b7c3d9",
  textMuted: "#8e9cb5",
  borderSubtle: "rgba(184, 198, 219, 0.16)",
  borderStrong: "rgba(184, 198, 219, 0.28)",
  success: "#3fb98a",
  warning: "#d6a14a",
  danger: "#e26d6d",
  info: "#5aa7e8",
});

if (report.failures.length > 0) {
  // Fails the house bar (4.5:1 AND |Lc| 60). Surface it; do not ship past it.
  console.warn(report.failures.map((f) => f.note).join("\n"));
}
```

Write `css` to a committed file and import it. Then, once, in your global
stylesheet:

```css
@import "@domandigital/craft/craft.css";
```

`craft.css` needs no build step and works with or without Tailwind.

On Tailwind v4, also import the theme bridge:

```css
@import "@domandigital/craft/craft.tailwind.css";
```

On Tailwind v3, add the preset:

```js
const { tailwindV3Preset } = require("@domandigital/craft");
module.exports = { presets: [tailwindV3Preset()] };
```

## The standard itself

[STANDARD.md](./STANDARD.md) is the eleven-section house standard, every numeric
rule cited, including a section on what is deliberately *not* a rule. Its
canonical numbers are compared against the code on every test run, so the
document cannot drift from what ships.

## The anchor guarantee

Every hex you pass in comes back out unchanged — the same string, byte for byte.
That is what lets a live site adopt this without a single pixel moving. Only the
steps you never picked by hand are generated.

## What it will tell you that you did not ask

`report.failures` lists every text-on-surface pair that clears WCAG AA but misses
the house APCA bar, which is the failure mode a WCAG-only check cannot see. The
accent fork emits its measured ratios as a CSS comment, so the choice is
checkable rather than asserted.

## API

| Area | Exports |
| --- | --- |
| Colour space | `hexToOklch`, `oklchToHex`, `toGamut`, `inSrgbGamut`, `inP3Gamut`, `deltaEOk`, `deltaEOkHex` |
| Ramps | `ramp`, `rampFromAnchors`, `RAMP_STEPS`, `LIGHTNESS_CURVE` |
| Contrast | `wcagContrast`, `apcaContrast`, `checkPair` |
| Semantic | `semantic`, `accentFork` |
| Motion | `EASE`, `EASE_TUPLE`, `DURATION_MS`, `DURATION_S`, `SPRING`, `SCALE`, `exitDuration`, `shouldAnimate` |
| Type | `fluidType`, `fluidClamp`, `typeFeatureTokens`, `HOUSE_TYPE`, `TYPE_STEPS` |
| Space | `fluidSpace`, `sectionRhythm`, `SPACE_STEPS` |
| Density | `densityCss`, `densityTokens`, `DENSITIES` |
| Restraint | `checkRestraint`, `HOUSE_BUDGET` |
| Tailwind | `tailwindV3Preset` (v3), `tailwindV4Theme` / `craft.tailwind.css` (v4) |
| Emit | `craftTokens`, `emitCss`, `motionTokens` |

## Licence

Apache-2.0
