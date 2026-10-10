/**
 * Read a client's reviews from a trade platform, Checkatrade or MyBuilder, from the file Doman Digital publishes beside
 * the Google file: `<client-slug>.<source>.json`. A collector reads the client's public profile on the platform and
 * the portal publishes what it read, so a site holds no scraper and a failed read makes the figures stale rather than
 * missing.
 *
 * Each platform keeps its own scale, named by `scale`: Checkatrade scores out of 10 (`out_of_10`), MyBuilder gives a
 * percentage of positive feedback (`percent_positive`). `score` and `count` are the platform's own figures for the
 * whole profile. `reviews` holds every review with words, word for word, with the reviewer as first name and initial.
 *
 * Like `getPublishedReviews`, this throws rather than returning an empty result, so the caller keeps the copy it has.
 */
import { GbpPublishedError, excerpt } from "./errors";
import { fetchWithRetry, readErrorBody, resolvePolicy, type GbpRequestOptions } from "./http";
import { DEFAULT_PUBLISHED_REVIEWS_BASE_URL, PUBLISHED_REVIEWS_SCHEMA } from "./published";

interface NextFetchInit extends RequestInit {
  next?: { revalidate?: number; tags?: string[] };
}

export type ExternalReviewSource = "checkatrade" | "mybuilder";

const SCALES = { checkatrade: "out_of_10", mybuilder: "percent_positive" } as const;
const SCORE_MAX = { checkatrade: 10, mybuilder: 100 } as const;

export type ExternalScale = (typeof SCALES)[ExternalReviewSource];
export type ExternalSentiment = "positive" | "neutral" | "negative";

export interface ExternalReview {
  id: string;
  /** First name and surname initial, e.g. "Karen P.". */
  author: string;
  /** The review's own score out of 10 (Checkatrade), else null. */
  rating: number | null;
  /** Positive, neutral or negative (MyBuilder), else null. */
  sentiment: ExternalSentiment | null;
  /** The job the review is for, as the platform titles it. */
  job: string | null;
  /** The review's words, exactly as on the platform. */
  comment: string;
  /** ISO 8601, or null when the platform gave no date. */
  createdAt: string | null;
  /** The trader's public response. */
  reply?: { text: string };
}

export interface PublishedExternalResult {
  source: ExternalReviewSource;
  /** The client's profile on the platform, for a "read them all" link. */
  profileUrl: string;
  /** What `score` is measured in: out of 10 for Checkatrade, a percentage positive for MyBuilder. */
  scale: ExternalScale;
  /** The platform's own figure for the whole profile, or null when it shows none. */
  score: number | null;
  /** The platform's own count of reviews, or null when it shows none. */
  count: number | null;
  /** Every review with words, newest first. */
  reviews: ExternalReview[];
  /** When the profile was last read in full. */
  syncedAt: string;
  publishedAt: string;
}

export interface GetPublishedExternalOptions {
  /** The client's slug, e.g. `"bellerose-plumbing"`. */
  client: string;
  source: ExternalReviewSource;
  /** Default: `GBP_REVIEWS_BASE_URL`, else the Doman Digital address. */
  baseUrl?: string;
  /** Max reviews to return. Default: all of them. */
  limit?: number;
  /** Cache hint passed to `fetch` for Next.js. Default: revalidate daily, tag `<source>-reviews`. */
  next?: { revalidate?: number; tags?: string[] };
  request?: GbpRequestOptions;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isTime = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));
const isCount = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;
const isSentiment = (v: unknown): v is ExternalSentiment => v === "positive" || v === "neutral" || v === "negative";
const optText = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

function parseReview(v: unknown): ExternalReview[] {
  if (!isRecord(v) || typeof v.id !== "string" || !v.id || typeof v.author !== "string" || !v.author) return [];
  if (typeof v.comment !== "string" || !v.comment) return [];
  const rating = typeof v.rating === "number" && v.rating >= 0 && v.rating <= 10 ? v.rating : null;
  const review: ExternalReview = {
    id: v.id,
    author: v.author,
    rating,
    sentiment: isSentiment(v.sentiment) ? v.sentiment : null,
    job: optText(v.job),
    comment: v.comment,
    createdAt: isTime(v.createdAt) ? v.createdAt : null,
  };
  if (isRecord(v.reply) && typeof v.reply.text === "string" && v.reply.text) review.reply = { text: v.reply.text };
  return [review];
}

/** Validate a published trade-platform file. A malformed entry is skipped; a malformed file throws. */
export function parsePublishedExternal(
  body: unknown,
  client: string,
  source: ExternalReviewSource,
): PublishedExternalResult {
  if (!isRecord(body)) throw new GbpPublishedError("invalid", client, "the file is not an object");
  if (body.schema !== PUBLISHED_REVIEWS_SCHEMA) throw new GbpPublishedError("unknown_schema", client, `schema ${String(body.schema)}`);
  if (body.client !== client || body.source !== source) {
    throw new GbpPublishedError("invalid", client, `the file is for ${String(body.client)} (${String(body.source)}), not ${source}`);
  }
  if (body.scale !== SCALES[source]) throw new GbpPublishedError("invalid", client, `scale ${String(body.scale)} is not ${SCALES[source]}`);
  const { score, count } = body;
  if (score !== null && (typeof score !== "number" || !(score >= 0 && score <= SCORE_MAX[source]))) {
    throw new GbpPublishedError("invalid", client, "score out of range");
  }
  if (count !== null && !isCount(count)) throw new GbpPublishedError("invalid", client, "count is not a whole number");
  if (typeof body.profile_url !== "string" || !body.profile_url.startsWith("https://")) {
    throw new GbpPublishedError("invalid", client, "profile_url missing");
  }
  if (!isTime(body.synced_at) || !isTime(body.published_at) || !Array.isArray(body.reviews)) {
    throw new GbpPublishedError("invalid", client, "synced_at, published_at or reviews missing");
  }
  return {
    source,
    profileUrl: body.profile_url,
    scale: SCALES[source],
    score,
    count,
    reviews: body.reviews.flatMap(parseReview),
    syncedAt: body.synced_at,
    publishedAt: body.published_at,
  };
}

/** The URL a client's file for one platform is read from. */
export function publishedExternalUrl(client: string, source: ExternalReviewSource, baseUrl?: string): string {
  if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(client)) throw new RangeError(`not a client slug: ${client}`);
  if (source !== "checkatrade" && source !== "mybuilder") throw new RangeError(`not a review source: ${String(source)}`);
  const base = (baseUrl ?? process.env.GBP_REVIEWS_BASE_URL ?? DEFAULT_PUBLISHED_REVIEWS_BASE_URL).replace(/\/+$/, "");
  return `${base}/${client}.${source}.json`;
}

/** Fetch a client's published Checkatrade or MyBuilder reviews. Throws {@link GbpPublishedError} or `GbpTimeoutError`. */
export async function getPublishedExternalReviews(options: GetPublishedExternalOptions): Promise<PublishedExternalResult> {
  const { client, source, limit, next, request } = options;
  const url = publishedExternalUrl(client, source, options.baseUrl);
  const init: NextFetchInit = {
    headers: { Accept: "application/json" },
    next: next ?? { revalidate: 86400, tags: [`${source}-reviews`] },
  };
  const { response } = await fetchWithRetry(url, init, `reviews.${source}`, resolvePolicy(request));
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
  const result = parsePublishedExternal(body, client, source);
  return limit === undefined ? result : { ...result, reviews: result.reviews.slice(0, limit) };
}
