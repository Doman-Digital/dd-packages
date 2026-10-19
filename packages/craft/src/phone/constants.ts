/** What the phone measures share: the house phone, the house floors, where results go. */

import type { PhoneFloors } from "./measure-in-page.js";

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

/**
 * The house floors at phone width. A site may raise `textPx`, or lower
 * `fieldHeightPx` with a reason; they are not per-repo taste. The field height
 * is portal standard rule 5 (48px inputs); until DOM-1053 the gate held fields
 * to the 44px target floor only.
 */
export const PHONE_FLOORS: Required<PhoneFloors> = { targetPx: 44, fieldFontPx: 16, textPx: 12, fieldHeightPx: 48 };

/** Where `measurePhone` writes and `craft phone-first --measured` reads, unless told otherwise. */
export const DEFAULT_MEASURED_DIR = "phone-first/measured";

/** A route as a file name: `/portal/invoices` is `portal-invoices.json`, `/` is `home.json`. */
export const routeFile = (route: string): string => `${route === "/" ? "home" : route.replace(/^\/+|\/+$/g, "").replace(/[^\w.-]+/g, "-")}.json`;
