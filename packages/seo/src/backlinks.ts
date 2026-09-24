/**
 * Backlink register: the shape of a site's links.json, a record of links the
 * business has earned. The data stays per-repo; this module only knows the
 * shape and how to read the live targets out of it for validateRedirects.
 *
 * There is deliberately no "requested" or "outreach" status. The register
 * records links that exist or existed, not asks, because Doman Digital does
 * not run cold outreach for links. A status that tracked asks would invite
 * the pipeline it rules out.
 */

export type BacklinkRel = "follow" | "nofollow" | "ugc" | "sponsored";
export type BacklinkStatus = "live" | "pending" | "lost";
export type BacklinkKind = "press" | "directory" | "register" | "supplier" | "partner" | "community" | "other";

export type Backlink = {
  /** Who links, in words: "NICEIC contractor register", "Local Echo". */
  source: string;
  /** The page the link sits on. */
  url: string;
  /** The page on this site it points to. */
  targetUrl: string;
  /** ISO date, YYYY-MM-DD. */
  obtainedOn: string;
  rel: BacklinkRel;
  status: BacklinkStatus;
  kind?: BacklinkKind;
  /** ISO date the link was last seen live. */
  lastCheckedOn?: string;
  notes?: string;
};

export type BacklinkRegister = { $schema?: string; links: Backlink[] };

/** Target URLs of live links, de-duplicated, in register order. Feed to validateRedirects. */
export function liveLinkedUrls(register: BacklinkRegister): string[] {
  const seen = new Set<string>();
  for (const link of register.links) {
    if (link.status === "live") seen.add(link.targetUrl);
  }
  return [...seen];
}
