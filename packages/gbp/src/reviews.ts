/**
 * Google Business Profile -- fetch the business's own reviews, including the
 * business's reply to each one. Free (no per-call billing, unlike Places
 * API), and because these are your own reviews via the Business Profile API
 * there are no Places display / caching restrictions.
 *
 * Auth is OAuth user refresh-token, not a service account -- service accounts
 * are rejected by this API entirely. See ./oauth-client.ts.
 *
 * A review's reply has no author field of its own: GBP replies are 1:1 (one
 * slot per review) and always from the business -- there's no third party to
 * disambiguate. Google's own UI renders it as "Response from the owner" for
 * the same reason. Attribute it to the business in the consumer, not here.
 *
 * Access caveat: the Business Profile APIs require a one-time access request
 * / approval from Google, and reviews live on the legacy `mybusiness v4`
 * endpoint which must be enabled on your Cloud project. Until that is
 * granted, every function here degrades gracefully to empty results.
 *
 * Env: GBP_CLIENT_ID, GBP_CLIENT_SECRET, GBP_REFRESH_TOKEN,
 * GOOGLE_BUSINESS_ACCOUNT_ID, GOOGLE_BUSINESS_LOCATION_ID.
 */

import { GbpApiError, GbpPaginationError, excerpt } from "./errors";
import { RETRYABLE_STATUSES, fetchWithRetry, readErrorBody, resolvePolicy, type GbpRequestOptions } from "./http";
import { getGoogleOAuthAccessToken, hasGoogleOAuthCredentials, invalidateAccessToken } from "./oauth-client";

// This package has no dependency on "next" (deliberately zero-dependency), so
// the `next: {...}` fetch cache-hint option Next.js apps augment RequestInit
// with isn't in scope here -- declared locally instead. A no-op outside Next.js.
interface NextFetchInit extends RequestInit {
  next?: { revalidate?: number; tags?: string[] };
}

// Google encodes star ratings as enum strings.
const STAR_VALUES: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

const MAX_PAGE_SIZE = 50;
/** 50 pages of 50 is 2,500 reviews: far past any client's profile, well short of a runaway loop. */
export const DEFAULT_MAX_PAGES = 50;

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** A raw review is only usable once it has both a comment and a star rating,
 * and (if filterMinStars is set) clears that bar. Shared between the
 * pagination stopping condition and the final filter, so the two can never
 * disagree about what counts. Rating-only reviews are still counted in
 * `totalReviewCount` and `averageRating`, which come from Google, not from
 * this list. */
function isUsableReview(r: RawReview, filterMinStars: number | undefined): boolean {
  if (!r.comment || !r.starRating || !(r.starRating in STAR_VALUES)) return false;
  if (filterMinStars !== undefined && STAR_VALUES[r.starRating] < filterMinStars) return false;
  return true;
}

/** Google's moderation state for an owner reply. Replies from before moderation existed carry none. */
export type ReviewReplyState = "PENDING" | "REJECTED" | "APPROVED";

export interface ReviewReply {
  text: string;
  /** ISO 8601, when the reply was last posted/edited. */
  updatedAt: string;
  /** Moderation state, when Google reports one. */
  state?: ReviewReplyState;
  /** Why Google rejected the reply. Only set when `state` is `"REJECTED"`. New values may appear. */
  policyViolation?: string;
}

/** A photo or video the reviewer attached. */
export interface ReviewMedia {
  /** The photo, or the video's thumbnail. */
  thumbnailUrl: string;
  /** The reviewer's own label for it, if any. */
  label?: string;
  /** Set for a video. */
  videoUrl?: string;
}

export interface BusinessReview {
  id: string;
  author: string;
  authorPhoto?: string;
  rating: number; // 1-5
  comment: string;
  createdAt: string; // ISO
  reply?: ReviewReply;
  /** Photos and videos attached to the review, in Google's order. */
  media?: ReviewMedia[];
  /** Google's URL for replying to this review, for an owner-facing surface. */
  replyUrl?: string;
}

export interface BusinessReviewsResult {
  /**
   * Google's average for every review on the profile, rating-only ones
   * included. `null` when Google did not report one (or the package is
   * unconfigured): never computed from the returned list.
   */
  averageRating: number | null;
  /**
   * Google's count of every review on the profile. `null` when Google did not
   * report one: never the length of the returned (filtered, limited) list,
   * which would publish a wrong number into anything built from it.
   */
  totalReviewCount: number | null;
  reviews: BusinessReview[];
}

const EMPTY: BusinessReviewsResult = {
  averageRating: null,
  totalReviewCount: null,
  reviews: [],
};

/** True when account + location + OAuth credentials are all configured. */
export function isBusinessProfileConfigured(): boolean {
  return (
    hasGoogleOAuthCredentials() &&
    Boolean(process.env.GOOGLE_BUSINESS_ACCOUNT_ID) &&
    Boolean(process.env.GOOGLE_BUSINESS_LOCATION_ID)
  );
}

interface RawReview {
  reviewId: string;
  reviewer?: { displayName?: string; profilePhotoUrl?: string };
  starRating?: string;
  comment?: string;
  createTime?: string;
  reviewReply?: { comment?: string; updateTime?: string; reviewReplyState?: string; policyViolation?: string };
  reviewMediaItems?: { thumbnailUrl?: string; thumbnailLabel?: string; videoUrl?: string }[];
  reviewReplyUrl?: string;
}

interface ReviewsPage {
  reviews: RawReview[];
  averageRating?: number;
  totalReviewCount?: number;
  nextPageToken?: string;
}

export type ReviewOrder = "shuffle" | "api";

export interface GetBusinessReviewsOptions {
  /** Max reviews to return (default: all of them, paginated). Counts usable
   * reviews only -- see `filterMinStars` -- so this is "give me N reviews you
   * can show", not "give me N raw API results". */
  limit?: number;
  /**
   * When set, only reviews at or above this star rating are returned -- for
   * public-facing social proof (e.g. a marketing site's testimonial feed).
   * Omit to return every review including low ratings, for an owner-facing
   * surface where the point is to see and respond to everything.
   */
  filterMinStars?: number;
  /** Cache-hint passed straight through to `fetch`'s Next.js augmentation.
   * A no-op outside Next.js. Default: revalidate hourly. */
  next?: { revalidate?: number; tags?: string[] };
  /**
   * `"shuffle"` (default): randomizes the returned order, applied after
   * `limit`. `"api"`: preserves the Business Profile API's own ordering
   * (`updateTime desc`, most recent first).
   */
  order?: ReviewOrder;
  /**
   * Keep owner replies Google has not approved (`PENDING` or `REJECTED`).
   * Default `false`: a public page shows only replies Google shows, so a
   * rejected reply never appears on the site as if it were live. Set `true`
   * for an owner-facing surface, where `reply.state` and
   * `reply.policyViolation` say what happened.
   */
  includeUnapprovedReplies?: boolean;
  /** Stop after this many pages rather than loop without end. Default 50. */
  maxPages?: number;
  /** Deadline and retry policy for every request this call makes. */
  request?: GbpRequestOptions;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

function parseReview(v: unknown): RawReview | null {
  if (!isRecord(v) || typeof v.reviewId !== "string") return null;
  const reviewer = isRecord(v.reviewer) ? { displayName: str(v.reviewer.displayName), profilePhotoUrl: str(v.reviewer.profilePhotoUrl) } : undefined;
  const reply = isRecord(v.reviewReply)
    ? {
        comment: str(v.reviewReply.comment),
        updateTime: str(v.reviewReply.updateTime),
        reviewReplyState: str(v.reviewReply.reviewReplyState),
        policyViolation: str(v.reviewReply.policyViolation),
      }
    : undefined;
  const media = Array.isArray(v.reviewMediaItems)
    ? v.reviewMediaItems.filter(isRecord).map((m) => ({ thumbnailUrl: str(m.thumbnailUrl), thumbnailLabel: str(m.thumbnailLabel), videoUrl: str(m.videoUrl) }))
    : undefined;
  return {
    reviewId: v.reviewId,
    reviewer,
    starRating: str(v.starRating),
    comment: str(v.comment),
    createTime: str(v.createTime),
    reviewReply: reply,
    reviewMediaItems: media,
    reviewReplyUrl: str(v.reviewReplyUrl),
  };
}

/** Validate a page of the reviews.list response. A malformed review is skipped; a malformed page throws. */
export function parseListReviewsResponse(body: unknown): ReviewsPage {
  if (!isRecord(body)) throw new TypeError("Business Profile reviews response was not an object");
  const reviews = Array.isArray(body.reviews) ? body.reviews.map(parseReview).filter((r): r is RawReview => r !== null) : [];
  const average = typeof body.averageRating === "number" && Number.isFinite(body.averageRating) && body.averageRating >= 0 && body.averageRating <= 5 ? body.averageRating : undefined;
  const total = typeof body.totalReviewCount === "number" && Number.isInteger(body.totalReviewCount) && body.totalReviewCount >= 0 ? body.totalReviewCount : undefined;
  return { reviews, averageRating: average, totalReviewCount: total, nextPageToken: str(body.nextPageToken) || undefined };
}

function toBusinessReview(r: RawReview, includeUnapprovedReplies: boolean): BusinessReview {
  const review: BusinessReview = {
    id: r.reviewId,
    author: r.reviewer?.displayName ?? "Anonymous",
    authorPhoto: r.reviewer?.profilePhotoUrl,
    rating: STAR_VALUES[r.starRating ?? "FIVE"] ?? 5,
    comment: r.comment ?? "",
    createdAt: r.createTime ?? "",
  };
  const reply = r.reviewReply;
  if (reply?.comment) {
    const state = reply.reviewReplyState === "PENDING" || reply.reviewReplyState === "REJECTED" || reply.reviewReplyState === "APPROVED" ? reply.reviewReplyState : undefined;
    if (includeUnapprovedReplies || (state !== "PENDING" && state !== "REJECTED")) {
      review.reply = { text: reply.comment, updatedAt: reply.updateTime ?? "" };
      if (state) review.reply.state = state;
      if (state === "REJECTED" && reply.policyViolation) review.reply.policyViolation = reply.policyViolation;
    }
  }
  const media = (r.reviewMediaItems ?? []).filter((m): m is typeof m & { thumbnailUrl: string } => Boolean(m.thumbnailUrl));
  if (media.length > 0) {
    review.media = media.map((m) => ({
      thumbnailUrl: m.thumbnailUrl,
      ...(m.thumbnailLabel ? { label: m.thumbnailLabel } : {}),
      ...(m.videoUrl ? { videoUrl: m.videoUrl } : {}),
    }));
  }
  if (r.reviewReplyUrl) review.replyUrl = r.reviewReplyUrl;
  return review;
}

/**
 * Fetch reviews for the configured location, paginating through all pages
 * (GBP caps each page at 50). Returns empty results (never throws on missing
 * config) so UI can render unconditionally.
 *
 * Every request has a deadline and retries 429 and transient 5xx a bounded
 * number of times. A 401 means the cached access token is no longer good: it
 * is dropped, refreshed once, and the same page is asked for again. A second
 * 401 throws. Throws `GbpApiError`, `GbpAuthError`, `GbpTimeoutError` or
 * `GbpPaginationError`; catch and degrade in the calling route.
 */
export async function getBusinessReviews(
  options: GetBusinessReviewsOptions = {},
): Promise<BusinessReviewsResult> {
  const { limit, filterMinStars, next, order = "shuffle", includeUnapprovedReplies = false, request } = options;
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  if (!Number.isInteger(maxPages) || maxPages < 1) throw new RangeError(`maxPages must be an integer >= 1, got ${maxPages}`);

  if (!isBusinessProfileConfigured()) return EMPTY;

  const policy = resolvePolicy(request);
  let token = await getGoogleOAuthAccessToken({ request });
  if (!token) return EMPTY;

  const account = process.env.GOOGLE_BUSINESS_ACCOUNT_ID!;
  const location = process.env.GOOGLE_BUSINESS_LOCATION_ID!;

  const raw: RawReview[] = [];
  let averageRating: number | undefined;
  let totalReviewCount: number | undefined;
  let pageToken: string | undefined;
  const seenTokens = new Set<string>();
  let pages = 0;

  const fetchPage = (accessToken: string, endpoint: string) => {
    // Typed as a variable (not inline) so the `next` cache hint -- a Next.js
    // RequestInit augmentation this zero-dependency package doesn't import --
    // doesn't trip excess-property checking against the plain RequestInit
    // fetch() expects.
    const init: NextFetchInit = {
      headers: { Authorization: `Bearer ${accessToken}` },
      next: next ?? { revalidate: 3600, tags: ["google-reviews"] },
    };
    return fetchWithRetry(endpoint, init, "reviews.list", policy);
  };

  for (;;) {
    const endpoint =
      `https://mybusiness.googleapis.com/v4/accounts/${account}` +
      `/locations/${location}/reviews?orderBy=updateTime%20desc&pageSize=${MAX_PAGE_SIZE}` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");

    let attempt = await fetchPage(token, endpoint);
    if (attempt.response.status === 401) {
      invalidateAccessToken(token);
      const fresh = await getGoogleOAuthAccessToken({ forceRefresh: true, request });
      if (!fresh) return EMPTY;
      token = fresh;
      attempt = await fetchPage(token, endpoint);
    }

    const { response, attempts, retryAfterMs } = attempt;
    if (!response.ok) {
      throw new GbpApiError({
        operation: "reviews.list",
        status: response.status,
        retryable: RETRYABLE_STATUSES.has(response.status),
        attempts,
        body: excerpt(await readErrorBody(response)),
        retryAfterMs,
      });
    }

    const data = parseListReviewsResponse(await response.json());
    pages++;
    raw.push(...data.reviews);
    // First page's aggregates win: they describe the whole profile, not the page.
    averageRating ??= data.averageRating;
    totalReviewCount ??= data.totalReviewCount;
    pageToken = data.nextPageToken;

    // Stop once enough *usable* reviews have been seen, not enough raw ones.
    // A page can be mostly ratings with no comment (comment/starRating are
    // both optional on GBP's own schema) or below filterMinStars, in which
    // case stopping on raw.length alone under-fills `limit` even though a
    // later page would have supplied enough.
    const enough = limit !== undefined && raw.filter((r) => isUsableReview(r, filterMinStars)).length >= limit;
    if (!pageToken || enough) break;
    if (seenTokens.has(pageToken)) throw new GbpPaginationError("repeated_token", pages);
    seenTokens.add(pageToken);
    if (pages >= maxPages) throw new GbpPaginationError("page_limit", pages);
  }

  const reviews: BusinessReview[] = raw
    .filter((r) => isUsableReview(r, filterMinStars))
    .map((r) => toBusinessReview(r, includeUnapprovedReplies))
    .slice(0, limit);

  return {
    averageRating: averageRating ?? null,
    totalReviewCount: totalReviewCount ?? null,
    reviews: order === "api" ? reviews : shuffleArray(reviews),
  };
}
