/// <reference lib="dom" />
/**
 * The in-page half of a snapshot.
 *
 * `collectInPage` runs inside the browser through `page.evaluate`, so it must
 * be self-contained: no imports, no references to anything outside its own
 * body. Anything that drives a browser can call it: craft's own `snapshotUrl`,
 * trawl, a Playwright test in a client repo.
 *
 * It measures, it does not judge. Every threshold that decides whether
 * something is a tell lives in the pure detectors, where it can be tested
 * against a fixture without a browser.
 */

import type { Snapshot } from "../snapshot/types.js";

export type InPageSnapshot = Omit<Snapshot, "version" | "url" | "capturedAt" | "motion"> & {
  motion: Omit<Snapshot["motion"], "introOverlay">;
};

export function collectInPage(): InPageSnapshot {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const scrollY = window.scrollY;
  const LIMIT = 8000;
  const all = Array.from(document.body.querySelectorAll("*")).slice(0, LIMIT) as HTMLElement[];

  const styles = new Map<Element, CSSStyleDeclaration>();
  const style = (el: Element): CSSStyleDeclaration => {
    let cs = styles.get(el);
    if (!cs) styles.set(el, (cs = getComputedStyle(el)));
    return cs;
  };
  const box = (el: Element) => {
    const r = el.getBoundingClientRect();
    return { top: r.top + scrollY, left: r.left, width: r.width, height: r.height };
  };
  const shown = (el: Element): boolean => {
    const cs = style(el);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const alphaOf = (c: string): number => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return c === "transparent" ? 0 : 1;
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    return parts.length >= 4 ? parseFloat(parts[3]) : 1;
  };
  const painted = (c: string): boolean => Boolean(c) && alphaOf(c) > 0.02;
  const ownText = (el: Element): string =>
    Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.nodeValue ?? "")
      .join("")
      .replace(/\s+/g, " ")
      .trim();
  const firstFamily = (stack: string): string => (stack.split(",")[0] ?? "").replace(/["']/g, "").trim();
  const px = (v: string): number => parseFloat(v) || 0;

  // ------------------------------------------------------------ colour and type
  const bg = new Map<string, { area: number; chars: number }>();
  const text = new Map<string, { area: number; chars: number }>();
  const fonts = new Map<string, { chars: number; displayChars: number; italicChars: number; weights: Set<number> }>();
  const sizes = new Set<number>();
  const weights = new Set<number>();
  const radii = new Set<string>();
  const shadows = new Set<string>();
  const spacing: number[] = [];
  const pageArea = Math.max(1, document.documentElement.scrollHeight * vw);

  for (const el of all) {
    if (!shown(el)) continue;
    const cs = style(el);
    const b = box(el);
    const area = Math.min(b.width * b.height, pageArea);
    if (painted(cs.backgroundColor)) {
      const e = bg.get(cs.backgroundColor) ?? { area: 0, chars: 0 };
      e.area += area;
      bg.set(cs.backgroundColor, e);
    }
    const own = ownText(el);
    if (own.length > 1) {
      const chars = own.length;
      const t = text.get(cs.color) ?? { area: 0, chars: 0 };
      t.chars += chars;
      text.set(cs.color, t);
      const family = firstFamily(cs.fontFamily);
      const f = fonts.get(family) ?? { chars: 0, displayChars: 0, italicChars: 0, weights: new Set<number>() };
      const size = px(cs.fontSize);
      const weight = parseInt(cs.fontWeight, 10) || 400;
      f.chars += chars;
      if (/^H[1-3]$/.test(el.tagName) || size >= 28) f.displayChars += chars;
      if (cs.fontStyle === "italic" || cs.fontStyle.startsWith("oblique")) f.italicChars += chars;
      f.weights.add(weight);
      fonts.set(family, f);
      sizes.add(Math.round(size));
      weights.add(weight);
    }
    if (/^(A|BUTTON|SECTION|ARTICLE|ASIDE)$/.test(el.tagName) || /card|panel|box|tile/i.test(typeof el.className === "string" ? el.className : "")) {
      if (cs.borderRadius && cs.borderRadius !== "0px") radii.add(cs.borderRadius);
      if (cs.boxShadow && cs.boxShadow !== "none") shadows.add(cs.boxShadow);
    }
    for (const prop of ["marginTop", "marginBottom", "paddingTop", "paddingBottom"] as const) {
      const v = Math.round(px(cs[prop]));
      if (v > 0 && v <= 200) spacing.push(v);
    }
  }

  const htmlBg = getComputedStyle(document.documentElement).backgroundColor;
  const bodyBg = getComputedStyle(document.body).backgroundColor;
  const ground = painted(bodyBg) ? bodyBg : painted(htmlBg) ? htmlBg : "rgb(255, 255, 255)";

  // ------------------------------------------------------------------ headings
  const headings = (Array.from(document.querySelectorAll("h1, h2, h3")) as HTMLElement[])
    .filter(shown)
    .slice(0, 60)
    .map((h) => {
      const cs = style(h);
      const italic = cs.fontStyle !== "normal";
      const italicPart =
        !italic &&
        (Array.from(h.querySelectorAll("*")) as HTMLElement[]).some((c) => style(c).fontStyle !== "normal" && (c.textContent ?? "").trim().length > 0);
      return {
        level: Number(h.tagName[1]),
        family: firstFamily(cs.fontFamily),
        sizePx: Math.round(px(cs.fontSize)),
        weight: parseInt(cs.fontWeight, 10) || 400,
        italic,
        italicPart,
        text: (h.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
        top: Math.round(box(h).top),
      };
    });

  // ------------------------------------------------------------------ controls
  const isButtonEl = (el: Element): boolean =>
    el.tagName === "BUTTON" || (el.tagName === "INPUT" && /^(submit|button)$/i.test((el as HTMLInputElement).type));
  /** A button, or an anchor drawn as one. */
  const isControl = (el: Element): boolean => {
    const isButton = isButtonEl(el);
    if (!isButton && el.tagName !== "A") return false;
    if (!shown(el)) return false;
    const cs = style(el);
    const b = box(el);
    const label = (el.textContent ?? (el as HTMLInputElement).value ?? "").replace(/\s+/g, " ").trim();
    if (!label || b.height < 24 || b.height > 90) return false;
    // An anchor counts as a control only when it is drawn as one.
    if (!isButton && !(painted(cs.backgroundColor) || px(cs.borderTopWidth) >= 1)) return false;
    if (!isButton && px(cs.paddingLeft) < 8) return false;
    return true;
  };
  const controls: Snapshot["controls"] = [];
  for (const el of all) {
    if (!isControl(el)) continue;
    const isButton = isButtonEl(el);
    const cs = style(el);
    const b = box(el);
    const label = (el.textContent ?? (el as HTMLInputElement).value ?? "").replace(/\s+/g, " ").trim();
    const r = cs.borderTopLeftRadius;
    const radius = r.endsWith("%") ? (parseFloat(r) / 100) * b.height : px(r);
    controls.push({
      kind: isButton ? "button" : "link",
      radiusPx: Math.round(radius),
      heightPx: Math.round(b.height),
      background: cs.backgroundColor,
      text: label.slice(0, 60),
    });
    if (controls.length >= 200) break;
  }

  // ---------------------------------------------------------------- animation
  type Anim = { target: Element | null; infinite: boolean; translateX: boolean };
  const anims: Anim[] = [];
  const docAny = document as Document & { getAnimations?: () => Animation[] };
  for (const a of docAny.getAnimations ? docAny.getAnimations() : []) {
    const effect = a.effect as KeyframeEffect | null;
    if (!effect) continue;
    let translateX = false;
    try {
      translateX = effect.getKeyframes().some((k) => /translate(?:X|3d)?\(\s*-?[\d.]+(?:%|px)/.test(String(k.transform ?? "")) && !/translateY/.test(String(k.transform ?? "")));
    } catch {
      translateX = false;
    }
    anims.push({ target: effect.target, infinite: effect.getTiming().iterations === Infinity, translateX });
  }
  const marqueeTargets = anims.filter((a) => a.infinite && a.translateX && a.target).map((a) => a.target as Element);

  // ------------------------------------------------------------------ sections
  const root = (document.querySelector("main") as HTMLElement | null) ?? document.body;
  // Header and footer are chrome, not sections of the page's story.
  const blocks: HTMLElement[] = [];
  const pushBlocks = (parent: HTMLElement, depth: number): void => {
    for (const child of Array.from(parent.children) as HTMLElement[]) {
      if (!shown(child) && !(style(child).opacity === "0")) continue;
      const b = box(child);
      if (b.height < 80 || b.width < vw * 0.5) continue;
      const kids = (Array.from(child.children) as HTMLElement[]).filter((k) => box(k).height >= 80 && box(k).width >= vw * 0.5);
      const covered = kids.reduce((n, k) => n + box(k).height, 0);
      // A wrapper is anything whose block children stack to fill it: one child
      // holding most of its height, or several that together hold most of it.
      // A section is where that stops being true.
      const wrapper =
        depth < 6 &&
        !/^(SECTION|ARTICLE|HEADER|FOOTER|ASIDE|NAV)$/.test(child.tagName) &&
        ((kids.length === 1 && box(kids[0]).height >= b.height * 0.8) || (kids.length >= 2 && covered >= b.height * 0.6));
      if (wrapper) pushBlocks(child, depth + 1);
      else blocks.push(child);
    }
  };
  pushBlocks(root, 0);
  const header = document.querySelector("body > header, header");
  const h1 = document.querySelector("h1");

  const waiting = (c: HTMLElement): boolean => {
    const cs = style(c);
    const op = parseFloat(cs.opacity);
    return op < 0.1 || (op < 1 && cs.transform !== "none") || c.hasAttribute("data-aos") || /\breveal\b|\bfade-?(?:in|up)\b|\banimate-on-scroll\b/i.test(typeof c.className === "string" ? c.className : "");
  };
  const hiddenAtLoad = (el: HTMLElement): boolean => {
    if ([el, ...(Array.from(el.children) as HTMLElement[]).slice(0, 6)].some(waiting)) return true;
    // A reveal is as often on the cards two levels down as on the section.
    // Only blocks that carry text and take up room count, and nothing fixed,
    // so a closed menu or a modal waiting at opacity 0 is not a reveal.
    const blocks = (Array.from(el.querySelectorAll("div, article, li, figure, p, h2, h3")) as HTMLElement[])
      .slice(0, 200)
      .filter((d) => {
        const b = box(d);
        return b.width > 100 && b.height > 40 && (d.textContent ?? "").trim().length > 12 && style(d).position !== "fixed";
      })
      .slice(0, 12);
    return blocks.filter(waiting).length >= Math.min(2, blocks.length) && blocks.some(waiting);
  };

  const cardsIn = (section: HTMLElement): { cards: number; iconCards: number } => {
    let best = { cards: 0, iconCards: 0 };
    const containers = [section, ...(Array.from(section.querySelectorAll("div, ul, ol")) as HTMLElement[])].slice(0, 300);
    for (const c of containers) {
      const kids = (Array.from(c.children) as HTMLElement[]).filter(shown);
      if (kids.length < 3) continue;
      const boxes = kids.map(box);
      const row = boxes.filter((b) => Math.abs(b.top - boxes[0].top) < 12);
      if (row.length < 3) continue;
      const w = row.map((b) => b.width);
      if (Math.max(...w) > Math.min(...w) * 1.35 || Math.max(...w) > vw * 0.45) continue;
      const withText = kids.filter((k) => (k.textContent ?? "").trim().length > 12);
      if (withText.length < 3) continue;
      const iconCards = withText.filter((k) => {
        const first = k.querySelector("svg, img");
        if (!first) return false;
        const fb = box(first);
        const kb = box(k);
        return fb.width <= 72 && fb.height <= 72 && fb.top - kb.top < 120;
      }).length;
      if (withText.length > best.cards) best = { cards: withText.length, iconCards };
    }
    return best;
  };

  // Version 2: what a section is for, and how it is laid out.
  const backgroundOf = (el: Element): string => {
    for (let n: Element | null = el; n && n !== document.documentElement; n = n.parentElement) {
      const c = style(n).backgroundColor;
      if (painted(c)) return c;
    }
    return ground;
  };
  const geometryOf = (el: HTMLElement, b: { top: number; left: number; width: number; height: number }): NonNullable<Snapshot["sections"][number]["geometry"]> => {
    const leaves = (Array.from(el.querySelectorAll("*")) as HTMLElement[])
      .slice(0, 1500)
      .filter((n) => (ownText(n).length > 1 || /^(IMG|SVG|VIDEO|PICTURE|BUTTON|INPUT|TEXTAREA|SELECT)$/i.test(n.tagName)) && shown(n))
      .slice(0, 400);
    const centreX = b.left + b.width / 2;
    let left = 0;
    let right = 0;
    let covered = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    let textBlocks = 0;
    let centred = 0;
    for (const n of leaves) {
      const r = box(n);
      const area = r.width * r.height;
      covered += area;
      minX = Math.min(minX, r.left);
      maxX = Math.max(maxX, r.left + r.width);
      const split = Math.max(0, Math.min(r.width, centreX - r.left));
      left += split * r.height;
      right += (r.width - split) * r.height;
      if (ownText(n).length > 1) {
        textBlocks += 1;
        const mid = r.left + r.width / 2;
        if (style(n).textAlign === "center" || (Math.abs(mid - centreX) < vw * 0.03 && r.width < b.width * 0.8)) centred += 1;
      }
    }
    const round = (v: number): number => Math.round(v * 1000) / 1000;
    return {
      centredShare: textBlocks ? round(centred / textBlocks) : 0,
      mirrorSymmetry: left + right > 0 ? round(1 - Math.abs(left - right) / (left + right)) : 1,
      whitespaceRatio: round(Math.max(0, 1 - Math.min(1, covered / Math.max(1, b.width * b.height)))),
      contentWidthRatio: leaves.length ? round(Math.min(1, (maxX - minX) / vw)) : 0,
      background: backgroundOf(el),
      controls: (Array.from(el.querySelectorAll("a, button, input")) as HTMLElement[]).slice(0, 200).filter(isControl).length,
    };
  };
  const CURRENCY = /[£$€]\s?\d/;
  const roleOf = (
    el: HTMLElement,
    kind: Snapshot["sections"][number]["kind"],
    geo: NonNullable<Snapshot["sections"][number]["geometry"]>,
    b: { height: number },
    cards: number,
    iconCards: number,
    last: boolean,
  ): NonNullable<Snapshot["sections"][number]["role"]> => {
    if (kind === "marquee" || kind === "hero") return kind;
    const heading = (el.querySelector("h1, h2, h3")?.textContent ?? "").toLowerCase();
    const leaves = (Array.from(el.querySelectorAll("*")) as HTMLElement[]).slice(0, 1500);
    const own = leaves.map(ownText);
    const questions = own.filter((t) => /\?$/.test(t) && t.length > 8).length;
    if (el.querySelectorAll("details").length >= 3 || el.querySelectorAll("[aria-expanded]").length >= 3 || (/\bfaq|frequently asked|questions\b/.test(heading) && questions >= 3)) return "faq";
    const prices = own.filter((t) => CURRENCY.test(t) && t.length < 40).length;
    if (prices >= 2 && (cards >= 2 || /pric|plan|package/.test(heading))) return "pricing";
    const quotes = el.querySelectorAll("blockquote, q").length;
    if (quotes >= 2 || /testimonial|review|what (?:our )?(?:clients|customers|people) say/.test(heading)) return "testimonials";
    const steps = Math.max(0, ...Array.from(el.querySelectorAll("ol")).map((ol) => ol.children.length));
    const numbered = own.filter((t) => /^(?:step\s*)?0?[1-9][.:]?$/i.test(t)).length;
    if (steps >= 3 || numbered >= 3 || /how it works|our process|\bsteps?\b/.test(heading)) return "process";
    const form = el.querySelector("form");
    const fields = form ? form.querySelectorAll("input:not([type=hidden]):not([type=submit]), textarea, select").length : 0;
    if (fields >= 2 || /contact|get in touch/.test(heading)) return "contact";
    const portraits = (Array.from(el.querySelectorAll("img")) as HTMLElement[]).filter((i) => {
      const r = box(i);
      return r.width >= 80 && r.width <= 420 && Math.abs(r.width - r.height) < r.width * 0.25;
    }).length;
    if (portraits >= 3 && /team|people|meet|who we are/.test(heading)) return "team";
    if (kind === "stats" || kind === "logos") return kind;
    const words = (el.textContent ?? "").replace(/\s+/g, " ").trim().length;
    // A band is set apart from the page: its own ground, or a centred block.
    // A left-aligned section on the page ground with one button is ordinary text.
    const setApart = geo.background !== ground || geo.centredShare >= 0.6;
    if (setApart && heading && b.height <= vh * 0.9 && geo.controls >= 1 && geo.controls <= 2 && words < 400 && cards < 3) return last ? "footer-cta" : "cta-band";
    if (cards >= 3 && iconCards >= 2) return "features";
    return kind;
  };

  /** Badges, avatars and carousels: the small parts that make a component a stock one. */
  const partsOf = (el: HTMLElement): { badges: string[]; avatars: number; carousel: boolean } => {
    const inside = (Array.from(el.querySelectorAll("*")) as HTMLElement[]).slice(0, 1500).filter(shown);
    const badges: string[] = [];
    for (const n of inside) {
      const t = ownText(n);
      if (t.length < 2 || t.length > 24 || badges.length >= 5) continue;
      const cs = style(n);
      const r = box(n);
      const radius = px(cs.borderTopLeftRadius);
      const drawn = painted(cs.backgroundColor) || px(cs.borderTopWidth) >= 1;
      if (drawn && r.height <= 40 && r.width <= 240 && radius >= r.height / 3 && !isControl(n)) badges.push(t);
    }
    const avatars = inside.filter((n) => {
      if (n.tagName !== "IMG") return false;
      const r = box(n);
      const rad = style(n).borderTopLeftRadius;
      const round = rad.endsWith("%") ? parseFloat(rad) >= 40 : px(rad) >= r.width * 0.4;
      return r.width <= 96 && r.width >= 16 && Math.abs(r.width - r.height) <= r.width * 0.15 && round;
    }).length;
    const carousel = inside.some((n) => {
      const cs = style(n);
      if (n.getAttribute("aria-roledescription") === "carousel" || (cs.scrollSnapType && cs.scrollSnapType !== "none")) return true;
      if (/^(auto|scroll|hidden)$/.test(cs.overflowX) && n.children.length >= 3 && n.scrollWidth > n.clientWidth * 1.2) return true;
      return /^(BUTTON|A)$/.test(n.tagName) && /\b(prev|previous|next)\b/i.test(n.getAttribute("aria-label") ?? "");
    });
    return { badges, avatars, carousel };
  };

  const kept = blocks.slice(0, 40);
  const sections: Snapshot["sections"] = kept.map((el, index) => {
    const b = box(el);
    const heading = el.querySelector("h1, h2, h3");
    const label = ((heading?.textContent ?? el.textContent ?? "").replace(/\s+/g, " ").trim()).slice(0, 60);
    const images = Array.from(el.querySelectorAll("img, svg")).filter((i) => shown(i) && box(i).height <= 90);
    const textChars = (el.textContent ?? "").replace(/\s+/g, "").length;
    const numbers = Array.from(el.querySelectorAll("*")).filter((n) => /^[£$€]?\d[\d,.]*\s?(?:[%+kKmM★]|\/5|\+)?$/.test(ownText(n)) && px(style(n).fontSize) >= 24).length;
    const { cards, iconCards } = cardsIn(el);
    let kind: Snapshot["sections"][number]["kind"] = "text";
    if (marqueeTargets.some((t) => el.contains(t))) kind = "marquee";
    else if ((h1 && el.contains(h1)) || (index === 0 && b.top < vh)) kind = "hero";
    else if (images.length >= 4 && textChars < 300) kind = "logos";
    else if (numbers >= 3 && textChars < 600) kind = "stats";
    else if (cards >= 3) kind = "cards";
    const geometry = geometryOf(el, b);
    const parts = partsOf(el);
    return {
      top: Math.round(b.top),
      height: Math.round(b.height),
      kind,
      label,
      cards,
      iconCards,
      hiddenAtLoad: b.top > vh && hiddenAtLoad(el),
      role: roleOf(el, kind, geometry, b, cards, iconCards, index === kept.length - 1),
      geometry,
      ...parts,
      figures: numbers,
    };
  });
  if (header && sections.length === 0) {
    const b = box(header);
    sections.push({ top: Math.round(b.top), height: Math.round(b.height), kind: "hero", label: "", cards: 0, iconCards: 0, hiddenAtLoad: false });
  }

  // ------------------------------------------------------------------ effects
  const colourStops = (image: string): string[] => image.match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}\b/gi) ?? [];
  const effects: Snapshot["effects"] = {
    glass: 0,
    gradientText: 0,
    gradients: [],
    glows: 0,
    gridBackgrounds: 0,
    marquees: new Set(marqueeTargets).size,
    hairlineShadowCards: 0,
    eyebrowChip: false,
  };
  for (const el of all) {
    if (!shown(el)) continue;
    const cs = style(el) as CSSStyleDeclaration & { webkitBackdropFilter?: string; webkitBackgroundClip?: string };
    const b = box(el);
    const area = b.width * b.height;
    const backdrop = cs.backdropFilter || cs.webkitBackdropFilter || "";
    // A blurred sticky nav bar is ordinary chrome, and every estate site has
    // one (measured 2026-09-23). The tell is a glass card holding content.
    if (
      /blur\(\s*[1-9]/.test(backdrop) &&
      alphaOf(cs.backgroundColor) < 0.95 &&
      b.width >= 200 &&
      b.height >= 120 &&
      cs.position !== "fixed" &&
      cs.position !== "sticky" &&
      !el.closest("header, nav, [role=dialog], dialog")
    ) {
      effects.glass += 1;
    }
    const image = cs.backgroundImage || "";
    const clip = cs.backgroundClip || cs.webkitBackgroundClip || "";
    if (clip === "text" && /gradient/.test(image)) effects.gradientText += 1;
    if (/gradient/.test(image)) {
      const size = cs.backgroundSize || "";
      const small = /(?:^|\s)(?:[1-9]|[1-5]\d|6[0-4])px/.test(size);
      const lines = (image.match(/linear-gradient/g) ?? []).length;
      if ((small && (lines >= 2 || /radial-gradient/.test(image))) || /repeating-linear-gradient/.test(image)) {
        effects.gridBackgrounds += 1;
      } else if (area >= vw * vh * 0.05) {
        effects.gradients.push({ stops: colourStops(image), area: Math.round(area), radial: /radial-gradient/.test(image) });
      }
    }
    const blur = (cs.filter || "").match(/blur\(\s*([\d.]+)px/);
    if (((blur && parseFloat(blur[1]) >= 40) || (/radial-gradient/.test(image) && !/(?:^|\s)\d{1,2}px/.test(cs.backgroundSize || ""))) && area >= 40000 && (el.textContent ?? "").trim().length === 0) {
      effects.glows += 1;
    }
    const shadow = cs.boxShadow || "";
    const shadowBlur = shadow.match(/(?:-?[\d.]+px\s+){2}([\d.]+)px/);
    if (shadowBlur && parseFloat(shadowBlur[1]) >= 24 && px(cs.borderTopWidth) >= 1 && alphaOf(cs.borderTopColor) <= 0.2 && area >= 20000) {
      effects.hairlineShadowCards += 1;
    }
  }
  if (h1) {
    let prev = h1.previousElementSibling as HTMLElement | null;
    if (!prev && h1.parentElement) prev = h1.parentElement.previousElementSibling as HTMLElement | null;
    if (prev && shown(prev)) {
      const cs = style(prev);
      const b = box(prev);
      const pill = b.height <= 44 && px(cs.borderTopLeftRadius) >= b.height / 2 - 1;
      const drawn = painted(cs.backgroundColor) || px(cs.borderTopWidth) >= 1;
      const chip = pill && drawn ? prev : (Array.from(prev.querySelectorAll("*")) as HTMLElement[]).find((c) => {
        const ccs = style(c);
        const cb = box(c);
        return cb.height <= 44 && px(ccs.borderTopLeftRadius) >= cb.height / 2 - 1 && (painted(ccs.backgroundColor) || px(ccs.borderTopWidth) >= 1);
      });
      effects.eyebrowChip = Boolean(chip && (chip.textContent ?? "").trim().length > 0 && (chip.textContent ?? "").trim().length <= 48);
    }
  }

  // ------------------------------------------------------------------ metrics
  const onScale = spacing.filter((v) => v % 4 === 0).length;
  let bodyLineLengthCh: number | null = null;
  let bodyFontSizePx: number | null = null;
  const para = (Array.from(document.querySelectorAll("p")) as HTMLElement[]).find((p) => shown(p) && (p.innerText || "").trim().split(/\s+/).length > 20);
  if (para) {
    const cs = style(para);
    bodyFontSizePx = Math.round(px(cs.fontSize));
    const probe = document.createElement("span");
    probe.style.cssText = `font:${cs.font};visibility:hidden;position:absolute;white-space:pre`;
    probe.textContent = "abcdefghijklmnopqrstuvwxyz";
    document.body.appendChild(probe);
    const avg = probe.getBoundingClientRect().width / 26;
    probe.remove();
    const width = para.getBoundingClientRect().width - px(cs.paddingLeft) - px(cs.paddingRight);
    if (avg > 0 && width > 0) bodyLineLengthCh = Math.round(width / avg);
  }

  // Phase M: every picture on the page, as the visitor gets it.
  const unwrap = (raw: string): string => {
    if (raw.startsWith("data:")) return raw.slice(0, 64);
    try {
      const u = new URL(raw, location.href);
      // An image optimiser hides the original behind its own URL.
      const inner = /\/_(?:next|vercel)\/image$/.test(u.pathname) ? u.searchParams.get("url") : null;
      if (inner) return new URL(inner, location.href).href;
      const cf = u.pathname.match(/^\/cdn-cgi\/image\/[^/]+\/(.+)$/);
      if (cf) return /^https?:\/\//.test(cf[1]) ? cf[1] : new URL(`/${cf[1]}`, location.href).href;
      return u.href;
    } catch {
      return raw.slice(0, 200);
    }
  };
  const roundBox = (el: Element, w: number): boolean => {
    const rad = style(el).borderTopLeftRadius;
    return rad.endsWith("%") ? parseFloat(rad) >= 40 : px(rad) >= w * 0.4;
  };
  const sectionOf = (el: Element): number | null => {
    const i = kept.findIndex((k) => k.contains(el));
    return i === -1 ? null : i;
  };
  const roleOfImage = (el: HTMLElement, src: string, w: number, h: number, alt: string | null): NonNullable<Snapshot["images"]>[number]["role"] => {
    const vector = /\.svg(?:[?#]|$)/i.test(src) || src.startsWith("data:image/svg");
    const square = Math.abs(w - h) <= w * 0.15;
    if (w >= 16 && w <= 96 && square && (roundBox(el, w) || (el.parentElement !== null && roundBox(el.parentElement, w)))) return "avatar";
    const section = sectionOf(el);
    const hint = `${alt ?? ""} ${src} ${typeof el.className === "string" ? el.className : ""}`;
    if (/\blogo\b/i.test(hint) || (section !== null && sections[section]?.kind === "logos") || (el.closest("header, footer, nav") && h <= 120)) return "logo";
    if (Math.max(w, h) <= (vector ? 120 : 72)) return "icon";
    if (vector) return "illustration";
    return w >= 160 && h >= 120 ? "photo" : "icon";
  };
  const images: NonNullable<Snapshot["images"]> = [];
  const seenImage = new Set<string>();
  const addImage = (el: HTMLElement, raw: string, alt: string | null, decorative: boolean, background: boolean) => {
    const b = box(el);
    if (!raw || b.width < 8 || b.height < 8) return;
    const src = unwrap(raw);
    const key = `${src} ${Math.round(b.top)} ${Math.round(b.left)}`;
    if (seenImage.has(key)) return;
    seenImage.add(key);
    let host: string | null = null;
    try {
      host = src.startsWith("data:") ? null : new URL(src).hostname;
    } catch {
      host = null;
    }
    images.push({
      src,
      host,
      width: Math.round(b.width),
      height: Math.round(b.height),
      top: Math.round(b.top),
      role: roleOfImage(el, src, b.width, b.height, alt),
      alt,
      decorative,
      section: sectionOf(el),
      background,
    });
  };
  for (const img of Array.from(document.querySelectorAll("img")).slice(0, 400) as HTMLImageElement[]) {
    if (!shown(img)) continue;
    const alt = img.getAttribute("alt");
    const decorative = alt === "" || img.getAttribute("aria-hidden") === "true" || /^(?:presentation|none)$/.test(img.getAttribute("role") ?? "");
    addImage(img, img.currentSrc || img.getAttribute("src") || "", alt, decorative, false);
  }
  for (const el of all) {
    const bgImage = style(el).backgroundImage || "";
    if (!bgImage.includes("url(")) continue;
    const b = box(el);
    if (b.width < 160 || b.height < 120 || !shown(el)) continue;
    const m = bgImage.match(/url\(\s*["']?([^"')]+)["']?\s*\)/);
    if (m) addImage(el, m[1], null, true, true);
  }
  images.sort((a, b) => b.width * b.height - a.width * a.height);

  const toList = (m: Map<string, { area: number; chars: number }>) =>
    Array.from(m, ([value, v]) => ({ value, area: Math.round(v.area), chars: v.chars })).sort((a, b) => b.area - a.area || b.chars - a.chars);
  const nums = (s: Set<number>) => Array.from(s).sort((a, b) => a - b);

  return {
    viewport: { width: vw, height: vh },
    pageHeight: document.documentElement.scrollHeight,
    ground,
    colours: { backgrounds: toList(bg).slice(0, 60), text: toList(text).sort((a, b) => b.chars - a.chars).slice(0, 40) },
    fonts: Array.from(fonts, ([family, f]) => ({ family, chars: f.chars, displayChars: f.displayChars, italicChars: f.italicChars, weights: nums(f.weights) })).sort((a, b) => b.chars - a.chars),
    headings,
    controls,
    sections,
    rhythmVariance: (() => {
      const hs = sections.map((x) => x.height);
      if (hs.length < 2) return null;
      const mean = hs.reduce((t, v) => t + v, 0) / hs.length;
      const sd = Math.sqrt(hs.reduce((t, v) => t + (v - mean) ** 2, 0) / hs.length);
      return mean > 0 ? Math.round((sd / mean) * 1000) / 1000 : null;
    })(),
    effects,
    images: images.slice(0, 60),
    motion: {
      hiddenSections: sections.filter((s) => s.hiddenAtLoad).length,
      sections: sections.length,
      animations: anims.length,
    },
    metrics: {
      fontSizes: nums(sizes),
      fontWeights: nums(weights),
      radii: Array.from(radii).sort(),
      shadows: Array.from(shadows).sort().slice(0, 20),
      spacingOnScalePct: spacing.length ? Math.round((onScale / spacing.length) * 1000) / 10 : null,
      bodyLineLengthCh,
      bodyFontSizePx,
    },
  };
}

/** True while something covers the viewport: the first frame of an intro cinematic. */
export function overlayInPage(): boolean {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  for (const el of Array.from(document.body.querySelectorAll("*")).slice(0, 4000)) {
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed" && cs.position !== "absolute") continue;
    if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.5) continue;
    const r = el.getBoundingClientRect();
    if (r.width < vw * 0.9 || r.height < vh * 0.9 || r.top > 10) continue;
    const bg = cs.backgroundColor;
    const alpha = /rgba?\(([^)]+)\)/.test(bg) ? parseFloat((bg.match(/[\d.]+/g) ?? [])[3] ?? "1") : 0;
    if (alpha > 0.8 || /gradient|url\(/.test(cs.backgroundImage)) return true;
  }
  return false;
}
