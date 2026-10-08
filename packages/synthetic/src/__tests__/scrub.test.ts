import { describe, expect, it } from "vitest";
import { REDACTED, scrubHeaders, scrubSentryEvent, scrubText } from "../index";

describe("scrubHeaders", () => {
  it("redacts X-DD-Synth* in Headers, records and tuples, and keeps the rest", () => {
    const h = new Headers({ "X-DD-Synth": "v1", "x-dd-synth-sig": "v1=abc", "content-type": "application/json" });
    const out = scrubHeaders(h);
    expect(out.get("x-dd-synth")).toBe(REDACTED);
    expect(out.get("X-DD-Synth-Sig")).toBe(REDACTED);
    expect(out.get("content-type")).toBe("application/json");
    expect(h.get("x-dd-synth-sig")).toBe("v1=abc");

    expect(scrubHeaders({ "X-DD-Synth-Run": "abc", Host: "a.com" })).toEqual({ "X-DD-Synth-Run": REDACTED, Host: "a.com" });
    expect(scrubHeaders([["X-DD-Synth-Kid", "k"], ["accept", "*/*"]])).toEqual([["X-DD-Synth-Kid", REDACTED], ["accept", "*/*"]]);
  });
});

describe("scrubText", () => {
  it("redacts header lines, JSON and query strings", () => {
    expect(scrubText("x-dd-synth-sig: v1=deadbeef")).toBe(`x-dd-synth-sig: ${REDACTED}`);
    expect(scrubText('{"X-DD-Synth-Run":"abcdefghijklmnop","a":1}')).toBe(`{"X-DD-Synth-Run":"${REDACTED}","a":1}`);
    expect(scrubText("a=1&x-dd-synth-kid=k1&b=2")).toBe(`a=1&x-dd-synth-kid=${REDACTED}&b=2`);
    expect(scrubText("nothing to see")).toBe("nothing to see");
  });
});

describe("scrubSentryEvent", () => {
  it("removes the headers from request, breadcrumbs, extra and message, without mutating the event", () => {
    const event = {
      message: "failed with X-DD-Synth-Sig: v1=abc123",
      request: { url: "https://a.com/api", headers: { "X-DD-Synth-Sig": "v1=abc123", "User-Agent": "dd-checks" } },
      breadcrumbs: [{ data: { headers: [["x-dd-synth-run", "abcdefghijklmnop"]] } }],
      extra: { "X-DD-Synth-Kid": "k" },
    };
    const snapshot = JSON.stringify(event);
    const out = scrubSentryEvent(event);
    expect(JSON.stringify(out)).not.toMatch(/abc123|abcdefghijklmnop|"k"/);
    expect(out.request.headers["User-Agent"]).toBe("dd-checks");
    expect(out.request.url).toBe("https://a.com/api");
    expect(JSON.stringify(event)).toBe(snapshot);
  });

  it("does not throw on cycles, and lets nothing through at the depth limit", () => {
    const event: Record<string, unknown> = { request: { headers: { "X-DD-Synth-Sig": "s3cret" } } };
    event.self = event;
    const out = scrubSentryEvent(event);
    expect(JSON.stringify(out)).not.toContain("s3cret");
  });
});
