/**
 * `@domandigital/craft/phone`: the phone-first gate for an app behind a
 * sign-in, such as a client portal (DOM-775).
 *
 * A site is measured by create-site's measure.mjs, which can open any page.
 * A portal's pages need a signed-in user and fixture data, which only the
 * portal's own Playwright suite knows how to set up. So the portal's suite
 * opens each key route at `PHONE` and calls `measurePhone`, which measures
 * the page and writes what it found; `craft phone-first --measured <dir>`
 * then judges every route against the repo's baseline in one place, with the
 * static check for max-width rules.
 *
 *     import { test } from "@playwright/test";
 *     import { PHONE, measurePhone } from "@domandigital/craft/phone";
 *
 *     test.use(PHONE);
 *     for (const route of ["/portal", "/portal/invoices"]) {
 *       test(`phone first: ${route}`, async ({ page }) => {
 *         await page.goto(route);
 *         await measurePhone(page, { route });
 *       });
 *     }
 *
 * Nothing here imports Playwright: the page is whatever the caller drives.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { measurePhoneInPage, type PhoneFloors, type RawPhoneFinding } from "./measure-in-page.js";
import type { MeasuredRoute } from "./judge.js";

export { measurePhoneInPage } from "./measure-in-page.js";
export type { PhoneCheck, PhoneFloors, RawPhoneFinding } from "./measure-in-page.js";
export * from "./judge.js";

/**
 * The phone every surface is designed at (STANDARD.md section 10): 375 x 812,
 * touch, at 2x. Spread into Playwright's `test.use` or `browser.newContext`.
 */
export const PHONE = {
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
} as const;

/** The house floors at phone width. Not per-repo settings. */
export const PHONE_FLOORS: PhoneFloors = { targetPx: 44, fieldFontPx: 16, textPx: 12 };

/** Where `measurePhone` writes and `craft phone-first --measured` reads, unless told otherwise. */
export const DEFAULT_MEASURED_DIR = "phone-first/measured";

interface MinimalPage {
  evaluate<R, A>(fn: (arg: A) => R, arg: A): Promise<R>;
  viewportSize?(): { width: number; height: number } | null;
}

export interface MeasurePhoneOptions {
  /** The route as the baseline names it, without host or query: `/portal/invoices`. */
  route: string;
  /** The folder to write `<route>.json` into. Default `phone-first/measured`, from the working directory. */
  out?: string;
}

/** A route as a file name: `/portal/invoices` is `portal-invoices.json`, `/` is `home.json`. */
export const routeFile = (route: string): string => `${route === "/" ? "home" : route.replace(/^\/+|\/+$/g, "").replace(/[^\w.-]+/g, "-")}.json`;

/**
 * Measure the page as it is now and write the result for `craft phone-first`.
 * Waits for web fonts first, so text is measured in the face it is set in.
 * Does not judge or throw on a finding: the baseline decides.
 */
export async function measurePhone(page: MinimalPage, options: MeasurePhoneOptions): Promise<MeasuredRoute> {
  if (!options.route.startsWith("/")) throw new Error(`measurePhone: route "${options.route}" should start with /`);
  await page.evaluate(() => document.fonts?.ready.then(() => undefined), undefined);
  const findings: RawPhoneFinding[] = await page.evaluate(measurePhoneInPage, PHONE_FLOORS);
  const viewport = page.viewportSize?.() ?? undefined;
  const result: MeasuredRoute = { route: options.route, ...(viewport ? { viewport } : {}), findings };
  const dir = options.out ?? DEFAULT_MEASURED_DIR;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, routeFile(options.route)), `${JSON.stringify(result, null, 1)}\n`);
  return result;
}
