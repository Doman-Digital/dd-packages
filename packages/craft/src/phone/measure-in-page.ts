/// <reference lib="dom" />
/**
 * The in-page half of the phone-first gate.
 *
 * `measurePhoneInPage` runs inside the browser through `page.evaluate`, so it
 * must be self-contained: no imports, no references to anything outside its
 * own body. It measures the page as it stands at whatever viewport the
 * browser has; the caller sets 375 x 812 (`PHONE` in ./index.ts).
 *
 * The floors are STANDARD.md section 10 and portal standard rule 10: nothing
 * scrolls sideways, every target a thumb has to hit is at least 44 x 44 CSS
 * px, every text field is set at 16px or more so Safari on iOS does not zoom
 * on focus, no visible text is under 12px, and no page title is cut off.
 * Lifted from create-site's measure.mjs (DOM-774) so a site and a portal are
 * measured the same way.
 */

export interface PhoneFloors {
  targetPx: number;
  fieldFontPx: number;
  textPx: number;
  /**
   * The height of a text field, select or textarea (portal standard rule 5:
   * 48px inputs). Left out, 48. Below `targetPx` the field also fails the
   * target check; this floor is what catches 44 to 47px.
   */
  fieldHeightPx?: number;
}

/**
 * What a measure can find. The first five are the 375px floors (DOM-775); the
 * rest are the every-viewport and phone-optimisation checks (DOM-787).
 */
export type PhoneCheck =
  | "scroll"
  | "target"
  | "field"
  | "text"
  | "title"
  | "overlap"
  | "action"
  | "layers"
  | "landscape"
  | "image"
  | "input"
  | "autocomplete"
  | "tel"
  | "linelength";

export interface RawPhoneFinding {
  check: PhoneCheck;
  /** `<tag> "text"`: what a person looks for on the page. */
  element: string;
  detail: string;
}

/**
 * `floors.only` narrows the measure to some checks, for the viewports where
 * only some apply (text at every width, targets and fields at phone widths).
 * Left out, all five run, as they always did.
 */
export function measurePhoneInPage(floors: PhoneFloors & { only?: PhoneCheck[] }): RawPhoneFinding[] {
  const out: RawPhoneFinding[] = [];
  // A literal, not an import: this function is serialised into the page. PHONE_FLOORS carries the same 48.
  const fieldHeightPx = floors.fieldHeightPx ?? 48;
  const only = floors.only;
  const on = (c: PhoneCheck): boolean => !only || only.includes(c);
  // The layout viewport. Under mobile emulation innerWidth grows with the page
  // (the phone zooms out to fit it), so it can never show sideways scroll.
  const vw = document.documentElement.clientWidth;
  const shown = (e: Element): boolean => {
    const s = getComputedStyle(e);
    return s.display !== "none" && s.visibility !== "hidden" && e.getClientRects().length > 0;
  };
  // Visually hidden, or parked off the page until it is needed (a skip link before focus, a closed drawer): not on screen, so not measured.
  const offPage = (e: Element): boolean => {
    const r = e.getBoundingClientRect();
    return r.right <= 0 || r.bottom + window.scrollY <= 0 || r.left >= vw;
  };
  const quiet = (e: Element): boolean => !!e.closest("[aria-hidden='true'], .sr-only, .visually-hidden, [hidden]") || offPage(e);
  const describe = (e: Element): string => {
    const text = (e.textContent ?? "").replace(/\s+/g, " ").trim() || e.getAttribute("aria-label") || e.getAttribute("name") || e.getAttribute("placeholder") || "";
    return `<${e.tagName.toLowerCase()}>${text ? ` "${text.slice(0, 40)}"` : ""}`;
  };

  // No width=device-width viewport meta: the phone lays the page out at 980px and shrinks it.
  if (!on("scroll")) {
    // The sideways-scroll check was not asked for.
  } else if (vw > window.screen.width + 1) {
    out.push({ check: "scroll", element: "<meta name=viewport>", detail: `the page lays out at ${vw}px on a ${window.screen.width}px phone: no width=device-width viewport meta` });
  }
  // Sideways scroll: the page is wider than the phone. Name what pokes out, so the fix has a place to start.
  else if (document.documentElement.scrollWidth > vw + 1) {
    const wide = Array.from(document.body.querySelectorAll("*"))
      .filter((e) => shown(e) && e.getBoundingClientRect().right > vw + 1)
      // The outermost offenders only: a wide table, not each of its cells.
      .filter((e, _, all) => !all.some((o) => o !== e && o.contains(e)))
      .slice(0, 3)
      .map(describe);
    out.push({ check: "scroll", element: "<html>", detail: `the page is ${document.documentElement.scrollWidth}px wide at ${vw}px${wide.length ? `; widest: ${wide.join(", ")}` : ""}` });
  }

  // Targets. A link inside a sentence is sized by its line (WCAG 2.5.5's inline exception); a field's label is a hit target too.
  const inline = (e: Element): boolean => {
    if (e.tagName !== "A" || getComputedStyle(e).display !== "inline") return false;
    const block = e.parentElement?.closest("p, li, dd, td, th, blockquote, figcaption, address");
    return !!block && (block.textContent ?? "").trim().length > (e.textContent ?? "").trim().length;
  };
  const targets = (!on("target") ? [] : Array.from(document.querySelectorAll("a[href], button, input:not([type='hidden']), select, textarea, [role='button'], [role='tab'], [role='menuitem'], summary"))).filter(shown);
  for (const e of targets) {
    const r = e.getBoundingClientRect();
    if (quiet(e) || inline(e) || r.width <= 1 || r.height <= 1) continue;
    const labels = "labels" in e && (e as HTMLInputElement).labels ? Array.from((e as HTMLInputElement).labels!).filter(shown) : [];
    const boxes = [r, ...labels.map((l) => l.getBoundingClientRect())];
    const w = Math.round(Math.max(...boxes.map((b) => b.width)));
    const h = Math.round(Math.max(...boxes.map((b) => b.height)));
    if (w < floors.targetPx || h < floors.targetPx) out.push({ check: "target", element: describe(e), detail: `${w}x${h}px, under ${floors.targetPx}x${floors.targetPx}` });
  }

  // Fields under 16px (Safari on iOS zooms the page on focus) or under the field height floor.
  const NOT_TEXT = new Set(["checkbox", "radio", "range", "color", "file", "submit", "reset", "button", "image"]);
  for (const e of on("field") ? Array.from(document.querySelectorAll("input:not([type='hidden']), select, textarea")) : []) {
    if (!shown(e) || quiet(e) || (e.tagName === "INPUT" && NOT_TEXT.has((e as HTMLInputElement).type))) continue;
    const px = parseFloat(getComputedStyle(e).fontSize);
    if (px < floors.fieldFontPx) out.push({ check: "field", element: describe(e), detail: `set at ${px}px, under ${floors.fieldFontPx}px, so Safari on iOS zooms on focus` });
    const box = e.getBoundingClientRect();
    const height = Math.round(box.height);
    if (box.width > 1 && height > 1 && height < fieldHeightPx) out.push({ check: "field", element: describe(e), detail: `${height}px tall, under ${fieldHeightPx}px (use min-h-12)` });
  }

  // Text an element shows itself, not text it inherits from a child.
  for (const e of on("text") ? Array.from(document.body.querySelectorAll("*")) : []) {
    if (!shown(e) || quiet(e) || ["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(e.tagName)) continue;
    const own = Array.from(e.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent ?? "").join(" ").replace(/\s+/g, " ").trim();
    if (!own) continue;
    const px = parseFloat(getComputedStyle(e).fontSize);
    if (px < floors.textPx) out.push({ check: "text", element: `<${e.tagName.toLowerCase()}> "${own.slice(0, 40)}"`, detail: `${px}px, under ${floors.textPx}px` });
  }

  // A page title cut off: wider than its box (clipped or ellipsed), or clamped to fewer lines than it needs.
  for (const e of on("title") ? Array.from(document.querySelectorAll("h1")) : []) {
    if (!shown(e) || quiet(e)) continue;
    const s = getComputedStyle(e);
    const clipsX = e.scrollWidth > e.clientWidth + 1 && s.overflowX !== "visible";
    const clipsY = e.scrollHeight > e.clientHeight + 1 && s.overflowY !== "visible";
    if (clipsX || clipsY) out.push({ check: "title", element: describe(e), detail: "the page title is cut off" });
  }
  return out;
}
