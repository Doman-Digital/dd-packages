import { describe, expect, it } from "vitest";
import vectors from "../../test-vectors.json";
import { RUN_ID_PATTERN, canonicalString, generateRunId, keysFromEnv, sign } from "../index";
import { BODY, KEY_A, URL_OK } from "./helpers";
import { sha256Hex } from "../encoding";

describe("published test vectors", () => {
  for (const v of vectors.vectors) {
    it(`${v.name}: canonical string and signature`, async () => {
      expect(await sha256Hex(v.body)).toBe(v.bodySha256);
      expect(
        canonicalString({
          kid: v.kid, ts: v.ts, runId: v.runId, mode: v.mode, client: v.client, form: v.form,
          host: v.host, path: v.path, contentType: v.contentType, bodySha256: v.bodySha256,
        }),
      ).toBe(v.canonical);

      const { headers } = await sign({
        key: { kid: v.kid, secret: vectors.secret },
        url: v.url,
        contentType: v.contentType,
        body: v.body,
        client: v.client,
        form: v.form,
        mode: v.mode as "probe" | "full",
        runId: v.runId,
        now: v.ts,
      });
      expect(headers["X-DD-Synth-Sig"]).toBe(v.signature);
      expect(headers["X-DD-Synth"]).toBe("v1");
      expect(headers["X-DD-Synth-Kid"]).toBe(v.kid);
      expect(headers["X-DD-Synth-Ts"]).toBe(String(v.ts));
      expect(headers["X-DD-Synth-Run"]).toBe(v.runId);
      expect(headers["X-DD-Synth-Mode"]).toBe(v.mode);
      expect(headers["X-DD-Synth-Client"]).toBe(v.client);
      expect(headers["X-DD-Synth-Form"]).toBe(v.form);
    });
  }

  it("the canonical string has the documented twelve lines", () => {
    const lines = vectors.vectors[0]!.canonical.split("\n");
    expect(lines).toHaveLength(12);
    expect(lines[0]).toBe("DD-SYNTH-V1");
    expect(lines[7]).toBe("POST");
  });
});

describe("run ids", () => {
  it("are 16 characters of [a-z2-7]", () => {
    for (let i = 0; i < 200; i++) expect(generateRunId()).toMatch(RUN_ID_PATTERN);
  });

  it("are unique, so no client idempotency key can dedupe a synthetic run", async () => {
    const ids = new Set<string>();
    for (let i = 0; i < 20_000; i++) ids.add(generateRunId());
    expect(ids.size).toBe(20_000);

    // The same body signed twice is two different runs with two different signatures.
    const a = await sign({ key: KEY_A, url: URL_OK, contentType: "application/json", body: BODY, client: "example", form: "enquiry", mode: "probe" });
    const b = await sign({ key: KEY_A, url: URL_OK, contentType: "application/json", body: BODY, client: "example", form: "enquiry", mode: "probe" });
    expect(a.runId).not.toBe(b.runId);
    expect(a.headers["X-DD-Synth-Sig"]).not.toBe(b.headers["X-DD-Synth-Sig"]);
  });
});

describe("sign", () => {
  const base = { key: KEY_A, url: URL_OK, contentType: "application/json", body: BODY, client: "example", form: "enquiry", mode: "probe" } as const;

  it("rejects bad input instead of signing it", async () => {
    await expect(sign({ ...base, client: "Bad\nClient" })).rejects.toThrow();
    await expect(sign({ ...base, form: "" })).rejects.toThrow();
    await expect(sign({ ...base, runId: "short" })).rejects.toThrow();
    await expect(sign({ ...base, contentType: "a\nb" })).rejects.toThrow();
    await expect(sign({ ...base, key: { kid: "x", secret: "c2hvcnQ" } })).rejects.toThrow();
  });
});

describe("keysFromEnv", () => {
  it("is off without DD_SYNTHETIC_SECRET, even if _NEXT is set", () => {
    expect(keysFromEnv({})).toEqual([]);
    expect(keysFromEnv({ DD_SYNTHETIC_SECRET_NEXT: "x", DD_SYNTHETIC_KID_NEXT: "k" })).toEqual([]);
  });

  it("holds at most two keys, each with its kid", () => {
    expect(
      keysFromEnv({
        DD_SYNTHETIC_SECRET: "a", DD_SYNTHETIC_KID: "ka",
        DD_SYNTHETIC_SECRET_NEXT: "b", DD_SYNTHETIC_KID_NEXT: "kb",
      }),
    ).toEqual([{ kid: "ka", secret: "a" }, { kid: "kb", secret: "b" }]);
    expect(keysFromEnv({ DD_SYNTHETIC_SECRET: "a" })).toEqual([]);
  });
});
