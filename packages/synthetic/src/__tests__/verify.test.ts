import { describe, expect, it, vi } from "vitest";
import { isSynthContext, upstashReplayGuard, verify, WINDOW_SECONDS, type VerifyResult } from "../index";
import { BODY, config, KEY_A, KEY_B, memoryGuard, NOW, signedRequest } from "./helpers";

const reason = (r: VerifyResult) => (r.ok ? "ok" : r.reason);

describe("verify", () => {
  it("accepts a signed request and returns a context", async () => {
    const { input, signed } = await signedRequest();
    const res = await verify(input, config());
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.context).toMatchObject({ v: 1, runId: signed.runId, mode: "full", client: "sensphere", form: "contact", kid: KEY_A.kid, ts: NOW });
    }
  });

  it("works with a Headers object and a URL object", async () => {
    const { input } = await signedRequest();
    const res = await verify({ ...input, url: new URL(input.url), headers: new Headers(input.headers) }, config());
    expect(res.ok).toBe(true);
  });

  describe("±120 s window", () => {
    for (const [offset, ok] of [
      [0, true],
      [WINDOW_SECONDS, true],
      [-WINDOW_SECONDS, true],
      [WINDOW_SECONDS + 1, false],
      [-(WINDOW_SECONDS + 1), false],
    ] as const) {
      it(`ts ${offset >= 0 ? "+" : ""}${offset}s from now is ${ok ? "accepted" : "expired"}`, async () => {
        const { input } = await signedRequest({ ts: NOW + offset });
        const res = await verify(input, config());
        expect(reason(res)).toBe(ok ? "ok" : "expired");
      });
    }

    it("the window is 120 seconds", () => expect(WINDOW_SECONDS).toBe(120));
  });

  describe("two keys", () => {
    it("accepts the current key", async () => {
      const { input } = await signedRequest({ key: KEY_A });
      expect(reason(await verify(input, config({ keys: [KEY_A, KEY_B] })))).toBe("ok");
    });

    it("accepts the next key", async () => {
      const { input } = await signedRequest({ key: KEY_B });
      expect(reason(await verify(input, config({ keys: [KEY_A, KEY_B] })))).toBe("ok");
    });

    it("accepts the next key alone and reports its kid", async () => {
      const { input } = await signedRequest({ key: KEY_B });
      const res = await verify(input, config({ keys: [KEY_B] }));
      expect(res.ok && res.context.kid).toBe(KEY_B.kid);
    });

    it("rejects an unknown kid", async () => {
      const { input } = await signedRequest({ key: KEY_B });
      const res = await verify(input, config({ keys: [KEY_A] }));
      expect(res).toEqual({ ok: false, reason: "unknown_kid", beacon: true });
    });

    it("never falls back to the other key when the kid names one", async () => {
      // KEY_B's kid with KEY_A's secret: the kid selects the key, so this must fail.
      const { input } = await signedRequest({ key: { kid: KEY_B.kid, secret: KEY_A.secret } });
      expect(reason(await verify(input, config({ keys: [KEY_A, KEY_B] })))).toBe("bad_signature");
    });

    it("rejects a third key as a misconfiguration", async () => {
      const { input } = await signedRequest();
      const third = { kid: "third", secret: KEY_A.secret };
      expect(reason(await verify(input, config({ keys: [KEY_A, KEY_B, third] })))).toBe("misconfigured");
    });

    it("rejects a key that is not 32 bytes", async () => {
      const { input } = await signedRequest();
      expect(reason(await verify(input, config({ keys: [{ kid: KEY_A.kid, secret: "c2hvcnQ" }] })))).toBe("misconfigured");
    });
  });

  describe("signature", () => {
    it("rejects a changed body", async () => {
      const { input } = await signedRequest();
      expect(reason(await verify({ ...input, body: BODY + " " }, config()))).toBe("bad_signature");
    });

    for (const [name, header, value] of [
      ["client", "X-DD-Synth-Client", "other"],
      ["form", "X-DD-Synth-Form", "referral"],
      ["mode", "X-DD-Synth-Mode", "probe"],
      ["run id", "X-DD-Synth-Run", "zzzzzzzzzzzzzzzz"],
      ["timestamp", "X-DD-Synth-Ts", String(NOW + 1)],
    ] as const) {
      it(`rejects a changed ${name}`, async () => {
        const { input } = await signedRequest();
        const res = await verify({ ...input, headers: { ...input.headers, [header]: value } }, config());
        expect(reason(res)).toBe("bad_signature");
      });
    }

    it("is bound to the content type exactly as sent", async () => {
      const { input } = await signedRequest();
      const res = await verify(
        { ...input, headers: { ...input.headers, "content-type": "application/json; charset=utf-8" } },
        config(),
      );
      expect(reason(res)).toBe("bad_signature");
    });

    it("rejects a signature of the wrong length or alphabet as malformed", async () => {
      const { input } = await signedRequest();
      for (const bad of ["v1=abc", "v2=" + "a".repeat(64), "v1=" + "g".repeat(64), ""]) {
        const res = await verify({ ...input, headers: { ...input.headers, "X-DD-Synth-Sig": bad } }, config());
        expect(reason(res)).toBe("malformed");
      }
    });

    it("rejects a flipped signature bit", async () => {
      const { input, signed } = await signedRequest();
      const flipped = (signed.signature[0] === "0" ? "1" : "0") + signed.signature.slice(1);
      const res = await verify({ ...input, headers: { ...input.headers, "X-DD-Synth-Sig": `v1=${flipped}` } }, config());
      expect(reason(res)).toBe("bad_signature");
    });

    it("a forged request that is also stale reports bad_signature", async () => {
      const { input } = await signedRequest({ ts: NOW - 10_000 });
      const res = await verify({ ...input, body: "tampered" }, config());
      expect(reason(res)).toBe("bad_signature");
    });
  });

  describe("replay", () => {
    it("accepts a run id once and rejects it the second time", async () => {
      const { input } = await signedRequest();
      const cfg = config();
      expect(reason(await verify(input, cfg))).toBe("ok");
      expect(await verify(input, cfg)).toEqual({ ok: false, reason: "replay", beacon: true });
    });

    it("asks the guard for a 300 s hold", async () => {
      const guard = vi.fn(async () => true);
      const { input, signed } = await signedRequest();
      await verify(input, config({ replayGuard: guard }));
      expect(guard).toHaveBeenCalledWith(signed.runId, 300);
    });

    it("fails closed when the guard throws", async () => {
      const { input } = await signedRequest();
      const res = await verify(input, config({ replayGuard: async () => { throw new Error("redis down"); } }));
      expect(reason(res)).toBe("replay_guard_error");
    });

    it("a guard is required", async () => {
      const { input } = await signedRequest();
      await expect(verify(input, config({ replayGuard: undefined as never }))).rejects.toThrow(/replayGuard is required/);
    });

    it("does not burn the run id on a request that fails earlier", async () => {
      const mem = memoryGuard();
      const { input } = await signedRequest();
      await verify({ ...input, body: "tampered" }, config({ replayGuard: mem.guard }));
      await verify({ ...input, url: "https://evil.example/api/contact" }, config({ replayGuard: mem.guard }));
      expect(mem.seen.size).toBe(0);
    });

    it("upstashReplayGuard issues SET NX EX and reads OK / null", async () => {
      const calls: string[] = [];
      let answer: string | null = "OK";
      const guard = upstashReplayGuard({
        url: "https://eu1-x.upstash.io/",
        token: "t",
        fetch: (async (u: string, init: RequestInit) => {
          calls.push(`${init.method} ${u} ${(init.headers as Record<string, string>).authorization}`);
          return new Response(JSON.stringify({ result: answer }));
        }) as typeof fetch,
      });
      expect(await guard("abcdefghijklmnop", 300)).toBe(true);
      answer = null;
      expect(await guard("abcdefghijklmnop", 300)).toBe(false);
      expect(calls[0]).toBe("POST https://eu1-x.upstash.io/set/synth:abcdefghijklmnop/1/NX/EX/300 Bearer t");
    });

    it("upstashReplayGuard throws on an HTTP error, which verify turns into a rejection", async () => {
      const guard = upstashReplayGuard({ url: "https://u.example", token: "t", fetch: (async () => new Response("no", { status: 500 })) as typeof fetch });
      const { input } = await signedRequest();
      expect(reason(await verify(input, config({ replayGuard: guard })))).toBe("replay_guard_error");
    });
  });

  describe("shape check (before the signature)", () => {
    const guardSpy = () => vi.fn(async () => true);

    for (const [name, patch] of [
      ["wrong method", { method: "GET" }],
      ["lower-case method", { method: "post" }],
      ["wrong host", { url: "https://sensphere.co.uk/api/contact" }],
      ["wrong path", { url: "https://staging.sensphere.co.uk/api/other" }],
      ["path with a trailing slash", { url: "https://staging.sensphere.co.uk/api/contact/" }],
      ["unlisted content type", { headers: { "content-type": "text/plain" } }],
      ["missing content type", { headers: {} }],
    ] as const) {
      it(`${name} is rejected as shape even though the signature is otherwise valid`, async () => {
        const { input } = await signedRequest();
        const merged = { ...input, ...patch, headers: "headers" in patch ? { ...patch.headers, ...synthOnly(input.headers) } : input.headers };
        const res = await verify(merged, config({ replayGuard: guardSpy() }));
        expect(res).toEqual({ ok: false, reason: "shape", beacon: true });
      });
    }

    it("is checked before the key: shape wins over unknown kid", async () => {
      const { input } = await signedRequest({ key: KEY_B });
      const res = await verify({ ...input, method: "PUT" }, config({ keys: [KEY_A] }));
      expect(reason(res)).toBe("shape");
    });

    it("ignores the query string", async () => {
      const { input } = await signedRequest();
      expect(reason(await verify({ ...input, url: input.url + "?synthetic=true&x=1" }, config()))).toBe("ok");
    });

    it("accepts a host override for proxies and several allowed hosts, case-insensitively", async () => {
      const { input } = await signedRequest();
      const cfg = config({ host: ["STAGING.sensphere.co.uk", "www.sensphere.co.uk"] });
      expect(reason(await verify({ ...input, url: "https://internal.local/api/contact", host: "staging.sensphere.co.uk" }, cfg))).toBe("ok");
    });

    it("accepts a content type with parameters when the media type is listed", async () => {
      const ct = "application/json; charset=utf-8";
      const { input } = await signedRequest({ contentType: ct });
      expect(reason(await verify({ ...input, headers: { ...input.headers, "content-type": ct } }, config()))).toBe("ok");
    });
  });

  describe("not synthetic / off", () => {
    it("a request without the marker is ordinary and sends no beacon", async () => {
      const res = await verify({ method: "POST", url: "https://staging.sensphere.co.uk/api/contact", headers: { "content-type": "application/json" }, body: BODY }, config());
      expect(res).toEqual({ ok: false, reason: "not_synthetic", beacon: false });
    });

    it("a body field called synthetic is never consulted", async () => {
      const body = JSON.stringify({ synthetic: true, synth: true, "x-dd-synth": "v1" });
      const res = await verify({ method: "POST", url: "https://staging.sensphere.co.uk/api/contact?synthetic=true", headers: { "content-type": "application/json" }, body }, config());
      expect(res).toMatchObject({ ok: false, reason: "not_synthetic" });
    });

    it("no keys means the path is off, even with a marker", async () => {
      const { input } = await signedRequest();
      expect(await verify(input, config({ keys: [] }))).toEqual({ ok: false, reason: "disabled", beacon: false });
    });
  });

  describe("malformed headers", () => {
    for (const header of ["X-DD-Synth-Kid", "X-DD-Synth-Ts", "X-DD-Synth-Run", "X-DD-Synth-Mode", "X-DD-Synth-Client", "X-DD-Synth-Form", "X-DD-Synth-Sig"]) {
      it(`missing ${header}`, async () => {
        const { input } = await signedRequest();
        const headers: Record<string, string> = { ...input.headers };
        delete headers[header];
        expect(reason(await verify({ ...input, headers }, config()))).toBe("malformed");
      });
    }

    for (const [name, header, value] of [
      ["marker version", "X-DD-Synth", "v2"],
      ["mode", "X-DD-Synth-Mode", "everything"],
      ["run id alphabet", "X-DD-Synth-Run", "ABCDEFGHIJKLMNOP"],
      ["run id length", "X-DD-Synth-Run", "abc"],
      ["run id digits outside 2-7", "X-DD-Synth-Run", "abcdefghijklmno1"],
      ["timestamp", "X-DD-Synth-Ts", "12.5"],
      ["client", "X-DD-Synth-Client", "a b"],
    ] as const) {
      it(`bad ${name}`, async () => {
        const { input } = await signedRequest();
        expect(reason(await verify({ ...input, headers: { ...input.headers, [header]: value } }, config()))).toBe("malformed");
      });
    }
  });

  describe("immutable synthetic context", () => {
    it("is frozen and cannot be changed", async () => {
      const { input } = await signedRequest();
      const res = await verify(input, config());
      if (!res.ok) throw new Error("expected ok");
      const ctx = res.context as unknown as Record<string, unknown>;
      expect(Object.isFrozen(ctx)).toBe(true);
      expect(() => { ctx.mode = "probe"; }).toThrow(TypeError);
      expect(() => { ctx.runId = "x"; }).toThrow(TypeError);
      expect(() => { delete ctx.client; }).toThrow(TypeError);
      expect(() => { ctx.synthetic = false; }).toThrow(TypeError);
      expect(ctx.mode).toBe("full");
    });

    it("isSynthContext is true for a verified context and false for look-alikes", async () => {
      const { input } = await signedRequest();
      const res = await verify(input, config());
      if (!res.ok) throw new Error("expected ok");
      expect(isSynthContext(res.context)).toBe(true);
      expect(isSynthContext({ ...res.context })).toBe(false);
      expect(isSynthContext(Object.freeze({ v: 1, runId: "abcdefghijklmnop", mode: "full", client: "c", form: "f", kid: "k", ts: 1 }))).toBe(false);
      expect(isSynthContext(JSON.parse(JSON.stringify(res.context)))).toBe(false);
      expect(isSynthContext(null)).toBe(false);
      expect(isSynthContext("synthetic")).toBe(false);
    });
  });
});

function synthOnly(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).filter(([k]) => k.toLowerCase().startsWith("x-dd-synth")));
}
