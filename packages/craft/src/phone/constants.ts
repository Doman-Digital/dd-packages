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

/** The house floors at phone width. Not per-repo settings. */
export const PHONE_FLOORS: PhoneFloors = { targetPx: 44, fieldFontPx: 16, textPx: 12 };

/** Where `measurePhone` writes and `craft phone-first --measured` reads, unless told otherwise. */
export const DEFAULT_MEASURED_DIR = "phone-first/measured";

/** A route as a file name: `/portal/invoices` is `portal-invoices.json`, `/` is `home.json`. */
export const routeFile = (route: string): string => `${route === "/" ? "home" : route.replace(/^\/+|\/+$/g, "").replace(/[^\w.-]+/g, "-")}.json`;
