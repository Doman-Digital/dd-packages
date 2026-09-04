# The Doman Digital craft standard

Eleven sections. Every numeric rule is cited, and section 10 says what is
deliberately *not* a rule.

This document and the package are bound together by a test: the machine-readable
block in section 11 is compared against `HOUSE_BUDGET`, `EASE` and
`DURATION_MS` on every run, so the standard cannot drift from what ships.

---

## 1. Colour is derived, not picked

Anchors — colours a surface already ships — are sacred and come back byte-identical.
Everything else is generated in OKLCh from those anchors.

- Ramps have **11 steps** (50–950).
- Gamut mapping reduces **chroma only**, preserving hue and lightness
  (CSS Color 4 §13.2). RGB clipping is rejected: it walks a saturated violet
  toward magenta.
- Derived values standing in for a hand-picked one must be within
  **ΔE_OK ≤ 0.02** — the just-noticeable difference — or be declared an
  intentional change.

*Source: Ottosson, "A perceptual color space for image processing" (2020); CSS Color 4 §13.2.*

## 2. Contrast is measured against both models

- Body text clears **4.5:1** (WCAG 2.x AA) **and** **|Lc| 60** (APCA-W3 0.1.9).
- Large text and non-text UI clear **3:1**.
- The two disagree, and the disagreement is the point: `#a78bfa` on `#060b19`
  scores 7.21:1 and Lc −49.1. WCAG is what an audit asks for; APCA is what tracks
  readability on dark backgrounds.
- An accent fork searches **from the brand end**, returning the darkest passing
  step, and emits its measured ratio as a comment. Searching from the light end
  returns near-white, which passes everything and is no longer the brand colour.

*Source: WCAG 2.2 SC 1.4.3; APCA-W3 0.1.9.*

## 3. Type is fluid, and always has a rem term

- Steps **−2 to 5**, `clamp()` interpolated between a small and a large viewport.
- The interpolation term is **`rem + vw`, never bare `vw`** — a bare-`vw` size
  ignores the browser text-size setting and fails WCAG 1.4.4 at 200% zoom.
- Existing sizes are **pinned**, not regenerated, so adopting the scale moves
  nothing.

*Source: Utopia (utopia.fyi); WCAG 2.2 SC 1.4.4.*

## 4. Typographic detail is not optional

- Display tracking **−0.01em**; button **0.12em**; eyebrow **0.24em**.
- Leading: display **1.05**, heading **1.1**, body **1.6**.
- Measure **45–75ch**; body **65ch**.
- Headings `text-wrap: balance`; body copy `text-wrap: pretty`.
- Numeric columns get `tabular-nums` and align to the end. Proportional figures
  in a column do not line up.
- Clipped display text gets a **descender mask** (`padding-bottom: .16em;
  margin-bottom: -.16em`), or it loses the tails of g, j, p, q, y.

*Source: house habit — the −0.01em display tracking and the ch measure were arrived at independently in two client repos.*

## 5. Space is fluid and proportional to type

- Steps **3xs–3xl** as multiples of a base (0.25× to 6×), plus **one-up pairs**.
- Section rhythm has **three** sizes, not five. Five shipped with zero consumers,
  which is the signature of a scale invented ahead of a need.

*Source: Utopia; measured — `--space-section-xs..xl` had no consumers in the monorepo.*

## 6. Density is a property of the surface

Three densities on a **4px grid**: rows **32 / 40 / 48px**. A table an operator
scans for six hours and the same component on a client dashboard have different
needs. Set once on a shell via `[data-density]`, inherited below.

*Source: Linear and Stripe both converge on 4px with a 32/40/48 row ladder.*

## 7. Motion is a decision before it is a curve

- **The LCP element never animates.** Animating it delays the metric by exactly
  the animation's duration.
- **Transform and opacity only.** Everything else cannot be composited.
- **Exits run at 0.75× their entrance.** Arriving content is asking to be read;
  leaving content lingering reads as lag.
- **No ease-in for UI, ever.** It accelerates away from the user. The objection
  is about the *end* of the movement, not the start, which is why ease-in-out is
  fine: a curve is rejected when its end tangent is steeper than the diagonal,
  meaning it covers more ground per unit time arriving than it averaged.
- **UI durations ≤ 300ms.** Drawers and one gated reveal may exceed it.
- **Don't animate what fires 100×/day**, and never animate a keyboard-triggered
  interaction — the user is moving faster than the animation.
- **One signature moment per page**, gated, never the LCP element.

*Source: Emil Kowalski, "Animations on the Web"; Core Web Vitals (LCP).*

## 8. Reduced motion collapses, never disables

`@media (prefers-reduced-motion: reduce)` sets `animation-duration` and
`transition-duration` to **0.01ms** and `animation-iteration-count` to 1.

**Never `animation: none`.** That drops the `forwards` fill along with the
animation, so a forwards-filled entrance never applies its end state and the
element keeps `opacity: 0` from its base rule — permanently invisible, for
exactly the users who asked for less motion. This shipped.

Images: AVIF and WebP, in that order.

*Source: WCAG 2.2 SC 2.3.3; measured — a live site was stranded at opacity 0 by this exact defect.*

## 9. Restraint is the budget

Per surface: **≤10 font sizes, ≤3 weights, ≤2 families** (plus mono),
**≤4 radii, ≤4 shadows**, accent hues clustered within **15° OKLCh**.

Differentiation guards pass anything that differs from its siblings, however
ugly. What they cannot see is accumulation — eighteen font sizes, six shadows,
four competing accents, each added reasonably, together reading as noise.

The budget counts the vocabulary a surface **chose**. A compiled stylesheet also
carries the framework's reset and theme, and `@layer theme` / `@layer base` are
excluded by default for that reason — counting them reports a surface as over
budget for values its author never wrote, and real findings then get triaged
away with the noise.

*Source: measured against the estate; the budget is the observed ceiling of the surfaces that read as designed. The layer exclusion is measured too — Tailwind v4's reset and theme contribute three font sizes and two timing functions to every sheet built with it.*

## 10. What is deliberately not a rule

The package emits **plain CSS custom properties** precisely so these stay free:

- **The styling engine.** Tailwind v3, v4, or none. Adapters exist for the first
  two; the third needs nothing.
- **The motion library.** `EASE_TUPLE` carries the same control points as `EASE`,
  so Framer Motion, GSAP and CSS agree without the package choosing one.
- **Where tokens live.** A `:root` block, a generated file, a Tailwind theme —
  the package does not care.
- **Layout, grid and component structure.** Out of scope.
- **Brand voice, copy, and photography grading.** Separate standards.

A rule here has to be one that is wrong to break. Everything else is a default.

## 11. The numbers

<!-- craft:canonical -->
```json
{
  "budget": {
    "maxFontSizes": 10,
    "maxFontWeights": 3,
    "maxFontFamilies": 2,
    "maxRadii": 4,
    "maxShadows": 4,
    "accentHueClusterDeg": 15,
    "maxUiDurationMs": 300
  },
  "ease": {
    "out": "cubic-bezier(0.23, 1, 0.32, 1)",
    "inOut": "cubic-bezier(0.77, 0, 0.175, 1)",
    "drawer": "cubic-bezier(0.32, 0.72, 0, 1)",
    "reveal": "cubic-bezier(0.22, 0.61, 0.36, 1)"
  },
  "durationMs": {
    "press": 120,
    "tooltip": 150,
    "dropdown": 200,
    "modal": 300,
    "drawer": 400,
    "reveal": 500,
    "stagger": 60
  },
  "exitRatio": 0.75,
  "contrast": { "minWcag": 4.5, "minLc": 60, "deltaEOk": 0.02 }
}
```
