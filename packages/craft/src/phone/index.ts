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
 * `measureViewports` (DOM-787) is the same for every viewport: it resizes the
 * page the suite opened through the ladder and the width sweep, and adds the
 * phone-optimisation and wide-screen checks. `measureSite` opens a running
 * site's routes itself, and `craft viewports` is that on the command line.
 * Both write the same measured files, so `craft phone-first --measured` judges
 * them against the same baseline.
 *
 * Nothing here imports Playwright: the page is whatever the caller drives.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_MEASURED_DIR, PHONE_FLOORS, routeFile } from "./constants.js";
import { measurePhoneInPage, type PhoneFloors, type RawPhoneFinding } from "./measure-in-page.js";
import type { MeasuredRoute } from "./judge.js";

export { measurePhoneInPage } from "./measure-in-page.js";
export type { PhoneCheck, PhoneFloors, RawPhoneFinding } from "./measure-in-page.js";
export { measureViewportInPage } from "./measure-viewport-in-page.js";
export type { InPageGroup, ViewportArg } from "./measure-viewport-in-page.js";
export { DEFAULT_MEASURED_DIR, PHONE, PHONE_FLOORS, routeFile } from "./constants.js";
export * from "./judge.js";
export * from "./viewports.js";
export { DESKTOP, measureRoute, measureSite, measureViewports } from "./run.js";
export type { MeasureSiteOptions, MeasureViewportsOptions, OpenedPage, SiteBrowser, SitePage, SiteResult, ViewportPage, ViewportsResult } from "./run.js";

interface MinimalPage {
  evaluate<R, A>(fn: (arg: A) => R, arg: A): Promise<R>;
  viewportSize?(): { width: number; height: number } | null;
}

export interface MeasurePhoneOptions {
  /** The route as the baseline names it, without host or query: `/portal/invoices`. */
  route: string;
  /** The folder to write `<route>.json` into. Default `phone-first/measured`, from the working directory. */
  out?: string;
  /** Override the 12 / 16 / 44 / 48px floors (text, field text, target, field height). The defaults are the house standard. */
  floors?: Partial<PhoneFloors>;
}


/**
 * Measure the page as it is now and write the result for `craft phone-first`.
 * Waits for web fonts first, so text is measured in the face it is set in.
 * Does not judge or throw on a finding: the baseline decides.
 */
export async function measurePhone(page: MinimalPage, options: MeasurePhoneOptions): Promise<MeasuredRoute> {
  if (!options.route.startsWith("/")) throw new Error(`measurePhone: route "${options.route}" should start with /`);
  await page.evaluate(() => document.fonts?.ready.then(() => undefined), undefined);
  const findings: RawPhoneFinding[] = await page.evaluate(measurePhoneInPage, { ...PHONE_FLOORS, ...(options.floors ?? {}) });
  const viewport = page.viewportSize?.() ?? undefined;
  const result: MeasuredRoute = { route: options.route, ...(viewport ? { viewport } : {}), findings };
  const dir = options.out ?? DEFAULT_MEASURED_DIR;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, routeFile(options.route)), `${JSON.stringify(result, null, 1)}\n`);
  return result;
}
