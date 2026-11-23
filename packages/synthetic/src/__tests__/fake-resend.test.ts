import { describe, expect, it } from "vitest";
import { fakeResend } from "../fake-resend";

const BASE = "http://fake.test";
const send = (resend: ReturnType<typeof fakeResend>, body: unknown, headers: Record<string, string> = {}) =>
  resend.fetch(new Request(`${BASE}/emails`, { method: "POST", headers: { authorization: "Bearer re_test", "content-type": "application/json", ...headers }, body: JSON.stringify(body) }));
const get = (resend: ReturnType<typeof fakeResend>, path: string) => resend.fetch(new Request(`${BASE}${path}`));
const booking = (to: string) => ({ from: "Shop <bookings@shop.example>", to: [to], subject: "Your booking is confirmed", html: "<p>See you Tuesday</p>", text: "See you Tuesday" });

describe("fakeResend", () => {
  it("accepts a send to a canary address and reads it back as Resend and the canary inbox do", async () => {
    const resend = fakeResend({ now: () => new Date("2026-11-23T10:00:00Z") });
    const res = await send(resend, booking("u-run1234@canary.domandigital.co.uk"));
    expect(res.status).toBe(200);
    const { id } = (await res.json()) as { id: string };
    const one = (await (await get(resend, `/emails/${id}`)).json()) as Record<string, unknown>;
    expect(one).toMatchObject({ id, subject: "Your booking is confirmed", text: "See you Tuesday", to: ["u-run1234@canary.domandigital.co.uk"], last_event: "delivered" });
    const inbox = (await (await get(resend, "/messages?runId=run1234")).json()) as { runId: string; messages: unknown[] };
    expect(inbox).toEqual({ runId: "run1234", messages: [{ kind: "u", receivedAt: "2026-11-23T10:00:00.000Z", subject: "Your booking is confirmed", sender: "Shop <bookings@shop.example>", authResults: null, resendMessageId: id, copies: 1 }] });
  });

  it("counts a second send as a second copy, and an Idempotency-Key seen before as none", async () => {
    const resend = fakeResend();
    const to = "s-run1234@canary.domandigital.co.uk";
    const first = (await (await send(resend, booking(to), { "idempotency-key": "booking-1" })).json()) as { id: string };
    const again = (await (await send(resend, booking(to), { "idempotency-key": "booking-1" })).json()) as { id: string };
    expect(again.id).toBe(first.id);
    const once = (await (await get(resend, "/messages?runId=run1234")).json()) as { messages: { copies: number }[] };
    expect(once.messages[0]!.copies).toBe(1);
    await send(resend, booking(to));
    const twice = (await (await get(resend, "/messages?runId=run1234")).json()) as { messages: { copies: number }[] };
    expect(twice.messages[0]!.copies).toBe(2);
  });

  it("refuses an address that is not a canary's, in any field, and a send with no key", async () => {
    const resend = fakeResend();
    expect((await send(resend, booking("owner@shop.example"))).status).toBe(422);
    expect((await send(resend, { ...booking("u-run1234@canary.domandigital.co.uk"), bcc: "owner@shop.example" })).status).toBe(422);
    expect((await send(resend, { ...booking("u-run1234@canary.domandigital.co.uk"), reply_to: "Owner <owner@shop.example>" })).status).toBe(422);
    const keyless = await resend.fetch(new Request(`${BASE}/emails`, { method: "POST", body: JSON.stringify(booking("u-run1234@canary.domandigital.co.uk")) }));
    expect(keyless.status).toBe(401);
    expect(await resend.store.all()).toEqual([]);
  });

  it("answers daily_quota_exceeded past its quota, as Resend does when the allowance is used up", async () => {
    const resend = fakeResend({ quota: 1 });
    expect((await send(resend, booking("u-run1234@canary.domandigital.co.uk"))).status).toBe(200);
    const over = await send(resend, booking("u-run1234@canary.domandigital.co.uk"));
    expect(over.status).toBe(429);
    expect(((await over.json()) as { name: string }).name).toBe("daily_quota_exceeded");
  });

  it("answers an empty inbox with an empty list and a bad run id with 400, as DD Checks does", async () => {
    const resend = fakeResend();
    expect(await (await get(resend, "/messages?runId=nothing1")).json()).toEqual({ runId: "nothing1", messages: [] });
    expect((await get(resend, "/messages?runId=a")).status).toBe(400);
    expect((await get(resend, "/emails/none")).status).toBe(404);
  });
});
