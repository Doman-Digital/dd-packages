/**
 * Dates in Europe/London, and dates as they appear in client copy.
 *
 * Everything a client reads is in UK time, and Cloudflare cron runs in UTC, so
 * calendar days are always worked out in Europe/London, never from a UTC
 * timestamp's date part. Intl only: it runs the same in Node and workerd.
 */

export const TIME_ZONE = "Europe/London";

export const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
] as const;
const MONTH_NAMES = MONTHS.map((m) => m[0]!.toUpperCase() + m.slice(1));
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const londonParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function partsOf(instant: Date): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of londonParts.formatToParts(instant)) if (p.type !== "literal") out[p.type] = Number(p.value);
  return out;
}

/** London's offset from UTC at an instant, in minutes (60 in summer, 0 in winter). */
export function londonOffsetMinutes(instant: Date): number {
  const p = partsOf(instant);
  const asUtc = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
}

function ymd(date: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!m) throw new Error(`Not a YYYY-MM-DD date: ${date}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** The instant a London calendar day starts. */
export function londonMidnight(date: string): Date {
  const [y, m, d] = ymd(date);
  const guess = Date.UTC(y, m - 1, d);
  const first = guess - londonOffsetMinutes(new Date(guess)) * 60000;
  // Re-check at the corrected instant: the offset can differ either side of a clock change.
  return new Date(guess - londonOffsetMinutes(new Date(first)) * 60000);
}

/** The London calendar date of an instant, as YYYY-MM-DD. */
export function londonDate(instant: Date | string): string {
  const p = partsOf(typeof instant === "string" ? new Date(instant) : instant);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** The YYYY-MM-DD date after this one. */
export function nextDay(date: string): string {
  const [y, m, d] = ymd(date);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** Whole calendar days from `from` to `to`, both YYYY-MM-DD. */
export function daysBetween(from: string, to: string): number {
  const [a, b] = [ymd(from), ymd(to)];
  return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000);
}

/** Adds calendar months, clamping to the end of a shorter month. */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = ymd(date);
  const last = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + months, Math.min(d, last))).toISOString().slice(0, 10);
}

/** "Wednesday 13 January". */
export function formatLong(date: string): string {
  const [y, m, d] = ymd(date);
  return `${DAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTH_NAMES[m - 1]}`;
}

/** "27 September". */
export function formatShort(date: string): string {
  const [, m, d] = ymd(date);
  return `${d} ${MONTH_NAMES[m - 1]}`;
}

/** A date as written in copy. A month alone ("in January") has no day. */
export type DateMention = { text: string; index: number; month: number; day?: number; year?: number };

const MONTH_RE = "(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)";
const WEEKDAY_RE = "(?:(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\\s+)?";
const DAY_MONTH = new RegExp(`\\b${WEEKDAY_RE}(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\b(?:,?\\s+(\\d{4}))?`, "gi");
const MONTH_DAY = new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?`, "gi");
const ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
const MONTH_ALONE = new RegExp(`\\b(?:in|for|by|from|until|till|during|early|mid|late|next|this)\\s+${MONTH_RE}\\b(?!\\s+\\d)`, "gi");

function monthNumber(name: string): number {
  const n = name.toLowerCase();
  const i = MONTHS.findIndex((m) => m.startsWith(n.slice(0, 3)));
  return i + 1;
}

/** Every date mentioned in a piece of copy, in order. */
export function findDates(text: string): DateMention[] {
  const found: DateMention[] = [];
  const taken: [number, number][] = [];
  const add = (m: RegExpExecArray, mention: Omit<DateMention, "text" | "index">) => {
    const start = m.index;
    const end = start + m[0].length;
    if (taken.some(([s, e]) => start < e && end > s)) return;
    taken.push([start, end]);
    found.push({ text: m[0], index: start, ...mention });
  };
  for (const m of text.matchAll(ISO)) add(m, { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) });
  for (const m of text.matchAll(DAY_MONTH)) {
    add(m, { day: Number(m[1]), month: monthNumber(m[2]!), ...(m[3] ? { year: Number(m[3]) } : {}) });
  }
  for (const m of text.matchAll(MONTH_DAY)) {
    add(m, { month: monthNumber(m[1]!), day: Number(m[2]), ...(m[3] ? { year: Number(m[3]) } : {}) });
  }
  for (const m of text.matchAll(MONTH_ALONE)) add(m, { month: monthNumber(m[1]!) });
  return found.sort((a, b) => a.index - b.index);
}

/** Two mentions name the same day, as far as the copy says. A month alone agrees with any day in it. */
export function sameDate(a: Omit<DateMention, "text" | "index">, b: Omit<DateMention, "text" | "index">): boolean {
  if (a.month !== b.month) return false;
  if (a.day !== undefined && b.day !== undefined && a.day !== b.day) return false;
  if (a.year !== undefined && b.year !== undefined && a.year !== b.year) return false;
  return true;
}

/** A YYYY-MM-DD date as a mention, for comparing config dates with copy. */
export function mentionOf(date: string): Omit<DateMention, "text" | "index"> {
  const [year, month, day] = ymd(date);
  return { year, month, day };
}
