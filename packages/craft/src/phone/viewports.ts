/**
 * What "every viewport" means (STANDARD.md section 10, DOM-787): the ladder
 * the page is measured at, the five bands it is designed in, the width sweep
 * between the rungs, and the thresholds the checks judge by. Pure data and
 * text work, so it is tested without a browser.
 */

import { cleanRoute, routeMatches } from "./judge.js";
import type { RawPhoneFinding } from "./measure-in-page.js";

export type Band = "phone" | "large-phone" | "tablet" | "laptop" | "wide";

/** The five bands every page is designed in. A width belongs to exactly one. */
export const BANDS: { band: Band; from: number; to: number | null }[] = [
  { band: "phone", from: 320, to: 479 },
  { band: "large-phone", from: 480, to: 767 },
  { band: "tablet", from: 768, to: 1023 },
  { band: "laptop", from: 1024, to: 1439 },
  { band: "wide", from: 1440, to: null },
];

export const bandOf = (width: number): Band => [...BANDS].reverse().find((b) => width >= b.from)?.band ?? "phone";

export interface Viewport {
  /** The label a report uses: `375`, or `844x390` for a landscape phone. */
  name: string;
  width: number;
  height: number;
  /** A phone held either way up: the touch floors (targets, fields) apply. */
  phone: boolean;
  landscape?: boolean;
}

/**
 * The ladder, phone first in order and in every report. Heights are the
 * phones' own; 375 x 812 stays the house phone (`PHONE`), so a baseline made
 * at 375 means the same thing here.
 */
export const LADDER: Viewport[] = [
  { name: "320", width: 320, height: 568, phone: true },
  { name: "375", width: 375, height: 812, phone: true },
  { name: "390", width: 390, height: 844, phone: true },
  { name: "430", width: 430, height: 932, phone: true },
  { name: "844x390", width: 844, height: 390, phone: true, landscape: true },
  { name: "768", width: 768, height: 1024, phone: false },
  { name: "1024", width: 1024, height: 768, phone: false },
  { name: "1280", width: 1280, height: 800, phone: false },
  { name: "1440", width: 1440, height: 900, phone: false },
  { name: "1920", width: 1920, height: 1080, phone: false },
];

/** The short phone the first screen is judged on: an iPhone SE, the least height a visitor has. */
export const SHORT_PHONE: Viewport = { name: "375x667", width: 375, height: 667, phone: true };

/** Widths where body line length and wide-screen image scaling are judged. */
export const WIDE_WIDTHS = [1440, 1920];

export interface Sweep {
  from: number;
  to: number;
  /** Step below `wideFrom`, where layouts change most. */
  step: number;
  /** Step from `wideFrom` up. */
  wideStep: number;
  wideFrom: number;
  /** The height every swept width is laid out at. */
  height: number;
}

export const DEFAULT_SWEEP: Sweep = { from: 320, to: 1920, step: 16, wideStep: 32, wideFrom: 1024, height: 800 };

/** 320, 336 ... 1024, 1056 ... 1920. */
export function sweepWidths(sweep: Sweep = DEFAULT_SWEEP): number[] {
  const out: number[] = [];
  for (let w = sweep.from; w <= sweep.to; w += w < sweep.wideFrom ? sweep.step : sweep.wideStep) out.push(w);
  if (out.at(-1) !== sweep.to) out.push(sweep.to);
  return out;
}

/** House defaults for the checks. Each can be overridden per site or portal; the defaults are what the standard says. */
export interface Thresholds {
  /** Fixed and sticky layers together cover at most this share of a short phone's screen. */
  maxLayerShare: number;
  /** In landscape, header and fixed layers leave at least this share of the height: they cover at most 1 minus it. */
  landscapeMaxLayerShare: number;
  /** An image whose file is more than this many times its displayed width is oversized (at DPR 2 it needs 2; the rest is slack). */
  oversizeRatio: number;
  /** An image whose file is narrower than this many times its displayed width is upscaled. */
  upscaleRatio: number;
  /** Body text lines at 1440 and 1920 are at most this many characters (`ch` of the computed font). */
  maxLineCh: number;
  /** Two pieces of visible text overlap when the overlap is this share of the shorter one's height and at least 3px wide. */
  overlapShare: number;
  /** Image files under this displayed width (CSS px) are icons and marks: not judged. */
  minImagePx: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  maxLayerShare: 0.25,
  landscapeMaxLayerShare: 0.5,
  oversizeRatio: 2.5,
  upscaleRatio: 1,
  maxLineCh: 80,
  overlapShare: 0.4,
  minImagePx: 32,
};

/** The main action, as a selector: one for the whole site, or one per route (`*` is the fallback). */
export type MainAction = string | Record<string, string>;

export const mainActionFor = (config: MainAction | undefined, route: string): string | undefined =>
  typeof config === "string" ? config : config ? (config[route] ?? config["*"]) : undefined;

/**
 * A length budget per page type, in phone screens to the footer (page height at
 * 375 x 667 over 667). Keys are a route (`/`), a route pattern (`/services/[slug]`),
 * a prefix (`/services/*`: the route and everything under it) or `*` for the
 * rest; the most specific match wins. No match is no budget: the count is
 * reported and never fails.
 */
export type ScreenBudgets = Record<string, number>;

/** The budget for a route, or undefined when none of the keys covers it. */
export function screenBudgetFor(budgets: ScreenBudgets | undefined, route: string): number | undefined {
  if (!budgets) return undefined;
  const path = cleanRoute(route);
  let best: { key: string; score: number } | undefined;
  for (const key of Object.keys(budgets)) {
    const prefix = key.endsWith("/*") ? key.slice(0, -1) : null;
    const hit = key === "*" ? 0 : prefix ? (path === key.slice(0, -2) || path.startsWith(prefix) ? 1 + prefix.length : -1) : routeMatches(key, path) ? (key === path ? 10_000 : 5_000 + key.length) : -1;
    if (hit >= 0 && (!best || hit > best.score)) best = { key, score: hit };
  }
  return best ? budgets[best.key] : undefined;
}

/** `screens` as a person types it into config: every budget a positive number. */
export function checkScreenBudgets(budgets: unknown, where = "screens"): ScreenBudgets | undefined {
  if (budgets === undefined) return undefined;
  if (!budgets || typeof budgets !== "object" || Array.isArray(budgets)) throw new Error(`${where} should map a route to its budget in phone screens, such as { "/": 6.5, "/services/*": 6 }`);
  for (const [route, value] of Object.entries(budgets)) {
    if (route !== "*" && !route.startsWith("/")) throw new Error(`${where}: "${route}" should start with / (or be *)`);
    if (typeof value !== "number" || !(value > 0)) throw new Error(`${where}: "${route}" should be a number of phone screens above 0, not ${JSON.stringify(value)}`);
  }
  return budgets as ScreenBudgets;
}

/** `/ 12.7, /services 4.1`: the count per route, for the line a run prints whether or not a budget is set. */
export function formatScreens(routes: { route: string; screens?: number }[], budgets?: ScreenBudgets): string {
  return routes
    .filter((r) => r.screens !== undefined)
    .map((r) => {
      const budget = screenBudgetFor(budgets, r.route);
      return `${r.route} ${r.screens}${budget === undefined ? "" : ` of ${budget}`}`;
    })
    .join(", ");
}

/**
 * Widths as a person reads them: `320-352, 400, 1440`. A run is consecutive
 * tested widths that all fail. A landscape or short-phone name (`844x390`)
 * stands alone.
 */
export function formatWidths(failing: string[], tested: string[]): string {
  const plain = tested.filter((n) => /^\d+$/.test(n)).sort((a, b) => Number(a) - Number(b));
  const rank = new Map(plain.map((name, i) => [name, i]));
  const names = [...new Set(failing)];
  const runs: string[][] = [];
  for (const name of names.filter((n) => rank.has(n)).sort((a, b) => rank.get(a)! - rank.get(b)!)) {
    const last = runs.at(-1);
    if (last && rank.get(name)! === rank.get(last.at(-1)!)! + 1) last.push(name);
    else runs.push([name]);
  }
  const out = runs.map((r) => (r.length > 1 ? `${r[0]}-${r.at(-1)}` : r[0]));
  return [...out, ...names.filter((n) => !rank.has(n))].join(", ");
}

const keyOf = (f: RawPhoneFinding): string => `${f.check}\u0000${f.element.replace(/("[^]*)$/, (t) => t.replace(/\d+/g, "#"))}`;

/**
 * One finding per element and check across every viewport, so the baseline
 * counts what is on the page and not how many widths it was seen at. The count
 * is the most seen at any single viewport; the detail names every viewport it
 * failed at, as ranges.
 */
export function mergeViewportFindings(perViewport: { viewport: string; findings: RawPhoneFinding[] }[], tested: string[]): RawPhoneFinding[] {
  const merged = new Map<string, { first: RawPhoneFinding; at: string[]; most: number }>();
  for (const { viewport, findings } of perViewport) {
    const counts = new Map<string, { first: RawPhoneFinding; n: number }>();
    for (const f of findings) {
      const k = keyOf(f);
      const had = counts.get(k);
      if (had) had.n++;
      else counts.set(k, { first: f, n: 1 });
    }
    for (const [k, { first, n }] of counts) {
      const had = merged.get(k);
      if (had) {
        had.at.push(viewport);
        had.most = Math.max(had.most, n);
      } else merged.set(k, { first, at: [viewport], most: n });
    }
  }
  const out: RawPhoneFinding[] = [];
  for (const { first, at, most } of merged.values()) {
    for (let i = 0; i < most; i++) out.push({ ...first, detail: `${first.detail} (at ${formatWidths(at, tested)})` });
  }
  return out;
}
