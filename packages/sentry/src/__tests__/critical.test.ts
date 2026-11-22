import { describe, expect, it } from "vitest";
import { type CriticalCaptureContext, type CspViolation, blockedOrigin, criticalContext, criticalReporter, watchCriticalCsp } from "../critical";

function recorder() {
  const calls: { error: unknown; ctx: CriticalCaptureContext }[] = [];
  return { calls, capture: (error: unknown, ctx: CriticalCaptureContext) => calls.push({ error, ctx }) };
}

function fakeDocument() {
  let listener: ((e: CspViolation) => void) | null = null;
  return {
    addEventListener: (_: "securitypolicyviolation", l: (e: CspViolation) => void) => (listener = l),
    removeEventListener: () => (listener = null),
    fire: (e: CspViolation) => listener?.(e),
    get watching() {
      return listener !== null;
    },
  };
}

const BANK_BLOCK: CspViolation = {
  effectiveDirective: "form-action",
  blockedURI: "https://3dsecure.examplebank.com/acs/challenge?session=abc123",
  sourceFile: "https://web.squarecdn.com/v1/square.js",
  disposition: "enforce",
};

describe("criticalContext", () => {
  it("is fatal, tagged and grouped by path and stage", () => {
    expect(criticalContext("checkout", "tokenize", { status: "Invalid" })).toEqual({
      level: "fatal",
      tags: { critical_path: "checkout", critical_stage: "tokenize" },
      fingerprint: ["critical", "checkout", "tokenize"],
      extra: { status: "Invalid", critical_path: "checkout", critical_stage: "tokenize" },
    });
  });

  it("refuses a name the alert could not match", () => {
    expect(() => criticalContext("Checkout", "x")).toThrow(/lower case/);
    expect(() => criticalContext("checkout", "card load")).toThrow(/lower case/);
  });
});

describe("criticalReporter", () => {
  it("hands the site's captureException the error and the context", () => {
    const r = recorder();
    criticalReporter(r.capture).criticalFailure("booking", "confirm", new Error("502 from Square"));
    expect(r.calls).toHaveLength(1);
    expect((r.calls[0]?.error as Error).message).toBe("502 from Square");
    expect(r.calls[0]?.ctx.level).toBe("fatal");
  });

  it("wraps a thrown non-Error so the issue still has a title", () => {
    const r = recorder();
    criticalReporter(r.capture).criticalFailure("checkout", "card-load", "timeout");
    expect((r.calls[0]?.error as Error).message).toBe("checkout failed at card-load: timeout");
  });

  it("never throws into the checkout, even with a broken SDK or a bad name", () => {
    const reporter = criticalReporter(() => {
      throw new Error("SDK not loaded");
    });
    expect(() => reporter.criticalFailure("checkout", "confirm", new Error("x"))).not.toThrow();
    expect(() => criticalReporter(recorder().capture).criticalFailure("Bad Path", "x", new Error("x"))).not.toThrow();
  });
});

describe("watchCriticalCsp", () => {
  it("ignores a block before the critical step starts (a tag blocked on page load)", () => {
    const r = recorder();
    const doc = fakeDocument();
    watchCriticalCsp(doc, criticalReporter(r.capture));
    doc.fire(BANK_BLOCK);
    expect(r.calls).toEqual([]);
  });

  it("reports the bank's 3-D Secure form being blocked while the card step is open, once, without the URL's path", () => {
    const r = recorder();
    const doc = fakeDocument();
    const reporter = criticalReporter(r.capture);
    const fallbacks: string[] = [];
    watchCriticalCsp(doc, reporter, { onBlocked: (_, at) => fallbacks.push(at.stage) });
    reporter.enter("checkout", "card");
    doc.fire(BANK_BLOCK);
    doc.fire(BANK_BLOCK);
    expect(r.calls).toHaveLength(1);
    expect((r.calls[0]?.error as Error).message).toBe("CSP blocked form-action https://3dsecure.examplebank.com during card");
    expect(r.calls[0]?.ctx.tags).toEqual({ critical_path: "checkout", critical_stage: "csp" });
    expect(r.calls[0]?.ctx.extra).toMatchObject({ directive: "form-action", blocked: "https://3dsecure.examplebank.com", source: "https://web.squarecdn.com", during: "card" });
    expect(JSON.stringify(r.calls[0]?.ctx)).not.toContain("session=abc123");
    expect(fallbacks).toEqual(["card"]);
  });

  it("ignores report-only violations, ignored directives, and anything after leave()", () => {
    const r = recorder();
    const doc = fakeDocument();
    const reporter = criticalReporter(r.capture);
    watchCriticalCsp(doc, reporter, { ignoreDirectives: ["img-src"] });
    reporter.enter("checkout", "card");
    doc.fire({ ...BANK_BLOCK, disposition: "report" });
    doc.fire({ ...BANK_BLOCK, effectiveDirective: "img-src" });
    reporter.leave();
    doc.fire(BANK_BLOCK);
    expect(r.calls).toEqual([]);
  });

  it("stops watching when asked", () => {
    const doc = fakeDocument();
    const stop = watchCriticalCsp(doc, criticalReporter(recorder().capture));
    expect(doc.watching).toBe(true);
    stop();
    expect(doc.watching).toBe(false);
  });
});

describe("blockedOrigin", () => {
  it("keeps the origin only", () => {
    expect(blockedOrigin("https://a.example.com/x?y=1")).toBe("https://a.example.com");
    expect(blockedOrigin("inline")).toBe("inline");
    expect(blockedOrigin("data:image/png;base64,xx")).toBe("data");
    expect(blockedOrigin(undefined)).toBe("unknown");
  });
});
