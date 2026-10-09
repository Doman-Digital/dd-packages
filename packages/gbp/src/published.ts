/**
 * Read a client's reviews from the file Doman Digital publishes, instead of from Google.
 *
 * One collector holds the only Google credential. Each night it reads every listing, the portal stores what it read,
 * and the portal writes `<client-slug>.json` to a public address. A site reads that file, so it needs no Google token
 * of its own, and a dead token makes its reviews stale rather than missing.
 *
 * The file carries Google's own rating and count for the whole listing, and only the reviews a site shows: four and
 * five stars, with words, and owner replies Google shows. `syncedAt` says when Google was last read.
 *
 * This throws on any failure rather than returning an empty result, so the caller can fall back to the copy it
 * already has (Next.js keeps the last good fetch; a static build keeps the last good deploy). Show nothing, never a
 * made-up number, when there is no copy at all.
 */
import { GbpPublishedError, excerpt } from "./errors";
import { fetchWithRetry, readErrorBody, resolvePolicy, type GbpRequestOptions } from "./http";
import type { BusinessReview, BusinessReviewsResult, ReviewOrder } from "./reviews";

/** Where Doman Digital's portal publishes review files. */
export const DEFAULT_PUBLISHED_REVIEWS_BASE_URL = "https://files.domandigital.co.uk/reviews";

/** The file schema this reader understands. A newer file is refused rather than misread. */
export const PUBLISHED_REVIEWS_SCHEMA = 1;

interface NextFetchInit extends RequestInit {
  next?: { revalidate?: number; tags?: string[] };
}

export interface GetPublishedReviewsOptions {
  /** The client's slug, e.g. `"chair-and-blade"`. */
  client: string;
  /** Default: `GBP_REVIEWS_BASE_URL` from the environment, else {@link DEFAULT_PUBLISHED_REVIEWS_BASE_URL}. */
  baseUrl?: string;
  /** Raise the published floor (four stars). Values at or below four change nothing. */
  filterMinStars?: number;
  /** Max reviews to return. Default: all of them. */
  limit?: number;
  /** `"api"` (default): newest first, as published. `"shuffle"`: random order, applied after `limit`. */
  order?: ReviewOrder;
  /** Cache hint passed to `fetch` for Next.js. Default: revalidate daily, tag `google-reviews`. */
  next?: { revalidate?: number; tags?: string[] };
  /** Deadline and retry policy. */
  request?: GbpRequestOptions;
}

export interface PublishedReviewsResult extends BusinessReviewsResult {
  /** When the collector last read Google in full. */
  syncedAt: string;
  /** When the file was written. */
  publishedAt: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isTime = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));

function parseReview(v: unknown): BusinessReview | null {
  if (!isRecord(v)) return null;
  const { id, author, rating, comment, createdAt, reply } = v;
  if (typeof id !== "string" || typeof author !== "string" || typeof comment !== "string" || !comment) return null;
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) return null;
  const review: BusinessReview = { id, author, rating, comment, createdAt: isTime(createdAt) ? createdAt : "" };
  if (isRecord(reply) && typeof reply.text === "string" && reply.text) {
    review.reply = { text: reply.text, updatedAt: isTime(reply.updatedAt) ? reply.updatedAt : "" };
  }
  return review;
}

/**
 * Validate a published file. A malformed review is skipped; a malformed file, a file for another client or a schema
 * this reader does not know throws {@link GbpPublishedError}.
 */
export function parsePublishedReviews(body: unknown, client: string): PublishedReviewsResult {
  if (!isRecord(body)) throw new GbpPublishedError("invalid", client, "the file is not an object");
  if (body.schema !== PUBLISHED_REVIEWS_SCHEMA) {
    throw new GbpPublishedError("unknown_schema", client, `schema ${String(body.schema)}`);
  }
  if (body.client !== client) throw new GbpPublishedError("invalid", client, `the file is for ${String(body.client)}`);
  const { rating, count } = body;
  if (rating !== null && (typeof rating !== "number" || !(rating >= 0 && rating <= 5))) {
    throw new GbpPublishedError("invalid", client, "rating out of range");
  }
  if (count !== null && (typeof count !== "number" || !Number.isInteger(count) || count < 0)) {
    throw new GbpPublishedError("invalid", client, "count is not a whole number");
  }
  if (!isTime(body.synced_at) || !isTime(body.published_at) || !Array.isArray(body.reviews)) {
    throw new GbpPublishedError("invalid", client, "synced_at, published_at or reviews missing");
  }
  return {
    averageRating: rating,
    totalReviewCount: count,
    reviews: body.reviews.map(parseReview).filter((r): r is BusinessReview => r !== null),
    syncedAt: body.synced_at,
    publishedAt: body.published_at,
  };
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** The URL a client's file is read from. */
export function publishedReviewsUrl(client: string, baseUrl?: string): string {
  if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(client)) throw new RangeError(`not a client slug: ${client}`);
  const base = (baseUrl ?? process.env.GBP_REVIEWS_BASE_URL ?? DEFAULT_PUBLISHED_REVIEWS_BASE_URL).replace(/\/+$/, "");
  return `${base}/${client}.json`;
}

/**
 * Fetch a client's published reviews. Retries 429 and transient 5xx within a deadline (see `request`), then throws:
 * {@link GbpPublishedError} for a missing or malformed file, `GbpTimeoutError` for a deadline.
 */
export async function getPublishedReviews(options: GetPublishedReviewsOptions): Promise<PublishedReviewsResult> {
  const { client, filterMinStars, limit, order = "api", next, request } = options;
  const url = publishedReviewsUrl(client, options.baseUrl);
  const init: NextFetchInit = {
    headers: { Accept: "application/json" },
    next: next ?? { revalidate: 86400, tags: ["google-reviews"] },
  };
  const { response } = await fetchWithRetry(url, init, "reviews.published", resolvePolicy(request));
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
  const result = parsePublishedReviews(body, client);
  let reviews = filterMinStars === undefined ? result.reviews : result.reviews.filter((r) => r.rating >= filterMinStars);
  if (limit !== undefined) reviews = reviews.slice(0, limit);
  return { ...result, reviews: order === "shuffle" ? shuffle(reviews) : reviews };
}
