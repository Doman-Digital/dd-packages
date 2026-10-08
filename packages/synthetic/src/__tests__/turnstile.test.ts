import { describe, expect, it, vi } from "vitest";
import { isProductionHost, isTurnstileTestKey, normaliseHostname, turnstileConfigCheck } from "../index";

const REAL_SITE = "0x4AAAAAAABkMYinukE8nzYS";
const REAL_SECRET = "0x4AAAAAAABkMYinukE8nzYSreal0secret00000";

function siteverify(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

const base = {
  siteKey: REAL_SITE,
  secretKey: REAL_SECRET,
  expectedHostname: "sensphere.co.uk",
  publicHost: "sensphere.co.uk",
};

describe("turnstileConfigCheck: every outcome", () => {
  it("ok: good config, dummy token rejected as invalid-input-response", async () => {
    const f = siteverify({ success: false, "error-codes": ["invalid-input-response"] });
    const res = await turnstileConfigCheck({ ...base, fetch: f as never });
    expect(res).toEqual({ ok: true, outcome: "ok", errorCodes: ["invalid-input-response"] });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(String(init.body)).toContain("secret=" + REAL_SECRET);
    expect(String(init.body)).not.toContain("remoteip");
  });

  it("keys_missing: no site key", async () => {
    const f = siteverify({});
    expect(await turnstileConfigCheck({ ...base, siteKey: undefined, fetch: f as never })).toMatchObject({ ok: false, outcome: "keys_missing" });
    expect(f).not.toHaveBeenCalled();
  });

  it("keys_missing: empty secret", async () => {
    expect(await turnstileConfigCheck({ ...base, secretKey: "" })).toMatchObject({ ok: false, outcome: "keys_missing" });
  });

  it("expected_hostname_missing", async () => {
    expect(await turnstileConfigCheck({ ...base, expectedHostname: "  " })).toMatchObject({ ok: false, outcome: "expected_hostname_missing" });
    expect(await turnstileConfigCheck({ ...base, expectedHostname: undefined })).toMatchObject({ outcome: "expected_hostname_missing" });
  });

  it("hostname_mismatch: the Sensphere fault", async () => {
    const f = siteverify({});
    const res = await turnstileConfigCheck({ ...base, expectedHostname: "www.sensphere.co.uk", fetch: f as never });
    expect(res).toMatchObject({ ok: false, outcome: "hostname_mismatch" });
    expect(f).not.toHaveBeenCalled();
  });

  it("hostname is compared after normalising scheme, case, port, path and trailing dot", async () => {
    const f = siteverify({ success: false, "error-codes": ["invalid-input-response"] });
    for (const expected of ["https://SenSphere.co.uk/", "sensphere.co.uk:443", "sensphere.co.uk.", " sensphere.co.uk/contact?x=1 "]) {
      expect(await turnstileConfigCheck({ ...base, expectedHostname: expected, fetch: f as never })).toMatchObject({ outcome: "ok" });
    }
  });

  it("test_key_in_production: test site key", async () => {
    const res = await turnstileConfigCheck({ ...base, siteKey: "1x00000000000000000000AA", fetch: siteverify({}) as never });
    expect(res).toMatchObject({ ok: false, outcome: "test_key_in_production" });
  });

  it("test_key_in_production: test secret key", async () => {
    const f = siteverify({});
    const res = await turnstileConfigCheck({ ...base, secretKey: "1x0000000000000000000000000000000AA", fetch: f as never });
    expect(res).toMatchObject({ ok: false, outcome: "test_key_in_production" });
    expect(f).not.toHaveBeenCalled();
  });

  it("test_key_in_production: every published test key family", async () => {
    for (const k of ["2x00000000000000000000AB", "3x00000000000000000000FF", "2x0000000000000000000000000000000AA", "3x0000000000000000000000000000000AA"]) {
      expect(isTurnstileTestKey(k)).toBe(true);
      expect(await turnstileConfigCheck({ ...base, siteKey: k })).toMatchObject({ outcome: "test_key_in_production" });
    }
    expect(isTurnstileTestKey(REAL_SITE)).toBe(false);
    expect(isTurnstileTestKey(REAL_SECRET)).toBe(false);
  });

  it("test keys are fine on staging, and siteverify is skipped for the always-pass secret", async () => {
    const f = siteverify({ success: true });
    const res = await turnstileConfigCheck({
      siteKey: "1x00000000000000000000AA",
      secretKey: "1x0000000000000000000000000000000AA",
      expectedHostname: "staging.sensphere.co.uk",
      publicHost: "staging.sensphere.co.uk",
      fetch: f as never,
    });
    expect(res).toEqual({ ok: true, outcome: "ok" });
    expect(f).not.toHaveBeenCalled();
  });

  it("production can be forced either way", async () => {
    const stagingKeys = { ...base, publicHost: "staging.sensphere.co.uk", expectedHostname: "staging.sensphere.co.uk", siteKey: "1x00000000000000000000AA" };
    expect(await turnstileConfigCheck({ ...stagingKeys, production: true })).toMatchObject({ outcome: "test_key_in_production" });
  });

  it("invalid_input_secret: the real secret is wrong", async () => {
    const f = siteverify({ success: false, "error-codes": ["invalid-input-secret"] });
    expect(await turnstileConfigCheck({ ...base, fetch: f as never })).toEqual({ ok: false, outcome: "invalid_input_secret", errorCodes: ["invalid-input-secret"] });
  });

  it("invalid_input_secret: missing-input-secret counts too", async () => {
    const f = siteverify({ success: false, "error-codes": ["missing-input-secret"] });
    expect(await turnstileConfigCheck({ ...base, fetch: f as never })).toMatchObject({ outcome: "invalid_input_secret" });
  });

  it("unexpected_response: success true for a dummy token", async () => {
    const f = siteverify({ success: true });
    expect(await turnstileConfigCheck({ ...base, fetch: f as never })).toMatchObject({ ok: false, outcome: "unexpected_response" });
  });

  it("unexpected_response: other error code, non-JSON, non-array codes", async () => {
    expect(await turnstileConfigCheck({ ...base, fetch: siteverify({ success: false, "error-codes": ["internal-error"] }) as never })).toMatchObject({ outcome: "unexpected_response", errorCodes: ["internal-error"] });
    expect(await turnstileConfigCheck({ ...base, fetch: vi.fn(async () => new Response("<html>")) as never })).toMatchObject({ outcome: "unexpected_response" });
    expect(await turnstileConfigCheck({ ...base, fetch: siteverify({ success: false, "error-codes": "x" }) as never })).toMatchObject({ outcome: "unexpected_response" });
  });

  it("siteverify_unreachable: network error, and it never throws", async () => {
    const f = vi.fn(async () => { throw new TypeError("fetch failed"); });
    expect(await turnstileConfigCheck({ ...base, fetch: f as never })).toEqual({ ok: false, outcome: "siteverify_unreachable" });
  });

  it("siteverify_unreachable: times out", async () => {
    const f = vi.fn((_u: string, init: RequestInit) => new Promise<Response>((_res, rej) => init.signal!.addEventListener("abort", () => rej(new Error("aborted")))));
    expect(await turnstileConfigCheck({ ...base, timeoutMs: 20, fetch: f as never })).toMatchObject({ outcome: "siteverify_unreachable" });
  });

  it("does not throw on garbage input", async () => {
    await expect(turnstileConfigCheck({ siteKey: 1, secretKey: {}, expectedHostname: [], publicHost: null } as never)).resolves.toMatchObject({ ok: false });
  });
});

describe("hostname and environment helpers", () => {
  it("normaliseHostname", () => {
    expect(normaliseHostname("HTTPS://User@Example.COM:8443/a/b?c#d")).toBe("example.com");
    expect(normaliseHostname("www.example.com")).toBe("www.example.com");
  });

  it("isProductionHost", () => {
    for (const h of ["sensphere.co.uk", "www.sensphere.co.uk", "https://app.example.com/"]) expect(isProductionHost(h)).toBe(true);
    for (const h of ["localhost", "localhost:4321", "127.0.0.1", "staging.sensphere.co.uk", "preview.x.com", "x.local", "foo.test", ""]) expect(isProductionHost(h)).toBe(false);
  });
});
