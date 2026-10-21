import { describe, expect, it } from "vitest";
import { buildBriefing } from "../build";
import { GLOSSARY, searchSentence, speedWords, uptimeHeadline } from "../glossary";
import { lintText } from "../lint";
import type { ClientConfig, RawInput } from "../types";
import client01 from "./fixtures/all-clients/client-01.json";
import client02 from "./fixtures/all-clients/client-02.json";
import client03 from "./fixtures/all-clients/client-03.json";
import client04 from "./fixtures/all-clients/client-04.json";
import client05 from "./fixtures/all-clients/client-05.json";
import client06 from "./fixtures/all-clients/client-06.json";
import client07 from "./fixtures/all-clients/client-07.json";

const day = (iso: string) => iso.slice(8, 10).replace(/^0/, "") + " Oct";

describe("glossary", () => {
  it("every entry has a label and a meaning, and the meaning is a sentence", () => {
    for (const [key, entry] of Object.entries(GLOSSARY)) {
      expect(entry.label, key).not.toBe("");
      expect(entry.meaning.endsWith("."), key).toBe(true);
    }
  });

  it("passes the copy gate", () => {
    for (const [key, entry] of Object.entries(GLOSSARY)) {
      expect(lintText(entry.label, `${key}.label`), key).toEqual([]);
      expect(lintText(entry.meaning, `${key}.meaning`), key).toEqual([]);
    }
  });

  it("never claims the site was up the whole time", () => {
    expect(uptimeHeadline({ failed: 0, failures: [] }, day)).toBe("Every check found your site working");
  });

  it("names the day and length of one outage", () => {
    expect(uptimeHeadline({ failed: 5, failures: [{ startedAt: "2026-10-04T10:00:00Z", minutes: 25 }] }, day)).toBe("Your site was down for 25 minutes on 4 Oct");
  });

  it("totals several outages", () => {
    const failures = [{ startedAt: "2026-10-04T10:00:00Z", minutes: 25 }, { startedAt: "2026-10-06T10:00:00Z", minutes: 15 }];
    expect(uptimeHeadline({ failed: 8, failures }, day)).toBe("Your site was down 2 times, 40 minutes in all");
  });

  it("says what each speed band means for a visitor", () => {
    expect(speedWords("fast").headline).toBe("Fast");
    expect(speedWords("middle").headline).toBe("Middling");
    expect(speedWords("slow").headline).toBe("Slow");
  });

  it("writes the search numbers as a sentence", () => {
    expect(searchSentence(1, 241779)).toBe("Your site showed up in Google 241,779 times, and people clicked through 1 time.");
  });

  it.each(["closing three serious security vulnerabilities", "your site now counts page views", "without cookies", "the privacy page names it", "we added analytics"])("flags jargon a client will not know: %s", (text) => {
    expect(lintText(text, "changes[0].outcome").map((f) => f.rule)).toContain("jargon");
  });

  it("explains the replacement in the finding", () => {
    expect(lintText("We added analytics.", "note")[0]!.message).toContain("how many people visit");
  });

  it("lets a client config allow a term the client uses", () => {
    expect(lintText("We added analytics.", "note", { allowedTerms: ["analytics"] })).toEqual([]);
  });

  it("flags the bare words a client asked about", () => {
    expect(lintText("Availability this fortnight was good.", "note").map((f) => f.rule)).toContain("jargon");
  });
});

const clients = [client01, client02, client03, client04, client05, client06, client07];
describe.each(clients)("$config.slug: no tile is a bare number", (source) => {
  it("carries a headline and a meaning line on every health tile", () => {
    const f = structuredClone(source) as unknown as { input: RawInput; config: ClientConfig };
    const { health } = buildBriefing(f.input, f.config).briefing;
    expect(health.uptime.headline).not.toBe("");
    expect(health.uptime.meaning).toBe(GLOSSARY.uptime.meaning);
    if (health.speed) {
      expect(health.speed.headline).not.toBe("");
      expect(health.speed.meaning).toContain(GLOSSARY.speed.meaning);
    }
    if (health.search.state === "numbers") {
      expect(health.search.line).not.toBe("");
      expect(health.search.meaning).toBe(GLOSSARY.search.meaning);
    }
  });
});
