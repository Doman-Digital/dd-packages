# The Doman Digital craft standard

Twelve sections. Every numeric rule is cited, and section 11 says what is
deliberately *not* a rule.

This document and the package are bound together by a test: the machine-readable
block in section 12 is compared against `HOUSE_BUDGET`, `EASE` and
`DURATION_MS` on every run, so the standard cannot drift from what ships.

---

<!-- copy-ok: the standard names the practice each rule replaces -->
## 1. Colour is derived, not picked

Anchors, the colours a surface already ships, are sacred and come back byte-identical.
Everything else is generated in OKLCh from those anchors.

- Ramps have **11 steps** (50–950).
- Gamut mapping reduces **chroma only**, preserving hue and lightness
  (CSS Color 4 §13.2). RGB clipping is rejected: it walks a saturated violet
  toward magenta.
- Derived values standing in for a hand-picked one must be within
  **ΔE_OK ≤ 0.02** (the just-noticeable difference) or be declared an
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
- The interpolation term is **`rem + vw`, never bare `vw`**. A bare-`vw` size
  ignores the browser text-size setting and fails WCAG 1.4.4 at 200% zoom.
- Existing sizes are **pinned**, not regenerated, so adopting the scale moves <!-- copy-ok -->
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

*Source: house habit. The −0.01em display tracking and the ch measure were arrived at independently in two client repos.*

## 5. Space is fluid and proportional to type

- Steps **3xs–3xl** as multiples of a base (0.25× to 6×), plus **one-up pairs**.
- Section rhythm has **three** sizes, not five. Five shipped with zero consumers,
  which is the signature of a scale invented ahead of a need.

*Source: Utopia; measured: `--space-section-xs..xl` had no consumers in the monorepo.*

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
  interaction: the user is moving faster than the animation.
- **One signature moment per page**, gated, never the LCP element.

*Source: Emil Kowalski, "Animations on the Web"; Core Web Vitals (LCP).*

## 8. Reduced motion collapses, never disables

`@media (prefers-reduced-motion: reduce)` sets `animation-duration` and
`transition-duration` to **0.01ms** and `animation-iteration-count` to 1.

**Never `animation: none` inside the block.** That drops the `forwards` fill along with the
animation, so a forwards-filled entrance never applies its end state and the
element keeps `opacity: 0` from its base rule, permanently invisible, for
exactly the users who asked for less motion. This shipped.

Images: AVIF and WebP, in that order.

*Source: WCAG 2.2 SC 2.3.3; measured: a live site was stranded at opacity 0 by this exact defect.*

## 9. Restraint is the budget

Per surface: **≤10 font sizes, ≤3 weights, ≤2 families** (plus mono),
**≤4 radii, ≤4 shadows**, accent hues clustered within **15° OKLCh**.

A size written in `em` or `%` counts separately, **≤3**. It is a ratio, not a
step: `code { font-size: 0.875em }` states one relationship and applies it
wherever code appears, rather than adding a rung to the ladder. Counting it
against the scale is the same category error as counting the framework's theme.
It is still counted, because eight competing ratios is as unreadable as eight
competing steps: split, not dropped. A value that stops being reported is a
value that grows.

Differentiation guards pass anything that differs from its siblings, however
ugly. What they cannot see is accumulation: eighteen font sizes, six shadows,
four competing accents, each added reasonably, together reading as noise.

The budget counts the vocabulary a surface **chose**, and the whole difficulty
is telling that apart from what the framework brought.

The first rule drew the line at the layer: `@layer theme` and `@layer base` were
excluded, because counting them reported a surface as over budget for values its
author never wrote. Right about the noise, wrong about the boundary. Tailwind v4
compiles `text-sm` to `font-size: var(--text-sm)` and `rounded-lg` to
`border-radius: var(--radius-lg)`, so with the definitions excluded *and* token
references skipped, a surface using `text-sm` seven hundred times reported it
zero times. One estate measured 19 font sizes and shipped 28; 5 shadows and
shipped 18. A count wrong in the under-reporting direction is worse than the
over-reporting kind it replaced: the first buries real findings in noise, the
second reports a pass.

The line is **used versus unused**, which is not a property of the layer:

- References are **resolved**, not skipped: through the token chain, to the <!-- copy-ok -->
  value that renders.
- A definition is only ever reached from a declaration in a kept layer, so a
  framework default nothing uses still counts for nothing.
- `--tw-shadow` assignments count as shadows. `shadow-[…]` emits no literal
  `box-shadow` at all; it assigns that property and lets one shared composite
  read it.
- A reference that resolves to nothing is **not** vocabulary. It is a
  declaration that silently applies nothing, and it is reported as its own
  warning.

*Source: measured against the estate. The budget is the observed ceiling of the surfaces that read as designed; the resolution rule is what it took to measure them at all.*

## 10. The phone is the base layout

Mobile first is a rule about **order and floor**, not about a layout. The phone
is designed, built and measured first, and every wider layout is derived from
it. A desktop layout squeezed onto a phone keeps the desktop's priorities and
drops whatever did not fit; a phone layout widened keeps what matters and adds.
Fitting on a phone is the floor. The bar is a page optimised for the phone and
intended at every width, and the two sub-sections below set it. What the phone
visitor needs in order to trust the business and take the next step is a
judgement about the page, not a measurement; it is recorded and reported as
[decision confidence](./CHARACTER.md#decision-confidence), and a finding made on
the phone is not carried to another width without looking there.

- **The phone is the base.** Base styles are the phone layout. Wider layouts
  are added with `min-width` queries only (Tailwind: unprefixed is the phone,
  `sm:` `md:` `lg:` add). A `max-width` query, a `width <` range or a Tailwind
  `max-*:` variant needs a recorded exception with its reason.
- **375px is the floor.** Every surface is designed and measured at **375 CSS
  px** first, the narrowest iPhone width in common use (SE, mini, X to 11 Pro).
  Nothing scrolls sideways at 375. 390 is still measured: it is the width the
  design is accepted at. 320 still works (see "Every viewport is intended").
- **Touch targets at least 44 × 44 CSS px.** A link inside a sentence is exempt,
  as in WCAG's own inline exception. 24px (SC 2.5.8, AA) is what an audit asks
  for; 44 is the house bar.
- **Form inputs at least 16px.** Safari on iOS zooms the page when a field set
  smaller gets focus, and the visitor has to pinch back out. Fix the size, never
  the viewport: `maximum-scale=1` takes zoom away from people who need it.
- **Reviews look at the phone capture first**, then the desktop one.
- **Performance is judged on the mobile Lighthouse profile.** A desktop score
  is not evidence: the phone is the slower device and the one Google indexes.

*Source: WCAG 2.2 SC 2.5.5 (Target Size, Enhanced), SC 2.5.8 and SC 1.4.4; Apple Human Interface Guidelines, "Accessibility" (44 × 44 pt hit targets); WebKit's focus zoom on fields under 16px; Lighthouse's default mobile emulation; Google Search Central, "Mobile-first indexing"; Luke Wroblewski, "Mobile First" (2011).*

### Optimised for the phone

A visitor on a phone has a small screen, one thumb, a slow connection and a
task. The page is built for that and measured on a **short phone, 375 × 667**
(an iPhone SE), the least height a visitor has.

- **The first screen says what this is and offers the main action.** At
  375 × 667, with no scroll, the visitor can read what the page is and who it
  is for, and can reach the main action: call, book, buy or enquire. On a long
  page the main action stays in thumb reach, pinned to the bottom edge or
  repeated, because the lower half is the half a thumb reaches.
- **Thumb reach.** Most people tap with one thumb. Frequent actions sit in the
  lower two thirds of the screen; a control that only the top corner holds is
  for rare use.
- **Use what a phone can do.** A telephone number is a `tel:` link, a text
  message address an `sms:` link and a street address a map link, so one tap
  calls, messages or navigates. Each field asks for the keyboard that fits:
  `type="tel"`, `type="email"`, `inputmode="numeric"` or `"decimal"`. A field
  that asks for personal data carries `autocomplete` (`name`, `email`, `tel`,
  `street-address`, `postal-code`), so the phone fills it. Nothing needs hover:
  what hover reveals is also there on tap and on focus. Anything pinned to an
  edge keeps clear of the safe area (`env(safe-area-inset-*)`, with
  `viewport-fit=cover`), so the notch, the home indicator and rounded corners
  never cover it.
- **Overlays take at most a quarter of a short screen.** The header, a cookie
  bar, a chat button and every other fixed or sticky layer together cover at
  most 25% of 375 × 667. A dialog the visitor opens is theirs and is not
  counted; a layer that is there on arrival is.
- **Images are sized for the phone.** `srcset` and `sizes` give a 2x screen a
  file about twice its displayed width. A file more than about 2.5 times its
  displayed width is oversized: the phone downloads pixels it throws away. A
  file narrower than its displayed width is upscaled and soft.
- **It is fast on a throttled phone.** On the mobile Lighthouse profile
  (simulated slow 4G, 4x CPU slowdown): Largest Contentful Paint 2.5 s or
  less, Interaction to Next Paint 200 ms or less, Cumulative Layout Shift 0.1
  or less.
- **Landscape is usable.** A phone is held either way up. At 844 × 390 nothing
  needed is hidden behind a fixed layer, the header and fixed layers leave at
  least half the height, and no content is cut off.

*Source: Steven Hoober, "How Do Users Really Hold Mobile Devices?" (UXmatters, 2013) and "Design for Fingers, Touch, and People" (UXmatters, 2017); Josh Clark, "Designing for Touch" (A Book Apart, 2015); RFC 3966 (`tel:`), RFC 5724 (`sms:`) and RFC 5870 (`geo:`); WHATWG HTML Standard, `inputmode` and the autofill field names; WCAG 2.2 SC 1.3.5 (Identify Input Purpose) and SC 1.3.4 (Orientation); W3C Media Queries Level 4, the `hover` and `pointer` features; CSS Environment Variables Module Level 1 (`env(safe-area-inset-*)`) and WebKit, "Designing Websites for iPhone X" (2017); Google Search Central, "Helping users easily access content on mobile" (intrusive interstitials); web.dev, "Web Vitals" (the good thresholds for LCP, INP and CLS) and "Serve responsive images".*

### Every viewport is intended

A page is seen at every width from a 320px phone to a 1920px screen, and each
width gets a layout someone meant. Five bands each look designed:

| Band | Width in CSS px |
| --- | --- |
| Phone | 320 to 479 |
| Large phone | 480 to 767 |
| Tablet | 768 to 1023 |
| Laptop | 1024 to 1439 |
| Wide | 1440 and up |

- **A tablet is a layout of its own.** At 768 to 1023 the page is neither the
  phone stretched across the width nor the laptop squeezed to fit. The tablet
  band is designed and captured like the others.
- **320 works.** Content reflows at 320 CSS px with no sideways scroll and no
  loss of information or function (WCAG SC 1.4.10, the same as 400% zoom on a
  1280px screen).
- **Lines are 45 to 80 characters.** Body text keeps a readable measure at
  every width. On a wide screen it is capped (`max-width` in `ch`), and the
  layout holds to a sensible width instead of stretching with the window.
  Images are never shown larger than their file.
- **The sweep catches what the breakpoints miss.** The ladder (320, 375, 390,
  430, 844 × 390 landscape, 768, 1024, 1280, 1440, 1920) is captured, and one
  page load is resized from 320 to 1920 in steps of 16 to 32px. At any width
  nothing scrolls sideways, no visible text sits on other visible text and no
  page title is cut off. The report names the exact widths that fail, phone
  first.

The measure is `@domandigital/craft/phone` (`measureViewports`,
`measureSite`, `craft viewports`): one measure that create-site's
`measure.mjs` and every portal gate use. Each check can be baselined: a
repo's existing failures are listed in the open, a new failure fails, and the
baseline only shrinks.

*Source: WCAG 2.2 SC 1.4.10 (Reflow) and SC 1.4.8 (Visual Presentation: no more than 80 characters a line); Robert Bringhurst, "The Elements of Typographic Style", chapter 2, "Rhythm and Proportion" (45 to 75 characters a line); Ethan Marcotte, "Responsive Web Design" (A List Apart, 2010); web.dev, "Responsive web design basics".*

## 11. What is deliberately not a rule

The package emits **plain CSS custom properties** precisely so these stay free:

- **The styling engine.** Tailwind v3, v4, or none. Adapters exist for the first
  two; the third needs nothing.
- **The motion library.** `EASE_TUPLE` carries the same control points as `EASE`,
  so Framer Motion, GSAP and CSS agree without the package choosing one.
- **Where tokens live.** A `:root` block, a generated file, a Tailwind theme:
  the package does not care.
- **Layout, grid and component structure.** Not a rule, at any width. Section
  10 fixes the order the widths are designed in, the floor they are measured
  at and the five bands each is designed for; what each layout looks like
  stays free. Layout *defaults*
  (hero straight into a trust strip, three icon cards, a reveal on every
  section) are measured as character in [CHARACTER.md](./CHARACTER.md), as
  warnings with a declared-exception path, never as rules here.
- **Brand voice, copy, and photography grading.** Separate standards.

A rule here has to be one that is wrong to break. Everything else is a default.

## 12. The numbers

<!-- craft:canonical -->
```json
{
  "budget": {
    "maxFontSizes": 10,
    "maxRelativeFontSizes": 3,
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
