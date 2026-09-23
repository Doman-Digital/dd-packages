import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { wordListsJson } from "../character/check.js";

const WORD_LISTS = readFileSync(fileURLToPath(new URL("../../word-lists.json", import.meta.url)), "utf8");

describe("word-lists.json is bound to the copy tells", () => {
  it("carries the generated document, unedited", () => {
    expect(WORD_LISTS, "run `pnpm --filter @domandigital/craft run docs`").toBe(wordListsJson());
  });

  it("parses as JSON with every list present", () => {
    const data = JSON.parse(WORD_LISTS);
    for (const key of [
      "aiWords",
      "stockPhrases",
      "aiPhrases",
      "plainerWords",
      "buzzwords",
      "negativeReassurance",
      "vagueWords",
      "reviewPhrases",
    ]) {
      expect(Array.isArray(data.lists[key]), key).toBe(true);
      expect(data.lists[key].length, key).toBeGreaterThan(0);
    }
  });
});
