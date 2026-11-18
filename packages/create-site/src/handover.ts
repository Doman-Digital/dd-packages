// Handover mode: an existing live site copied in (an Astro handover) still goes
// through create-site, so it gets the data, SEO and graph layers and the
// drift checks. It keeps the client's look and copy: anything a visitor can see
// is added only when the builder names it in --with, one site at a time.

/** The pieces a visitor can see. A handover adds none unless asked. */
export const VISIBLE_PIECES = ["credit", "consent", "analytics", "legal", "press", "resources"] as const;
export type VisiblePiece = (typeof VISIBLE_PIECES)[number];

/**
 * The template files behind each visible piece. The lib files (consent, web
 * analytics, legal) are inert code and always install, so the facts and the
 * house tests that import them keep working. Matching is by file name.
 */
const PIECE_FILES: Record<VisiblePiece, RegExp> = {
  credit: /\/DesignerCredit\.(tsx|astro)$/,
  consent: /\/CookieBanner\.(tsx|astro)$/,
  analytics: /\/WebAnalytics\.(tsx|astro)$/,
  legal: /\/(privacy|cookies|terms|accessibility)(\/page\.tsx|\.astro)$/,
  press: /\/press(\/page\.tsx|\.astro)$/,
  resources: /\/resources(\/page\.tsx|\/index\.astro)$/,
};

/** The piece a template belongs to, or null when it is an invisible layer. */
export function pieceOf(template: string): VisiblePiece | null {
  const path = `/${template}`;
  for (const piece of VISIBLE_PIECES) if (PIECE_FILES[piece].test(path)) return piece;
  return null;
}

/** Whether a template is installed. A new build installs everything. */
export function installs(template: string, handover: { with: readonly string[] } | null): boolean {
  if (!handover) return true;
  const piece = pieceOf(template);
  return piece === null || handover.with.includes(piece);
}
