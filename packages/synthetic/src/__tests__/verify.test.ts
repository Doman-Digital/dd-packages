import { describe, expect, it, vi } from "vitest";
import { memoryReplayGuard, upstashReplayGuard, verify, verifyRequest, syntheticReport } from "../index";
import { BODY, KEY_A, KEY_B, NOW, URL_OK, config, signed } from "./helpers";

describe("accepts a good request", () => {
  it("returns a frozen synthetic context", async () => {
    const { input, runId } = await signed();
    const result = await verify(input, config());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.synthetic).toEqual({ v: 1, runId, mode: "probe", client: "example", form: "enquiry", kid: KEY_A.kid });
    expect(Object.isFrozen(result.synthetic)).toBe(true);
    expect(() => {
      (result.synthetic as { mode: string }).mode = "full";
    }).toThrow(TypeError);
    expect(result.synthetic.mode).toBe("probe");
  });

  it("verifies a Request and leaves its body readable", async () => {
    const { input } = await signed();
    const request = new Request(URL_OK, { method: "POST", headers: input.headers, body: BODY });
    const result = await verifyRequest(request, config());
    expect(result.ok).toBe(true);
    expect(await request.text()).toBe(BODY);
  });

  it("accepts content-type parameters, signed as sent", async () => {
    const contentType = "multipart/form-data; boundary=----X1";
    const { input } = await signed({ contentType }, { contentType });
    expect((await verify(input, config({ contentTypes: ["multipart/form-data"] }))).ok).toBe(true);
  });
});

describe("the immutable flag", () => {
  it("ignores a synthetic field in the body or the query", async () => {
    const ordinaryHeaders = new Headers({ "content-type": "application/json" });
    for (const url of [URL_OK, `${URL_OK}?synthetic=true`]) {
      const result = await verify(
        { method: "POST", url, headers: ordinaryHeaders, body: '{"synthetic":true,"synthetic_run_id":"x"}' },
        config(),
      );
      expect(result).toMatchObject({ ok: false, rejected: false, reason: "not_synthetic" });
    }
  });

  it("builds the context only from verified headers, never from the body", async () => {
    const { input } = await signed();
    const result = await verify({ ...input, body: BODY }, config());
    expect(result.ok && Object.keys(result.synthetic).sort()).toEqual(["client", "form", "kid", "mode", "runId", "v"]);
  });

  it("report carries stages only for a verified context", async () => {
    const { input, runId } = await signed();
    const result = await verify(input, config());
    if (!result.ok) throw new Error("expected ok");
    expect(syntheticReport(result.synthetic, { turnstile: { status: "pass" }, sms: { status: "skipped" } })).toEqual({
      v: 1,
      runId,
      stages: { turnstile: { status: "pass" }, sms: { status: "skipped" } },
    });
  });
});

describe("time window", () => {
  const at = (offset: number) => signed({ now: NOW + offset });
  it.each([
    [0, true],
    [120, true],
    [-120, true],
    [121, false],
    [-121, false],
    [3600, false],
  ])("ts %i s from now -> ok=%s", async (offset, ok) => {
    const { input } = await at(offset);
    const result = await verify(input, config());
    expect(result.ok).toBe(ok);
    if (!ok) expect(result).toMatchObject({ rejected: true, reason: "stale" });
  });
});

describe("keys", () => {
  it("accepts either of two keys, by kid", async () => {
    const cfg = () => config({ keys: [KEY_A, KEY_B] });
    expect((await verify((await signed({ key: KEY_A })).input, cfg())).ok).toBe(true);
    expect((await verify((await signed({ key: KEY_B })).input, cfg())).ok).toBe(true);
  });

  it("rejects an unknown kid", async () => {
    const { input } = await signed({ key: KEY_B });
    expect(await verify(input, config({ keys: [KEY_A] }))).toMatchObject({ ok: false, rejected: true, reason: "unknown_kid" });
  });

  it("does not try the other key when the kid names one", async () => {
    // Signed with B's secret but labelled with A's kid.
    const { input } = await signed({ key: { kid: KEY_A.kid, secret: KEY_B.secret } });
    expect(await verify(input, config({ keys: [KEY_A, KEY_B] }))).toMatchObject({ reason: "bad_signature" });
  });

  it("is off with no keys: an ordinary request, not a rejection", async () => {
    const { input } = await signed();
    expect(await verify(input, config({ keys: [] }))).toMatchObject({ ok: false, rejected: false, reason: "disabled" });
  });
});

describe("signature", () => {
  it("rejects a tampered body, signature, field and key", async () => {
    expect(await verify((await signed({}, { body: BODY + " " })).input, config())).toMatchObject({ reason: "bad_signature" });
    expect(await verify((await signed({}, { headers: { "X-DD-Synth-Sig": "v1=" + "0".repeat(64) } })).input, config())).toMatchObject({ reason: "bad_signature" });
    expect(await verify((await signed({}, { headers: { "X-DD-Synth-Mode": "full" } })).input, config())).toMatchObject({ reason: "bad_signature" });
    expect(await verify((await signed({}, { headers: { "X-DD-Synth-Form": "other" } })).input, config())).toMatchObject({ reason: "bad_signature" });
    expect(await verify((await signed({ key: { kid: KEY_A.kid, secret: KEY_B.secret } })).input, config())).toMatchObject({ reason: "bad_signature" });
  });

  it.each(["", "v2=" + "a".repeat(64), "v1=ZZ", "v1=" + "A".repeat(64), "v1=" + "a".repeat(62)])("rejects malformed signature %j", async (sig) => {
    const { input } = await signed({}, { headers: { "X-DD-Synth-Sig": sig } });
    expect(await verify(input, config())).toMatchObject({ ok: false, rejected: true, reason: "malformed" });
  });

  it("rejects missing or malformed headers", async () => {
    for (const name of ["X-DD-Synth-Kid", "X-DD-Synth-Ts", "X-DD-Synth-Run", "X-DD-Synth-Mode", "X-DD-Synth-Client", "X-DD-Synth-Form", "X-DD-Synth-Sig"]) {
      const result = await verify((await signed({}, { dropHeader: name })).input, config());
      expect(result).toMatchObject({ ok: false, rejected: true });
    }
    expect(await verify((await signed({}, { headers: { "X-DD-Synth-Run": "UPPERCASE0000000" } })).input, config())).toMatchObject({ reason: "malformed" });
    expect(await verify((await signed({}, { headers: { "X-DD-Synth-Ts": "-5" } })).input, config())).toMatchObject({ reason: "malformed" });
    expect(await verify((await signed({}, { headers: { "X-DD-Synth": "v2" } })).input, config())).toMatchObject({ reason: "unsupported_version" });
  });

  it("only accepts form modes on a form handler", async () => {
    for (const mode of ["beacon", "receipt"] as const) {
      expect(await verify((await signed({ mode })).input, config())).toMatchObject({ reason: "mode" });
    }
    expect((await verify((await signed({ mode: "beacon" })).input, config({ modes: ["beacon"] }))).ok).toBe(true);
  });

  it("pins client and form when configured", async () => {
    const { input } = await signed();
    expect((await verify(input, config({ client: "example", form: "enquiry" }))).ok).toBe(true);
    expect(await verify((await signed()).input, config({ form: "newsletter" }))).toMatchObject({ reason: "bad_signature" });
  });
});

describe("shape is checked before the signature", () => {
  it("rejects the wrong method, host, path and content type", async () => {
    expect(await verify((await signed({}, { method: "GET" })).input, config())).toMatchObject({ rejected: true, reason: "shape" });
    expect(await verify((await signed({}, { url: "https://evil.example.com/api/enquiry" })).input, config())).toMatchObject({ reason: "shape" });
    expect(await verify((await signed({}, { url: "https://www.example.co.uk/api/other" })).input, config())).toMatchObject({ reason: "shape" });
    expect(await verify((await signed({}, { url: "https://www.example.co.uk:8443/api/enquiry" })).input, config())).toMatchObject({ reason: "shape" });
    expect(await verify((await signed({ contentType: "text/plain" }, { contentType: "text/plain" })).input, config())).toMatchObject({ reason: "shape" });
    expect(await verify((await signed({}, { dropHeader: "content-type" })).input, config())).toMatchObject({ reason: "shape" });
  });

  it("reports shape, not bad_signature, for a request that is wrong in both ways", async () => {
    const { input } = await signed({}, { url: "https://www.example.co.uk/api/other", headers: { "X-DD-Synth-Sig": "v1=" + "0".repeat(64) } });
    expect(await verify(input, config())).toMatchObject({ reason: "shape" });
  });

  it("does not hash the body when the shape is wrong", async () => {
    const digest = vi.spyOn(crypto.subtle, "digest");
    try {
      await verify((await signed({}, { method: "GET" })).input, config());
      // sign() hashed once while building the request; verify must not add one.
      expect(digest).toHaveBeenCalledTimes(1);
    } finally {
      digest.mockRestore();
    }
  });

  it("accepts any of several configured paths", async () => {
    const { input } = await signed();
    expect((await verify(input, config({ path: ["/api/contact", "/api/enquiry"] }))).ok).toBe(true);
  });
});

describe("replay guard", () => {
  it("rejects the same run id the second time", async () => {
    const cfg = config();
    const { input } = await signed();
    expect((await verify(input, cfg)).ok).toBe(true);
    expect(await verify(input, cfg)).toMatchObject({ ok: false, rejected: true, reason: "replay" });
  });

  it("is not burned by a forged request", async () => {
    const guard = memoryReplayGuard();
    const spy = vi.fn(guard);
    const cfg = config({ replayGuard: spy });
    const { input } = await signed({}, { headers: { "X-DD-Synth-Sig": "v1=" + "0".repeat(64) } });
    await verify(input, cfg);
    expect(spy).not.toHaveBeenCalled();
  });

  it("fails closed when the guard throws or rejects", async () => {
    const { input } = await signed();
    expect(await verify(input, config({ replayGuard: () => { throw new Error("db down"); } }))).toMatchObject({ reason: "replay_guard_unavailable" });
    expect(await verify((await signed()).input, config({ replayGuard: async () => { throw new Error("redis down"); } }))).toMatchObject({ reason: "replay_guard_unavailable" });
  });

  it("works with a database unique-constraint style guard", async () => {
    const rows = new Set<string>();
    const cfg = config({ replayGuard: (id) => (rows.has(id) ? false : (rows.add(id), true)) });
    const { input } = await signed();
    expect((await verify(input, cfg)).ok).toBe(true);
    expect((await verify(input, cfg)).ok).toBe(false);
  });
});

describe("upstashReplayGuard", () => {
  const respond = (body: unknown, ok = true) => vi.fn(async () => new Response(JSON.stringify(body), { status: ok ? 200 : 500 }));

  it("sends SET synth:<runId> NX EX 300 and reads OK as first use", async () => {
    const fetchMock = respond({ result: "OK" });
    const guard = upstashReplayGuard({ url: "https://x.upstash.io/", token: "tok", fetch: fetchMock as unknown as typeof fetch });
    expect(await guard("abcdefghijklmnop")).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://x.upstash.io");
    expect(JSON.parse(init.body as string)).toEqual(["SET", "synth:abcdefghijklmnop", "1", "NX", "EX", "300"]);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("reads a null result as already seen, and throws on an HTTP error", async () => {
    expect(await upstashReplayGuard({ url: "https://x", token: "t", fetch: respond({ result: null }) as unknown as typeof fetch })("abcdefghijklmnop")).toBe(false);
    await expect(upstashReplayGuard({ url: "https://x", token: "t", fetch: respond({}, false) as unknown as typeof fetch })("abcdefghijklmnop")).rejects.toThrow();
  });
});
