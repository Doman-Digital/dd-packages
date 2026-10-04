import { describe, expect, it } from "vitest";
import { checkPhotoReview } from "../photo/review.js";

// The fixtures dd-drift-guards shipped with its photo-review guard.
const PASS = JSON.stringify({ score: 0.86, images: [{ file: "hero.jpg", score: 0.91 }, { file: "team-02.jpg", score: 0.78 }] });
const ONE_WEAK = JSON.stringify({ score: 0.74, images: [{ file: "hero.jpg", score: 0.91 }, { file: "team-02.jpg", score: 0.41 }] });
const TRUNCATED = '{ "score": 0.86, "images": [';

describe("checkPhotoReview", () => {
  it("passes a review where every image clears the bar", () => {
    expect(checkPhotoReview(PASS)).toMatchObject({ ok: true, failures: [] });
  });

  it("fails one weak image hiding under a passing average", () => {
    const r = checkPhotoReview(ONE_WEAK);
    expect(r.ok).toBe(false);
    expect(r.failures).toEqual(["1 of 2 image(s) below 0.70: team-02.jpg (0.41)"]);
  });

  it("fails a truncated report instead of reading it as no report", () => {
    expect(checkPhotoReview(TRUNCATED).failures[0]).toMatch(/not valid JSON/);
  });

  it("fails a missing report unless photography is not required", () => {
    expect(checkPhotoReview(null).ok).toBe(false);
    expect(checkPhotoReview(null, { required: false }).ok).toBe(true);
  });

  it("fails a report with nothing in it, and honours a stricter bar", () => {
    expect(checkPhotoReview("{}").ok).toBe(false);
    expect(checkPhotoReview(PASS, { minScore: 0.8 }).failures).toEqual(["1 of 2 image(s) below 0.80: team-02.jpg (0.78)"]);
  });
});
