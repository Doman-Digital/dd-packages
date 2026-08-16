/**
 * The internal-link graph: which pages should send authority to which other
 * pages. This is the mechanism behind "guides rank, the pages that take
 * bookings don't" — a content page declares which money page(s) it supports,
 * and this module derives the reverse edge for free, plus a same-pillar
 * fallback for pages that haven't declared anything explicit yet.
 *
 * The rendering primitive (an actual "read more" component) stays per-repo,
 * since every site has its own design system. This module only returns
 * route keys.
 */

export type LinkDeclaration = {
  routeKey: string;
  /** routeKeys this page should send authority to, e.g. a guide -> its treatment page. */
  supports?: string[];
  /** Fallback grouping used when supports is empty or needs topping up. */
  pillar?: string;
};

export type RelatedLinks = {
  /** Pages this route should link out to: its own declared supports, topped up with pillar siblings. */
  linksTo: string[];
  /** Pages that declared this route in their own supports — the reverse edge, derived, not declared twice. */
  linkedFrom: string[];
};

export type GetRelatedLinksOptions = {
  /** Caps `linksTo` only. Explicit supports are kept first, then pillar
   * siblings top it up to this many. Omit for no cap. */
  limit?: number;
  /** Caps `linkedFrom` independently of `limit`. Omit for no cap -- every
   * page that declared this one as a support is returned. */
  linkedFromLimit?: number;
};

export function getRelatedLinks(
  declarations: LinkDeclaration[],
  routeKey: string,
  opts: GetRelatedLinksOptions = {},
): RelatedLinks {
  const self = declarations.find((d) => d.routeKey === routeKey);

  const linkedFrom = declarations
    .filter((d) => d.routeKey !== routeKey && (d.supports ?? []).includes(routeKey))
    .map((d) => d.routeKey);

  const explicit = self?.supports ?? [];
  let linksTo = [...explicit];

  // `opts.limit` caps `linksTo` only -- it never applied to `linkedFrom`,
  // which is an unrelated list (every page that named this one, not this
  // page's own outbound picks). `linkedFromLimit` is independent and opt-in.
  const limit = opts.limit;
  const needsTopUp = limit === undefined || linksTo.length < limit;
  if (needsTopUp && self?.pillar) {
    const siblings = declarations
      .filter(
        (d) =>
          d.routeKey !== routeKey && d.pillar === self.pillar && !linksTo.includes(d.routeKey),
      )
      .map((d) => d.routeKey);
    linksTo = limit === undefined ? [...linksTo, ...siblings] : [...linksTo, ...siblings].slice(0, limit);
  } else if (limit !== undefined) {
    linksTo = linksTo.slice(0, limit);
  }

  const linkedFromLimit = opts.linkedFromLimit;

  return {
    linksTo,
    linkedFrom: linkedFromLimit === undefined ? linkedFrom : linkedFrom.slice(0, linkedFromLimit),
  };
}
