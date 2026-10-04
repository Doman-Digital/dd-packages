/**
 * The photo-review gate: reads the report `halide review --json` wrote and
 * fails a build whose photography is under the bar.
 *
 * It takes the report's text, not a path, and never runs halide. A check that
 * spawns a binary cannot run where the binary is absent (a CI image, a fresh
 * clone), turns a fast check slow, and depends on a tool version nobody
 * pinned. The pipeline writes the report; the build reads it and hands it here.
 *
 * Folded in from dd-drift-guards (guards/photo-review.mjs) on 3 October 2026,
 * unchanged in what it passes and fails. Pure.
 */

export interface PhotoReviewOptions {
  /** Lowest acceptable score, overall and per image. Default 0.7. */
  minScore?: number;
  /**
   * When false, no report is a pass: for a site with no photography at all.
   * Default true, because a missing report on a site that has photos is the
   * review not having run.
   */
  required?: boolean;
}

export interface PhotoReviewResult {
  ok: boolean;
  failures: string[];
  /** One line per thing checked, passed or not. */
  report: string[];
}

interface ReviewImage {
  file?: string;
  id?: string;
  score?: unknown;
}

/** `text` is the report's contents, or null when there is no report. */
export function checkPhotoReview(text: string | null, options: PhotoReviewOptions = {}): PhotoReviewResult {
  const minScore = options.minScore ?? 0.7;
  const required = options.required ?? true;
  const failures: string[] = [];
  const report: string[] = [];
  const add = (ok: boolean, message: string): void => {
    report.push(`${ok ? "ok  " : "FAIL"}  ${message}`);
    if (!ok) failures.push(message);
  };
  const done = (): PhotoReviewResult => ({ ok: failures.length === 0, failures, report });

  if (text === null) {
    if (required) add(false, "no photo review: run `halide review --json`");
    else report.push("ok    no photo review, and none required");
    return done();
  }

  let parsed: { score?: unknown; images?: unknown };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch (error) {
    // A truncated write must fail, not read as "no report": on a site with
    // photos that would pass the build with nothing checked.
    add(false, `the photo review is not valid JSON: ${(error as Error).message}`);
    return done();
  }

  const images = (Array.isArray(parsed.images) ? parsed.images : []) as ReviewImage[];
  const overall = typeof parsed.score === "number" ? parsed.score : null;
  if (overall === null && images.length === 0) {
    add(false, "the photo review has neither a score nor an images list");
    return done();
  }
  if (overall !== null) add(overall >= minScore, `overall score ${overall.toFixed(2)} against a minimum of ${minScore.toFixed(2)}`);

  // Per image as well: one weak photo can hide under a good average.
  const below = images.filter((i): i is ReviewImage & { score: number } => typeof i.score === "number" && i.score < minScore);
  if (below.length > 0) {
    const named = below
      .slice(0, 5)
      .map((i) => `${i.file ?? i.id ?? "?"} (${i.score.toFixed(2)})`)
      .join(", ");
    add(false, `${below.length} of ${images.length} image(s) below ${minScore.toFixed(2)}: ${named}`);
  } else if (images.length > 0) {
    add(true, `all ${images.length} image(s) at or above ${minScore.toFixed(2)}`);
  }
  return done();
}
