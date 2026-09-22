/**
 * Tells found in source: markup, component code and stylesheets.
 *
 * Detectors are deliberately plain. Each reads the parse every other detector
 * reads, looks for one pattern, and says where. Thresholds for the counted
 * tells (reveals, pills) come from the estate survey: they sit below the sites
 * that read as templated and above the ones that do not.
 */

import { findColours, isAiViolet, isBlueToPurple, isCream } from "../color.js";
import type { ClassUnit, Hit, ParsedFile, ScanContext, SourceTell } from "../types.js";

// ---------------------------------------------------------------- helpers

/** Drop variant prefixes (`md:hover:`) and `!`, keeping colons inside `[...]`. */
export function baseClass(cls: string): string {
  let depth = 0;
  let cut = 0;
  for (let i = 0; i < cls.length; i += 1) {
    if (cls[i] === "[") depth += 1;
    else if (cls[i] === "]") depth -= 1;
    else if (cls[i] === ":" && depth === 0) cut = i + 1;
  }
  return cls.slice(cut).replace(/^!/, "");
}

function bases(unit: ClassUnit): string[] {
  return unit.classes.map(baseClass);
}

function has(unit: ClassUnit, pattern: RegExp): boolean {
  return bases(unit).some((c) => pattern.test(c));
}

function find(unit: ClassUnit, pattern: RegExp): string | undefined {
  return bases(unit).find((c) => pattern.test(c));
}

/** Tailwind arbitrary value, with `_` read back as the space it stands for. */
function arbitrary(cls: string): string | null {
  const m = cls.match(/\[(.*)\]$/);
  return m ? m[1].replace(/_/g, " ") : null;
}

function eachUnit(ctx: ScanContext, fn: (unit: ClassUnit, file: ParsedFile) => string | null): Hit[] {
  const hits: Hit[] = [];
  for (const file of ctx.files) {
    for (const unit of file.classUnits) {
      const message = fn(unit, file);
      if (message) hits.push({ path: file.path, offset: unit.offset, message });
    }
  }
  return hits;
}

function firstMatch(text: string, pattern: RegExp): number {
  const m = pattern.exec(text);
  pattern.lastIndex = 0;
  return m ? m.index : -1;
}

/** A framework's own palette definition, which says nothing about what is used. */
const FRAMEWORK_PALETTE =
  /^--(?:color-)?(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+$|^--tw-/;

const f = (path: string, text: string) => ({ path, text });

// ---------------------------------------------------------------- fonts

function familyNames(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim().replace(/^["']|["']$/g, "").trim())
    .filter(Boolean);
}

/** Every font family a file names, and where. */
export function fontMentions(file: ParsedFile): { name: string; offset: number }[] {
  const out: { name: string; offset: number }[] = [];
  for (const d of file.declarations) {
    if (d.property === "font-family" || d.property === "font" || d.property.startsWith("--font")) {
      for (const name of familyNames(d.value)) out.push({ name, offset: d.offset });
    }
  }
  const text = file.text;
  for (const m of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']next\/font\/google["']/g)) {
    for (const spec of m[1].split(",")) {
      const name = spec.trim().split(/\s+as\s+/)[0].replace(/_/g, " ").trim();
      if (name) out.push({ name, offset: m.index ?? 0 });
    }
  }
  for (const m of text.matchAll(/fonts\.googleapis\.com\/css2?\?[^"'\s)>]*/g)) {
    for (const fam of m[0].matchAll(/family=([^&:;]+)/g)) {
      out.push({ name: decodeURIComponent(fam[1]).replace(/\+/g, " "), offset: m.index ?? 0 });
    }
  }
  for (const m of text.matchAll(/@fontsource(?:-variable)?\/([a-z0-9-]+)/g)) {
    out.push({ name: m[1].replace(/-/g, " "), offset: m.index ?? 0 });
  }
  for (const m of text.matchAll(/\bfont-\[([^\]]+)\]/g)) {
    for (const name of familyNames(m[1].replace(/_/g, " "))) out.push({ name, offset: m.index ?? 0 });
  }
  if (file.kind === "script" || file.kind === "markup") {
    // Tailwind v3 config arrays and inline style objects: fontFamily: ["Inter", ...]
    for (const m of text.matchAll(/fontFamily\s*[:=]\s*(\{[\s\S]*?\}|\[[^\]]*\]|["'][^"']*["'])/g)) {
      for (const lit of m[1].matchAll(/["']([^"']+)["']/g)) {
        for (const name of familyNames(lit[1])) out.push({ name, offset: (m.index ?? 0) + (lit.index ?? 0) });
      }
    }
  }
  return out;
}

function fontTell(fonts: readonly string[]): (ctx: ScanContext) => Hit[] {
  const wanted = new Map(fonts.map((n) => [n.toLowerCase(), n]));
  return (ctx) => {
    const hits: Hit[] = [];
    for (const file of ctx.files) {
      const seen = new Set<string>();
      for (const { name, offset } of fontMentions(file)) {
        const canonical = wanted.get(name.toLowerCase());
        if (!canonical || seen.has(canonical)) continue;
        seen.add(canonical);
        hits.push({ path: file.path, offset, message: `${canonical} is a reflex font` });
      }
    }
    return hits;
  };
}

/** The faces a model picks when the brief does not name one. */
export const REFLEX_FONTS_1 = ["Inter", "Roboto", "Open Sans", "Poppins", "Montserrat", "Lato"] as const;

/** What models moved to once Inter was named and banned. */
export const REFLEX_FONTS_2 = [
  "Inter Tight",
  "DM Sans",
  "Manrope",
  "Space Grotesk",
  "Plus Jakarta Sans",
  "Outfit",
  "Geist",
  "Sora",
  "Instrument Sans",
  "Instrument Serif",
  "Fraunces",
  "Playfair Display",
  "Cormorant Garamond",
  "DM Serif Display",
] as const;

// ---------------------------------------------------------------- colour

const TW_VIOLET = /^(?:bg|text|from|via|to|border|ring|fill|stroke|shadow|outline|decoration|accent|caret|divide)-(indigo|violet|purple)-([3-8]00)(?:\/[\w.[\]]+)?$/;

function violetHits(ctx: ScanContext): Hit[] {
  const hits: Hit[] = [];
  for (const file of ctx.files) {
    const seen = new Set<string>();
    const push = (key: string, offset: number, message: string): void => {
      if (seen.has(key)) return;
      seen.add(key);
      hits.push({ path: file.path, offset, message });
    };
    for (const unit of file.classUnits) {
      for (const cls of bases(unit)) {
        const tw = cls.match(TW_VIOLET);
        if (tw) push(`${tw[1]}-${tw[2]}`, unit.offset, `${tw[1]}-${tw[2]} is the default AI accent`);
        const arb = arbitrary(cls);
        if (arb) {
          for (const c of findColours(arb)) {
            if (isAiViolet(c.oklch)) push(c.raw.toLowerCase(), unit.offset, `${c.raw} sits in the indigo-violet band (h ${c.oklch.h.toFixed(0)}°)`);
          }
        }
      }
    }
    for (const d of file.declarations) {
      if (FRAMEWORK_PALETTE.test(d.property)) continue;
      for (const c of findColours(d.value)) {
        if (c.alpha >= 0.5 && isAiViolet(c.oklch)) {
          push(c.raw.toLowerCase(), d.offset, `${c.raw} sits in the indigo-violet band (h ${c.oklch.h.toFixed(0)}°)`);
        }
      }
    }
  }
  return hits;
}

const BLUEISH = /^(?:blue|indigo|sky|cyan)$/;
const PURPLEISH = /^(?:violet|purple|fuchsia|pink)$/;

function gradientHits(ctx: ScanContext): Hit[] {
  const hits = eachUnit(ctx, (unit) => {
    if (!has(unit, /^bg-(?:gradient-to|linear|radial|conic)/)) return null;
    const stops = bases(unit)
      .map((c) => c.match(/^(?:from|via|to)-([a-z]+)-\d+/)?.[1])
      .filter((x): x is string => Boolean(x));
    if (stops.some((s) => BLUEISH.test(s)) && stops.some((s) => PURPLEISH.test(s))) {
      return `gradient from ${stops.join(" to ")}`;
    }
    return null;
  });
  for (const file of ctx.files) {
    for (const d of file.declarations) {
      if (!/gradient\(/.test(d.value) || FRAMEWORK_PALETTE.test(d.property)) continue;
      const colours = findColours(d.value).filter((c) => isBlueToPurple(c.oklch));
      if (colours.length < 2) continue;
      const hues = colours.map((c) => c.oklch.h);
      if (Math.max(...hues) - Math.min(...hues) >= 25) {
        hits.push({ path: file.path, offset: d.offset, message: `gradient from ${colours.map((c) => c.raw).join(" to ")}` });
      }
    }
  }
  return hits;
}

// Named cream tokens only. Tailwind's amber-50 and yellow-50 are the stock
// warning-notice fill, and flagging every patch-test notice as a cream page
// ground was the first false positive the scanner produced on real code.
const CREAM_CLASS = /^bg-(?:cream|ivory|parchment|linen|sand|oat|bone|eggshell)(?:-\d+)?(?:\/\d+)?$/;
const BG_PROPERTY = /background|^--(?:color-)?(?:bg|background|surface|canvas|paper|cream|base|page)/;

function creamHits(ctx: ScanContext): Hit[] {
  const hits: Hit[] = [];
  for (const file of ctx.files) {
    const seen = new Set<string>();
    const push = (key: string, offset: number, message: string): void => {
      if (seen.has(key)) return;
      seen.add(key);
      hits.push({ path: file.path, offset, message });
    };
    for (const unit of file.classUnits) {
      for (const cls of bases(unit)) {
        if (CREAM_CLASS.test(cls)) push(cls, unit.offset, `${cls} is a cream ground`);
        const arb = cls.startsWith("bg-") ? arbitrary(cls) : null;
        if (arb) for (const c of findColours(arb)) if (isCream(c.oklch)) push(c.raw.toLowerCase(), unit.offset, `${c.raw} is a cream ground`);
      }
    }
    for (const d of file.declarations) {
      if (!BG_PROPERTY.test(d.property) || FRAMEWORK_PALETTE.test(d.property)) continue;
      for (const c of findColours(d.value)) {
        if (c.alpha >= 0.9 && isCream(c.oklch)) push(c.raw.toLowerCase(), d.offset, `${c.raw} is a cream ground`);
      }
    }
  }
  return hits;
}

// ---------------------------------------------------------------- surfaces

function glassHits(ctx: ScanContext): Hit[] {
  const hits = eachUnit(ctx, (unit) =>
    has(unit, /^backdrop-blur/) && has(unit, /^bg-[a-z]+(?:-\d+)?\/(?:\d+|\[[\d.]+\])$/)
      ? "translucent blurred panel"
      : null,
  );
  for (const file of ctx.files) {
    for (const d of file.declarations) {
      if (/^(?:-webkit-)?backdrop-filter$/.test(d.property) && /blur\(/.test(d.value)) {
        hits.push({ path: file.path, offset: d.offset, message: "backdrop blur panel" });
      }
    }
  }
  return hits;
}

function gradientTextHits(ctx: ScanContext): Hit[] {
  const hits = eachUnit(ctx, (unit) =>
    has(unit, /^bg-clip-text$/) && has(unit, /^text-transparent$/) ? "gradient-filled text" : null,
  );
  for (const file of ctx.files) {
    for (const d of file.declarations) {
      if (/^(?:-webkit-)?background-clip$/.test(d.property) && /\btext\b/.test(d.value)) {
        hits.push({ path: file.path, offset: d.offset, message: "gradient-filled text" });
      }
    }
  }
  return hits;
}

function thinBorderWideShadowHits(ctx: ScanContext): Hit[] {
  const hits = eachUnit(ctx, (unit) => {
    const faint = has(unit, /^border-(?:black|white)\/(?:[1-9]|10|\[0?\.\d+\])$|^border-(?:gray|slate|zinc|neutral|stone)-(?:50|100|200)(?:\/\d+)?$/);
    const wide =
      has(unit, /^shadow-(?:xl|2xl)$/) ||
      bases(unit).some((c) => c.startsWith("shadow-[") && Number((arbitrary(c) ?? "").split(/\s+/)[2]?.replace("px", "")) >= 24);
    return faint && wide && has(unit, /^border$/) ? "hairline border under a wide soft shadow" : null;
  });
  for (const file of ctx.files) {
    const bySelector = new Map<string, { border?: number; shadow?: number; offset: number }>();
    for (const d of file.declarations) {
      const entry = bySelector.get(d.selector) ?? { offset: d.offset };
      if (/^border(?:-top|-bottom)?$/.test(d.property) && /\b1px\b/.test(d.value)) {
        const c = findColours(d.value)[0];
        if (c && c.alpha <= 0.12) entry.border = d.offset;
      }
      if (d.property === "box-shadow") {
        const blur = Math.max(...[...d.value.matchAll(/(?:^|,)\s*(?:inset\s+)?-?[\d.]+(?:px)?\s+-?[\d.]+(?:px)?\s+([\d.]+)px/g)].map((m) => Number(m[1])), 0);
        if (blur >= 24) entry.shadow = d.offset;
      }
      bySelector.set(d.selector, entry);
    }
    for (const entry of bySelector.values()) {
      if (entry.border !== undefined && entry.shadow !== undefined) {
        hits.push({ path: file.path, offset: entry.border, message: "hairline border under a wide soft shadow" });
      }
    }
  }
  return hits;
}

function glowHits(ctx: ScanContext): Hit[] {
  const hits = eachUnit(ctx, (unit) => {
    if (bases(unit).some((c) => c.startsWith("bg-[radial-gradient"))) return "radial spotlight behind content";
    const blob =
      has(unit, /^(?:absolute|fixed)$/) &&
      has(unit, /^blur-(?:2xl|3xl|\[(?:[4-9]\d|\d{3,})px\])$/) &&
      has(unit, /^(?:rounded-full|bg-gradient|bg-[a-z]+-\d+\/\d+|opacity-)/);
    return blob ? "blurred glow blob" : null;
  });
  for (const file of ctx.files) {
    for (const d of file.declarations) {
      if (!/^background(?:-image)?$/.test(d.property) || !/radial-gradient\(/.test(d.value)) continue;
      const colours = findColours(d.value);
      if (/transparent/.test(d.value) || colours.some((c) => c.alpha < 0.5)) {
        hits.push({ path: file.path, offset: d.offset, message: "radial spotlight fading to transparent" });
      }
    }
  }
  return hits;
}

function gridBackgroundHits(ctx: ScanContext): Hit[] {
  const hits = eachUnit(ctx, (unit) => {
    if (has(unit, /^bg-(?:grid|dot|dots|graph)(?:-|$)/)) return "decorative grid background";
    const arb = bases(unit).filter((c) => c.startsWith("bg-[") || c.startsWith("[background")).map((c) => arbitrary(c) ?? "");
    const lines = arb.join(" ").match(/(?:linear|radial)-gradient\([^)]*\b1px\b/g) ?? [];
    return lines.length > 0 ? "decorative grid background" : null;
  });
  for (const file of ctx.files) {
    for (const d of file.declarations) {
      if (!/^background(?:-image)?$/.test(d.property)) continue;
      const lines = d.value.match(/(?:linear|radial)-gradient\([^;]*?\b1px\b/g) ?? [];
      if (lines.length >= 1 && /gradient\([\s\S]*gradient\(/.test(d.value)) {
        hits.push({ path: file.path, offset: d.offset, message: "decorative grid background" });
      }
    }
  }
  return hits;
}

function italicSerifHits(ctx: ScanContext): Hit[] {
  const hits = eachUnit(ctx, (unit) =>
    has(unit, /^italic$/) && has(unit, /^font-(?:serif|display|heading|title|\[)/) && !has(unit, /^font-(?:sans|mono)$/)
      ? "italic serif display"
      : null,
  );
  for (const file of ctx.files) {
    for (const m of file.text.matchAll(/<h[1-3]\b[^>]*>(?:(?!<\/h[1-3]>)[\s\S]){0,200}?<(?:em|i)\b/g)) {
      hits.push({ path: file.path, offset: m.index ?? 0, message: "italic word set inside a display heading" });
    }
    for (const d of file.declarations) {
      if (d.property === "font-style" && d.value === "italic" && /(?:^|[\s,>])(?:h[1-3]|\.?(?:display|hero|headline|title))\b/i.test(d.selector)) {
        hits.push({ path: file.path, offset: d.offset, message: `italic display type on ${d.selector}` });
      }
    }
  }
  return hits;
}

// ---------------------------------------------------------------- structure

function eyebrowChipHits(ctx: ScanContext): Hit[] {
  const hits: Hit[] = [];
  for (const file of ctx.files) {
    const h1 = file.text.search(/<h1\b/);
    if (h1 === -1) continue;
    for (const unit of file.classUnits) {
      if (unit.offset > h1 || h1 - unit.offset > 900) continue;
      const chip =
        has(unit, /^rounded-full$/) &&
        has(unit, /^(?:border|ring-1|bg-[a-z]+-\d+\/\d+|bg-[a-z]+-(?:50|100))$/) &&
        has(unit, /^text-(?:xs|sm|\[1[0-3]px\])$/) &&
        has(unit, /^px-(?:2|2\.5|3|3\.5|4)$/);
      if (chip) hits.push({ path: file.path, offset: unit.offset, message: "pill badge above the hero heading" });
    }
  }
  return hits;
}

function iconTiles(file: ParsedFile): ClassUnit[] {
  return file.classUnits.filter((unit) => {
    const sized =
      has(unit, /^size-(?:8|9|10|11|12|14)$/) ||
      ((find(unit, /^h-(?:8|9|10|11|12|14)$/) ?? "x").slice(2) === (find(unit, /^w-(?:8|9|10|11|12|14)$/) ?? "y").slice(2));
    return (
      sized &&
      has(unit, /^rounded-(?:md|lg|xl|2xl|full)$/) &&
      has(unit, /^(?:items-center|place-items-center|place-content-center)$/) &&
      has(unit, /^bg-/)
    );
  });
}

const ICON_LIBRARY = /from\s+["'](?:lucide-react|@heroicons\/react[^"']*|react-icons[^"']*|@phosphor-icons\/react|@tabler\/icons-react|@radix-ui\/react-icons)["']/;

function iconTileStackHits(ctx: ScanContext): Hit[] {
  const hits: Hit[] = [];
  for (const file of ctx.files) {
    if (!ICON_LIBRARY.test(file.text)) continue;
    const tiles = iconTiles(file);
    if (tiles.length > 0) {
      hits.push({ path: file.path, offset: tiles[0].offset, message: `icon in a tinted tile (${tiles.length} in this file)` });
    }
  }
  return hits;
}

function iconGridHits(ctx: ScanContext): Hit[] {
  const hits: Hit[] = [];
  for (const file of ctx.files) {
    if (!ICON_LIBRARY.test(file.text) || iconTiles(file).length === 0) continue;
    const grid = file.classUnits.find((u) => has(u, /^grid-cols-3$/) && has(u, /^grid$/));
    if (grid) hits.push({ path: file.path, offset: grid.offset, message: "three-column grid of icon cards" });
  }
  return hits;
}

function bentoHits(ctx: ScanContext): Hit[] {
  const hits: Hit[] = [];
  for (const file of ctx.files) {
    const all = file.classUnits.flatMap(bases);
    const colSpan = all.some((c) => /^col-span-[2-3]$/.test(c));
    const rowSpan = file.classUnits.find((u) => has(u, /^row-span-[2-3]$/));
    if (colSpan && rowSpan) {
      hits.push({ path: file.path, offset: rowSpan.offset, message: "mixed column and row spans: a bento grid" });
    }
  }
  return hits;
}

const WRAPPER = /^(?:Section|Container|Reveal|FadeIn|FadeUp|Fade|Animate\w*|Motion\w*|Suspense|Fragment|Wrapper|Layout|Main|ErrorBoundary)$/;
const PROOF = /Trust|Logo|Proof|Stat|Badge|Partner|Client|Marquee|Press|Rating|Review|Testimonial|Accredit|Brands/;

function heroThenProofHits(ctx: ScanContext): Hit[] {
  const hits: Hit[] = [];
  for (const file of ctx.files) {
    if (file.kind !== "markup") continue;
    const tags = [...file.text.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)].map((m) => ({ name: m[1], offset: m.index ?? 0 }));
    const hero = tags.findIndex((t) => /Hero/.test(t.name));
    if (hero === -1) continue;
    const next = tags.slice(hero + 1).find((t) => !WRAPPER.test(t.name) && !/Hero/.test(t.name));
    if (next && PROOF.test(next.name)) {
      hits.push({ path: file.path, offset: next.offset, message: `${tags[hero].name} is followed straight by ${next.name}` });
    }
  }
  return hits;
}

// ---------------------------------------------------------------- counted

/** Above this many scroll reveals in one scan, reveal is the default, not a choice. */
export const REVEAL_LIMIT = 12;
/** Above this many fully rounded shapes in one scan, the pill is the shape language by accident. */
export const PILL_LIMIT = 30;
/** A components/ui folder with this many stock primitives is a generator's dump. */
export const SHADCN_LIMIT = 12;

const REVEAL = /<(?:Reveal|ScrollReveal|FadeIn|FadeUp|FadeInUp|SlideIn|SlideUp|AnimateIn|AnimateOnScroll|InView|RevealOnScroll)\b|\bwhileInView\b|\bdata-aos=|\buseInView\s*\(|\bscrollTrigger\s*:/g;

function countHits(ctx: ScanContext, perFile: (file: ParsedFile) => number[], limit: number, label: (n: number, top: string) => string): Hit[] {
  let total = 0;
  let worst: { file: ParsedFile; offsets: number[] } | null = null;
  for (const file of ctx.files) {
    const offsets = perFile(file);
    total += offsets.length;
    if (!worst || offsets.length > worst.offsets.length) worst = { file, offsets };
  }
  if (total <= limit || !worst || worst.offsets.length === 0) return [];
  return [{ path: worst.file.path, offset: worst.offsets[0], message: label(total, `${worst.file.path} has ${worst.offsets.length}`) }];
}

function revealHits(ctx: ScanContext): Hit[] {
  return countHits(
    ctx,
    (file) => (file.kind === "markup" || file.kind === "script" ? [...file.text.matchAll(REVEAL)].map((m) => m.index ?? 0) : []),
    REVEAL_LIMIT,
    (n, top) => `${n} scroll reveals (limit ${REVEAL_LIMIT}); ${top}`,
  );
}

/** A radius so large it only ever means "fully round". */
const PILL_RADIUS = /\b(?:9{3,}|[1-9]\d{3,})px\b|\b(?:50|100)vh\b|\b100vmax\b|\b9{3,}rem\b/;

function pillHits(ctx: ScanContext): Hit[] {
  return countHits(
    ctx,
    (file) => [
      ...file.classUnits.filter((u) => has(u, /^rounded-full$/)).map((u) => u.offset),
      ...file.declarations
        .filter((d) => /^border(?:-[a-z]+)*-radius$/.test(d.property) && PILL_RADIUS.test(d.value))
        .map((d) => d.offset),
    ],
    PILL_LIMIT,
    (n, top) => `${n} fully rounded shapes (limit ${PILL_LIMIT}); ${top}`,
  );
}

/** The stock shadcn/ui primitives, as their files are named. */
export const SHADCN_PRIMITIVES = [
  "accordion", "alert", "alert-dialog", "aspect-ratio", "avatar", "badge", "breadcrumb", "button",
  "calendar", "card", "carousel", "chart", "checkbox", "collapsible", "command", "context-menu",
  "dialog", "drawer", "dropdown-menu", "form", "hover-card", "input", "input-otp", "label",
  "menubar", "navigation-menu", "pagination", "popover", "progress", "radio-group", "resizable",
  "scroll-area", "select", "separator", "sheet", "sidebar", "skeleton", "slider", "sonner",
  "switch", "table", "tabs", "textarea", "toast", "toaster", "toggle", "toggle-group", "tooltip",
] as const;

function shadcnHits(ctx: ScanContext): Hit[] {
  const stock = new Set<string>(SHADCN_PRIMITIVES);
  const ui = ctx.files.filter((file) => {
    const m = file.path.match(/(?:^|\/)components\/ui\/([a-z-]+)\.(?:tsx|jsx|ts)$/);
    return m !== null && stock.has(m[1]);
  });
  if (ui.length < SHADCN_LIMIT) return [];
  const others = ctx.files.filter((file) => !ui.includes(file));
  const imported = (name: string): boolean =>
    others.some((o) => new RegExp(`ui/${name}["']`).test(o.text)) ||
    ui.some((o) => new RegExp(`["']\\./${name}["']|ui/${name}["']`).test(o.text));
  const unused = others.length > 0 ? ui.filter((file) => !imported(file.path.match(/([a-z-]+)\.[a-z]+$/)![1])) : [];
  const detail = unused.length > 0 ? `; ${unused.length} imported nowhere` : "";
  return [{ path: ui[0].path, offset: 0, message: `${ui.length} stock shadcn primitives${detail}` }];
}

function marqueeHits(ctx: ScanContext): Hit[] {
  const hits: Hit[] = [];
  const pattern = /@keyframes\s+[\w-]*marquee|animate-(?:marquee|scroll-x|infinite-scroll)\b|<Marquee\b|["']react-fast-marquee["']|ui\/marquee["']|animation(?:-name)?\s*:\s*[^;]*marquee/i;
  for (const file of ctx.files) {
    const at = firstMatch(file.text, pattern);
    if (at !== -1) hits.push({ path: file.path, offset: at, message: "scrolling marquee" });
  }
  return hits;
}

function introHits(ctx: ScanContext): Hit[] {
  const hits: Hit[] = [];
  const name = /(?:^|\/)(?:intro(?:-?(?:cinematic|sequence|animation|overlay))?|preloader|splash(?:-?screen)?|loading-?screen|curtain)\.(?:tsx|jsx|vue|svelte|astro)$/i;
  for (const file of ctx.files) {
    if (name.test(file.path) && /sessionStorage|localStorage|AnimatePresence|setTimeout|gsap|@keyframes|animate\(/.test(file.text)) {
      hits.push({ path: file.path, offset: 0, message: "intro sequence before the page" });
      continue;
    }
    const use = file.text.match(/<(?:IntroCinematic|Intro|Preloader|Splash|SplashScreen|LoadingScreen|Curtain)\b/);
    if (use && file.kind === "markup") hits.push({ path: file.path, offset: use.index ?? 0, message: `${use[0].slice(1)} runs before the page` });
  }
  return hits;
}

// ---------------------------------------------------------------- catalogue

export const SOURCE_TELLS: SourceTell[] = [
  {
    id: "reflex-font",
    name: "Reflex font",
    generation: 1,
    severity: "warn",
    surface: "source",
    why: "Inter, Roboto, Poppins and friends are what a model sets when nothing in the brief names a face. Every site in the estate ships one.",
    fix: "Pick the display face from the client's world (signage, packaging, the trade's lettering), record why in art-direction.json, and keep it unique across the estate.",
    detect: fontTell(REFLEX_FONTS_1),
    fixtures: {
      flag: [
        f("app/layout.tsx", `import { Inter } from "next/font/google";\nconst inter = Inter({ subsets: ["latin"] });`),
        f("index.html", `<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600" rel="stylesheet">`),
        f("tailwind.config.js", `fontFamily: { sans: ["Roboto", "sans-serif"] }`),
        f("main.ts", `import "@fontsource/montserrat";`),
        f("components/A.tsx", `<p className="font-['Open_Sans']">x</p>`),
      ],
      pass: [f("app/layout.tsx", `import { Bricolage_Grotesque } from "next/font/google";`)],
    },
  },
  {
    id: "reflex-font-2",
    name: "Second-wave reflex font",
    generation: 2,
    severity: "warn",
    surface: "source",
    why: "Ban Inter and a model reaches for Inter Tight, DM Sans, Manrope, Space Grotesk or an Instrument/Fraunces serif. A swap inside the reflex list is not a decision.",
    fix: "Same as reflex-font. If this face really is the right one, declare an exception with the reason and the evidence.",
    detect: fontTell(REFLEX_FONTS_2),
    fixtures: {
      flag: [f("src/styles.css", `@theme {\n  --font-sans: "DM Sans", system-ui, sans-serif;\n}`)],
      pass: [f("src/styles.css", `@theme {\n  --font-sans: "Hanken Grotesk", system-ui, sans-serif;\n}`)],
    },
  },
  {
    id: "ai-violet",
    name: "Indigo-violet accent",
    generation: 1,
    severity: "warn",
    surface: "source",
    why: "Tailwind's indigo and violet are the accent a model picks for any brand it knows nothing about. Hue is read in OKLCh, so a hex violet is caught as well as a class name.",
    fix: "Derive the accent from something the client owns (livery, shopfront, product). If violet is the brand, declare it: `{ \"tell\": \"ai-violet\", \"because\": \"...\" }`.",
    detect: violetHits,
    fixtures: {
      flag: [
        f("components/Hero.tsx", `<a className="rounded-md bg-indigo-600 px-4 py-2 text-white">Book</a>`),
        f("app/globals.css", `:root { --accent: #5a35d1; }`),
      ],
      pass: [f("components/Hero.tsx", `<a className="rounded-md bg-emerald-700 px-4 py-2 text-white">Book</a>`)],
    },
  },
  {
    id: "blue-purple-gradient",
    name: "Blue-to-purple gradient",
    generation: 1,
    severity: "warn",
    surface: "source",
    why: "The first-wave hero background. It says 'software product' on a plumber's site.",
    fix: "Use a flat ground from the palette. If the design needs depth, get it from photography or material texture from the client's world.",
    detect: gradientHits,
    fixtures: {
      flag: [
        f("components/Hero.tsx", `<section className="bg-gradient-to-r from-blue-600 to-purple-600">`),
        f("app/globals.css", `.hero { background: linear-gradient(135deg, #2563eb, #9333ea); }`),
      ],
      pass: [f("components/Hero.tsx", `<section className="bg-gradient-to-b from-stone-100 to-stone-200">`)],
    },
  },
  {
    id: "gradient-text",
    name: "Gradient-filled heading",
    generation: 1,
    severity: "warn",
    surface: "source",
    why: "Gradient text is the model's way of making a heading look designed without deciding what it should look like.",
    fix: "Set the heading in the display face at a real size and weight. Let type do the work.",
    detect: gradientTextHits,
    fixtures: {
      flag: [
        f("components/Hero.tsx", `<h1 className="bg-gradient-to-r from-rose-500 to-amber-500 bg-clip-text text-transparent">`),
        f("app/globals.css", `.headline { -webkit-background-clip: text; color: transparent; }`),
      ],
      pass: [f("components/Hero.tsx", `<h1 className="font-display text-5xl text-ink">`)],
    },
  },
  {
    id: "glass-panel",
    name: "Glass panel",
    generation: 1,
    severity: "warn",
    surface: "source",
    why: "A translucent blurred card over a busy background is the stock way to put text on a hero image. It costs contrast and says nothing about the client.",
    fix: "Give text a solid ground, or crop the image so the text sits on a quiet area.",
    detect: glassHits,
    fixtures: {
      flag: [
        f("components/Hero.tsx", `<div className="rounded-2xl bg-white/10 p-8 backdrop-blur-md">`),
        f("app/globals.css", `.card { background: rgb(255 255 255 / .1); backdrop-filter: blur(12px); }`),
      ],
      pass: [f("components/Hero.tsx", `<div className="rounded-sm bg-paper p-8">`)],
    },
  },
  {
    id: "hero-then-proof",
    name: "Hero straight into a trust strip",
    generation: 1,
    severity: "warn",
    surface: "source",
    why: "Six of seven estate sites go hero, then logos or stats. It is the landing-page template's order, not the client's story.",
    fix: "Follow the hero with the thing only this business has: the work, the place, the person. Put proof where a doubt arises.",
    detect: heroThenProofHits,
    fixtures: {
      flag: [f("app/page.tsx", `export default function Page() {\n  return (<main><Hero /><TrustStrip /><Services /></main>);\n}`)],
      pass: [f("app/page.tsx", `export default function Page() {\n  return (<main><Hero /><Workshop /><TrustStrip /></main>);\n}`)],
    },
  },
  {
    id: "icon-tile-grid",
    name: "Three-column icon-card grid",
    generation: 1,
    severity: "warn",
    surface: "source",
    why: "Three cards, each an icon, a heading and two lines, is what a model builds for any list of services.",
    fix: "Show the services as the client would: a price list, a menu board, photographs of the work, a sequence.",
    detect: iconGridHits,
    fixtures: {
      flag: [
        f(
          "components/Features.tsx",
          `import { Heart } from "lucide-react";\n<div className="grid grid-cols-1 gap-6 md:grid-cols-3">\n  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100"><Heart /></div>\n</div>`,
        ),
      ],
      pass: [f("components/Features.tsx", `<ul className="divide-y">\n  <li className="flex justify-between py-3">Gel manicure <span>£32</span></li>\n</ul>`)],
    },
  },
  {
    id: "reveal-everywhere",
    name: "Reveal on every section",
    generation: 1,
    severity: "warn",
    surface: "source",
    why: "When every block fades up on scroll, the motion stops meaning anything and the page feels slow. MMM had 70, DD 40, sen-sphere 27.",
    fix: `Keep one gated signature moment per page (STANDARD section 7) and let the rest arrive still. The limit here is ${REVEAL_LIMIT} per scan.`,
    detect: revealHits,
    fixtures: {
      flag: [f("app/page.tsx", Array.from({ length: REVEAL_LIMIT + 1 }, (_, i) => `<Reveal><Block n={${i}} /></Reveal>`).join("\n"))],
      pass: [f("app/page.tsx", `<Reveal><Signature /></Reveal>\n<Block />\n<Block />`)],
    },
  },
  {
    id: "pill-everything",
    name: "Pills everywhere",
    generation: 1,
    severity: "warn",
    surface: "source",
    why: "rounded-full on every button, badge and tag is the framework's friendliest default. MMM had 162, DD 125. A shape used everywhere is not a shape language.",
    fix: `Choose the shape language on purpose (and record it), then use the pill only where it means something. The limit here is ${PILL_LIMIT} per scan.`,
    detect: pillHits,
    fixtures: {
      flag: [f("components/Tags.tsx", Array.from({ length: PILL_LIMIT + 1 }, () => `<span className="rounded-full px-3">tag</span>`).join("\n"))],
      pass: [f("components/Tags.tsx", `<span className="rounded-full px-3">tag</span>\n<a className="rounded-sm px-4">Book</a>`)],
    },
  },
  {
    id: "shadcn-dump",
    name: "Stock component dump",
    generation: 1,
    severity: "warn",
    surface: "source",
    why: "A generator exports the whole shadcn/ui kit whether the site uses it or not. Rise & Bloom ships a full set under its own book, vine and petal assets.",
    fix: "Delete the primitives nothing imports. Restyle the ones that stay so they belong to this site.",
    detect: shadcnHits,
    fixtures: {
      flag: [SHADCN_PRIMITIVES.slice(0, SHADCN_LIMIT).map((name) => f(`src/components/ui/${name}.tsx`, `export function X() { return null; }`))],
      pass: [f("src/components/ui/button.tsx", `export function Button() { return null; }`)],
    },
  },
  {
    id: "cream-palette",
    name: "Cream ground",
    generation: 2,
    severity: "warn",
    surface: "source",
    why: "Once white-and-violet was named, models moved to a warm off-white: parchment, linen, oat. It reads as 'tasteful' in the same way everywhere.",
    fix: "Take the ground from the client's material world (paper stock, wall colour, tile). If it really is cream, say why.",
    detect: creamHits,
    fixtures: {
      flag: [
        f("app/globals.css", `body { background-color: #f5efe6; }`),
        f("app/page.tsx", `<main className="bg-cream text-ink">`),
        f("app/page.tsx", `<main className="bg-[#f7f1e8]">`),
      ],
      pass: [f("app/globals.css", `body { background-color: #ffffff; }`)],
    },
  },
  {
    id: "italic-serif-display",
    name: "Italic serif display",
    generation: 2,
    severity: "warn",
    surface: "source",
    why: "A serif heading with one italic word ('Beauty, reimagined') is the second wave's signature move.",
    fix: "Use emphasis only where the sentence needs it, and set it the way the display face wants, not by reflex.",
    detect: italicSerifHits,
    fixtures: {
      flag: [
        f("components/Hero.tsx", `<h1 className="font-display text-6xl">Nails, <em>reimagined</em></h1>`),
        f("components/Hero.tsx", `<span className="font-serif italic">reimagined</span>`),
        f("app/globals.css", `.hero h1 { font-style: italic; }`),
      ],
      pass: [f("components/Hero.tsx", `<h1 className="font-display text-6xl">Nails in Brackley</h1>\n<p><em>Walk-ins</em> welcome.</p>`)],
    },
  },
  {
    id: "hero-eyebrow-chip",
    name: "Eyebrow chip above the hero",
    generation: 2,
    severity: "warn",
    surface: "source",
    why: "A small bordered pill ('New · Now booking') above the headline is in almost every generated hero.",
    fix: "Drop it. If the fact matters, put it in the headline or the first line of copy.",
    detect: eyebrowChipHits,
    fixtures: {
      flag: [
        f("components/Hero.tsx", `<span className="inline-flex rounded-full border px-3 py-1 text-xs">Now booking</span>\n<h1>Nails in Brackley</h1>`),
        f("components/Hero.tsx", `<span className={cn("rounded-full px-3 text-xs", "bg-rose-500/10")}>New</span>\n<h1>Nails</h1>`),
      ],
      pass: [f("components/Hero.tsx", `<h1>Nails in Brackley</h1>\n<span className="inline-flex rounded-full border px-3 py-1 text-xs">Tag</span>`)],
    },
  },
  {
    id: "icon-tile-stack",
    name: "Icon in a tinted tile",
    generation: 2,
    severity: "warn",
    surface: "source",
    why: "A library icon in a soft rounded square, stacked above a heading, is the stock card header.",
    fix: "Use the client's own marks, photography or numerals. If an icon earns its place, set it inline with the text.",
    detect: iconTileStackHits,
    fixtures: {
      flag: [f("components/Card.tsx", `import { Sparkles } from "lucide-react";\n<div className="flex size-10 items-center justify-center rounded-lg bg-violet-100"><Sparkles /></div>`)],
      pass: [f("components/Card.tsx", `import { Sparkles } from "lucide-react";\n<p className="flex items-center gap-2"><Sparkles className="size-4" />Aftercare</p>`)],
    },
  },
  {
    id: "bento-grid",
    name: "Bento grid",
    generation: 2,
    severity: "warn",
    surface: "source",
    why: "Mixed-size tiles in a grid became the default 'features' layout of the second wave.",
    fix: "Lay content out by what it is. If one item matters most, give it the page, not a double-width tile.",
    detect: bentoHits,
    fixtures: {
      flag: [f("components/Features.tsx", `<div className="grid grid-cols-3"><div className="md:col-span-2 md:row-span-2" /><div /></div>`)],
      pass: [f("components/Features.tsx", `<div className="grid grid-cols-3"><div className="col-span-2" /><div /></div>`)],
    },
  },
  {
    id: "radial-spotlight-glow",
    name: "Radial glow",
    generation: 2,
    severity: "warn",
    surface: "source",
    why: "A soft blurred blob or radial spotlight behind the hero is atmosphere without a subject.",
    fix: "Light the page with real imagery, or leave the ground flat.",
    detect: glowHits,
    fixtures: {
      flag: [
        f("components/Hero.tsx", `<div className="absolute -top-20 left-1/2 h-96 w-96 rounded-full bg-rose-400/30 blur-3xl" />`),
        f("app/globals.css", `.hero { background: radial-gradient(circle at top, rgb(244 63 94 / .25), transparent 60%); }`),
      ],
      pass: [f("components/Hero.tsx", `<div className="absolute inset-0 bg-black/40" />`)],
    },
  },
  {
    id: "grid-background",
    name: "Graph-paper background",
    generation: 2,
    severity: "warn",
    surface: "source",
    why: "A faint 1px line or dot grid behind the hero is the developer-tool look, borrowed by everyone.",
    fix: "Remove it. If the brand has a pattern, draw it from the brand.",
    detect: gridBackgroundHits,
    fixtures: {
      flag: [
        f(
          "app/globals.css",
          `.hero { background-image: linear-gradient(to right, #e5e5e5 1px, transparent 1px), linear-gradient(to bottom, #e5e5e5 1px, transparent 1px); background-size: 24px 24px; }`,
        ),        f("components/Hero.tsx", `<div className="absolute inset-0 bg-[linear-gradient(to_right,#8882_1px,transparent_1px)] bg-[size:24px_24px]" />`),
      ],
      pass: [f("app/globals.css", `.hero { background-image: url(/shopfront.avif); }`)],
    },
  },
  {
    id: "marquee",
    name: "Scrolling marquee",
    generation: 2,
    severity: "warn",
    surface: "source",
    why: "An endless strip of logos or words is the second wave's trust strip. It moves so it looks alive.",
    fix: "Show proof still and in context: one named review, one accreditation, where the doubt arises.",
    detect: marqueeHits,
    fixtures: {
      flag: [
        f("app/globals.css", `@keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }`),
        f("components/Logos.tsx", `import Marquee from "react-fast-marquee";`),
      ],
      pass: [f("app/globals.css", `@keyframes fade { from { opacity: 0 } to { opacity: 1 } }`)],
    },
  },
  {
    id: "thin-border-wide-shadow",
    name: "Hairline border, wide shadow",
    generation: 2,
    severity: "warn",
    surface: "source",
    why: "A near-invisible border under a large soft shadow is the stock 'elevated card'.",
    fix: "Pick one: a border that is visible, or a shadow the light source explains. Keep within the four-shadow budget.",
    detect: thinBorderWideShadowHits,
    fixtures: {
      flag: [
        f("components/Card.tsx", `<div className="rounded-2xl border border-black/5 bg-white shadow-2xl">`),
        f("app/globals.css", `.card { border: 1px solid rgb(0 0 0 / .06); box-shadow: 0 20px 48px rgb(0 0 0 / .08); }`),
      ],
      pass: [f("components/Card.tsx", `<div className="rounded-sm border border-ink bg-white">`)],
    },
  },
  {
    id: "intro-cinematic",
    name: "Intro cinematic",
    generation: 2,
    severity: "warn",
    surface: "source",
    why: "A logo animation that runs before the page is something a model adds to make a site feel premium. Three estate sites open with one. It delays the page for every visitor.",
    fix: "Remove it. Spend the signature moment on something the visitor came for.",
    detect: introHits,
    fixtures: {
      flag: [
        f("components/IntroCinematic.tsx", `const seen = sessionStorage.getItem("intro");\nexport function IntroCinematic() { return <AnimatePresence /> }`),
        f("app/page.tsx", `<><Preloader /><Hero /></>`),
      ],
      pass: [f("components/Introduction.md", `An introduction to the studio.`)],
    },
  },
];
