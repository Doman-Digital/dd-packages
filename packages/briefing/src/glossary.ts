/**
 * What each number in a briefing means, in the client's words. One source for
 * the relay render and the hand-built set, so a tile cannot show a bare number.
 * Every health tile carries a question, an answer in words and a meaning line;
 * the figure is supporting detail.
 */

import type { Speed, Uptime } from "./types";

export type GlossaryEntry = {
  /** What the tile asks, in the client's words. */
  label: string;
  /** One sentence on what is being counted. */
  meaning: string;
};

export const GLOSSARY = {
  uptime: {
    label: "Was your site working?",
    meaning: "Every 5 minutes we open your site to check it loads. This counts how many of those checks found it working.",
  },
  speed: {
    label: "How fast it opens on a phone",
    meaning: "We open your site on a phone-sized test five times and take the middle result. 90 and above is fast, 50 to 89 is middling, under 50 is slow.",
  },
  search: {
    label: "Found on Google",
    meaning: "How many times your site showed up when people searched, and how many of them clicked through to it.",
  },
  visits: {
    label: "Visits to your site",
    meaning: "How many separate times someone came to your site.",
  },
} as const satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;

const SPEED_WORDS: Record<Speed["band"], { headline: string; sentence: string }> = {
  fast: { headline: "Fast", sentence: "Your pages open quickly for people on a phone." },
  middle: { headline: "Middling", sentence: "Your pages open in a reasonable time. There is room to make them quicker." },
  slow: { headline: "Slow", sentence: "Your pages take a while to open for people on a phone." },
};

/** The answer to "How fast it opens on a phone", in a word and a sentence. */
export function speedWords(band: Speed["band"]): { headline: string; sentence: string } {
  return SPEED_WORDS[band];
}

/**
 * The answer to "Was your site working?". It never claims the site was up the
 * whole time: five-minute checks cannot show that, only what they found.
 */
export function uptimeHeadline(u: Pick<Uptime, "failed" | "failures">, formatDay: (iso: string) => string): string {
  if (u.failed === 0) return "Every check found your site working";
  if (u.failures.length === 1) {
    const f = u.failures[0]!;
    return `Your site was down for ${f.minutes} ${f.minutes === 1 ? "minute" : "minutes"} on ${formatDay(f.startedAt)}`;
  }
  const minutes = u.failures.reduce((sum, f) => sum + f.minutes, 0);
  return `Your site was down ${u.failures.length} times, ${minutes} ${minutes === 1 ? "minute" : "minutes"} in all`;
}

/** Search tile, numbers state: the sentence that replaces "N clicks from N appearances". */
export function searchSentence(clicks: number, impressions: number): string {
  const n = (x: number) => x.toLocaleString("en-GB");
  return `Your site showed up in Google ${n(impressions)} times, and people clicked through ${n(clicks)} ${clicks === 1 ? "time" : "times"}.`;
}
