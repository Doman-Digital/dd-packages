/**
 * Which pages, at which widths: the inputs to a multi-page audit. Pure text
 * work, so it is tested without a browser.
 */

export interface Viewport {
  width: number;
  height: number;
}

const decode = (s: string): string =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");

/**
 * The `<loc>` entries of a sitemap. For a sitemap index, `sitemaps` holds the
 * child sitemaps to read next and `urls` is empty.
 */
export function parseSitemap(xml: string): { urls: string[]; sitemaps: string[] } {
  const locs = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((m) => decode(m[1]));
  return /<sitemapindex[\s>]/i.test(xml) ? { urls: [], sitemaps: locs } : { urls: locs, sitemaps: [] };
}

/** A file of URLs, one per line. Blank lines and `#` comments are skipped. */
export function parseUrlList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

/**
 * `390,768,1440` as viewports. The height is the first screen a visitor
 * sees at that width: 844 for a phone (below 600), 1024 for a tablet (below
 * 1024), 900 otherwise.
 */
export function parseViewports(value: string): Viewport[] {
  const widths = value.split(",").map((w) => w.trim());
  return widths.map((w) => {
    const width = Number(w);
    if (!Number.isInteger(width) || width < 240 || width > 3840) throw new Error(`--viewport: "${w}" is not a width in px between 240 and 3840`);
    return { width, height: width < 600 ? 844 : width < 1024 ? 1024 : 900 };
  });
}
