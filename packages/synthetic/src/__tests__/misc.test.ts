import { describe, expect, it } from "vitest";
import {
  canaryAddress,
  generateRunId,
  isCanaryRecipient,
  isOwnCanaryAddress,
  keysFromEnv,
  RUN_ID_PATTERN,
  scrubDeep,
  scrubHeaders,
  scrubSentryEvent,
  scrubString,
  sign,
  verify,
} from "../index";
import { BODY, config, KEY_A, NOW, signedRequest } from "./helpers";

describe("recipient lock", () => {
  it("accepts a plain address at canary.domandigital.co.uk", () => {
    for (const e of ["s-abcdefghijklmnop@canary.domandigital.co.uk", "U-X@CANARY.DOMANDIGITAL.CO.UK", "a.b+c_d-e@canary.domandigital.co.uk"]) {
      expect(isCanaryRecipient(e)).toBe(true);
    }
  });

  it("rejects everything else", () => {
    for (const e of [
      "someone@gmail.com",
      "s-x@domandigital.co.uk",
      "s-x@canary.domandigital.co.uk.evil.com",
      "s-x@evilcanary.domandigital.co.uk",
      "s-x@sub.canary.domandigital.co.uk",
      "s-x@canary.domandigital.co.uk, boss@client.com",
      "boss@client.com,s-x@canary.domandigital.co.uk",
      "Name <s-x@canary.domandigital.co.uk>",
      '"a@b.com"@canary.domandigital.co.uk',
      "a@b.com@canary.domandigital.co.uk",
      "@canary.domandigital.co.uk",
      "s-x@canary.domandigital.co.uk\nbcc: x@y.com",
      "s-x@canary.domandigital.co.uk ",
      "",
    ]) {
      expect(isCanaryRecipient(e), e).toBe(false);
    }
    for (const v of [undefined, null, 5, {}, ["s-x@canary.domandigital.co.uk"]]) expect(isCanaryRecipient(v)).toBe(false);
  });

  it("isOwnCanaryAddress binds the address to this run", async () => {
    const { input } = await signedRequest();
    const res = await verify(input, config());
    if (!res.ok) throw new Error("expected ok");
    expect(isOwnCanaryAddress(canaryAddress("s", res.context.runId), res.context)).toBe(true);
    expect(isOwnCanaryAddress(canaryAddress("u", res.context.runId).toUpperCase(), res.context)).toBe(true);
    expect(isOwnCanaryAddress(canaryAddress("s", "zzzzzzzzzzzzzzzz"), res.context)).toBe(false);
    expect(isOwnCanaryAddress("x@gmail.com", res.context)).toBe(false);
  });
});

describe("run ids are unique per run", () => {
  it("format is 16 characters of [a-z2-7]", () => {
    for (let i = 0; i < 200; i++) expect(generateRunId()).toMatch(RUN_ID_PATTERN);
  });

  it("20,000 run ids contain no duplicate", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 20_000; i++) ids.add(generateRunId());
    expect(ids.size).toBe(20_000);
  });

  it("uses every symbol of the alphabet (unbiased mask)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) for (const c of generateRunId()) seen.add(c);
    expect(seen.size).toBe(32);
  });

  it("the same fixture signed twice differs in run id, canary address and signature, so no idempotency key can dedupe it", async () => {
    const fixture = { name: "DD Synthetic Check", message: "Synthetic check. Please ignore." };
    const runs = [];
    for (let i = 0; i < 500; i++) {
      const runId = generateRunId();
      const body = JSON.stringify({ ...fixture, email: canaryAddress("u", runId) });
      const s = await sign({ key: KEY_A, mode: "full", client: "c", form: "f", url: "https://x.example/f", contentType: "application/json", body, ts: NOW });
      runs.push({ runId, body, sig: s.signature, email: canaryAddress("u", runId) });
    }
    for (const field of ["runId", "body", "sig", "email"] as const) {
      expect(new Set(runs.map((r) => r[field])).size, field).toBe(runs.length);
    }
  });

  it("a replayed run id is refused even with a fresh timestamp", async () => {
    const cfg = config();
    const a = await signedRequest({ runId: "aaaaaaaaaaaaaaaa" });
    const b = await signedRequest({ runId: "aaaaaaaaaaaaaaaa", ts: NOW + 5 });
    expect((await verify(a.input, cfg)).ok).toBe(true);
    expect(await verify(b.input, cfg)).toMatchObject({ ok: false, reason: "replay" });
  });

  it("sign() refuses a malformed run id", async () => {
    await expect(sign({ key: KEY_A, mode: "full", client: "c", form: "f", url: "https://x.example/f", contentType: "application/json", body: "", runId: "short" })).rejects.toThrow();
  });
});

describe("sign() input checks", () => {
  const ok = { key: KEY_A, mode: "probe" as const, client: "c", form: "f", url: "https://x.example/f", contentType: "application/json", body: BODY };
  it("rejects a bad secret, kid and field with a line break", async () => {
    await expect(sign({ ...ok, key: { kid: "k", secret: "AAAA" } })).rejects.toThrow(/32 bytes/);
    await expect(sign({ ...ok, key: { kid: "bad kid", secret: KEY_A.secret } })).rejects.toThrow(/key id/);
    await expect(sign({ ...ok, client: "a\nb" })).rejects.toThrow(/line breaks/);
  });

  it("signs bytes as given (Uint8Array and ArrayBuffer match the string)", async () => {
    const bytes = new TextEncoder().encode(BODY);
    const [a, b, c] = await Promise.all([
      sign({ ...ok, body: BODY, runId: "aaaaaaaaaaaaaaaa", ts: NOW }),
      sign({ ...ok, body: bytes, runId: "aaaaaaaaaaaaaaaa", ts: NOW }),
      sign({ ...ok, body: bytes.buffer as ArrayBuffer, runId: "aaaaaaaaaaaaaaaa", ts: NOW }),
    ]);
    expect(b.signature).toBe(a.signature);
    expect(c.signature).toBe(a.signature);
  });
});

describe("keysFromEnv", () => {
  it("pairs each secret with its kid, current then next", () => {
    expect(keysFromEnv({ DD_SYNTHETIC_SECRET: "a", DD_SYNTHETIC_KID: "k1", DD_SYNTHETIC_SECRET_NEXT: "b", DD_SYNTHETIC_KID_NEXT: "k2" })).toEqual([
      { kid: "k1", secret: "a" },
      { kid: "k2", secret: "b" },
    ]);
  });

  it("unset secret turns the path off; a secret without a kid is skipped", () => {
    expect(keysFromEnv({})).toEqual([]);
    expect(keysFromEnv({ DD_SYNTHETIC_SECRET: "a" })).toEqual([]);
    expect(keysFromEnv({ DD_SYNTHETIC_SECRET_NEXT: "b", DD_SYNTHETIC_KID_NEXT: "k2" })).toEqual([{ kid: "k2", secret: "b" }]);
  });
});

describe("scrubbing X-DD-Synth-* from Sentry events and logs", () => {
  const sig = "v1=" + "ab".repeat(32);

  it("scrubHeaders handles plain objects, Headers and entry arrays, any case", () => {
    const want = { "content-type": "application/json", "x-dd-synth": "[Filtered]", "X-DD-Synth-Sig": "[Filtered]" };
    expect(scrubHeaders({ "content-type": "application/json", "x-dd-synth": "v1", "X-DD-Synth-Sig": sig })).toEqual(want);
    expect(scrubHeaders(new Headers({ "content-type": "application/json", "x-dd-synth": "v1", "x-dd-synth-sig": sig }))).toEqual({
      "content-type": "application/json",
      "x-dd-synth": "[Filtered]",
      "x-dd-synth-sig": "[Filtered]",
    });
    expect(scrubHeaders([["X-DD-Synth-Run", "abcdefghijklmnop"], ["accept", "*/*"]])).toEqual({ "X-DD-Synth-Run": "[Filtered]", accept: "*/*" });
  });

  it("scrubString redacts synth headers written into text", () => {
    expect(scrubString(`curl -H "X-DD-Synth-Sig: ${sig}" -H 'x-dd-synth-run: abcdefghijklmnop' https://x`)).toBe(
      `curl -H "X-DD-Synth-Sig: [Filtered]" -H 'x-dd-synth-run: [Filtered]' https://x`,
    );
    expect(scrubString(`{"x-dd-synth-sig":"${sig}"}`)).not.toContain(sig);
    expect(scrubString("nothing to see")).toBe("nothing to see");
  });

  it("scrubSentryEvent cleans request headers, breadcrumbs, extra, message and exceptions, without mutating the input", () => {
    const event = {
      message: `failed X-DD-Synth-Sig: ${sig}`,
      request: { url: "https://x", headers: { "X-DD-Synth-Sig": sig, "X-DD-Synth-Run": "abcdefghijklmnop", Accept: "*/*" } },
      breadcrumbs: [{ category: "fetch", data: { headers: { "x-dd-synth-kid": "k" } } }],
      extra: { nested: { deep: [{ "X-DD-Synth-Ts": "1" }] } },
      exception: { values: [{ value: `bad x-dd-synth-sig=${sig}` }] },
    };
    const before = JSON.stringify(event);
    const out = scrubSentryEvent(event);
    const text = JSON.stringify(out);
    expect(text).not.toContain(sig);
    expect(text).not.toContain("abcdefghijklmnop");
    expect(text).toContain("*/*");
    expect(out.request.headers["X-DD-Synth-Sig"]).toBe("[Filtered]");
    expect(JSON.stringify(event)).toBe(before);
  });

  it("survives cycles and non-objects", () => {
    const a: Record<string, unknown> = { "x-dd-synth-sig": sig };
    a.self = a;
    const out = scrubDeep(a);
    expect(out["x-dd-synth-sig"]).toBe("[Filtered]");
    expect(out.self).toBe(out);
    expect(scrubDeep(5)).toBe(5);
    expect(scrubDeep(null)).toBe(null);
  });
});
