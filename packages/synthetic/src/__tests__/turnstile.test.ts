import { describe, expect, it, vi } from "vitest";
import { SITEVERIFY_URL, isProductionHost, isTurnstileTestKey, normaliseHostname, turnstileConfigCheck } from "../index";

const REAL_SITE = "0x4AAAAAAABkMYinukE8nzYS";
const REAL_SECRET = "0x4AAAAAAABkMYinukE8nzYSsecretvalue000";
const TEST_SITE = "1x00000000000000000000AA";
const TEST_SECRET = "1x0000000000000000000000000000000AA";

const siteverify = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body)));
const base = {
  siteKey: REAL_SITE,
  secretKey: REAL_SECRET,
  expectedHostname: "www.example.co.uk",
  publicHost: "www.example.co.uk",
};

describe("turnstileConfigCheck outcomes", () => {
  it("ok: good secret, dummy token refused with invalid-input-response", async () => {
    const fetchMock = siteverify({ success: false, "error-codes": ["invalid-input-response"] });
    const result = await turnstileConfigCheck({ ...base, fetch: fetchMock as unknown as typeof fetch });
    expect(result).toMatchObject({ ok: true, outcome: "ok" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(SITEVERIFY_URL);
    const sent = new URLSearchParams(init.body as string);
    expect(sent.get("secret")).toBe(REAL_SECRET);
    expect(sent.get("response")).toBeTruthy();
  });

  it("missing_keys: each of the three values", async () => {
    const never = vi.fn();
    for (const patch of [{ siteKey: undefined }, { secretKey: "" }, { expectedHostname: undefined }]) {
      expect(await turnstileConfigCheck({ ...base, ...patch, fetch: never as unknown as typeof fetch })).toEqual({ ok: false, outcome: "missing_keys" });
    }
    expect(never).not.toHaveBeenCalled();
  });

  it("hostname_mismatch: the Sensphere failure, caught before any network call", async () => {
    const never = vi.fn();
    const result = await turnstileConfigCheck({ ...base, expectedHostname: "sensphere.co.uk", publicHost: "www.sensphere.co.uk", fetch: never as unknown as typeof fetch });
    expect(result).toEqual({ ok: false, outcome: "hostname_mismatch" });
    expect(never).not.toHaveBeenCalled();
  });

  it("hostname is normalised: scheme, case, port, path and trailing dot do not matter", async () => {
    const fetchMock = siteverify({ success: false, "error-codes": ["invalid-input-response"] });
    const result = await turnstileConfigCheck({ ...base, expectedHostname: "HTTPS://WWW.Example.co.uk.:443/contact", fetch: fetchMock as unknown as typeof fetch });
    expect(result.outcome).toBe("ok");
  });

  it("test_key_on_production: either key, and no network call", async () => {
    const never = vi.fn();
    for (const patch of [{ siteKey: TEST_SITE }, { secretKey: TEST_SECRET }]) {
      expect(await turnstileConfigCheck({ ...base, ...patch, fetch: never as unknown as typeof fetch })).toEqual({ ok: false, outcome: "test_key_on_production" });
    }
    expect(never).not.toHaveBeenCalled();
  });

  it("test keys are fine on staging, where the always-pass secret answers success", async () => {
    const result = await turnstileConfigCheck({
      siteKey: TEST_SITE,
      secretKey: TEST_SECRET,
      expectedHostname: "staging.example.co.uk",
      publicHost: "staging.example.co.uk",
      fetch: siteverify({ success: true, "error-codes": [] }) as unknown as typeof fetch,
    });
    expect(result).toMatchObject({ ok: true, outcome: "ok" });
  });

  it("invalid-input-secret: the secret is wrong", async () => {
    const result = await turnstileConfigCheck({ ...base, fetch: siteverify({ success: false, "error-codes": ["invalid-input-secret"] }) as unknown as typeof fetch });
    expect(result).toMatchObject({ ok: false, outcome: "invalid-input-secret", errorCodes: ["invalid-input-secret"] });
  });

  it("invalid-input-secret wins when both codes are present", async () => {
    const result = await turnstileConfigCheck({ ...base, fetch: siteverify({ success: false, "error-codes": ["invalid-input-response", "invalid-input-secret"] }) as unknown as typeof fetch });
    expect(result.outcome).toBe("invalid-input-secret");
  });

  it("siteverify_unexpected: success on production, or an unknown code", async () => {
    expect((await turnstileConfigCheck({ ...base, fetch: siteverify({ success: true }) as unknown as typeof fetch })).outcome).toBe("siteverify_unexpected");
    expect((await turnstileConfigCheck({ ...base, fetch: siteverify({ success: false, "error-codes": ["internal-error"] }) as unknown as typeof fetch })).outcome).toBe("siteverify_unexpected");
    expect((await turnstileConfigCheck({ ...base, fetch: siteverify({}) as unknown as typeof fetch })).outcome).toBe("siteverify_unexpected");
  });

  it("siteverify_unreachable: a network error, a timeout or non-JSON, and it never throws", async () => {
    const boom = vi.fn(async () => { throw new TypeError("network"); });
    const html = vi.fn(async () => new Response("<html>", { status: 502 }));
    expect((await turnstileConfigCheck({ ...base, fetch: boom as unknown as typeof fetch })).outcome).toBe("siteverify_unreachable");
    expect((await turnstileConfigCheck({ ...base, fetch: html as unknown as typeof fetch })).outcome).toBe("siteverify_unreachable");
  });

  it("the production flag can be forced either way", async () => {
    const never = vi.fn();
    expect((await turnstileConfigCheck({ ...base, siteKey: TEST_SITE, production: true, fetch: never as unknown as typeof fetch })).outcome).toBe("test_key_on_production");
  });
});

describe("helpers", () => {
  it("recognises Cloudflare's published test keys and not real ones", () => {
    for (const key of ["1x00000000000000000000AA", "2x00000000000000000000AB", "3x00000000000000000000FF", "1x00000000000000000000BB", "1x0000000000000000000000000000000AA", "2x0000000000000000000000000000000AA", "3x0000000000000000000000000000000AA"]) {
      expect(isTurnstileTestKey(key)).toBe(true);
    }
    expect(isTurnstileTestKey(REAL_SITE)).toBe(false);
    expect(isTurnstileTestKey(REAL_SECRET)).toBe(false);
  });

  it("treats staging, local and preview hosts as non-production", () => {
    for (const h of ["staging.sensphere.co.uk", "localhost", "127.0.0.1", "x.workers.dev", "x.vercel.app", "x.pages.dev", "a.test"]) expect(isProductionHost(h)).toBe(false);
    for (const h of ["www.sensphere.co.uk", "sensphere.co.uk"]) expect(isProductionHost(h)).toBe(true);
  });

  it("normaliseHostname keeps www", () => {
    expect(normaliseHostname("www.a.com")).not.toBe(normaliseHostname("a.com"));
  });
});
