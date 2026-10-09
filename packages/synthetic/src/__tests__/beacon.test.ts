import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRejectBeaconThrottle, sendBeacon, sendPurgeReceipt, verify, memoryReplayGuard, type ReporterOptions } from "../index";
import { KEY_A, NOW } from "./helpers";

function reporter(overrides: Partial<ReporterOptions> = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response("ok");
  });
  const options: ReporterOptions = { key: KEY_A, client: "example", fetch: fetchMock as unknown as typeof fetch, now: NOW, ...overrides };
  return { options, calls, fetchMock };
}

beforeEach(() => resetRejectBeaconThrottle());

describe("synthetic_rejected throttle", () => {
  it("sends one beacon per client, form and reason a minute, so forged traffic cannot flood", async () => {
    const { options, calls } = reporter();
    for (let i = 0; i < 20; i++) await sendBeacon(options, { form: "enquiry", code: "synthetic_rejected", reason: "bad_signature" });
    expect(calls).toHaveLength(1);
    await sendBeacon(options, { form: "enquiry", code: "synthetic_rejected", reason: "replay" });
    expect(calls).toHaveLength(2);
    await sendBeacon({ ...options, now: NOW + 61 }, { form: "enquiry", code: "synthetic_rejected", reason: "bad_signature" });
    expect(calls).toHaveLength(3);
  });
});

describe("sendBeacon", () => {
  it("posts a signed, codes-only payload that dd-checks can verify", async () => {
    const { options, calls } = reporter();
    await sendBeacon(options, { form: "enquiry", code: "hostname_mismatch" });
    expect(calls).toHaveLength(1);
    const { url, init } = calls[0]!;
    expect(url).toBe("https://checks.domandigital.co.uk/beacon");
    expect(JSON.parse(init.body as string)).toEqual({ v: 1, client: "example", form: "enquiry", code: "hostname_mismatch", ts: NOW });

    const result = await verify(
      { method: "POST", url, headers: new Headers(init.headers), body: init.body as string },
      { keys: [KEY_A], host: "checks.domandigital.co.uk", path: "/beacon", contentTypes: ["application/json"], modes: ["beacon"], replayGuard: memoryReplayGuard(), now: NOW },
    );
    expect(result.ok).toBe(true);
  });

  it("includes the reason on synthetic_rejected, and drops it without one", async () => {
    const { options, calls } = reporter();
    await sendBeacon(options, { form: "enquiry", code: "synthetic_rejected", reason: "replay" });
    expect(JSON.parse(calls[0]!.init.body as string)).toMatchObject({ code: "synthetic_rejected", reason: "replay" });
    await sendBeacon(options, { form: "enquiry", code: "synthetic_rejected" });
    await sendBeacon(options, { form: "enquiry", code: "synthetic_rejected", reason: "made-up" as never });
    expect(calls).toHaveLength(1);
  });

  it("carries nothing but codes: unknown codes and extra fields are not sent", async () => {
    const { options, calls } = reporter();
    await sendBeacon(options, { form: "enquiry", code: "someone@example.com" as never });
    await sendBeacon(options, { form: "enquiry", code: "accepted", email: "a@b.com", name: "A" } as never);
    expect(calls).toHaveLength(1);
    expect(Object.keys(JSON.parse(calls[0]!.init.body as string)).sort()).toEqual(["client", "code", "form", "ts", "v"]);
  });

  it("never throws or rejects: network error, bad key, bad endpoint, throwing waitUntil", async () => {
    const boom = vi.fn(async () => { throw new TypeError("offline"); });
    const { options } = reporter({ fetch: boom as unknown as typeof fetch });
    await expect(sendBeacon(options, { form: "enquiry", code: "accepted" })).resolves.toBeUndefined();
    await expect(sendBeacon({ ...options, key: { kid: "x", secret: "nope" } }, { form: "enquiry", code: "accepted" })).resolves.toBeUndefined();
    await expect(sendBeacon({ ...options, endpoint: "not a url" }, { form: "enquiry", code: "accepted" })).resolves.toBeUndefined();
    await expect(sendBeacon({ ...options, waitUntil: () => { throw new Error("gone"); } }, { form: "enquiry", code: "accepted" })).resolves.toBeUndefined();
    await expect(sendBeacon(options, undefined as never)).resolves.toBeUndefined();
    await expect(sendBeacon(undefined as never, { form: "enquiry", code: "accepted" })).resolves.toBeUndefined();
  });

  it("hands the send to waitUntil", async () => {
    const waitUntil = vi.fn();
    const { options } = reporter({ waitUntil });
    await sendBeacon(options, { form: "enquiry", code: "accepted" });
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(waitUntil.mock.calls[0]![0]).toBeInstanceOf(Promise);
  });
});

describe("sendPurgeReceipt", () => {
  it("posts {client, form, deleted, remaining}, signed in receipt mode", async () => {
    const { options, calls } = reporter();
    await sendPurgeReceipt(options, { form: "enquiry", deleted: 24, remaining: 0 });
    const { url, init } = calls[0]!;
    expect(url).toBe("https://checks.domandigital.co.uk/purge-receipt");
    expect(JSON.parse(init.body as string)).toEqual({ v: 1, client: "example", form: "enquiry", deleted: 24, remaining: 0, ts: NOW });
    expect(new Headers(init.headers).get("X-DD-Synth-Mode")).toBe("receipt");
  });

  it("drops invalid counts and never throws", async () => {
    const { options, calls } = reporter();
    for (const bad of [{ deleted: -1, remaining: 0 }, { deleted: 1.5, remaining: 0 }, { deleted: 0, remaining: NaN }, { deleted: "3", remaining: 0 }]) {
      await expect(sendPurgeReceipt(options, { form: "enquiry", ...bad } as never)).resolves.toBeUndefined();
    }
    expect(calls).toHaveLength(0);
    const boom = vi.fn(async () => { throw new Error("down"); });
    await expect(sendPurgeReceipt({ ...options, fetch: boom as unknown as typeof fetch }, { form: "enquiry", deleted: 1, remaining: 0 })).resolves.toBeUndefined();
    await expect(sendPurgeReceipt(options, undefined as never)).resolves.toBeUndefined();
  });
});
