import { describe, expect, it } from "vitest";
import { addMonths, daysBetween, findDates, formatLong, formatShort, londonDate, londonMidnight, londonOffsetMinutes, nextDay, sameDate } from "../dates";

describe("Europe/London", () => {
  it("knows the offset either side of the clock change", () => {
    expect(londonOffsetMinutes(new Date("2026-10-10T12:00:00Z"))).toBe(60);
    expect(londonOffsetMinutes(new Date("2026-11-10T12:00:00Z"))).toBe(0);
  });

  it("starts a London day at the right instant", () => {
    expect(londonMidnight("2026-09-27").toISOString()).toBe("2026-09-26T23:00:00.000Z");
    expect(londonMidnight("2027-01-13").toISOString()).toBe("2027-01-13T00:00:00.000Z");
    // 25 October 2026: the clocks go back at 02:00 BST, after midnight.
    expect(londonMidnight("2026-10-25").toISOString()).toBe("2026-10-24T23:00:00.000Z");
    expect(londonMidnight("2026-10-26").toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });

  it("gives the London calendar date of an instant, not the UTC one", () => {
    expect(londonDate("2026-10-07T23:30:00Z")).toBe("2026-10-08");
    expect(londonDate("2027-01-03T23:30:00Z")).toBe("2027-01-03");
  });

  it("does calendar arithmetic", () => {
    expect(nextDay("2026-09-30")).toBe("2026-10-01");
    expect(daysBetween("2026-10-11", "2027-01-13")).toBe(94);
    expect(addMonths("2026-09-27", 1)).toBe("2026-10-27");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-09-27", 12)).toBe("2027-09-27");
  });

  it("formats dates the way the copy writes them", () => {
    expect(formatLong("2027-01-13")).toBe("Wednesday 13 January");
    expect(formatShort("2026-09-27")).toBe("27 September");
  });
});

describe("dates in copy", () => {
  it("finds day-month, month-day, ISO and month-alone dates", () => {
    const found = findDates("Moved from 18 November to Wednesday 13 January 2027, then 2027-01-20, or March 4th, or in February.");
    expect(found.map((d) => [d.day, d.month, d.year])).toEqual([
      [18, 11, undefined],
      [13, 1, 2027],
      [20, 1, 2027],
      [4, 3, undefined],
      [undefined, 2, undefined],
    ]);
  });

  it("ignores a month name that is not a date", () => {
    expect(findDates("May we suggest a new photo?")).toEqual([]);
  });

  it("a month alone agrees with any day in it; different days or years do not", () => {
    const [jan] = findDates("the launch in January");
    const [jan13] = findDates("13 January 2027");
    const [jan20] = findDates("20 January");
    expect(sameDate(jan!, jan13!)).toBe(true);
    expect(sameDate(jan13!, jan20!)).toBe(false);
    expect(sameDate({ month: 1, day: 13, year: 2027 }, { month: 1, day: 13, year: 2028 })).toBe(false);
  });
});
