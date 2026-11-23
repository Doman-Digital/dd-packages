import { CANARY_DOMAIN } from "./canary";

/**
 * A stand-in for Resend, for a client's own test runs (synthetic standard, section O2: Doman-Digital
 * services/checks/docs/synthetic-standard.md). On 22 November 2026 a booking suite sent about 16 real
 * emails a run with the client's own key and used up its 100 a day: every customer confirmation after it
 * would have failed. Pull request and deploy runs post here instead and send nothing.
 *
 * It answers where a suite looks, in the same shapes as the real services:
 *
 * - `POST /emails` as Resend does: a Bearer key, Resend's JSON body, an `Idempotency-Key` that is seen
 *   again answers with the first send's id. It refuses any recipient (to, cc, bcc, reply-to) that is not a
 *   canary address, as a receiver must (standard N3), so a test that types a real address fails here
 *   before it can mail anyone on the nightly run.
 * - `GET /emails/<id>` as Resend does: the send with its body, so a suite can check the wording and links.
 * - `GET /messages?runId=<run>` as DD Checks' canary read does (`/admin/canary/messages`): one row per
 *   kind (`s` staff, `u` submitter) with `copies` counting every arrival, so a suite reads the fake on a
 *   pull request run and the real canary on the nightly run with the same code. `authResults` is null:
 *   nothing was signed because nothing left the machine.
 *
 * `quota` makes it answer 429 `daily_quota_exceeded` after that many sends, so a site's allowance alert
 * (standard O2.4) can be tested.
 *
 * Web Fetch only, like the rest of this package: `fetch(request)` runs in a Worker (a staging Worker can
 * answer its own sends with it) or behind a few lines of node:http (README).
 */

export interface FakeEmail {
  id: string;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  replyTo: string[];
  subject: string;
  html: string | null;
  text: string | null;
  createdAt: string;
}

export interface CanaryRow {
  kind: "s" | "u";
  receivedAt: string;
  subject: string;
  sender: string;
  authResults: null;
  resendMessageId: string;
  copies: number;
}

/** Where sends are kept. In memory by default; a Worker passes one backed by its own storage. */
export interface FakeResendStore {
  idFor(idempotencyKey: string): Promise<string | null>;
  save(email: FakeEmail, idempotencyKey: string | null): Promise<void>;
  get(id: string): Promise<FakeEmail | null>;
  all(): Promise<FakeEmail[]>;
}

export function memoryStore(): FakeResendStore {
  const emails = new Map<string, FakeEmail>();
  const keys = new Map<string, string>();
  return {
    idFor: async (key) => keys.get(key) ?? null,
    save: async (email, key) => {
      emails.set(email.id, email);
      if (key) keys.set(key, email.id);
    },
    get: async (id) => emails.get(id) ?? null,
    all: async () => [...emails.values()],
  };
}

export interface FakeResendOptions {
  store?: FakeResendStore;
  /** Answer 429 daily_quota_exceeded once this many emails have been accepted. */
  quota?: number;
  now?: () => Date;
}

/** A canary address and its parts: `s-<run>@canary.domandigital.co.uk` (DD Checks C6: 4 to 40 lower-case letters and digits). */
const CANARY = new RegExp(`^([su])-([a-z0-9]{4,40})@${CANARY_DOMAIN.replace(/\./g, "\\.")}$`);
export function parseCanary(address: string): { kind: "s" | "u"; runId: string } | null {
  const m = CANARY.exec(address.trim().toLowerCase());
  return m ? { kind: m[1] as "s" | "u", runId: m[2]! } : null;
}

const list = (value: unknown): string[] | null => {
  if (value === undefined || value === null) return [];
  const items = Array.isArray(value) ? value : [value];
  return items.every((v) => typeof v === "string") ? (items as string[]) : null;
};

/** The address inside `Name <address>`, or the value itself. */
const addressOf = (value: string): string => /<([^>]+)>\s*$/.exec(value)?.[1] ?? value;

export function canaryRows(emails: FakeEmail[], runId: string): CanaryRow[] {
  const run = runId.toLowerCase();
  const rows = new Map<string, CanaryRow>();
  for (const email of emails) {
    for (const address of [...email.to, ...email.cc, ...email.bcc]) {
      const canary = parseCanary(address);
      if (!canary || canary.runId !== run) continue;
      const row = rows.get(canary.kind);
      if (row) row.copies += 1;
      else rows.set(canary.kind, { kind: canary.kind, receivedAt: email.createdAt, subject: email.subject, sender: email.from, authResults: null, resendMessageId: email.id, copies: 1 });
    }
  }
  return [...rows.values()];
}

export function fakeResend(options: FakeResendOptions = {}): { fetch(request: Request): Promise<Response>; store: FakeResendStore } {
  const store = options.store ?? memoryStore();
  const now = options.now ?? (() => new Date());
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  const error = (status: number, name: string, message: string) => json(status, { statusCode: status, name, message });

  async function send(request: Request): Promise<Response> {
    if (!/^Bearer \S+$/.test(request.headers.get("authorization") ?? "")) return error(401, "missing_api_key", "Missing API key in the authorization header");
    let body: Record<string, unknown>;
    try {
      const parsed: unknown = await request.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
      body = parsed as Record<string, unknown>;
    } catch {
      return error(422, "validation_error", "The body is not a JSON object");
    }
    const to = list(body.to), cc = list(body.cc), bcc = list(body.bcc), replyTo = list(body.reply_to ?? body.replyTo);
    if (typeof body.from !== "string" || !to?.length || !cc || !bcc || !replyTo || typeof body.subject !== "string" || !(body.html || body.text)) {
      return error(422, "validation_error", "from, to, subject and html or text are required");
    }
    const strangers = [...to, ...cc, ...bcc, ...replyTo].filter((a) => !parseCanary(addressOf(a)));
    if (strangers.length) return error(422, "validation_error", `not a canary address: tests send only to ${CANARY_DOMAIN}`);
    const key = request.headers.get("idempotency-key");
    const earlier = key ? await store.idFor(key) : null;
    if (earlier) return json(200, { id: earlier });
    if (options.quota !== undefined && (await store.all()).length >= options.quota) {
      return error(429, "daily_quota_exceeded", "You have reached your daily email sending quota.");
    }
    const email: FakeEmail = {
      id: crypto.randomUUID(),
      from: body.from,
      to: to.map(addressOf), cc: cc.map(addressOf), bcc: bcc.map(addressOf), replyTo: replyTo.map(addressOf),
      subject: body.subject,
      html: typeof body.html === "string" ? body.html : null,
      text: typeof body.text === "string" ? body.text : null,
      createdAt: now().toISOString(),
    };
    await store.save(email, key);
    return json(200, { id: email.id });
  }

  return {
    store,
    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);
      if (request.method === "POST" && url.pathname === "/emails") return send(request);
      if (request.method === "GET" && url.pathname === "/messages") {
        const runId = (url.searchParams.get("runId") ?? "").toLowerCase();
        if (!/^[a-z0-9]{4,40}$/.test(runId)) return error(400, "validation_error", "runId is 4 to 40 lower-case letters and digits");
        return json(200, { runId, messages: canaryRows(await store.all(), runId) });
      }
      const one = /^\/emails\/([^/]+)$/.exec(url.pathname);
      if (request.method === "GET" && one) {
        const email = await store.get(decodeURIComponent(one[1]!));
        if (!email) return error(404, "not_found", "Email not found");
        return json(200, { object: "email", id: email.id, from: email.from, to: email.to, cc: email.cc, bcc: email.bcc, reply_to: email.replyTo, subject: email.subject, html: email.html, text: email.text, created_at: email.createdAt, last_event: "delivered" });
      }
      return error(404, "not_found", "The requested endpoint does not exist");
    },
  };
}
