import type { BrowserContext } from "playwright";

/**
 * The write guard. A simulated buyer on a real site must never join the real waitlist, send a real enquiry or start a
 * real checkout, so the browser the panel drives is read-only: every request that is not a GET or a HEAD is aborted
 * before it leaves the machine, so is every request to a payment host (even a GET), every beacon and every
 * WebSocket, and every form submission is stopped in the page. Each attempt is kept, so the report and the evaluator
 * can say what the panel refused to do. Added on DOM-18298 after DOM-18242.
 */

export type BlockKind = "request" | "form" | "websocket";

export interface BlockedRequest {
  /** ISO time of the attempt. */
  at: string;
  /** The buyer's step number when it happened (0 is the page load before the first action). */
  step: number;
  kind: BlockKind;
  method: string;
  url: string;
  resourceType: string;
  /** Why: "write-method", "payment-host", "beacon", "websocket" or "form-submit". */
  reason: string;
  /** The page the attempt came from. */
  page: string;
}

/** Hosts that take payment or start a checkout: blocked even for GET, because loading one can start a session. */
export const PAYMENT_HOSTS = [
  "stripe.com",
  "stripe.network",
  "stripecdn.com",
  "paypal.com",
  "paypalobjects.com",
  "klarna.com",
  "adyen.com",
  "checkout.com",
  "squareup.com",
  "gocardless.com",
  "sumup.com",
  "worldpay.com",
];

const READ_METHODS = new Set(["GET", "HEAD"]);

export const isPaymentHost = (host: string): boolean => PAYMENT_HOSTS.some((d) => host === d || host.endsWith(`.${d}`));

/** Why a request must be blocked, or undefined when it may go ahead. Pure, so it is tested without a browser. */
export function blockReason(req: { method: string; url: string; resourceType: string }): string | undefined {
  let host = "";
  try {
    host = new URL(req.url).hostname.toLowerCase();
  } catch {
    return "unreadable-url";
  }
  if (isPaymentHost(host)) return "payment-host";
  if (req.resourceType === "ping") return "beacon";
  if (!READ_METHODS.has(req.method.toUpperCase())) return "write-method";
  return undefined;
}

/**
 * Stops form submissions in the page itself, so the buyer stays on the page instead of landing on a browser error
 * page, and reports each one through the `__panelBlocked` binding. Capture phase on the document, ahead of the site's
 * own handlers; `form.submit()` is replaced too, because it fires no submit event.
 */
export const FORM_GUARD_SCRIPT = `(() => {
  const report = (form, how) => {
    try {
      const f = form instanceof HTMLFormElement ? form : null;
      window.__panelBlocked({ action: f ? f.action : '', method: f ? (f.getAttribute('method') || 'get') : '', how });
    } catch {}
  };
  document.addEventListener('submit', (e) => { e.preventDefault(); e.stopImmediatePropagation(); report(e.target, 'submit'); }, true);
  HTMLFormElement.prototype.submit = function () { report(this, 'form.submit()'); };
})();`;

/** How many third-party (analytics) blocked attempts a session keeps in full; the rest are only counted. */
export const MAX_KEPT = 300;

export class WriteGuard {
  readonly blocked: BlockedRequest[] = [];
  /** Every attempt, including those past MAX_KEPT. */
  total = 0;
  /** The buyer's current step: set by the session runner before each action. */
  step = 0;

  constructor(private readonly origin: string) {}

  private noiseKept = 0;

  /** A form that did not send, a payment page, or a same-site write: what a person would notice and what matters. */
  private isNoticeable(b: Pick<BlockedRequest, "kind" | "reason" | "url">): boolean {
    return b.kind === "form" || b.reason === "payment-host" || (b.reason === "write-method" && safeOrigin(b.url) === this.origin);
  }

  /** The cap applies to third-party noise (analytics beacons) only: a form, payment or same-site write is always kept. */
  private add(entry: Omit<BlockedRequest, "at" | "step">): void {
    this.total++;
    if (!this.isNoticeable(entry)) {
      if (this.noiseKept >= MAX_KEPT) return;
      this.noiseKept++;
    }
    this.blocked.push({ at: new Date().toISOString(), step: this.step, ...entry });
  }

  /**
   * Attempts since `from` (an index into `blocked`) that a person would notice. Background analytics beacons are left
   * out, so the buyer is not told about those on every step.
   */
  noticeable(from: number): BlockedRequest[] {
    return this.blocked.slice(from).filter((b) => this.isNoticeable(b));
  }

  /** What the buyer is told after an action that tripped the guard, so a blocked send is not read as a fault in the site. */
  note(from: number): string {
    const hit = this.noticeable(from);
    if (!hit.length) return "";
    return `\n(The panel is read-only on this live site, so it did not send ${hit.length === 1 ? "that" : "those"}: ${[...new Set(hit.map((b) => (b.kind === "form" ? "a form" : b.reason === "payment-host" ? "a payment page" : "a request")))].join(", ")}. What would happen after sending is unknown: do not note it as a problem.)`;
  }

  async install(context: BrowserContext): Promise<void> {
    await context.exposeBinding("__panelBlocked", (source, info: { action?: string; method?: string; how?: string }) => {
      this.add({
        kind: "form",
        method: (info?.method || "get").toUpperCase(),
        url: info?.action || "",
        resourceType: "form",
        reason: "form-submit",
        page: source.page.url(),
      });
    });
    await context.addInitScript(FORM_GUARD_SCRIPT);
    await context.route("**/*", async (route) => {
      const req = route.request();
      const reason = blockReason({ method: req.method(), url: req.url(), resourceType: req.resourceType() });
      if (!reason) return route.continue().catch(() => undefined);
      this.add({ kind: "request", method: req.method(), url: req.url(), resourceType: req.resourceType(), reason, page: req.frame().page()?.url() ?? "" });
      return route.abort("blockedbyclient").catch(() => undefined);
    });
    // A WebSocket can carry writes and is not seen by route(): close every one the page opens.
    await context.routeWebSocket(/.*/, (ws) => {
      this.add({ kind: "websocket", method: "WS", url: ws.url(), resourceType: "websocket", reason: "websocket", page: "" });
      void ws.close();
    });
  }
}

function safeOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}
