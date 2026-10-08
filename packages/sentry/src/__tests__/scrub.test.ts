import { describe, expect, it } from "vitest";
import { REDACTED, scrubEvent, scrubString } from "../index";

describe("scrubString", () => {
  it("redacts every email, bearer token and UK phone number", () => {
    expect(scrubString("from a@b.co.uk and c.d@e.com")).toBe("from [REDACTED_EMAIL] and [REDACTED_EMAIL]");
    expect(scrubString("Authorization: Bearer abc.def-123")).toBe("Authorization: Bearer [REDACTED_TOKEN]");
    expect(scrubString("call 07700 900123 or +44 7700 900456")).toBe("call [REDACTED_PHONE] or [REDACTED_PHONE]");
    expect(scrubString("landline 020-7946-0018")).toBe("landline [REDACTED_PHONE]");
  });

  it("leaves dates, timings, ids and versions alone", () => {
    for (const text of ["2026-10-08 12:00:00", "took 1234567 ms", "order 48213", "v1.20.3", "trace 4bf92f3577b34da6a3ce929d0e0e4736"]) {
      expect(scrubString(text)).toBe(text);
    }
  });
});

describe("scrubEvent", () => {
  const event = {
    event_id: "e1",
    message: "Booking failed for jo@example.com",
    request: {
      url: "https://site.example/book?email=jo@example.com",
      headers: { Cookie: "s=1", "X-DD-Synth-Sig": "v1=abc", "User-Agent": "UA" },
      cookies: { s: "1" },
      data: { name: "Jo", phone: "07700 900123", notes: "ring 07700900123" },
      query_string: "email=jo@example.com&x=1",
    },
    user: { id: "u1", email: "jo@example.com", ip_address: "1.2.3.4" },
    extra: { apiKey: "k", token: "t", count: 3 },
    tags: { route: "/book" },
    contexts: { form: { sessionId: "s", step: 2 } },
    exception: {
      values: [{ type: "Error", value: "Send to jo@example.com failed", stacktrace: { frames: [{ filename: "app.js", lineno: 1 }] } }],
    },
    breadcrumbs: [{ category: "fetch", message: "POST for jo@example.com", data: { url: "/api", authorization: "Bearer x" } }],
  };

  it("redacts the customer's details everywhere they turned up in the audit", () => {
    const out = scrubEvent(event);
    expect(out.message).toBe("Booking failed for [REDACTED_EMAIL]");
    expect(out.request.url).toBe("https://site.example/book?email=[REDACTED_EMAIL]");
    expect(out.request.headers).toEqual({ Cookie: REDACTED, "X-DD-Synth-Sig": "[redacted]", "User-Agent": "UA" });
    expect(out.request.cookies).toBe(REDACTED);
    expect(out.request.data).toEqual({ name: "Jo", phone: REDACTED, notes: "ring [REDACTED_PHONE]" });
    expect(out.request.query_string).toBe("email=[REDACTED_EMAIL]&x=1");
    expect(out.user).toEqual({ id: "u1", email: REDACTED, ip_address: "1.2.3.4" });
    expect(out.extra).toEqual({ apiKey: REDACTED, token: REDACTED, count: 3 });
    expect(out.contexts).toEqual({ form: { sessionId: REDACTED, step: 2 } });
    expect(out.exception.values[0]?.value).toBe("Send to [REDACTED_EMAIL] failed");
    expect(out.exception.values[0]?.stacktrace).toEqual(event.exception.values[0]?.stacktrace);
    expect(out.breadcrumbs[0]).toEqual({ category: "fetch", message: "POST for [REDACTED_EMAIL]", data: { url: "/api", authorization: REDACTED } });
  });

  it("strips X-DD-Synth headers wherever they appear", () => {
    const out = scrubEvent({ extra: { dump: "x-dd-synth-run: abcdef123456" }, breadcrumbs: [{ data: { headers: [["X-DD-Synth-Kid", "k1"]] } }] });
    expect(out.extra.dump).toBe("x-dd-synth-run: [redacted]");
    expect(out.breadcrumbs[0]?.data.headers).toEqual([["X-DD-Synth-Kid", "[redacted]"]]);
  });

  it("does not mutate the event or add parts it did not have", () => {
    const before = JSON.stringify(event);
    scrubEvent(event);
    expect(JSON.stringify(event)).toBe(before);
    expect(scrubEvent({ event_id: "e2" })).toEqual({ event_id: "e2" });
  });

  it("survives a cycle", () => {
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;
    expect(() => scrubEvent({ extra: cyclic })).not.toThrow();
  });
});
