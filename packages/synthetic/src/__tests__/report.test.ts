import { describe, expect, it, vi } from "vitest";
import { sendBeacon, sendPurgeReceipt, verifyReport, type BeaconInput } from "../index";
import { KEY_A, NOW } from "./helpers";

function target(fetchImpl: (u: string, init: RequestInit) => Promise<Response>, over: Partial<BeaconInput> = {}) {
  return {
    url: "https://checks.domandigital.co.uk/beacon",
    key: KEY_A,
    client: "sensphere",
    form: "contact",
    now: () => NOW,
    fetch: fetchImpl as unknown as typeof fetch,
    ...over,
  };
}

describe("sendBeacon", () => {
  it("posts a signed, codes-only body that dd-checks can verify", async () => {
    const sent: { headers: Record<string, string>; body: string }[] = [];
    await sendBeacon({
      ...target(async (_u, init) => { sent.push({ headers: init.headers as Record<string, string>, body: String(init.body) }); return new Response("ok"); }),
      code: "synthetic_rejected",
      reason: "bad_signature",
    });
    expect(sent).toHaveLength(1);
    expect(JSON.parse(sent[0].body)).toEqual({ v: 1, kind: "beacon", client: "sensphere", form: "contact", code: "synthetic_rejected", reason: "bad_signature" });
    const res = await verifyReport(sent[0].headers, sent[0].body, [KEY_A], { now: () => NOW });
    expect(res).toMatchObject({ ok: true, kind: "beacon", client: "sensphere" });
  });

  it("a tampered body fails verification", async () => {
    const sent: { headers: Record<string, string>; body: string }[] = [];
    await sendBeacon({ ...target(async (_u, i) => { sent.push({ headers: i.headers as Record<string, string>, body: String(i.body) }); return new Response(""); }), code: "accepted" });
    const res = await verifyReport(sent[0].headers, sent[0].body.replace("accepted", "delivery_failed"), [KEY_A], { now: () => NOW });
    expect(res).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("a stale report is expired and an unknown kid is rejected", async () => {
    const sent: { headers: Record<string, string>; body: string }[] = [];
    await sendBeacon({ ...target(async (_u, i) => { sent.push({ headers: i.headers as Record<string, string>, body: String(i.body) }); return new Response(""); }), code: "accepted" });
    expect(await verifyReport(sent[0].headers, sent[0].body, [KEY_A], { now: () => NOW + 121 })).toEqual({ ok: false, reason: "expired" });
    expect(await verifyReport(sent[0].headers, sent[0].body, [{ ...KEY_A, kid: "other" }], { now: () => NOW })).toEqual({ ok: false, reason: "unknown_kid" });
  });

  it("a beacon signature cannot be replayed as a purge receipt (kind is signed)", async () => {
    const sent: { headers: Record<string, string>; body: string }[] = [];
    await sendBeacon({ ...target(async (_u, i) => { sent.push({ headers: i.headers as Record<string, string>, body: String(i.body) }); return new Response(""); }), code: "accepted" });
    const swapped = sent[0].body.replace('"kind":"beacon"', '"kind":"purge"');
    expect(await verifyReport(sent[0].headers, swapped, [KEY_A], { now: () => NOW })).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("carries no personal data: only the fixed fields", async () => {
    let body = "";
    await sendBeacon({ ...target(async (_u, i) => { body = String(i.body); return new Response(""); }), code: "accepted", email: "a@b.com", message: "hi" } as never);
    expect(Object.keys(JSON.parse(body)).sort()).toEqual(["client", "code", "form", "kind", "v"]);
  });

  describe("never throws", () => {
    it("network failure", async () => {
      await expect(sendBeacon({ ...target(async () => { throw new TypeError("fetch failed"); }), code: "accepted" })).resolves.toBeUndefined();
    });

    it("hung endpoint is abandoned after the timeout", async () => {
      const f = (_u: string, init: RequestInit) => new Promise<Response>((_r, rej) => init.signal!.addEventListener("abort", () => rej(new Error("abort"))));
      await expect(sendBeacon({ ...target(f), timeoutMs: 20, code: "accepted" })).resolves.toBeUndefined();
    });

    it("non-2xx answer and an unreadable body", async () => {
      await expect(sendBeacon({ ...target(async () => new Response("no", { status: 500 })), code: "accepted" })).resolves.toBeUndefined();
    });

    it("invalid secret, unknown code, missing reason, bad reason: sends nothing", async () => {
      const f = vi.fn(async () => new Response(""));
      await sendBeacon({ ...target(f), key: { kid: "k", secret: "short" }, code: "accepted" });
      await sendBeacon({ ...target(f), code: "pii_leak" as never });
      await sendBeacon({ ...target(f), code: "synthetic_rejected" });
      await sendBeacon({ ...target(f), code: "synthetic_rejected", reason: "because" as never });
      expect(f).not.toHaveBeenCalled();
    });

    it("garbage arguments and a throwing waitUntil", async () => {
      await expect(sendBeacon(undefined as never)).resolves.toBeUndefined();
      await expect(sendBeacon(null as never)).resolves.toBeUndefined();
      await expect(sendBeacon({ ...target(async () => new Response("")), code: "accepted", waitUntil: () => { throw new Error("boom"); } })).resolves.toBeUndefined();
    });

    it("never rejects synchronously either", () => {
      expect(() => sendBeacon(undefined as never)).not.toThrow();
      expect(() => sendPurgeReceipt(undefined as never)).not.toThrow();
    });

    it("hands the request to waitUntil so a Worker keeps it alive", async () => {
      const waited: Promise<unknown>[] = [];
      const p = sendBeacon({ ...target(async () => new Response("")), code: "accepted", waitUntil: (x) => waited.push(x) });
      expect(waited).toHaveLength(1);
      await p;
    });
  });
});

describe("sendPurgeReceipt", () => {
  it("posts {client, form, deleted, remaining} signed", async () => {
    const sent: { headers: Record<string, string>; body: string }[] = [];
    await sendPurgeReceipt({
      ...target(async (_u, i) => { sent.push({ headers: i.headers as Record<string, string>, body: String(i.body) }); return new Response(""); }),
      deleted: 12,
      remaining: 0,
    });
    expect(JSON.parse(sent[0].body)).toEqual({ v: 1, kind: "purge", client: "sensphere", form: "contact", deleted: 12, remaining: 0 });
    expect(await verifyReport(sent[0].headers, sent[0].body, [KEY_A], { now: () => NOW })).toMatchObject({ ok: true, kind: "purge", payload: { deleted: 12, remaining: 0 } });
  });

  it("never throws: network failure, bad counts, bad key", async () => {
    const f = vi.fn(async () => { throw new Error("down"); });
    await expect(sendPurgeReceipt({ ...target(f), deleted: 1, remaining: 0 })).resolves.toBeUndefined();
    const g = vi.fn(async () => new Response(""));
    await sendPurgeReceipt({ ...target(g), deleted: -1, remaining: 0 });
    await sendPurgeReceipt({ ...target(g), deleted: 1.5, remaining: 0 });
    await sendPurgeReceipt({ ...target(g), deleted: "3" as never, remaining: 0 });
    await sendPurgeReceipt({ ...target(g), key: { kid: "k", secret: "x" }, deleted: 1, remaining: 0 });
    expect(g).not.toHaveBeenCalled();
  });
});

describe("verifyReport malformed input", () => {
  it("rejects non-JSON, missing headers, wrong marker", async () => {
    expect(await verifyReport({}, "{", [KEY_A])).toEqual({ ok: false, reason: "malformed" });
    expect(await verifyReport({}, "{}", [KEY_A])).toEqual({ ok: false, reason: "malformed" });
    expect(await verifyReport({ "x-dd-synth": "v1" }, '{"kind":"beacon","client":"c","form":"f"}', [KEY_A])).toEqual({ ok: false, reason: "malformed" });
  });
});
