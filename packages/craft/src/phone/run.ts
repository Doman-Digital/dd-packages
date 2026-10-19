/**
 * The runner for the every-viewport measure (DOM-787): drives a page through
 * the ladder and the width sweep and hands each stop to the in-page checks.
 *
 * Two entries:
 *
 * - `measureViewports(page, options)` resizes the page it is given, in place.
 *   A portal's Playwright suite owns the sign-in and the fixture data, so it
 *   opens the route and calls this.
 * - `measureSite(browser, options)` opens each route itself, once in a phone
 *   context (touch, 2x, mobile viewport handling) for everything under 768 and
 *   once in a desktop context for the rest: what create-site's measure.mjs and
 *   `craft viewports` use for a page anyone can open.
 *
 * Neither imports Playwright: the caller drives the browser.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_MEASURED_DIR, PHONE, PHONE_FLOORS, routeFile } from "./constants.js";
import type { MeasuredRoute } from "./judge.js";
import { measurePhoneInPage, type PhoneFloors, type RawPhoneFinding } from "./measure-in-page.js";
import { measureViewportInPage, type InPageGroup } from "./measure-viewport-in-page.js";
import { DEFAULT_SWEEP, DEFAULT_THRESHOLDS, LADDER, mainActionFor, mergeViewportFindings, screenBudgetFor, SHORT_PHONE, sweepWidths, type MainAction, type ScreenBudgets, type Sweep, type Thresholds, type Viewport } from "./viewports.js";

export interface ViewportPage {
  evaluate<R, A>(fn: (arg: A) => R, arg: A): Promise<R>;
  setViewportSize(size: { width: number; height: number }): Promise<void>;
}

export interface MeasureViewportsOptions {
  /** The route as the baseline names it, without host or query: `/portal/invoices`. */
  route: string;
  /** The folder to write `<route>.json` into. Default `phone-first/measured`. `false` writes nothing. */
  out?: string | false;
  /**
   * Which half to run on this page. `all` (default) runs everything on the one
   * page; `phone` stops below 768 and adds the short phone and landscape;
   * `wide` runs 768 and up. A page in a desktop browser context has no business
   * judging a phone, and the other way round: `measureSite` runs each half in
   * the context it belongs to.
   */
  scope?: "all" | "phone" | "wide";
  /** Override house thresholds. */
  thresholds?: Partial<Thresholds>;
  /** Override the 12 / 16 / 44px floors and the 48px field height (`fieldHeightPx`). The defaults are the house standard; a site may set `textPx` higher. */
  floors?: Partial<PhoneFloors>;
  /** The main action's selector: one for all routes, or per route with `*` as the fallback. Absent: not checked. */
  mainAction?: MainAction;
  /**
   * A length budget per route, in phone screens to the footer (page height at
   * 375 x 667 over 667): `{ "/": 6.5, "/services/*": 6 }`. A route over its
   * budget fails the `screens` check. Without a budget the count is only
   * reported, in `ViewportsResult.screens`.
   */
  screens?: ScreenBudgets;
  /** The width sweep, or `false` to measure the ladder only. */
  sweep?: Partial<Sweep> | false;
  /** Replace the ladder. */
  ladder?: Viewport[];
  /** Called at each ladder viewport once the page has settled, for captures. */
  onViewport?: (page: ViewportPage, viewport: Viewport, route: string) => Promise<void>;
}

export interface ViewportsResult extends MeasuredRoute {
  viewports: string[];
  /** What each viewport found before the merge, in the order measured. */
  perViewport: { viewport: string; findings: RawPhoneFinding[] }[];
}

interface Stop {
  name: string;
  width: number;
  height: number;
  /** A ladder stop: settled fully, lazy images loaded, captured. A sweep stop only settles. */
  ladder: boolean;
  groups: InPageGroup[];
  /** Run the touch floors (targets, fields) here. */
  touch: boolean;
}

/** The stops in order: the phone first (ladder, short phone, landscape), then every other width, narrow to wide. */
export function plan(options: Pick<MeasureViewportsOptions, "scope" | "sweep" | "ladder">): Stop[] {
  const ladder = options.ladder ?? LADDER;
  const scope = options.scope ?? "all";
  const phoneSide = scope !== "wide";
  const wideSide = scope !== "phone";
  const stops: Stop[] = [];
  const widthsDone = new Set<number>();
  for (const v of ladder.filter((x) => x.phone && !x.landscape)) {
    if (!phoneSide) continue;
    stops.push({ name: v.name, width: v.width, height: v.height, ladder: true, groups: ["sweep"], touch: true });
    widthsDone.add(v.width);
  }
  if (phoneSide) {
    stops.push({ name: SHORT_PHONE.name, width: SHORT_PHONE.width, height: SHORT_PHONE.height, ladder: true, groups: ["optimise"], touch: false });
    for (const v of ladder.filter((x) => x.landscape)) stops.push({ name: v.name, width: v.width, height: v.height, ladder: true, groups: ["sweep", "landscape"], touch: true });
  }
  const rest: Stop[] = [];
  for (const v of ladder.filter((x) => !x.phone)) {
    if (!wideSide || widthsDone.has(v.width)) continue;
    rest.push({ name: v.name, width: v.width, height: v.height, ladder: true, groups: v.width >= 1440 ? ["sweep", "wide"] : ["sweep"], touch: false });
    widthsDone.add(v.width);
  }
  if (options.sweep !== false) {
    const sweep = { ...DEFAULT_SWEEP, ...(options.sweep ?? {}) };
    for (const w of sweepWidths(sweep)) {
      if (widthsDone.has(w) || (w < 768 ? !phoneSide : !wideSide)) continue;
      rest.push({ name: String(w), width: w, height: sweep.height, ladder: false, groups: ["sweep"], touch: false });
      widthsDone.add(w);
    }
  }
  return [...stops, ...rest.sort((a, b) => a.width - b.width)];
}

// Two frames and a beat, so layout, fonts and anything the resize triggers have landed.
const settle = async (page: ViewportPage, ms: number): Promise<void> => void (await page.evaluate((wait: number) => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, wait)))), ms));

// Walk the page so lazy images load, wait for them, and come back to the top.
async function loadEverything(page: ViewportPage): Promise<void> {
  await page.evaluate(async () => {
    const h = document.documentElement.scrollHeight;
    for (let y = 0; y < h; y += Math.max(300, window.innerHeight - 100)) {
      window.scrollTo({ top: y, behavior: "instant" });
      await new Promise((r) => setTimeout(r, 40));
    }
    await Promise.all(Array.from(document.images).map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = () => r(null); setTimeout(r, 3000); }))));
    await document.fonts?.ready;
    window.scrollTo({ top: 0, behavior: "instant" });
  }, undefined);
}

interface Collected {
  perViewport: { viewport: string; findings: RawPhoneFinding[] }[];
  tested: string[];
  /** Phone screens to the footer, from the short phone. */
  screens?: number;
}

async function collect(page: ViewportPage, options: MeasureViewportsOptions): Promise<Collected> {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...(options.thresholds ?? {}) };
  const floors = { ...PHONE_FLOORS, ...(options.floors ?? {}) };
  const mainAction = mainActionFor(options.mainAction, options.route);
  const perViewport: Collected["perViewport"] = [];
  const tested: string[] = [];
  let screens: number | undefined;
  for (const stop of plan(options)) {
    await page.setViewportSize({ width: stop.width, height: stop.height });
    await settle(page, stop.ladder ? 150 : 60);
    if (stop.ladder) await loadEverything(page);
    if (stop.ladder) await options.onViewport?.(page, { name: stop.name, width: stop.width, height: stop.height, phone: stop.touch || stop.width < 768, landscape: stop.groups.includes("landscape") }, options.route);
    const findings: RawPhoneFinding[] = [];
    // The floors: text at every ladder stop, targets and fields where a thumb is.
    if (stop.ladder) findings.push(...(await page.evaluate(measurePhoneInPage, { ...floors, only: stop.touch ? ["target" as const, "field" as const, "text" as const] : ["text" as const] })));
    findings.push(...(await page.evaluate(measureViewportInPage, { groups: stop.groups, thresholds, mainAction, metaViewport: stop.width < 768 })));
    // Length: the page, lazy images loaded, in screens of the short phone's height.
    if (stop.name === SHORT_PHONE.name) {
      const height = await page.evaluate(() => document.documentElement.scrollHeight, undefined);
      screens = Math.round((height / stop.height) * 10) / 10;
      const budget = screenBudgetFor(options.screens, options.route);
      if (budget !== undefined && screens > budget) findings.push({ check: "screens", element: "<page>", detail: `${screens} phone screens to the footer at ${stop.width} x ${stop.height}, over the budget of ${budget} for ${options.route}` });
    }
    perViewport.push({ viewport: stop.name, findings });
    tested.push(stop.name);
  }
  return { perViewport, tested, ...(screens !== undefined ? { screens } : {}) };
}

/** The phone half and the wide half as one: the screens come from the half that measured the short phone. */
function mergeCollected(collected: Collected[]): Collected {
  const screens = collected.find((c) => c.screens !== undefined)?.screens;
  return { perViewport: collected.flatMap((c) => c.perViewport), tested: collected.flatMap((c) => c.tested), ...(screens !== undefined ? { screens } : {}) };
}

function finish(route: string, collected: Collected, out: string | false | undefined): ViewportsResult {
  const result: ViewportsResult = {
    route,
    viewports: collected.tested,
    ...(collected.screens !== undefined ? { screens: collected.screens } : {}),
    findings: mergeViewportFindings(collected.perViewport, collected.tested),
    perViewport: collected.perViewport,
  };
  if (out !== false) writeMeasured(result, out ?? DEFAULT_MEASURED_DIR);
  return result;
}

/** Writes `<route>.json` for `craft phone-first --measured`: the merged findings, not the per-viewport detail. */
export function writeMeasured(result: MeasuredRoute, dir: string): void {
  mkdirSync(dir, { recursive: true });
  const { route, viewport, viewports, screens, findings } = result;
  writeFileSync(join(dir, routeFile(route)), `${JSON.stringify({ route, ...(viewport ? { viewport } : {}), ...(viewports ? { viewports } : {}), ...(screens !== undefined ? { screens } : {}), findings }, null, 1)}\n`);
}

/**
 * Measure the page the caller has opened at every viewport, resizing it in
 * place: the ladder, the width sweep, the short phone, landscape and the wide
 * checks. Writes the merged result for `craft phone-first --measured`. Does
 * not judge or throw on a finding: the baseline decides.
 */
export async function measureViewports(page: ViewportPage, options: MeasureViewportsOptions): Promise<ViewportsResult> {
  if (!options.route.startsWith("/")) throw new Error(`measureViewports: route "${options.route}" should start with /`);
  await page.evaluate(() => document.fonts?.ready.then(() => undefined), undefined);
  return finish(options.route, await collect(page, options), options.out);
}

/** The desktop context the wide half is measured in, beside `PHONE` for the phone half. Spread into `browser.newContext`. */
export const DESKTOP = { viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 } as const;

/** A page opened at the route, and how to close it when its half is measured. */
export interface OpenedPage {
  page: ViewportPage;
  close?: () => Promise<void>;
}

/**
 * Every viewport for a route only the caller can open, such as a portal screen
 * behind a sign-in (DOM-835). As `measureSite` does for a public page, the
 * phone half is measured in a phone context and the wide half in a desktop
 * one; `open(scope)` returns a page already at the route, signed in with the
 * suite's fixtures, in `PHONE` for "phone" and `DESKTOP` for "wide". The two
 * halves are merged and written once, for `craft phone-first --measured`.
 *
 *     await measureRoute(async (scope) => {
 *       const context = await browser.newContext({ ...(scope === "phone" ? PHONE : DESKTOP), extraHTTPHeaders: auth });
 *       const page = await context.newPage();
 *       await page.goto(base + route);
 *       return { page, close: () => context.close() };
 *     }, { route, mainAction: 'a[href="/portal/requests/new"]' });
 */
export async function measureRoute(open: (scope: "phone" | "wide") => Promise<OpenedPage>, options: Omit<MeasureViewportsOptions, "scope">): Promise<ViewportsResult> {
  if (!options.route.startsWith("/")) throw new Error(`measureRoute: route "${options.route}" should start with /`);
  const collected: Collected[] = [];
  for (const scope of ["phone", "wide"] as const) {
    const { page, close } = await open(scope);
    try {
      await page.evaluate(() => document.fonts?.ready.then(() => undefined), undefined);
      collected.push(await collect(page, { ...options, scope }));
    } finally {
      await close?.();
    }
  }
  return finish(options.route, mergeCollected(collected), options.out);
}

export interface SitePage extends ViewportPage {
  goto(url: string): Promise<{ ok(): boolean; status(): number | string } | null>;
}

export interface SiteBrowser {
  newContext(options: Record<string, unknown>): Promise<{ newPage(): Promise<SitePage>; close(): Promise<void> }>;
}

export interface MeasureSiteOptions extends Omit<MeasureViewportsOptions, "route" | "scope"> {
  /** The running site, without a trailing slash. */
  base: string;
  routes: string[];
}

export interface SiteResult {
  routes: ViewportsResult[];
  /** Routes that did not answer, with why. Not measured, and not passed. */
  errors: { route: string; error: string }[];
}

/**
 * Open every route on a running site and measure it: the phone half in a
 * phone context, the wide half in a desktop one, merged per route.
 */
export async function measureSite(browser: SiteBrowser, options: MeasureSiteOptions): Promise<SiteResult> {
  const result: SiteResult = { routes: [], errors: [] };
  for (const route of options.routes) {
    const collected: Collected[] = [];
    let failed: string | null = null;
    for (const [scope, context] of [
      ["phone", PHONE],
      ["wide", DESKTOP],
    ] as const) {
      const ctx = await browser.newContext({ ...context });
      try {
        const page = await ctx.newPage();
        const resp = await page.goto(options.base + route).catch((error: Error) => ({ ok: () => false, status: () => error.message }));
        if (!resp || !resp.ok()) {
          failed = `HTTP ${resp?.status()}`;
          break;
        }
        await page.evaluate(() => document.fonts?.ready.then(() => undefined), undefined);
        collected.push(await collect(page, { ...options, route, scope }));
      } finally {
        await ctx.close();
      }
    }
    if (failed) {
      result.errors.push({ route, error: failed });
      continue;
    }
    result.routes.push(finish(route, mergeCollected(collected), options.out));
  }
  return result;
}
