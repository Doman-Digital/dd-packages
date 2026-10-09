/**
 * Read a client's Facebook Page recommendations from the file Doman Digital publishes, beside the Google file:
 * `<client-slug>.facebook.json`. The portal reads every connected Page daily with the Page token it already holds, so a
 * site needs no Meta token, and a dead token makes the figures stale rather than missing.
 *
 * Facebook has recommendations, not star reviews: `count` is every recommendation on the Page, `recommends` the
 * positive ones, and `rating` is Meta's own overall figure out of 5 (null when Meta gives none). `reviews` holds the
 * positive recommendations with words. There is no author: Meta does not return the person who recommended.
 *
 * Like `getPublishedReviews`, this throws rather than returning an empty result, so the caller keeps the copy it has.
 */
import { GbpPublishedError, excerpt } from "./errors";
import { fetchWithRetry, readErrorBody, resolvePolicy, type GbpRequestOptions } from "./http";
import { DEFAULT_PUBLISHED_REVIEWS_BASE_URL, PUBLISHED_REVIEWS_SCHEMA } from "./published";

interface NextFetchInit extends RequestInit {
  next?: { revalidate?: number; tags?: string[] };
}

export interface FacebookRecommendation {
  id: string;
  comment: string;
  /** ISO 8601. */
  createdAt: string;
}

export interface PublishedFacebookResult {
  /** Meta's overall rating out of 5, or null when Meta gives none. */
  rating: number | null;
  /** Every recommendation on the Page, positive and negative. */
  count: number;
  /** The positive ones. */
  recommends: number;
  /** Positive recommendations with words, newest first. */
  reviews: FacebookRecommendation[];
  /** When the portal last read the Page in full. */
  syncedAt: string;
  publishedAt: string;
}

export interface GetPublishedFacebookOptions {
  /** The client's slug, e.g. `"rmp-electrical"`. */
  client: string;
  /** Default: `GBP_REVIEWS_BASE_URL`, else the Doman Digital address. */
  baseUrl?: string;
  /** Max recommendations to return. Default: all of them. */
  limit?: number;
  /** Cache hint passed to `fetch` for Next.js. Default: revalidate daily, tag `facebook-reviews`. */
  next?: { revalidate?: number; tags?: string[] };
  request?: GbpRequestOptions;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isTime = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));
const isCount = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;

/** Validate a published Facebook file. A malformed entry is skipped; a malformed file throws. */
export function parsePublishedFacebook(body: unknown, client: string): PublishedFacebookResult {
  if (!isRecord(body)) throw new GbpPublishedError("invalid", client, "the file is not an object");
  if (body.schema !== PUBLISHED_REVIEWS_SCHEMA) throw new GbpPublishedError("unknown_schema", client, `schema ${String(body.schema)}`);
  if (body.client !== client || body.source !== "facebook") {
    throw new GbpPublishedError("invalid", client, `the file is for ${String(body.client)} (${String(body.source)})`);
  }
  const { rating, count, recommends } = body;
  if (rating !== null && (typeof rating !== "number" || !(rating >= 0 && rating <= 5))) {
    throw new GbpPublishedError("invalid", client, "rating out of range");
  }
  if (!isCount(count) || !isCount(recommends) || recommends > count) {
    throw new GbpPublishedError("invalid", client, "count or recommends is not a whole number within the count");
  }
  if (!isTime(body.synced_at) || !isTime(body.published_at) || !Array.isArray(body.reviews)) {
    throw new GbpPublishedError("invalid", client, "synced_at, published_at or reviews missing");
  }
  const reviews = body.reviews.flatMap((v): FacebookRecommendation[] =>
    isRecord(v) && typeof v.id === "string" && typeof v.comment === "string" && v.comment && isTime(v.createdAt)
      ? [{ id: v.id, comment: v.comment, createdAt: v.createdAt }]
      : [],
  );
  return { rating, count, recommends, reviews, syncedAt: body.synced_at, publishedAt: body.published_at };
}

/** The URL a client's Facebook file is read from. */
export function publishedFacebookUrl(client: string, baseUrl?: string): string {
  if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(client)) throw new RangeError(`not a client slug: ${client}`);
  const base = (baseUrl ?? process.env.GBP_REVIEWS_BASE_URL ?? DEFAULT_PUBLISHED_REVIEWS_BASE_URL).replace(/\/+$/, "");
  return `${base}/${client}.facebook.json`;
}

/** Fetch a client's published Facebook recommendations. Throws {@link GbpPublishedError} or `GbpTimeoutError`. */
export async function getPublishedFacebookRecommendations(
  options: GetPublishedFacebookOptions,
): Promise<PublishedFacebookResult> {
  const { client, limit, next, request } = options;
  const url = publishedFacebookUrl(client, options.baseUrl);
  const init: NextFetchInit = {
    headers: { Accept: "application/json" },
    next: next ?? { revalidate: 86400, tags: ["facebook-reviews"] },
  };
  const { response } = await fetchWithRetry(url, init, "reviews.facebook", resolvePolicy(request));
  if (!response.ok) {
    const body = excerpt(await readErrorBody(response), 120);
    throw new GbpPublishedError("http", client, String(response.status), response.status, body || undefined);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new GbpPublishedError("invalid", client, "the file is not JSON");
  }
  const result = parsePublishedFacebook(body, client);
  return limit === undefined ? result : { ...result, reviews: result.reviews.slice(0, limit) };
}
