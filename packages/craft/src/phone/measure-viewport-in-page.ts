/// <reference lib="dom" />
/**
 * The in-page half of the every-viewport measure (DOM-787).
 *
 * `measureViewportInPage` runs inside the browser through `page.evaluate`, so
 * like `measurePhoneInPage` it must be self-contained: no imports, nothing
 * from outside its own body. The caller has set the viewport, waited for the
 * page to settle and scrolled to the top; the function judges the page as it
 * stands, for whichever groups of checks it is asked for:
 *
 * - `sweep`: at any width, the page does not scroll sideways, no visible text
 *   sits on other visible text, and no page title is cut off.
 * - `optimise`: on the short phone (375 x 667), the main action is on the
 *   first screen or pinned, fixed and sticky layers leave the screen to the
 *   page, images are sized for the phone, fields use the right keyboard and
 *   carry autocomplete, and phone numbers in the text dial.
 * - `landscape`: on a phone held sideways, the header and fixed layers leave
 *   at least half the height.
 * - `wide`: at 1440 and above, body text keeps a readable line length and no
 *   image is stretched past its file.
 */

import type { RawPhoneFinding } from "./measure-in-page.js";
import type { Thresholds } from "./viewports.js";

export type InPageGroup = "sweep" | "optimise" | "landscape" | "wide";

export interface ViewportArg {
  groups: InPageGroup[];
  thresholds: Thresholds;
  /** CSS selector for the page's main action. Absent: the action check is not run. */
  mainAction?: string;
  /** Also fail a page with no width=device-width viewport meta, which a phone lays out at 980px. Meaningful at phone widths. */
  metaViewport?: boolean;
}

export function measureViewportInPage(arg: ViewportArg): RawPhoneFinding[] {
  const { groups, thresholds: t } = arg;
  const out: RawPhoneFinding[] = [];
  const vw = document.documentElement.clientWidth;
  // The layout viewport, as clientWidth is: under mobile emulation innerHeight grows with a page that is too wide.
  const vh = document.documentElement.clientHeight;
  const pct = (n: number): string => `${Math.round(n * 100)}%`;
  const px = (n: number): string => `${Math.round(n)}px`;

  // Rendered: not display:none or hidden, and not skipped content (the inside of a closed <details>, content-visibility: hidden), whose boxes are stale.
  const shown = (e: Element): boolean => {
    const s = getComputedStyle(e);
    if (s.display === "none" || s.visibility === "hidden" || e.getClientRects().length === 0) return false;
    return typeof e.checkVisibility === "function" ? e.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true }) : true;
  };
  const hiddenByMarkup = (e: Element): boolean => !!e.closest("[aria-hidden='true'], .sr-only, .visually-hidden, [hidden]");
  const faded = (e: Element): boolean => {
    for (let n: Element | null = e; n && n !== document.documentElement; n = n.parentElement) if (getComputedStyle(n).opacity === "0") return true;
    return false;
  };
  const describe = (e: Element): string => {
    const text = (e.textContent ?? "").replace(/\s+/g, " ").trim() || e.getAttribute("aria-label") || e.getAttribute("name") || e.getAttribute("placeholder") || "";
    return `<${e.tagName.toLowerCase()}>${text ? ` "${text.slice(0, 40)}"` : ""}`;
  };
  const add = (check: RawPhoneFinding["check"], element: string, detail: string): void => {
    out.push({ check, element, detail });
  };
  // Where an element is cut off: every ancestor that clips its overflow, as the box it clips to.
  const clipBoxes = new Map<Element, DOMRect[]>();
  const clipsOf = (e: Element): DOMRect[] => {
    const had = clipBoxes.get(e);
    if (had) return had;
    const boxes: DOMRect[] = [];
    for (let n = e.parentElement; n && n !== document.documentElement && n !== document.body; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (/hidden|clip|auto|scroll/.test(s.overflowX + s.overflowY)) boxes.push(n.getBoundingClientRect());
    }
    clipBoxes.set(e, boxes);
    return boxes;
  };
  // Only a box that hides its overflow cuts text off: a scroller shows the rest.
  const hardClipsOf = (e: Element): DOMRect[] => {
    const boxes: DOMRect[] = [];
    for (let n = e.parentElement; n && n !== document.documentElement && n !== document.body; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (/hidden|clip/.test(s.overflowX) || /hidden|clip/.test(s.overflowY)) boxes.push(n.getBoundingClientRect());
    }
    return boxes;
  };
  const inLayers = new Map<Element, boolean>();
  const inLayer = (e: Element): boolean => {
    const had = inLayers.get(e);
    if (had !== undefined) return had;
    const p = getComputedStyle(e).position;
    const v = p === "fixed" || p === "sticky" || (!!e.parentElement && inLayer(e.parentElement));
    inLayers.set(e, v);
    return v;
  };

  // Every run of visible text as boxes: one per line of each text node, cut to what its clipping ancestors show.
  interface Box {
    l: number;
    t: number;
    r: number;
    b: number;
    owner: Element;
    node: Node;
  }
  const textBoxes = (): Box[] => {
    const boxes: Box[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    const skip = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "OPTION", "TEXTAREA", "TITLE"]);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const owner = n.parentElement;
      if (!owner || skip.has(owner.tagName) || !(n.textContent ?? "").trim() || !shown(owner) || hiddenByMarkup(owner) || faded(owner)) continue;
      range.selectNodeContents(n);
      for (const rect of Array.from(range.getClientRects())) {
        let { left: l, top: tp, right: r, bottom: b } = rect;
        for (const c of clipsOf(owner)) {
          l = Math.max(l, c.left);
          tp = Math.max(tp, c.top);
          r = Math.min(r, c.right);
          b = Math.min(b, c.bottom);
        }
        if (r - l >= 1 && b - tp >= 1) boxes.push({ l, t: tp, r, b, owner, node: n });
      }
    }
    return boxes;
  };
  const nameOf = (b: Box): string => `<${b.owner.tagName.toLowerCase()}> "${(b.node.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40)}"`;

  // The share of the screen the fixed and sticky layers cover, with what covers it.
  const layerCover = (): { share: number; names: string[] } => {
    const painted = (e: Element): boolean => {
      const s = getComputedStyle(e);
      const bg = s.backgroundColor;
      const clear = bg === "rgba(0, 0, 0, 0)" || bg === "transparent";
      return !clear || s.backgroundImage !== "none" || parseFloat(s.borderTopWidth) > 0 || parseFloat(s.borderBottomWidth) > 0 || s.boxShadow !== "none" || /^(IMG|SVG|VIDEO|CANVAS|IFRAME|BUTTON|INPUT)$/i.test(e.tagName) || Array.from(e.childNodes).some((c) => c.nodeType === 3 && (c.textContent ?? "").trim());
    };
    const paintedBoxes = (e: Element, depth: number): { e: Element; r: DOMRect }[] => {
      if (!shown(e) || getComputedStyle(e).pointerEvents === "none" || faded(e)) return [];
      if (painted(e)) return [{ e, r: e.getBoundingClientRect() }];
      return depth > 6 ? [] : Array.from(e.children).flatMap((c) => paintedBoxes(c, depth + 1));
    };
    const read = (): { share: number; names: string[] } => {
      const boxes = Array.from(document.body.querySelectorAll("*"))
        .filter((e) => ["fixed", "sticky"].includes(getComputedStyle(e).position))
        .flatMap((e) => paintedBoxes(e, 0))
        .map(({ e, r }) => ({ e, l: Math.max(0, r.left), t: Math.max(0, r.top), r: Math.min(vw, r.right), b: Math.min(vh, r.bottom) }))
        .filter((b) => b.r - b.l > 1 && b.b - b.t > 1);
      // The union of the boxes: cut the plane at every edge and add the cells any box fills.
      const xs = [...new Set(boxes.flatMap((b) => [b.l, b.r]))].sort((a, b) => a - b);
      const ys = [...new Set(boxes.flatMap((b) => [b.t, b.b]))].sort((a, b) => a - b);
      let area = 0;
      for (let i = 0; i < xs.length - 1; i++) {
        for (let j = 0; j < ys.length - 1; j++) {
          if (boxes.some((b) => b.l <= xs[i] && b.r >= xs[i + 1] && b.t <= ys[j] && b.b >= ys[j + 1])) area += (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j]);
        }
      }
      return { share: area / (vw * vh), names: [...new Set(boxes.map((b) => describe(b.e)))].slice(0, 4) };
    };
    // At the top, then scrolled: a sticky header only sticks once the page moves.
    const top = read();
    const home = window.scrollY;
    window.scrollTo({ top: Math.min(document.documentElement.scrollHeight - vh, Math.round(vh * 1.5)), behavior: "instant" });
    const moved = read();
    window.scrollTo({ top: home, behavior: "instant" });
    return moved.share > top.share ? moved : top;
  };

  const imageName = (img: HTMLImageElement): string => {
    const alt = (img.getAttribute("alt") ?? "").trim();
    const file = (img.currentSrc || img.src).split("?")[0].split("/").pop() ?? "";
    return `<img> "${(alt || file).slice(0, 40)}"`;
  };
  // Images against their files. `kinds` picks the faults looked for.
  const images = (kinds: ("oversized" | "upscaled")[]): void => {
    for (const img of Array.from(document.images)) {
      const src = img.currentSrc || img.src;
      if (!img.complete || !img.naturalWidth || !src || /\.svg(\?|$)|^data:image\/svg/i.test(src) || !shown(img) || hiddenByMarkup(img) || faded(img)) continue;
      const shownPx = img.getBoundingClientRect().width;
      if (shownPx < t.minImagePx) continue;
      const ratio = img.naturalWidth / shownPx;
      if (kinds.includes("oversized") && ratio > t.oversizeRatio) {
        add("image", `${imageName(img)} oversized`, `the file is ${img.naturalWidth}px wide, shown at ${px(shownPx)} (${ratio.toFixed(1)}x; a 2x phone needs ${px(shownPx * 2)}). Serve a smaller one with srcset and sizes`);
      }
      if (kinds.includes("upscaled") && ratio < t.upscaleRatio) {
        add("image", `${imageName(img)} upscaled`, `the file is ${img.naturalWidth}px wide, stretched to ${px(shownPx)}. Serve one at least that wide`);
      }
    }
  };

  if (groups.includes("sweep")) {
    // Sideways scroll: the page is wider than the screen. Name what pokes out.
    if (arg.metaViewport && vw > window.screen.width + 1) {
      add("scroll", "<meta name=viewport>", `the page lays out at ${vw}px on a ${window.screen.width}px phone: no width=device-width viewport meta`);
    } else if (document.documentElement.scrollWidth > vw + 1) {
      const wide = Array.from(document.body.querySelectorAll("*"))
        .filter((e) => shown(e) && e.getBoundingClientRect().right > vw + 1)
        .filter((e, _, all) => !all.some((o) => o !== e && o.contains(e)))
        .slice(0, 3)
        .map(describe);
      add("scroll", "<html>", `the page is ${document.documentElement.scrollWidth}px wide at ${vw}px${wide.length ? `; widest: ${wide.join(", ")}` : ""}`);
    }

    // Text on text. Sorted by top edge, so each box meets only the ones that start above its bottom.
    const boxes = textBoxes().sort((a, b) => a.t - b.t);
    const seen = new Set<string>();
    for (let i = 0; i < boxes.length && seen.size < 15; i++) {
      const a = boxes[i];
      for (let j = i + 1; j < boxes.length && boxes[j].t < a.b; j++) {
        const b = boxes[j];
        if (a.node === b.node) continue;
        const w = Math.min(a.r, b.r) - Math.max(a.l, b.l);
        const h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
        if (w < 3 || h < t.overlapShare * Math.min(a.b - a.t, b.b - b.t)) continue;
        // On screen, ask what is painted there: text under an opaque bar, a menu or a dialog is covered, not overlapped.
        const x = Math.max(a.l, b.l) + w / 2;
        const y = Math.max(a.t, b.t) + h / 2;
        const onScreen = x >= 0 && x < vw && y >= 0 && y < vh;
        if (!onScreen && inLayer(a.owner) !== inLayer(b.owner)) continue;
        if (onScreen && getComputedStyle(a.owner).pointerEvents !== "none" && getComputedStyle(b.owner).pointerEvents !== "none") {
          const stack = document.elementsFromPoint(x, y);
          const at = (o: Element): number => stack.findIndex((e) => e === o || o.contains(e));
          const [ia, ib] = [at(a.owner), at(b.owner)];
          if (ia < 0 || ib < 0) continue;
          const lower = ia > ib ? a.owner : b.owner;
          const covers = (e: Element): boolean => {
            const s = getComputedStyle(e);
            const alpha = s.backgroundColor === "transparent" ? 0 : parseFloat(s.backgroundColor.match(/[,/]\s*([\d.]+)%?\)$/)?.[1] ?? "1");
            return !e.contains(lower) && (alpha >= 0.9 || s.backgroundImage !== "none");
          };
          if (stack.slice(0, Math.max(ia, ib)).some(covers)) continue;
        }
        const names = [nameOf(a), nameOf(b)].sort();
        const key = names.join(" / ");
        if (seen.has(key)) continue;
        seen.add(key);
        add("overlap", key, `visible text overlaps other text by ${px(w)} x ${px(h)}`);
      }
    }

    // A page title cut off: wider than its box (clipped or ellipsed), clamped to fewer lines than it needs, or cut by a box around it.
    for (const e of Array.from(document.querySelectorAll("h1, [role='heading'][aria-level='1']"))) {
      if (!shown(e) || hiddenByMarkup(e)) continue;
      const s = getComputedStyle(e);
      const clipsX = e.scrollWidth > e.clientWidth + 1 && s.overflowX !== "visible";
      const clipsY = e.scrollHeight > e.clientHeight + 1 && s.overflowY !== "visible";
      const range = document.createRange();
      range.selectNodeContents(e);
      const r = range.getBoundingClientRect();
      const cutByParent = r.width > 0 && hardClipsOf(e).some((c) => r.right > c.right + 1 || r.left < c.left - 1 || r.bottom > c.bottom + 1);
      if (clipsX || clipsY || cutByParent) add("title", describe(e), "the page title is cut off");
    }
  }

  if (groups.includes("optimise")) {
    if (arg.mainAction) {
      const matches = Array.from(document.querySelectorAll(arg.mainAction)).filter((e) => shown(e) && !hiddenByMarkup(e));
      if (matches.length === 0) {
        add("action", arg.mainAction, "no visible element matches the main action selector");
      } else {
        const pinned = (e: Element): boolean => ["fixed", "sticky"].includes(getComputedStyle(e).position) || (!!e.parentElement && e.parentElement !== document.body && pinned(e.parentElement));
        const fits = matches.some((e) => {
          const r = e.getBoundingClientRect();
          return pinned(e) || (r.top >= 0 && r.bottom <= vh + 1);
        });
        if (!fits) {
          const r = matches[0].getBoundingClientRect();
          add("action", describe(matches[0]), `the main action starts ${px(r.top)} down a ${px(vh)} screen: it is not on the first screen or pinned`);
        }
      }
    }

    const cover = layerCover();
    if (cover.share > t.maxLayerShare) add("layers", "fixed and sticky layers", `together cover ${pct(cover.share)} of a ${px(vh)} screen, over the ${pct(t.maxLayerShare)} allowed: ${cover.names.join(", ")}`);

    images(["oversized", "upscaled"]);

    // Fields: the keyboard that fits, and autocomplete where the phone can fill it in.
    const clean = (s: string): string => s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_\-.[\]]+/g, " ").toLowerCase();
    const PHONE = /\b(phone|tel|telephone|mobile)\b/;
    const EMAIL = /\be ?mail\b/;
    const NUMBER = /\b(otp|one time code|verification code|security code|quantity|qty|age|cvc|cvv|pin|card number|cc number|number of|amount)\b/;
    const PERSONAL = /\b(name|first name|last name|given|family|surname|email|e mail|phone|tel|telephone|mobile|address|street|city|town|postcode|post code|zip|country|county|company|organisation|organization|username|user name|password|card|birth|dob)\b/;
    const NOT_TEXT = new Set(["hidden", "checkbox", "radio", "range", "color", "file", "submit", "reset", "button", "image", "date", "time", "datetime-local", "month", "week"]);
    for (const e of Array.from(document.querySelectorAll("input, textarea"))) {
      const field = e as HTMLInputElement;
      if (!shown(e) || hiddenByMarkup(e) || NOT_TEXT.has(field.type) || field.type === "search" || e.closest("[role='search']")) continue;
      const label = Array.from(field.labels ?? []).map((l) => l.textContent ?? "").join(" ");
      const named = e.getAttribute("aria-label") ?? "";
      const signals = clean([e.getAttribute("name"), e.id, named, e.getAttribute("placeholder"), e.getAttribute("autocomplete"), label].filter(Boolean).join(" "));
      const inputmode = (e.getAttribute("inputmode") ?? "").toLowerCase();
      const type = e.tagName === "TEXTAREA" ? "textarea" : field.type;
      const kinds: ("phone" | "email" | "number")[] = [];
      if (PHONE.test(signals)) kinds.push("phone");
      if (EMAIL.test(signals)) kinds.push("email");
      if (NUMBER.test(signals)) kinds.push("number");
      const who = `<${e.tagName.toLowerCase()}> "${(label.replace(/\s+/g, " ").trim() || named || e.getAttribute("name") || e.id || e.getAttribute("placeholder") || type).slice(0, 40)}"`;
      if (e.tagName === "INPUT" && kinds.length === 1) {
        const [kind] = kinds;
        const good = kind === "phone" ? type === "tel" || inputmode === "tel" : kind === "email" ? type === "email" || inputmode === "email" : type === "number" || ["numeric", "decimal", "tel"].includes(inputmode);
        if (!good) {
          const use = kind === "phone" ? 'type="tel"' : kind === "email" ? 'type="email"' : 'inputmode="numeric" (or "decimal")';
          add("input", who, `looks like ${kind === "number" ? "a number" : kind === "email" ? "an email" : "a phone"} field but is type="${type}"${inputmode ? ` inputmode="${inputmode}"` : ""}, so the phone shows the wrong keyboard. Use ${use}`);
        }
      }
      const personal = e.tagName === "INPUT" && (["email", "tel", "password"].includes(type) || PERSONAL.test(signals));
      const auto = (e.getAttribute("autocomplete") ?? "").trim().toLowerCase();
      if (personal && (auto === "" || auto === "off")) {
        add("autocomplete", who, `${auto ? 'autocomplete="off" stops the phone filling it in' : "the autocomplete attribute is missing, so the phone cannot fill it in"}. Name what it holds, as in autocomplete="email"`);
      }
    }

    // Numbers a visitor reads and then types into the dialler: a link does it in one tap.
    const UK = /(?<![\w+])(?:\+44[\s-]?(?:\(0\))?|0)\d(?:[\s-]?\d){8,9}(?!\d)/g;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const dials = new Set<string>();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const owner = n.parentElement;
      if (!owner || ["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "TEXTAREA"].includes(owner.tagName) || !shown(owner) || hiddenByMarkup(owner) || owner.closest("a[href^='tel:' i]")) continue;
      for (const m of (n.textContent ?? "").matchAll(UK)) {
        const digits = m[0].replace(/\D/g, "");
        if (!(digits.length === 11 && digits.startsWith("0")) && !(digits.length === 12 && digits.startsWith("44")) && !(digits.length === 13 && digits.startsWith("440"))) continue;
        const shownAs = m[0].replace(/\s+/g, " ").trim();
        if (dials.has(shownAs)) continue;
        dials.add(shownAs);
        add("tel", `<${owner.tagName.toLowerCase()}> "${shownAs}"`, `a phone number that is not a tel: link. Wrap it in <a href="tel:${digits.startsWith("0") ? `+44${digits.slice(1)}` : `+${digits.replace(/^440/, "44")}`}">`);
      }
    }
  }

  if (groups.includes("landscape")) {
    const cover = layerCover();
    if (cover.share > t.landscapeMaxLayerShare) {
      add("landscape", "header and fixed layers", `together cover ${pct(cover.share)} of a ${px(vh)} landscape screen, over the ${pct(t.landscapeMaxLayerShare)} allowed: ${cover.names.join(", ")}`);
    }
  }

  if (groups.includes("wide")) {
    images(["upscaled"]);
    // Body text lines, measured as the longest rendered line over the width of a 0 in the element's own font (1ch).
    const paragraphs = Array.from(document.querySelectorAll("p, li:not(:has(p)), dd, blockquote:not(:has(p))"));
    for (const e of paragraphs) {
      // Body text: not chrome (navigation, the page's header and footer, a dialog or a pinned bar) and not code or tables.
      if (!shown(e) || hiddenByMarkup(e) || faded(e) || e.closest("nav, header, footer, aside, pre, table, [role='navigation'], [role='menu'], [role='banner'], [role='contentinfo'], [role='dialog'], [role='alertdialog']") || inLayer(e)) continue;
      const range = document.createRange();
      range.selectNodeContents(e);
      const lines = new Map<number, { l: number; r: number }>();
      for (const r of Array.from(range.getClientRects())) {
        if (r.width < 1 || r.height < 1) continue;
        const key = Math.round(r.top / 4);
        const had = lines.get(key);
        if (had) {
          had.l = Math.min(had.l, r.left);
          had.r = Math.max(had.r, r.right);
        } else lines.set(key, { l: r.left, r: r.right });
      }
      const longest = Math.max(0, ...Array.from(lines.values()).map((l) => l.r - l.l));
      if (longest < 1) continue;
      const probe = document.createElement("span");
      probe.style.cssText = "position:absolute;visibility:hidden;display:inline-block;width:1ch;height:1px;font:inherit;letter-spacing:normal";
      e.appendChild(probe);
      const ch = probe.getBoundingClientRect().width;
      probe.remove();
      if (ch <= 0) continue;
      const chars = longest / ch;
      if (chars > t.maxLineCh) add("linelength", describe(e), `lines run ${Math.round(chars)} characters at ${vw}px, over the ${t.maxLineCh} allowed. Cap the measure with max-width in ch`);
    }
  }
  return out;
}
